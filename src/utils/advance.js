/**
 * Advance-payment calculations shared by the Advance Payments section and the
 * Executive Summary, so both always show the same figures.
 */

const filled = (v) => v !== undefined && v !== null && v !== '';

/** The form payload of a stored advance record (stored as JSON text or object). */
export const advanceData = (rec) => {
  if (!rec) return {};
  if (typeof rec.data === 'string') {
    try { return JSON.parse(rec.data || '{}'); } catch { return {}; }
  }
  return rec.data || {};
};

/** Cumulative value of completed quantities (price x quantity), before the 70% rule. */
export const cumTotal = (f) =>
  (f.quantities || []).reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseFloat(r.qty) || 0), 0);

/** 70% of the cumulative total, unless entered by hand. */
export const pct70 = (f) => (filled(f.pct_70_override) ? parseFloat(f.pct_70_override) || 0 : Math.round(cumTotal(f) * 0.7));

/** Advance now due: the 70% share minus earlier payments, unless entered by hand. */
export const dueAdvance = (f) => (filled(f.due_advance_override)
  ? parseFloat(f.due_advance_override) || 0
  : Math.max(0, pct70(f) - (parseFloat(f.previous_advances) || 0)));
