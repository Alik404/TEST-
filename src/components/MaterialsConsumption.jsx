import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, Trash2, Pencil, Copy, Printer, Plus, ArrowLeft, ArrowRight, AlertTriangle,
  FileText, Camera, X, Eye, CheckCircle2, PackageOpen, CalendarDays
} from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { num, date as fmtDate, isoDay } from '../utils/format';
import { toast } from '../utils/toast';
import { buildReport, openReport, h } from '../utils/report';
import { canEdit } from '../navigation';
import { EmptyState, Modal, Field, ConfirmDialog, LoadingBlock } from './ui';

const INITIAL_FORM_STATE = {
  date: isoDay(),
  day: 'الأحد',
  start_time: '08:00',
  end_time: '17:00',
  prepared_by: '',
  basics: {
    varnish: { pulled: '', remaining: '' },
    granite_granules: { pulled: '', remaining: '' },
    brown_paint: { pulled: '', remaining: '' },
    gray_base: { pulled: '', remaining: '' },
    putty: { pulled: '', remaining: '' },
    primer: { pulled: '', remaining: '' },
    roller: { pulled: '', remaining: '' }
  },
  basics_notes: '',
  marble: {
    zone_a: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    },
    zone_b: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    },
    zone_c: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    }
  },
  marble_notes: '',
  sealants: {
    beige_paint: { pulled: '', remaining: '' },
    white_paint: { pulled: '', remaining: '' },
    primer: { pulled: '', remaining: '' },
    tape: { pulled: '', remaining: '' },
    sponge_1cm: { pulled: '', remaining: '' },
    sponge_2cm: { pulled: '', remaining: '' },
    sponge_3cm: { pulled: '', remaining: '' }
  },
  sealants_notes: '',
  bulk: {
    cement: '',
    sand: '',
    foam: { pulled: '', remaining: '' }
  },
  bulk_notes: '',
  notes: '',
  site_images: []
};

const DAYS_OF_WEEK = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

const ZONES = ['zone_a', 'zone_b', 'zone_c'];
const ZONE_NAMES = { zone_a: 'A', zone_b: 'B', zone_c: 'C' };
const DRAFT_KEY = 'materials_consumption_draft';
const MAX_IMAGES = 6;

// Stock at or below these levels raises a low-stock alert.
const DEFAULT_THRESHOLDS = {
  varnish: 10, granite_granules: 50, brown_paint: 3, gray_base: 5, putty: 10, primer: 10, roller: 5,
  beige_paint: 10, white_paint: 100, tape: 5, sponge_1cm: 5, sponge_2cm: 5, sponge_3cm: 5,
  cement: 15, sand: 1
};

const LABELS = {
  varnish: 'وارنيش', granite_granules: 'حبيبات كرانيت', brown_paint: 'صبغ لون جوزي', gray_base: 'أساس رصاصي',
  putty: 'معجون', primer: 'برايمر', roller: 'رولة',
  beige_paint: 'صوصج بيجي', white_paint: 'صوصج أبيض', tape: 'تيب لاصق',
  sponge_1cm: 'حبل اسفنجي 1 سم', sponge_2cm: 'حبل اسفنجي 2 سم', sponge_3cm: 'حبل اسفنجي 3 سم',
  cement: 'أسمنت', sand: 'رمل'
};

const SECTION_TITLES = {
  basics: { ar: 'الماربلكس والمواد الأساسية', en: 'Marblex & basic materials' },
  marble: { ar: 'جرد المرمر حسب الزون واللون', en: 'Marble count by zone and colour' },
  sealants: { ar: 'الصوصج والمواد العازلة', en: 'Sealants & insulation' },
  bulk: { ar: 'المواد السائبة (أسمنت ورمل وفوم)', en: 'Bulk materials (cement, sand, foam)' },
};

const isItemKey = (k) => !(k === 'section_notes' || k === 'notes' || k.endsWith('_notes'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const dayFor = (iso) => DAYS_OF_WEEK.ar[new Date(`${iso}T12:00:00`).getDay()] || '';

function getLowStockItems(data) {
  const alerts = [];
  if (!data) return alerts;
  ['basics', 'sealants'].forEach(section => {
    Object.entries(data[section] || {}).forEach(([k, item]) => {
      if (!isItemKey(k) || !item) return;
      const rem = parseFloat(item.remaining);
      const thresh = DEFAULT_THRESHOLDS[k];
      if (thresh !== undefined && !Number.isNaN(rem) && rem <= thresh) {
        alerts.push({ key: `${section}-${k}`, name: LABELS[k] || k, remaining: rem, threshold: thresh });
      }
    });
  });
  if (data.bulk?.cement) {
    const c = parseFloat(data.bulk.cement);
    if (!Number.isNaN(c) && c <= DEFAULT_THRESHOLDS.cement) {
      alerts.push({ key: 'cement', name: LABELS.cement, remaining: c, threshold: DEFAULT_THRESHOLDS.cement });
    }
  }
  return alerts;
}

// Section notes may live at the top level or inside the JSON columns.
function normalizeReport(rep) {
  if (!rep) return rep;
  return {
    ...rep,
    site_images: Array.isArray(rep.site_images) ? rep.site_images : [],
    basics_notes: rep.basics_notes !== undefined ? rep.basics_notes : (rep.basics?.section_notes || rep.basics?.basics_notes || ''),
    marble_notes: rep.marble_notes !== undefined ? rep.marble_notes : (rep.marble?.section_notes || rep.marble?.marble_notes || ''),
    sealants_notes: rep.sealants_notes !== undefined ? rep.sealants_notes : (rep.sealants?.section_notes || rep.sealants?.sealants_notes || ''),
    bulk_notes: rep.bulk_notes !== undefined ? rep.bulk_notes : (rep.bulk?.section_notes || rep.bulk?.bulk_notes || '')
  };
}

// Plain-text change log between the saved report and the edited one.
function getDifferences(report, prev) {
  const lines = [];
  if (!prev) return lines;
  ['basics', 'sealants'].forEach(section => {
    Object.keys(report[section] || {}).forEach(k => {
      if (!isItemKey(k)) return;
      const oldP = prev[section]?.[k]?.pulled || '-';
      const newP = report[section]?.[k]?.pulled || '-';
      const oldR = prev[section]?.[k]?.remaining || '-';
      const newR = report[section]?.[k]?.remaining || '-';
      if (oldP !== newP || oldR !== newR) {
        lines.push(`- ${LABELS[k] || k}: مسحوب (${oldP} -> ${newP}) | متبقي (${oldR} -> ${newR})`);
      }
    });
  });
  const pairs = [
    ['الأسمنت', prev.bulk?.cement, report.bulk?.cement],
    ['الرمل', prev.bulk?.sand, report.bulk?.sand],
    ['الفوم', prev.bulk?.foam?.pulled, report.bulk?.foam?.pulled],
  ];
  pairs.forEach(([label, a, b]) => {
    if ((a || '-') !== (b || '-')) lines.push(`- ${label}: (${a || '-'} -> ${b || '-'})`);
  });
  ZONES.forEach(zone => {
    ['white', 'brown'].forEach(c => {
      const oldTotal = prev.marble?.[zone]?.[c]?.total || 0;
      const newTotal = report.marble?.[zone]?.[c]?.total || 0;
      if (oldTotal !== newTotal) {
        lines.push(`- مرمر ${c === 'white' ? 'أبيض' : 'جوزي'} (زون ${ZONE_NAMES[zone]}): السابق (${oldTotal}) -> المحدث (${newTotal})`);
      }
    });
  });
  return lines;
}

function withTotals(data) {
  const next = clone(data);
  ZONES.forEach(zone => {
    ['white', 'brown'].forEach(color => {
      const z = next.marble[zone][color];
      z.total = ((parseInt(z.skiliat, 10) || 0) * (parseInt(z.pieces_per_skilia, 10) || 0)) + (parseInt(z.loose, 10) || 0);
    });
  });
  return next;
}

function marbleTotals(data) {
  const t = { whiteSk: 0, brownSk: 0, whiteLoose: 0, brownLoose: 0, white: 0, brown: 0 };
  ZONES.forEach(zone => {
    const w = data.marble?.[zone]?.white || {};
    const b = data.marble?.[zone]?.brown || {};
    t.whiteSk += parseInt(w.skiliat, 10) || 0;
    t.brownSk += parseInt(b.skiliat, 10) || 0;
    t.whiteLoose += parseInt(w.loose, 10) || 0;
    t.brownLoose += parseInt(b.loose, 10) || 0;
    t.white += parseInt(w.total, 10) || 0;
    t.brown += parseInt(b.total, 10) || 0;
  });
  return t;
}

const readDraft = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
};
const writeDraft = (data) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
};
const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
};

export default function MaterialsConsumption({ user, t, lang }) {
  const isAr = lang === 'ar';
  const editable = canEdit(user);

  const [mode, setMode] = useState('history'); // 'history' | 'form'
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState(null);
  const [isCloned, setIsCloned] = useState(false);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await apiFetch('/api/materials-consumption');
      if (res.ok) setReports((await res.json()).map(normalizeReport));
    } catch (err) {
      console.error('Error fetching materials reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  useEffect(() => { Promise.resolve().then(fetchReports); }, []);

  // Autosave a new (not edited) report on this device while typing.
  useEffect(() => {
    if (mode !== 'form' || editingId) return undefined;
    const id = setTimeout(() => {
      writeDraft(formData);
      setDraftSaved(true);
    }, 600);
    return () => clearTimeout(id);
  }, [formData, mode, editingId]);

  const openNew = () => {
    setSubmitError('');
    setEditingId(null);
    if (reports.length > 0) {
      // A new count starts from the latest one; changes are logged on save.
      const base = normalizeReport(reports[0]);
      const today = isoDay();
      setFormData({ ...clone(base), id: undefined, created_at: undefined, date: today, day: dayFor(today) });
      setOriginal(clone(base));
      setIsCloned(true);
    } else {
      const draft = readDraft();
      if (draft) {
        setFormData({ ...draft, date: draft.date || isoDay() });
        toast.info(t('hasDraftLoaded'));
      } else {
        const today = isoDay();
        setFormData({ ...clone(INITIAL_FORM_STATE), date: today, day: dayFor(today), prepared_by: user?.name || '' });
      }
      setOriginal(null);
      setIsCloned(false);
    }
    setMode('form');
    window.scrollTo({ top: 0 });
  };

  const openEdit = (report) => {
    const norm = normalizeReport(report);
    setSubmitError('');
    setFormData(clone(norm));
    setOriginal(clone(norm));
    setEditingId(report.id);
    setIsCloned(false);
    setViewing(null);
    setMode('form');
    window.scrollTo({ top: 0 });
  };

  const openClone = (report) => {
    const norm = normalizeReport(report);
    const today = isoDay();
    setSubmitError('');
    setFormData({ ...clone(norm), id: undefined, created_at: undefined, date: today, day: dayFor(today) });
    setOriginal(clone(norm));
    setEditingId(null);
    setIsCloned(true);
    setViewing(null);
    setMode('form');
    window.scrollTo({ top: 0 });
  };

  const backToHistory = () => {
    setEditingId(null);
    setIsCloned(false);
    setMode('history');
    window.scrollTo({ top: 0 });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSubmitError('');

    const data = clone(formData);
    // Section notes are also embedded in the JSON columns so every backend keeps them.
    data.basics = { ...(data.basics || {}), section_notes: data.basics_notes || '' };
    data.marble = { ...(data.marble || {}), section_notes: data.marble_notes || '' };
    data.sealants = { ...(data.sealants || {}), section_notes: data.sealants_notes || '' };
    data.bulk = { ...(data.bulk || {}), section_notes: data.bulk_notes || '' };

    if (original) {
      const diffs = getDifferences(data, original);
      if (diffs.length > 0) {
        data.notes = `${data.notes ? `${data.notes}\n\n` : ''}--- تحديثات الاستهلاك / التعديلات (${data.date}) ---\n${diffs.join('\n')}`;
      }
    }

    try {
      const res = await apiFetch(editingId ? `/api/materials-consumption/${editingId}` : '/api/materials-consumption', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ التقرير.' : 'Could not save the report.'));
      if (!editingId) clearDraft();
      toast.success(editingId ? (isAr ? 'تم تحديث التقرير' : 'Report updated') : (isAr ? 'تم حفظ التقرير' : 'Report saved'));
      setFormData(INITIAL_FORM_STATE);
      setOriginal(null);
      backToHistory();
      fetchReports();
    } catch (err) {
      setSubmitError(err.message || (isAr ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/materials-consumption/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حذف التقرير.' : 'Could not delete the report.'));
      toast.success(isAr ? 'تم حذف التقرير' : 'Report deleted');
      setToDelete(null);
      setViewing(null);
      fetchReports();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const print = (report, section) => openReport(buildConsumptionReport(normalizeReport(report), section, t, lang), {
    title: section ? SECTION_TITLES[section][isAr ? 'ar' : 'en'] : (isAr ? 'تقرير جرد واستهلاك المواد' : 'Daily materials report'),
  });

  if (mode === 'form') {
    return (
      <ConsumptionForm
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        isCloned={isCloned}
        saving={saving}
        submitError={submitError}
        draftSaved={draftSaved}
        t={t}
        lang={lang}
        onBack={backToHistory}
        onSubmit={submit}
        onPrint={(section) => print(formData, section)}
        onClear={() => setConfirmClear(true)}
        confirmClear={confirmClear}
        onConfirmClear={() => {
          const today = isoDay();
          setFormData({ ...clone(INITIAL_FORM_STATE), date: today, day: dayFor(today), prepared_by: user?.name || '' });
          setOriginal(null);
          setIsCloned(false);
          clearDraft();
          setConfirmClear(false);
        }}
        onCancelClear={() => setConfirmClear(false)}
      />
    );
  }

  if (loading && reports.length === 0) return <LoadingBlock label={t('loading')} />;

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header card-header--divided">
          <div>
            <h2 className="card-title">{t('reportHistory')}</h2>
            <p className="card-subtitle">
              <span className="num">{reports.length}</span> {isAr ? 'تقرير جرد يومي' : 'daily counts'}
              {reports[0] && <> · {isAr ? 'آخرها' : 'latest'} {fmtDate(reports[0].date, lang)}</>}
            </p>
          </div>
          {editable && (
            <button type="button" className="btn btn--primary" onClick={openNew}>
              <Plus size={18} aria-hidden="true" />
              {isAr ? 'جرد جديد' : 'New count'}
            </button>
          )}
        </div>

        {reports.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={t('noReportsYet')}
            text={isAr ? 'سجّل جرد اليوم الأول لبدء متابعة الاستهلاك والأرصدة.' : 'Record the first daily count to start tracking stock.'}
            action={editable && (
              <button type="button" className="btn btn--primary" onClick={openNew}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'جرد جديد' : 'New count'}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="dt dt--stack dt--stack3">
              <thead>
                <tr>
                  <th>{t('materialsReportDate')}</th>
                  <th>{t('materialsReportDay')}</th>
                  <th>{isAr ? 'الوقت' : 'Time'}</th>
                  <th>{t('materialsReportPreparedBy')}</th>
                  <th className="c-num">{isAr ? 'رصيد المرمر' : 'Marble stock'}</th>
                  <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => {
                  const tot = marbleTotals(report);
                  const lows = getLowStockItems(report).length;
                  return (
                    <tr key={report.id} data-clickable="true" onClick={() => setViewing(report)}>
                      <td className="c-title">
                        <span className="task-name">
                          <span className="num">{report.date}</span>
                          {lows > 0 && <span className="badge badge--warn"><AlertTriangle size={12} aria-hidden="true" />{isAr ? `${lows} منخفض` : `${lows} low`}</span>}
                        </span>
                      </td>
                      <td data-label={t('materialsReportDay')}>{report.day}</td>
                      <td data-label={isAr ? 'الوقت' : 'Time'}><span className="num">{report.start_time} - {report.end_time}</span></td>
                      <td data-label={t('materialsReportPreparedBy')}>{report.prepared_by || '-'}</td>
                      <td className="c-num" data-label={isAr ? 'رصيد المرمر' : 'Marble stock'}>
                        <span className="num">{num(tot.white + tot.brown)}</span>
                        <span className="text-xs muted"> ({isAr ? 'أ' : 'W'} <span className="num">{num(tot.white)}</span> · {isAr ? 'ج' : 'B'} <span className="num">{num(tot.brown)}</span>)</span>
                      </td>
                      <td className="c-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="btn-row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setViewing(report)}>
                            <Eye size={15} aria-hidden="true" />
                            {isAr ? 'عرض' : 'View'}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => print(report)} aria-label={isAr ? `طباعة تقرير ${report.date}` : `Print report ${report.date}`} title="PDF">
                            <Printer size={15} aria-hidden="true" />
                          </button>
                          {editable && (
                            <>
                              <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openClone(report)} aria-label={isAr ? 'نسخ كتقرير جديد' : 'Copy as new report'} title={isAr ? 'نسخ كتقرير جديد' : 'Copy as new'}>
                                <Copy size={15} aria-hidden="true" />
                              </button>
                              <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openEdit(report)} aria-label={isAr ? `تعديل تقرير ${report.date}` : `Edit report ${report.date}`} title={isAr ? 'تعديل' : 'Edit'}>
                                <Pencil size={15} aria-hidden="true" />
                              </button>
                              <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => setToDelete(report)} aria-label={isAr ? `حذف تقرير ${report.date}` : `Delete report ${report.date}`} title={isAr ? 'حذف' : 'Delete'}>
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReportDetail
        report={viewing}
        t={t}
        lang={lang}
        editable={editable}
        onClose={() => setViewing(null)}
        onPrint={print}
        onEdit={openEdit}
        onClone={openClone}
        onDelete={(r) => setToDelete(r)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف تقرير الجرد' : 'Delete report'}
        message={isAr ? `سيُحذف تقرير يوم ${toDelete?.date || ''} نهائياً.` : `The report for ${toDelete?.date || ''} will be deleted permanently.`}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

// ── Read-only detail of one report ────────────────────────────────────────

function ItemsList({ items, t, lang }) {
  const rows = Object.entries(items || {}).filter(([k, v]) => isItemKey(k) && v && typeof v === 'object');
  return (
    <div className="mat-rows">
      <div className="mat-row mat-row--head" aria-hidden="true">
        <span />
        <span>{t('materialPulled')}</span>
        <span>{t('materialRemaining')}</span>
      </div>
      {rows.map(([k, v]) => {
        const thresh = DEFAULT_THRESHOLDS[k];
        const rem = parseFloat(v.remaining);
        const low = thresh !== undefined && !Number.isNaN(rem) && rem <= thresh;
        return (
          <div className="mat-row" key={k}>
            <span className="mat-name">{t(k)}{low && <span className="badge badge--warn">{lang === 'ar' ? 'منخفض' : 'Low'}</span>}</span>
            <span className="num">{v.pulled || '0'}</span>
            <span className={`num${low ? ' text-warn fw-bold' : ''}`}>{v.remaining || '0'}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReportDetail({ report, t, lang, editable, onClose, onPrint, onEdit, onClone, onDelete }) {
  const isAr = lang === 'ar';
  if (!report) return null;
  const tot = marbleTotals(report);
  const sectionHead = (key) => (
    <div className="form-section-title">
      <span>{SECTION_TITLES[key][isAr ? 'ar' : 'en']}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPrint(report, key)}>
        <Printer size={15} aria-hidden="true" />
        PDF
      </button>
    </div>
  );
  return (
    <Modal
      open={Boolean(report)}
      onClose={onClose}
      size="xl"
      title={`${isAr ? 'جرد يوم' : 'Count for'} ${report.day || ''} ${report.date}`}
      description={`${report.start_time || '-'} - ${report.end_time || '-'} · ${report.prepared_by || '-'}`}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          {editable && (
            <button type="button" className="btn btn--danger-ghost" onClick={() => onDelete(report)} style={{ marginInlineEnd: 'auto' }}>
              <Trash2 size={17} aria-hidden="true" />
              {isAr ? 'حذف' : 'Delete'}
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn--secondary" onClick={() => onClone(report)}>
              <Copy size={17} aria-hidden="true" />
              {isAr ? 'نسخ' : 'Copy'}
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn--secondary" onClick={() => onEdit(report)}>
              <Pencil size={17} aria-hidden="true" />
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => onPrint(report)}>
            <Printer size={17} aria-hidden="true" />
            {isAr ? 'التقرير الكامل PDF' : 'Full report PDF'}
          </button>
        </>
      }
    >
      <div className="stack">
        <section className="form-section">
          {sectionHead('basics')}
          <ItemsList items={report.basics} t={t} lang={lang} />
          {report.basics_notes && <p className="note-block">{report.basics_notes}</p>}
        </section>

        <section className="form-section">
          {sectionHead('marble')}
          <div className="table-wrap">
            <table className="dt dt--dense">
              <thead>
                <tr>
                  <th>{t('colZoneName')}</th>
                  <th className="c-num">{t('skiliatCount')}</th>
                  <th className="c-num">{t('piecesPerSkilia')}</th>
                  <th className="c-num">{t('loosePieces')}</th>
                  <th className="c-num">{t('totalPieces')}</th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map(zone => ['white', 'brown'].map(color => {
                  const d = report.marble?.[zone]?.[color] || {};
                  return (
                    <tr key={`${zone}-${color}`}>
                      <td>{isAr ? 'زون' : 'Zone'} {ZONE_NAMES[zone]} · {color === 'white' ? t('marbleWhiteTitle') : t('marbleBrownTitle')}</td>
                      <td className="c-num">{d.skiliat || 0}</td>
                      <td className="c-num">{d.pieces_per_skilia || 198}</td>
                      <td className="c-num">{d.loose || 0}</td>
                      <td className="c-num c-strong">{num(d.total || 0)}</td>
                    </tr>
                  );
                }))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{isAr ? 'المجموع' : 'Total'}</td>
                  <td className="c-num">{tot.whiteSk + tot.brownSk}</td>
                  <td className="c-num">-</td>
                  <td className="c-num">{tot.whiteLoose + tot.brownLoose}</td>
                  <td className="c-num">{num(tot.white + tot.brown)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {report.marble_notes && <p className="note-block">{report.marble_notes}</p>}
        </section>

        <section className="form-section">
          {sectionHead('sealants')}
          <ItemsList items={report.sealants} t={t} lang={lang} />
          {report.sealants_notes && <p className="note-block">{report.sealants_notes}</p>}
        </section>

        <section className="form-section">
          {sectionHead('bulk')}
          <div className="kv kv--3">
            <div className="kv-item"><div className="kv-label">{t('cementQty')}</div><div className="kv-value kv-value--lg">{report.bulk?.cement || '0'}</div></div>
            <div className="kv-item"><div className="kv-label">{t('sandQty')}</div><div className="kv-value kv-value--lg">{report.bulk?.sand || '0'}</div></div>
            <div className="kv-item"><div className="kv-label">{t('foam')}</div><div className="kv-value kv-value--lg num">{report.bulk?.foam?.pulled || '0'} / {report.bulk?.foam?.remaining || '0'}</div></div>
          </div>
          {report.bulk_notes && <p className="note-block">{report.bulk_notes}</p>}
        </section>

        {report.notes && (
          <section className="form-section">
            <div className="form-section-title">{isAr ? 'ملاحظات عامة وسجل التعديلات' : 'General notes & change log'}</div>
            <p className="note-block">{report.notes}</p>
          </section>
        )}

        {report.site_images?.length > 0 && (
          <section className="form-section">
            <div className="form-section-title">{isAr ? 'صور الموقع' : 'Site photos'}</div>
            <div className="photo-grid">
              {report.site_images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="photo">
                  <img src={src} alt={`${isAr ? 'صورة' : 'Photo'} ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

// ── Entry form ────────────────────────────────────────────────────────────

function ConsumptionForm({
  formData, setFormData, editingId, isCloned, saving, submitError, draftSaved, t, lang,
  onBack, onSubmit, onPrint, onClear, confirmClear, onConfirmClear, onCancelClear,
}) {
  const isAr = lang === 'ar';
  const fileRef = useRef(null);
  const lows = useMemo(() => getLowStockItems(formData), [formData]);
  const tot = marbleTotals(formData);
  const Back = isAr ? ArrowRight : ArrowLeft;

  const setTop = (key, value) => setFormData(prev => {
    const next = { ...prev, [key]: value };
    if (key === 'date' && value) next.day = dayFor(value);
    return next;
  });
  const setItem = (section, item, field, value) => setFormData(prev => {
    const next = clone(prev);
    next[section][item][field] = value;
    return next;
  });
  const setBulk = (item, field, value) => setFormData(prev => {
    const next = clone(prev);
    if (item === 'foam') next.bulk.foam[field] = value;
    else next.bulk[item] = value;
    return next;
  });
  const setMarble = (zone, color, field, value) => setFormData(prev => {
    const next = clone(prev);
    next.marble[zone][color][field] = value;
    return withTotals(next);
  });

  const addImages = (event) => {
    const files = Array.from(event.target.files || []).filter(f => f.type.startsWith('image/'));
    event.target.value = '';
    const room = MAX_IMAGES - (formData.site_images?.length || 0);
    if (room <= 0) {
      toast.error(isAr ? `الحد الأقصى ${MAX_IMAGES} صور.` : `Maximum ${MAX_IMAGES} photos.`);
      return;
    }
    files.slice(0, room).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Downscale to 800px and JPEG 65% so reports stay light.
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
            else { width = Math.round((width * maxDim) / height); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          setFormData(prev => {
            const current = Array.isArray(prev.site_images) ? prev.site_images : [];
            if (current.length >= MAX_IMAGES) return prev;
            return { ...prev, site_images: [...current, dataUrl] };
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => setFormData(prev => ({
    ...prev,
    site_images: (prev.site_images || []).filter((_, i) => i !== index),
  }));

  const title = editingId
    ? (isAr ? 'تعديل تقرير الجرد' : 'Edit count')
    : isCloned ? (isAr ? 'جرد جديد (منسوخ من آخر جرد)' : 'New count (copied from latest)') : (isAr ? 'جرد جديد' : 'New count');

  const jump = [
    ['mc-general', isAr ? 'البيانات' : 'Details'],
    ['mc-basics', isAr ? 'الأساسية' : 'Basics'],
    ['mc-marble', isAr ? 'المرمر' : 'Marble'],
    ['mc-sealants', isAr ? 'العوازل' : 'Sealants'],
    ['mc-bulk', isAr ? 'السائبة' : 'Bulk'],
    ['mc-photos', isAr ? 'الصور' : 'Photos'],
  ];

  const itemRows = (section) => (
    <div className="mat-rows">
      <div className="mat-row mat-row--head" aria-hidden="true">
        <span />
        <span>{t('materialPulled')}</span>
        <span>{t('materialRemaining')}</span>
      </div>
      {Object.keys(formData[section] || {}).filter(isItemKey).map(item => {
        const label = t(item);
        return (
          <div className="mat-row" key={item}>
            <label className="mat-name" htmlFor={`${section}-${item}-p`}>{label}</label>
            <input id={`${section}-${item}-p`} className="input input--sm input--num" value={formData[section][item]?.pulled ?? ''}
              onChange={(e) => setItem(section, item, 'pulled', e.target.value)} aria-label={`${label}: ${t('materialPulled')}`} inputMode="decimal" />
            <input className="input input--sm input--num" value={formData[section][item]?.remaining ?? ''}
              onChange={(e) => setItem(section, item, 'remaining', e.target.value)} aria-label={`${label}: ${t('materialRemaining')}`} inputMode="decimal" />
          </div>
        );
      })}
    </div>
  );

  const sectionCard = (id, key, index, body, notesKey) => (
    <section className="card" id={id} aria-labelledby={`${id}-t`}>
      <div className="card-header card-header--divided">
        <h2 className="card-title" id={`${id}-t`}>
          <span className="step-index">{index}</span>
          {SECTION_TITLES[key][isAr ? 'ar' : 'en']}
        </h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPrint(key)}>
          <Printer size={15} aria-hidden="true" />
          {isAr ? 'طباعة القسم' : 'Print section'}
        </button>
      </div>
      <div className="card-body stack-sm">
        {body}
        <Field label={isAr ? 'ملاحظات القسم' : 'Section notes'} htmlFor={`${id}-notes`}>
          <textarea id={`${id}-notes`} className="textarea" rows={2} value={formData[notesKey] || ''} onChange={(e) => setTop(notesKey, e.target.value)} />
        </Field>
      </div>
    </section>
  );

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="form-head">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <Back size={18} aria-hidden="true" />
          {t('backToHistory')}
        </button>
        <h2 className="form-head-title">{title}</h2>
        {!editingId && draftSaved && (
          <span className="text-xs muted form-head-status"><CheckCircle2 size={14} aria-hidden="true" /> {t('autoSaveDraft')}</span>
        )}
      </div>

      <nav className="chips" aria-label={isAr ? 'أقسام النموذج' : 'Form sections'}>
        {jump.map(([id, label]) => (
          <a key={id} className="chip" href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            {label}
          </a>
        ))}
      </nav>

      {submitError && (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="alert-body">{submitError}</div>
        </div>
      )}

      <section className="card" id="mc-general" aria-labelledby="mc-general-t">
        <div className="card-header card-header--divided">
          <h2 className="card-title" id="mc-general-t"><CalendarDays size={20} aria-hidden="true" />{isAr ? 'بيانات الجرد' : 'Count details'}</h2>
        </div>
        <div className="card-body">
          <div className="form-grid form-grid--4">
            <Field label={t('materialsReportDate')} htmlFor="mc-date">
              <input id="mc-date" type="date" className="input" value={formData.date} onChange={(e) => setTop('date', e.target.value)} required />
            </Field>
            <Field label={t('materialsReportDay')} htmlFor="mc-day">
              <select id="mc-day" className="select" value={formData.day} onChange={(e) => setTop('day', e.target.value)}>
                {DAYS_OF_WEEK.ar.map((d, i) => <option key={d} value={d}>{isAr ? d : DAYS_OF_WEEK.en[i]}</option>)}
              </select>
            </Field>
            <Field label={t('materialsReportStartTime')} htmlFor="mc-start">
              <input id="mc-start" type="time" className="input" value={formData.start_time} onChange={(e) => setTop('start_time', e.target.value)} />
            </Field>
            <Field label={t('materialsReportEndTime')} htmlFor="mc-end">
              <input id="mc-end" type="time" className="input" value={formData.end_time} onChange={(e) => setTop('end_time', e.target.value)} />
            </Field>
            <Field label={t('materialsReportPreparedBy')} htmlFor="mc-by" className="span-all">
              <input id="mc-by" className="input" value={formData.prepared_by} onChange={(e) => setTop('prepared_by', e.target.value)} required />
            </Field>
          </div>
        </div>
      </section>

      {lows.length > 0 && (
        <div className="alert alert--warn" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="alert-body">
            <strong>{isAr ? 'مواد وصلت إلى الحد الأدنى في المخزن' : 'Items at or below minimum stock'}</strong>
            <div className="low-list">
              {lows.map(a => (
                <span key={a.key} className="badge badge--warn">
                  {a.name}: <span className="num">{a.remaining}</span> ({isAr ? 'الحد' : 'min'} <span className="num">{a.threshold}</span>)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {sectionCard('mc-basics', 'basics', 1, itemRows('basics'), 'basics_notes')}

      {sectionCard('mc-marble', 'marble', 2, (
        <>
          <div className="zone-grid">
            {ZONES.map(zone => (
              <fieldset key={zone} className="zone-card">
                <legend>{isAr ? 'زون' : 'Zone'} {ZONE_NAMES[zone]}</legend>
                {['white', 'brown'].map(color => {
                  const d = formData.marble[zone][color];
                  const colorLabel = color === 'white' ? t('marbleWhiteTitle') : t('marbleBrownTitle');
                  return (
                    <div key={color} className="zone-row">
                      <div className="zone-row-head">
                        <span><span className="swatch" style={{ background: `var(--viz-${color})`, display: 'inline-block', marginInlineEnd: 'var(--space-2)' }} />{colorLabel}</span>
                        <strong className="num">{num(d.total || 0)}</strong>
                      </div>
                      <div className="zone-inputs">
                        <Field label={t('skiliatCount')} htmlFor={`${zone}-${color}-sk`}>
                          <input id={`${zone}-${color}-sk`} className="input input--sm input--num" inputMode="numeric" value={d.skiliat} onChange={(e) => setMarble(zone, color, 'skiliat', e.target.value)} />
                        </Field>
                        <Field label={t('piecesPerSkilia')} htmlFor={`${zone}-${color}-pp`}>
                          <input id={`${zone}-${color}-pp`} className="input input--sm input--num" inputMode="numeric" value={d.pieces_per_skilia} onChange={(e) => setMarble(zone, color, 'pieces_per_skilia', e.target.value)} />
                        </Field>
                        <Field label={t('loosePieces')} htmlFor={`${zone}-${color}-lo`}>
                          <input id={`${zone}-${color}-lo`} className="input input--sm input--num" inputMode="numeric" value={d.loose} onChange={(e) => setMarble(zone, color, 'loose', e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
          <div className="kv kv--3 totals-strip">
            <div className="kv-item"><div className="kv-label">{t('netWhite')}</div><div className="kv-value kv-value--lg num">{num(tot.white)}</div></div>
            <div className="kv-item"><div className="kv-label">{t('netBrown')}</div><div className="kv-value kv-value--lg num">{num(tot.brown)}</div></div>
            <div className="kv-item"><div className="kv-label">{isAr ? 'المجموع' : 'Total'}</div><div className="kv-value kv-value--lg num text-accent">{num(tot.white + tot.brown)}</div></div>
          </div>
        </>
      ), 'marble_notes')}

      {sectionCard('mc-sealants', 'sealants', 3, itemRows('sealants'), 'sealants_notes')}

      {sectionCard('mc-bulk', 'bulk', 4, (
        <div className="form-grid form-grid--4">
          <Field label={t('cementQty')} htmlFor="mc-cement">
            <input id="mc-cement" className="input input--num" value={formData.bulk.cement} onChange={(e) => setBulk('cement', null, e.target.value)} inputMode="decimal" />
          </Field>
          <Field label={t('sandQty')} htmlFor="mc-sand">
            <input id="mc-sand" className="input" value={formData.bulk.sand} onChange={(e) => setBulk('sand', null, e.target.value)} />
          </Field>
          <Field label={`${t('foam')}: ${t('materialPulled')}`} htmlFor="mc-foam-p">
            <input id="mc-foam-p" className="input input--num" value={formData.bulk.foam?.pulled ?? ''} onChange={(e) => setBulk('foam', 'pulled', e.target.value)} inputMode="decimal" />
          </Field>
          <Field label={`${t('foam')}: ${t('materialRemaining')}`} htmlFor="mc-foam-r">
            <input id="mc-foam-r" className="input input--num" value={formData.bulk.foam?.remaining ?? ''} onChange={(e) => setBulk('foam', 'remaining', e.target.value)} inputMode="decimal" />
          </Field>
        </div>
      ), 'bulk_notes')}

      <section className="card" id="mc-photos" aria-labelledby="mc-photos-t">
        <div className="card-header card-header--divided">
          <div>
            <h2 className="card-title" id="mc-photos-t"><Camera size={20} aria-hidden="true" />{isAr ? 'صور الموقع' : 'Site photos'}</h2>
            <p className="card-subtitle">{isAr ? `حتى ${MAX_IMAGES} صور، تُضمَّن في تقرير PDF.` : `Up to ${MAX_IMAGES} photos, included in the PDF.`}</p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => fileRef.current?.click()} disabled={(formData.site_images?.length || 0) >= MAX_IMAGES}>
            <Camera size={18} aria-hidden="true" />
            {isAr ? 'إرفاق صور' : 'Add photos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addImages} />
        </div>
        <div className="card-body">
          {formData.site_images?.length > 0 ? (
            <div className="photo-grid">
              {formData.site_images.map((src, i) => (
                <div key={i} className="photo">
                  <img src={src} alt={`${isAr ? 'صورة' : 'Photo'} ${i + 1}`} />
                  <button type="button" className="photo-remove" onClick={() => removeImage(i)} aria-label={`${isAr ? 'إزالة الصورة' : 'Remove photo'} ${i + 1}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm muted">{isAr ? 'لا توجد صور مرفقة.' : 'No photos attached.'}</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <Field label={isAr ? 'ملاحظات عامة' : 'General notes'} htmlFor="mc-notes" hint={isAr ? 'عند الحفظ يُضاف تلقائياً سجل بالتغييرات عن آخر جرد.' : 'On save, a log of changes since the last count is appended.'}>
            <textarea id="mc-notes" className="textarea" rows={4} value={formData.notes} onChange={(e) => setTop('notes', e.target.value)} placeholder={t('materialsReportNotes')} />
          </Field>
        </div>
      </section>

      <div className="form-actionbar">
        {!editingId && (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            {isAr ? 'نموذج فارغ' : 'Empty form'}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={() => onPrint(null)}>
          <FileText size={18} aria-hidden="true" />
          <span className="btn-label-wide">{isAr ? 'معاينة ' : 'Preview '}</span>PDF
        </button>
        <button type="submit" className="btn btn--primary" aria-busy={saving}>
          <Save size={18} aria-hidden="true" />
          {editingId ? t('updateReport') : t('submitReport')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        lang={lang}
        danger={false}
        title={isAr ? 'البدء بنموذج فارغ' : 'Start with an empty form'}
        message={isAr ? 'ستُمسح القيم الحالية والمسودة المحفوظة على هذا الجهاز.' : 'Current values and the saved draft on this device will be cleared.'}
        confirmLabel={isAr ? 'تفريغ النموذج' : 'Clear form'}
        onConfirm={onConfirmClear}
        onClose={onCancelClear}
      />
    </form>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

function buildConsumptionReport(report, section, t, lang) {
  const isAr = lang === 'ar';
  const show = (key) => !section || section === key;
  const itemsTable = (items) => h.table({
    columns: [
      { label: isAr ? 'المادة' : 'Material' },
      { label: isAr ? 'الكمية المسحوبة' : 'Drawn', align: 'center', width: '35mm' },
      { label: isAr ? 'الكمية المتبقية' : 'Remaining', align: 'center', width: '35mm' },
    ],
    rows: Object.entries(items || {})
      .filter(([k, v]) => isItemKey(k) && v && typeof v === 'object')
      .map(([k, v]) => {
        const thresh = DEFAULT_THRESHOLDS[k];
        const rem = parseFloat(v.remaining);
        const low = thresh !== undefined && !Number.isNaN(rem) && rem <= thresh;
        return [LABELS[k] || t(k), v.pulled || '-', { v: v.remaining || '-', tone: low ? 'warn' : undefined, strong: low }];
      }),
  });

  const tot = marbleTotals(report);
  const marbleRows = [];
  ZONES.forEach(zone => {
    marbleRows.push({ group: `${isAr ? 'زون' : 'Zone'} ${ZONE_NAMES[zone]}` });
    ['white', 'brown'].forEach(color => {
      const d = report.marble?.[zone]?.[color] || {};
      marbleRows.push([
        color === 'white' ? (isAr ? 'مرمر أبيض' : 'White marble') : (isAr ? 'مرمر جوزي' : 'Walnut marble'),
        { v: parseInt(d.skiliat, 10) || 0, align: 'center' },
        { v: d.pieces_per_skilia || 198, align: 'center' },
        { v: parseInt(d.loose, 10) || 0, align: 'center' },
        { v: num(parseInt(d.total, 10) || 0), align: 'center', strong: true },
      ]);
    });
  });

  let index = 0;
  const next = () => { index += 1; return index; };
  const parts = [];

  if (show('basics')) {
    parts.push(h.section(SECTION_TITLES.basics[isAr ? 'ar' : 'en'], h.raw(`${itemsTable(report.basics)}${h.notes(isAr ? 'ملاحظات القسم' : 'Notes', report.basics_notes)}`), { index: next() }));
  }
  if (show('marble')) {
    parts.push(h.section(SECTION_TITLES.marble[isAr ? 'ar' : 'en'], h.raw(`${h.table({
      columns: [
        { label: isAr ? 'النوع' : 'Type' },
        { label: isAr ? 'السكيبات' : 'Pallets', align: 'center' },
        { label: isAr ? 'قطع/سكيبة' : 'Pcs/pallet', align: 'center' },
        { label: isAr ? 'الفرط' : 'Loose', align: 'center' },
        { label: isAr ? 'المجموع' : 'Total', align: 'center' },
      ],
      rows: marbleRows,
      foot: [
        { v: isAr ? 'الإجمالي (أبيض / جوزي)' : 'Total (white / walnut)', strong: true },
        `${tot.whiteSk} / ${tot.brownSk}`, '-', `${tot.whiteLoose} / ${tot.brownLoose}`,
        `${num(tot.white)} / ${num(tot.brown)}`,
      ],
    })}${h.notes(isAr ? 'ملاحظات القسم' : 'Notes', report.marble_notes)}`), { index: next() }));
  }
  if (show('sealants')) {
    parts.push(h.section(SECTION_TITLES.sealants[isAr ? 'ar' : 'en'], h.raw(`${itemsTable(report.sealants)}${h.notes(isAr ? 'ملاحظات القسم' : 'Notes', report.sealants_notes)}`), { index: next() }));
  }
  if (show('bulk')) {
    parts.push(h.section(SECTION_TITLES.bulk[isAr ? 'ar' : 'en'], h.raw(`${h.kpis([
      { label: isAr ? 'الأسمنت (كيس)' : 'Cement (bags)', value: report.bulk?.cement || '-' },
      { label: isAr ? 'الرمل' : 'Sand', value: report.bulk?.sand || '-' },
      { label: isAr ? 'الفوم (مسحوب / متبقي)' : 'Foam (drawn / left)', value: `${report.bulk?.foam?.pulled || '-'} / ${report.bulk?.foam?.remaining || '-'}` },
    ])}${h.notes(isAr ? 'ملاحظات القسم' : 'Notes', report.bulk_notes)}`), { index: next() }));
  }
  if (!section && report.notes) {
    parts.push(h.notes(isAr ? 'ملاحظات عامة وسجل التعديلات' : 'General notes & change log', report.notes));
  }
  if (report.site_images?.length) {
    parts.push(h.section(isAr ? 'التوثيق الميداني بالصور' : 'Site photos', h.raw(`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;break-inside:avoid;">
        ${report.site_images.map(src => `<div style="height:42mm;border:1px solid #d4d4d8;border-radius:2mm;overflow:hidden;"><img src="${h.text(src).html}" style="width:100%;height:100%;object-fit:cover;" alt=""></div>`).join('')}
      </div>`), { index: next() }));
  }

  return buildReport({
    lang,
    title: section ? SECTION_TITLES[section][isAr ? 'ar' : 'en'] : (isAr ? 'تقرير جرد واستهلاك المواد اليومي' : 'Daily Materials Count & Consumption'),
    subtitle: `${report.day || ''} ${report.date || ''}`.trim(),
    code: `MAT-${report.date || ''}`,
    meta: [
      { label: isAr ? 'التاريخ' : 'Date', value: report.date || '-' },
      { label: isAr ? 'اليوم' : 'Day', value: report.day || '-' },
      { label: isAr ? 'وقت المباشرة' : 'Start', value: report.start_time || '-' },
      { label: isAr ? 'وقت الانتهاء' : 'End', value: report.end_time || '-' },
      { label: isAr ? 'معد التقرير' : 'Prepared by', value: report.prepared_by || '-' },
    ],
    body: parts.map(String).join(''),
    signatures: [
      { ar: 'مشرف الموقع', en: 'Site Supervisor' },
      { ar: 'المعاون الفني', en: 'Technical Assistant' },
      { ar: 'معد التقرير', en: 'Prepared by', name: report.prepared_by || '' },
    ],
  });
}
