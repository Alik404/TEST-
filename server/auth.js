import crypto from 'crypto';

// ── Password Hashing (scrypt, Node built-in — no extra dependency) ──────────
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const PREFIX = 'scrypt';

export const isHashed = (stored) =>
  typeof stored === 'string' && stored.startsWith(PREFIX + '$');

export const hashPassword = (plain) =>
  new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(
      String(plain),
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derived) => {
        if (err) return reject(err);
        resolve(
          [PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derived.toString('hex')].join('$')
        );
      }
    );
  });

const constantTimeEquals = (a, b) => {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  // Hash both to a fixed length so length differences do not leak via an early return.
  const digestA = crypto.createHash('sha256').update(bufA).digest();
  const digestB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(digestA, digestB);
};

/**
 * Verifies a password against the stored value.
 * Returns { ok, needsUpgrade } — needsUpgrade is true when the stored value was
 * legacy plaintext, so the caller can transparently re-store it as a hash.
 */
export const verifyPassword = (plain, stored) =>
  new Promise((resolve) => {
    if (typeof stored !== 'string' || stored.length === 0) {
      return resolve({ ok: false, needsUpgrade: false });
    }

    if (!isHashed(stored)) {
      return resolve({ ok: constantTimeEquals(plain, stored), needsUpgrade: true });
    }

    const parts = stored.split('$');
    if (parts.length !== 6) return resolve({ ok: false, needsUpgrade: false });

    const [, n, r, p, salt, hex] = parts;
    crypto.scrypt(
      String(plain),
      salt,
      KEY_LEN,
      { N: Number(n), r: Number(r), p: Number(p) },
      (err, derived) => {
        if (err) return resolve({ ok: false, needsUpgrade: false });
        const expected = Buffer.from(hex, 'hex');
        const ok =
          expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
        resolve({ ok, needsUpgrade: false });
      }
    );
  });

// ── Signed Session Tokens (HMAC-SHA256, stateless) ──────────────────────────
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const resolveSecret = () => {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'FATAL: AUTH_SECRET is missing or shorter than 32 characters. ' +
        'Set it in the environment before starting the server in production.'
    );
    process.exit(1);
  }

  console.warn(
    'AUTH_SECRET not set. Generating an ephemeral development secret; ' +
      'all sessions are invalidated on every restart.'
  );
  return crypto.randomBytes(48).toString('hex');
};

const SECRET = resolveSecret();

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (input) =>
  Buffer.from(String(input).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const sign = (payloadB64) =>
  crypto
    .createHmac('sha256', SECRET)
    .update(payloadB64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const issueToken = (user) => {
  const payload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return payloadB64 + '.' + sign(payloadB64);
};

export const verifyToken = (token) => {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;

  const payloadB64 = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payloadB64);

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return null;
  }

  if (!payload || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
};

// ── Express Middleware ──────────────────────────────────────────────────────
const readToken = (req) => {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
};

export const requireAuth = (req, res, next) => {
  const payload = verifyToken(readToken(req));
  if (!payload) {
    return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية. يرجى تسجيل الدخول من جديد.' });
  }
  req.user = { id: payload.sub, name: payload.name, role: payload.role };
  next();
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
  const payload = verifyToken(readToken(req));
  if (!payload) {
    return res.status(401).json({ error: 'جلسة غير صالحة أو منتهية. يرجى تسجيل الدخول من جديد.' });
  }
  if (!allowedRoles.includes(payload.role)) {
    return res.status(403).json({ error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' });
  }
  req.user = { id: payload.sub, name: payload.name, role: payload.role };
  next();
};

/** Site engineers and the general director may edit project data. */
export const requireEditor = requireRole('admin', 'super_admin');

/** Only the general director may manage accounts. */
export const requireSuperAdmin = requireRole('super_admin');

// ── Upload Safety ───────────────────────────────────────────────────────────
const ALLOWED_UPLOADS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  // iPhone camera formats, when the browser does not convert them to JPEG.
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
  ['video/3gpp', '3gp'],
  ['audio/webm', 'webm'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/ogg', 'ogg'],
  ['audio/wav', 'wav']
]);

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB

const kindFromMime = (mime) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
};

/**
 * Parses a client-supplied data URI into a safe { buffer, extension, kind }.
 * The extension comes from our own allowlist keyed by MIME type — never from
 * the client-supplied filename — so no arbitrary extension can be written.
 * Throws an Error with an Arabic message on any rejection.
 */
export const parseUpload = (mediaData) => {
  const raw = String(mediaData || '');
  const separator = ';base64,';
  const index = raw.indexOf(separator);

  if (index === -1 || !raw.startsWith('data:')) {
    throw new Error('صيغة المرفق غير مدعومة. يرجى إعادة الرفع.');
  }

  const mime = raw.slice(5, index).split(';')[0].trim().toLowerCase();
  const extension = ALLOWED_UPLOADS.get(mime);
  const kind = kindFromMime(mime);

  if (!extension || !kind) {
    throw new Error('نوع الملف غير مسموح. المسموح: صور، فيديو، أو تسجيل صوتي.');
  }

  const base64 = raw.slice(index + separator.length);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('بيانات المرفق تالفة.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new Error('المرفق فارغ.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('حجم المرفق يتجاوز الحد المسموح (12 ميغابايت).');
  }

  return { buffer, extension, kind };
};
