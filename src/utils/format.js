/**
 * Formatting shared by the screens and the printed reports, so a number or
 * a date reads the same everywhere. Digits stay Western (0-9) as in the
 * project's paper records.
 */

export const num = (value, { decimals, fallback = '-' } = {}) => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString('en-US', decimals === undefined
    ? { maximumFractionDigits: 2 }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const pct = (value, decimals = 1) => `${num(Number(value) || 0, { decimals })}%`;

/** Units as engineers write them: m2 -> م², m3 -> م³. */
export const unit = (value) => {
  if (!value || value === '-') return '';
  return String(value)
    .replace(/م2|م٢/g, 'م²')
    .replace(/م3|م٣/g, 'م³')
    .replace(/\bm2\b/gi, 'm²')
    .replace(/\bm3\b/gi, 'm³');
};

export const qty = (value, u, opts) => {
  const n = num(value, opts);
  if (n === '-') return n;
  const suffix = unit(u);
  return suffix ? `${n} ${suffix}` : n;
};

// Arabic month and day names with Western digits, matching the paper records.
const locale = (lang) => (lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB');

export const date = (value, lang = 'ar', style = 'medium') => {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const opts = style === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : style === 'weekday'
      ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(locale(lang), opts);
};

export const time = (value, lang = 'ar') => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' });
};

/** YYYY-MM-DD for <input type="date"> and API payloads. */
export const isoDay = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

/** Iraqi dinar amounts. */
export const iqd = (value, lang = 'ar') => `${num(value, { decimals: 0 })} ${lang === 'ar' ? 'د.ع' : 'IQD'}`;

/**
 * Site records store dates as free text "DD/MM/YYYY" (sometimes "D/M/YYYY").
 * These convert between that and the YYYY-MM-DD value of <input type="date">,
 * so phones get the native date picker without changing the stored format.
 */
export const dmyToIso = (value) => {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(String(value || ''));
  if (!m) return '';
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

export const isoToDmy = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
