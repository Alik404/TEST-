import { dataRoot } from './config.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { dbAll, isSupabaseActive, databaseReady } from './database.js';
import { requireAuth } from './auth.js';
import { registerRecordRoutes } from './record-routes.js';
import { registerHandoverRoutes } from './handover.js';
import { auditContext } from './audit-context.js';
import { registerOperations } from './operations.js';
import { verifyLocalAttachment } from './attachments.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS: same-origin by default; extra origins via ALLOWED_ORIGINS ─────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const isOriginAllowed = (req) => {
  const origin = req.get('origin');
  // No Origin header: same-origin navigation, curl, or a native client.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // The app's own origin (frontend served by this server).
  if (origin === `${req.protocol}://${req.get('host')}`) return true;
  return process.env.NODE_ENV !== 'production';
};

app.set('trust proxy', 1); // Render terminates TLS at a proxy; keeps req.protocol accurate.

app.use((req, res, next) => {
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));

// A 12mb attachment becomes ~16mb once base64-encoded; 20mb leaves room for JSON overhead.
app.use(express.json({ limit: '20mb' }));
app.use('/api', auditContext);

// Ensure uploads directory exists
const uploadsDir = path.join(dataRoot, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Attachments are written with an allowlisted extension only (see auth.js → parseUpload).
// nosniff stops a browser from re-interpreting a stored file as an executable type.
app.use('/api/uploads', (req, res, next) => {
  const name = req.path.slice(1);
  if (verifyLocalAttachment(name, req.query.exp, req.query.sig)) return next();
  return requireAuth(req, res, next);
}, express.static(uploadsDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health Check Endpoint ───────────────────────────────────────────────────
registerRecordRoutes(app);
registerOperations(app);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database_mode: isSupabaseActive() ? 'supabase_cloud' : 'sqlite_local',
    uptime_seconds: Math.floor(process.uptime()),
    version: '2.0.0',
    revision: process.env.RENDER_GIT_COMMIT || null
  });
});

// ── 1. Authentication Endpoint ──────────────────────────────────────────────

// Returns the caller's identity as the SERVER sees it. The client uses this to
// rehydrate its session instead of trusting whatever sits in localStorage.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── 2. Fetch Dashboard Data (KPIs + Progress Table) ─────────────────────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY id ASC');
    const tasks = await dbAll(`
      SELECT t.*, c.name as category_name 
      FROM tasks t 
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.id ASC
    `);

    // Dynamic KPIs from sub_units
    const nazalatStats = await dbAll(`
      SELECT zone, status, COUNT(*) as count 
      FROM sub_units 
      GROUP BY zone, status
    `);

    let completedA = 0, completedB = 0, completedC = 0;
    nazalatStats.forEach(stat => {
      if (stat.zone === 'Zone A' && stat.status === 'منجز') completedA = stat.count;
      if (stat.zone === 'Zone B' && stat.status === 'منجز') completedB = stat.count;
      if (stat.zone === 'Zone C' && stat.status === 'منجز') completedC = stat.count;
    });

    const totalCompletedNazalat = completedA + completedB + completedC;
    const totalNazalat = 113;
    const nazalatProgressPercent = totalNazalat > 0 ? (totalCompletedNazalat / totalNazalat) * 100 : 0;

    // Marble pieces sum from sub_units and marble_distribution
    const marbleRows = await dbAll('SELECT * FROM marble_distribution');
    let computedAppliedWhite = 0;
    let computedAppliedBrown = 0;

    marbleRows.forEach(item => {
      computedAppliedWhite += (item.white_qty || 0);
      computedAppliedBrown += (item.brown_qty || 0);
    });

    const totalAppliedMarble = computedAppliedWhite + computedAppliedBrown;

    // Dynamic Marblex stats
    let marblexRows = [];
    try {
      marblexRows = await dbAll('SELECT * FROM marblex_progress');
    } catch (e) {
      console.warn('Could not fetch marblex_progress for dashboard:', e.message);
    }
    let mbxTotPieces = 0, mbxAppPieces = 0, mbxTotSteel = 0, mbxAppSteel = 0;
    marblexRows.forEach(m => {
      mbxTotPieces += Number(m.total_pieces) || 0;
      mbxAppPieces += Number(m.applied_pieces) || 0;
      mbxTotSteel += Number(m.total_steel) || 0;
      mbxAppSteel += Number(m.applied_steel) || 0;
    });
    const mbxPiecesProg = mbxTotPieces > 0 ? parseFloat(((mbxAppPieces / mbxTotPieces) * 100).toFixed(2)) : 0;
    const mbxSteelProg = mbxTotSteel > 0 ? parseFloat(((mbxAppSteel / mbxTotSteel) * 100).toFixed(2)) : 0;

    // Overall Progress Calculation
    let sumProgress = 0;
    tasks.forEach(t => {
      if (t.name === 'تطبيك النزلات (محدث تلقائياً)' && t.is_manual === 0) {
        t.progress_percent = parseFloat(nazalatProgressPercent.toFixed(2));
        t.completed_quantity = totalCompletedNazalat;
      }
      if (t.name === 'تطبيق ألواح الماربلكس (القطع)' && t.is_manual === 0) {
        if (mbxTotPieces > 0) t.total_quantity = mbxTotPieces;
        t.completed_quantity = mbxAppPieces;
        t.progress_percent = mbxPiecesProg;
      }
      if (t.name === 'تركيب ستيلات التثبيت للماربلكس' && t.is_manual === 0) {
        if (mbxTotSteel > 0) t.total_quantity = mbxTotSteel;
        t.completed_quantity = mbxAppSteel;
        t.progress_percent = mbxSteelProg;
      }
      sumProgress += (Number(t.progress_percent) || 0);
    });
    const overallProgress = tasks.length > 0 ? (sumProgress / tasks.length) : 0;

    res.json({
      categories,
      tasks,
      kpis: {
        total_marble_pieces: totalAppliedMarble > 0 ? totalAppliedMarble : 10830,
        applied_marble_pieces: totalAppliedMarble,
        applied_white_marble: Math.round(computedAppliedWhite),
        applied_brown_marble: Math.round(computedAppliedBrown),
        overall_progress_percent: parseFloat(overallProgress.toFixed(2)),
        skylight_progress_percent: 100.0,
        nazalat_total: totalNazalat,
        nazalat_completed: totalCompletedNazalat,
        nazalat_progress_percent: parseFloat(nazalatProgressPercent.toFixed(2)),
        total_marblex_pieces: mbxTotPieces,
        applied_marblex_pieces: mbxAppPieces,
        marblex_pieces_progress: mbxPiecesProg,
        total_marblex_steel: mbxTotSteel,
        applied_marblex_steel: mbxAppSteel,
        marblex_steel_progress: mbxSteelProg
      }
    });
  } catch (error) {
    console.error('Fetch dashboard error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم.' });
  }
});

// ── 3. Sub-Units (Nazalat Tracking) Endpoints ───────────────────────────────
app.get('/api/nazalat', requireAuth, async (req, res) => {
  const { zone, status } = req.query;

  let query = 'SELECT * FROM sub_units';
  const params = [];
  const conditions = [];

  if (zone) {
    conditions.push('zone = ?');
    params.push(zone);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY serial_number ASC';

  try {
    const rows = await dbAll(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch nazalat error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجلات النزلات.' });
  }
});

// ── 5. Marble Distribution Endpoints ────────────────────────────────────────
app.get('/api/marble', requireAuth, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM marble_distribution ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Fetch marble error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب توزيع المرمر.' });
  }
});

// ── Static Asset & SPA Serving ──────────────────────────────────────────────
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

registerHandoverRoutes(app);
app.use('/api', (req, res) => res.status(404).json({ error: 'المسار المطلوب غير موجود.', code: 'NOT_FOUND' }));

app.get('/*any', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Server is running. Run `npm run client` or `npm run build` for the frontend.');
  }
});

await databaseReady;

const httpServer = app.listen(Number(PORT), () => {
  console.log(`Engineering Management Server running at http://localhost:${httpServer.address().port}`);
});
