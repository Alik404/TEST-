/**
 * Daily joints progress: shared calculations for the screen and the PDF.
 *
 * A record is one work day:
 *   { id, report_date: 'YYYY-MM-DD', workers_count, notes,
 *     data: { rows: [{ type, item, count, length }], sealant_rate } }
 * A row's total is always count x length (meters); it is never stored.
 */

export const JOINT_TYPES = [
  { id: 'horizontal', label: { ar: 'الجوينات الأفقية', en: 'Horizontal joints' }, short: { ar: 'أفقية', en: 'Horizontal' }, length: 58 },
  { id: 'vertical', label: { ar: 'الجوينات العمودية', en: 'Vertical joints' }, short: { ar: 'عمودية', en: 'Vertical' }, length: 14.5 },
];

export const jointType = (id) => JOINT_TYPES.find(t => t.id === id) || JOINT_TYPES[0];

/** Work items as written on the site's paper sheets. */
export const QUICK_ITEMS = [
  'املاء صوصج',
  'فتح جوينات + حبل',
  'تنظيف كوسرة + حبل',
  'كوسرة',
  'فتح فقط',
];

const round = (n) => Math.round(n * 100) / 100;

export const rowTotal = (row) => round((Number(row?.count) || 0) * (Number(row?.length) || 0));

export const recordRows = (record) => (Array.isArray(record?.data?.rows) ? record.data.rows : []);

/** Meters per type for one day. */
export const dayTotals = (record) => {
  const out = { horizontal: 0, vertical: 0, total: 0 };
  for (const row of recordRows(record)) {
    const t = rowTotal(row);
    out[jointType(row.type).id] += t;
    out.total += t;
  }
  out.horizontal = round(out.horizontal);
  out.vertical = round(out.vertical);
  out.total = round(out.total);
  return out;
};

/** A day's rows split by type, in the order the paper sheet uses. */
export const rowsByType = (rows) =>
  JOINT_TYPES
    .map(type => ({ type, rows: rows.filter(r => jointType(r.type).id === type.id) }))
    .filter(g => g.rows.length > 0);

/**
 * Running inventory: every row up to and including `upto` (all dates when
 * omitted), summed per type + item + meters per downspout.
 */
export const cumulative = (records, upto) => {
  const map = new Map();
  for (const rec of records) {
    if (upto && rec.report_date > upto) continue;
    for (const row of recordRows(rec)) {
      const type = jointType(row.type).id;
      const length = Number(row.length) || 0;
      const key = `${type}|${String(row.item).trim()}|${length}`;
      const cur = map.get(key) || { type, item: String(row.item).trim(), length, count: 0, total: 0 };
      cur.count = round(cur.count + (Number(row.count) || 0));
      cur.total = round(cur.total + rowTotal(row));
      map.set(key, cur);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  const totals = { horizontal: 0, vertical: 0, total: 0 };
  for (const r of rows) {
    totals[r.type] = round(totals[r.type] + r.total);
    totals.total = round(totals.total + r.total);
  }
  return { rows, groups: rowsByType(rows), totals };
};

/** Records sorted oldest first (report order). */
export const byDateAsc = (records) =>
  [...records].sort((a, b) => (a.report_date === b.report_date
    ? String(a.created_at || '').localeCompare(String(b.created_at || ''))
    : a.report_date.localeCompare(b.report_date)));
