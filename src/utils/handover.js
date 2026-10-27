/**
 * Shared vocabulary of the handover notes section: note types, review
 * statuses, rejection reasons, the polishing handover register, and the
 * ordering and naming rules used on screen and in exported images.
 */
import { apiFetch, apiErrorMessage } from './api';

export const MAX_PHOTOS = 4;

/** JSON call to the handover API; throws an Error carrying the server's message. */
export const handoverRequest = async (path, options = {}, fallback = 'تعذر الاتصال بالخادم.') => {
  const res = await apiFetch(`/api/handover${path}`, options);
  if (!res.ok) {
    const error = new Error(await apiErrorMessage(res, fallback));
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export const readPref = (key, fallback = '') => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

export const writePref = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

export const NOTE_TYPES = [
  { id: 'joints',    ar: 'الحلول',   en: 'Joints' },
  { id: 'polishing', ar: 'الجلي',    en: 'Polishing' },
  { id: 'cleaning',  ar: 'التنظيف',  en: 'Cleaning' },
  { id: 'cracks',    ar: 'التشققات', en: 'Cracks' },
  { id: 'other',     ar: 'أخرى',     en: 'Other' },
];

export const noteType = (id) => NOTE_TYPES.find(t => t.id === id) || NOTE_TYPES[NOTE_TYPES.length - 1];

export const STATUSES = {
  pending:  { ar: 'بانتظار الفلترة', en: 'Awaiting review', tone: 'info' },
  approved: { ar: 'معتمدة',          en: 'Approved',        tone: 'success' },
  deferred: { ar: 'مؤجلة',           en: 'Deferred',        tone: 'warn' },
  rejected: { ar: 'مستبعدة',         en: 'Rejected',        tone: 'danger' },
};

export const REJECT_REASONS = [
  { id: 'duplicate',    ar: 'مكررة',        en: 'Duplicate' },
  { id: 'inaccurate',   ar: 'غير دقيقة',    en: 'Inaccurate' },
  { id: 'out_of_scope', ar: 'خارج النطاق',  en: 'Out of scope' },
  { id: 'resolved',     ar: 'تمت معالجتها', en: 'Already fixed' },
];

export const rejectReason = (id) => REJECT_REASONS.find(r => r.id === id);

export const RECEIPT_STATUSES = [
  { id: 'not_received', ar: 'غير مستلمة',      en: 'Not received',       tone: 'neutral' },
  { id: 'with_notes',   ar: 'مستلمة بملاحظات', en: 'Received with notes', tone: 'warn' },
  { id: 'received',     ar: 'مستلمة',          en: 'Received',           tone: 'success' },
];

export const receiptStatus = (id) => RECEIPT_STATUSES.find(s => s.id === id) || RECEIPT_STATUSES[0];

const dmyFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Baghdad', day: '2-digit', month: '2-digit', year: 'numeric',
});

/** 27/10/2026 with Western digits, in Baghdad time whatever the phone's zone. */
export const dmy = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : dmyFormat.format(d);
};

/** The text that goes out: the reviewer's wording when there is one. */
export const noteText = (note) => (note.final_text || note.description || '').trim();

/** Levels in the order of the settings list; unknown levels go last, A to Z. */
export const levelRank = (levels) => {
  const index = new Map(levels.map((l, i) => [l, i]));
  return (level) => (index.has(level) ? index.get(level) : levels.length);
};

const STATUS_ORDER = { pending: 0, approved: 1, deferred: 2, rejected: 3 };

export const sortNotes = (notes, levels) => {
  const rank = levelRank(levels);
  return [...notes].sort((a, b) =>
    rank(a.level) - rank(b.level)
    || a.level.localeCompare(b.level, 'en')
    || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || (a.approved_seq || 0) - (b.approved_seq || 0)
    || (a.deferred_seq || 0) - (b.deferred_seq || 0)
    || String(a.created_at).localeCompare(String(b.created_at)));
};

/** Notes grouped by level, in level order: [{ level, notes }]. */
export const groupByLevel = (notes, levels) => {
  const groups = new Map();
  for (const note of sortNotes(notes, levels)) {
    if (!groups.has(note.level)) groups.set(note.level, []);
    groups.get(note.level).push(note);
  }
  return [...groups].map(([level, list]) => ({ level, notes: list }));
};

/**
 * Exported file name, Latin characters only: B37-01_1.jpg, B37-D01_2.jpg.
 * A note without photos becomes one card image named B37-01.jpg.
 */
export const exportFileName = (number, photoIndex) =>
  `${String(number).replace(/[^A-Za-z0-9-]/g, '')}${photoIndex ? `_${photoIndex}` : ''}.jpg`;

export const canEditNote = (note, user, permissions) =>
  note.status === 'pending' && (permissions?.canReview || Number(note.created_by) === Number(user?.id));
