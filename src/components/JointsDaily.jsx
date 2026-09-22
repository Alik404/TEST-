import { useEffect, useMemo, useState } from 'react';
import {
  Ruler, MoveHorizontal, MoveVertical, CalendarDays, Plus, Pencil, Trash2, Printer, Save,
  FileSpreadsheet, Eye, X, Calculator, SearchX, Users, Layers
} from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { num, isoDay, date as fmtDate } from '../utils/format';
import { toast } from '../utils/toast';
import { openReport } from '../utils/report';
import { exportRowsToExcel } from '../utils/exportUtils';
import {
  JOINT_TYPES, QUICK_ITEMS, ZONES, jointType, zoneLabel, rowTotal, recordRows, rowsByType, dayTotals, cumulative, byDateAsc
} from '../utils/joints';
import { buildJointsDayReport, buildJointsRangeReport } from '../utils/jointsReport';
import { canEdit } from '../navigation';
import { StatCard, EmptyState, Modal, Field, ConfirmDialog, LoadingBlock, Segmented } from './ui';

const newRow = (type = 'horizontal', item = QUICK_ITEMS[0], zone = ZONES[0]) => ({ type, item, count: '', length: String(jointType(type).length), zone });

const emptyForm = () => ({
  report_date: isoDay(),
  workers_count: 4,
  sealant_rate: '',
  notes: '',
  rows: [newRow()],
});

const TYPE_ICON = { horizontal: MoveHorizontal, vertical: MoveVertical };

export default function JointsDaily({ user, lang }) {
  const isAr = lang === 'ar';
  const L = (o) => o[isAr ? 'ar' : 'en'];
  const editable = canEdit(user);
  const meter = isAr ? 'م' : 'm';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [viewing, setViewing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    try {
      const res = await apiFetch('/api/joints-daily');
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error('Failed to fetch joints records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  useEffect(() => { Promise.resolve().then(load); }, []);

  // Newest day first on screen.
  const filtered = useMemo(() => byDateAsc(records)
    .filter(r => (!from || r.report_date >= from) && (!to || r.report_date <= to))
    .reverse(), [records, from, to]);

  const cum = useMemo(() => cumulative(records), [records]);

  const periodTotals = useMemo(() => filtered.reduce((acc, r) => {
    const t = dayTotals(r);
    acc.horizontal += t.horizontal; acc.vertical += t.vertical; acc.total += t.total;
    return acc;
  }, { horizontal: 0, vertical: 0, total: 0 }), [filtered]);

  const filtersActive = Boolean(from || to);

  // ── Form ────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (record) => {
    setViewing(null);
    setEditing(record);
    const rows = recordRows(record);
    setForm({
      report_date: record.report_date || isoDay(),
      workers_count: record.workers_count ?? '',
      sealant_rate: record.data?.sealant_rate || '',
      notes: record.notes || '',
      rows: rows.length ? rows.map(r => ({ type: jointType(r.type).id, item: r.item, count: String(r.count), length: String(r.length), zone: r.zone || ZONES[0] })) : [newRow()],
    });
    setFormOpen(true);
  };

  const setRow = (i, patch) => setForm(f => ({ ...f, rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  // Switching type resets meters per downspout to that type's standard length,
  // unless the user had typed a custom value.
  const setRowType = (i, type) => setForm(f => ({
    ...f,
    rows: f.rows.map((r, j) => {
      if (j !== i) return r;
      const wasStandard = !r.length || Number(r.length) === jointType(r.type).length;
      return { ...r, type, length: wasStandard ? String(jointType(type).length) : r.length };
    }),
  }));

  const addRow = () => setForm(f => {
    const last = f.rows[f.rows.length - 1];
    return { ...f, rows: [...f.rows, newRow(last?.type || 'horizontal', last?.item || QUICK_ITEMS[0], last?.zone || ZONES[0])] };
  });

  const removeRow = (i) => setForm(f => ({ ...f, rows: f.rows.filter((_, j) => j !== i) }));

  const formTotals = useMemo(() => dayTotals({ data: { rows: form.rows } }), [form.rows]);
  const validRows = form.rows.filter(r => r.item.trim() && Number(r.count) > 0 && Number(r.length) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.report_date) return;
    if (validRows.length === 0) {
      toast.error(isAr ? 'أضف فقرة واحدة على الأقل بعدد نزلات وطول أكبر من صفر.' : 'Add at least one item with downspouts and length above zero.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        report_date: form.report_date,
        workers_count: Number(form.workers_count) || 0,
        notes: form.notes.trim(),
        data: {
          sealant_rate: form.sealant_rate.trim(),
          rows: validRows.map(r => ({ type: r.type, item: r.item.trim(), count: Number(r.count), length: Number(r.length), zone: r.zone || ZONES[0] })),
        },
      };
      const res = await apiFetch(editing ? `/api/joints-daily/${editing.id}` : '/api/joints-daily', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ جرد الجوينات.' : 'Could not save the joints count.'));
      await load();
      setFormOpen(false);
      toast.success(editing ? (isAr ? 'تم تحديث جرد اليوم' : 'Day updated') : (isAr ? 'تم حفظ جرد اليوم' : 'Day saved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/joints-daily/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حذف الجرد.' : 'Could not delete the record.'));
      await load();
      setToDelete(null);
      setViewing(null);
      toast.success(isAr ? 'تم حذف جرد اليوم' : 'Day deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Reports ─────────────────────────────────────────────────────────────
  const printDay = (record) => openReport(buildJointsDayReport({ record, records, lang }), {
    title: isAr ? `جرد الجوينات ${record.report_date}` : `Joints ${record.report_date}`,
  });

  const printRange = () => openReport(buildJointsRangeReport({ list: filtered, records, from, to, lang }), {
    title: isAr ? 'تقرير تقدم أعمال الجوينات' : 'Joints progress report',
  });

  const exportExcel = async () => {
    const rows = [];
    for (const rec of byDateAsc(filtered)) {
      for (const r of recordRows(rec)) {
        rows.push({
          'التاريخ': rec.report_date,
          'النوع': jointType(r.type).label.ar,
          'الزون': zoneLabel(r.zone, true),
          'الفقرة المنجزة': r.item,
          'عدد النزلات': Number(r.count) || 0,
          'أمتار الطول للنزلة الواحدة': Number(r.length) || 0,
          'المجموع (متر)': rowTotal(r),
          'عدد العمال': Number(rec.workers_count) || 0,
          'استهلاك الصوصج': rec.data?.sealant_rate || '',
          'ملاحظات': rec.notes || '',
        });
      }
    }
    if (await exportRowsToExcel(rows, 'جرد_أعمال_الجوينات', 'الجوينات')) {
      toast.info(isAr ? 'جارٍ تنزيل ملف Excel' : 'Downloading the Excel file');
    }
  };

  if (loading && records.length === 0) return <LoadingBlock label={isAr ? 'جارٍ تحميل جرد الجوينات' : 'Loading joints records'} />;

  const typeOptions = JOINT_TYPES.map(t => ({ value: t.id, label: `${L(t.short)} (${num(t.length)} ${meter})`, icon: TYPE_ICON[t.id] }));

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص الجوينات التراكمي' : 'Cumulative joints summary'}>
        <StatCard className="stat--span2" label={isAr ? 'المجموع الكلي التراكمي' : 'Cumulative grand total'} value={num(cum.totals.total)} unit={meter} icon={Ruler} tone="accent"
          meta={isAr ? 'كل الأيام المسجلة' : 'All recorded days'} />
        <StatCard label={L(JOINT_TYPES[0].label)} value={num(cum.totals.horizontal)} unit={meter} icon={MoveHorizontal} />
        <StatCard label={L(JOINT_TYPES[1].label)} value={num(cum.totals.vertical)} unit={meter} icon={MoveVertical} />
        <StatCard className="stat--span2" label={isAr ? 'أيام العمل المسجلة' : 'Recorded work days'} value={num(records.length)} icon={CalendarDays} tone="info"
          meta={records.length ? `${isAr ? 'آخر جرد' : 'Last count'}: ${fmtDate(byDateAsc(records)[records.length - 1].report_date, lang)}` : undefined} />
      </section>

      <section className="card">
        <div className="card-body stack-sm">
          <div className="toolbar">
            <div className="date-range toolbar-grow">
              <Field label={isAr ? 'من تاريخ' : 'From'} htmlFor="jd-from">
                <input id="jd-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
              </Field>
              <Field label={isAr ? 'إلى تاريخ' : 'To'} htmlFor="jd-to">
                <input id="jd-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
              </Field>
              {filtersActive && (
                <button type="button" className="btn btn--ghost" onClick={() => { setFrom(''); setTo(''); }}>
                  <X size={16} aria-hidden="true" />
                  {isAr ? 'مسح التصفية' : 'Clear'}
                </button>
              )}
            </div>
            <div className="toolbar-end">
              <button type="button" className="btn btn--secondary" onClick={exportExcel} disabled={filtered.length === 0}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                Excel
              </button>
              <button type="button" className="btn btn--secondary" onClick={printRange} disabled={filtered.length === 0}>
                <Printer size={18} aria-hidden="true" />
                {isAr ? 'تقرير PDF' : 'PDF report'}
              </button>
              {editable && (
                <button type="button" className="btn btn--primary" onClick={openAdd}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'جرد يوم جديد' : 'New day'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>


      <section className="card" aria-labelledby="jd-cum-title">
        <header className="card-header card-header--divided">
          <div>
            <h2 className="card-title" id="jd-cum-title">{isAr ? 'الجرد التراكمي' : 'Cumulative count'}</h2>
            <p className="card-subtitle">{isAr ? 'مجموع كل فقرة من أول يوم حتى آخر جرد' : 'Each item summed from the first to the last day'}</p>
          </div>
        </header>
        <div className="card-body">
          {cum.rows.length === 0
            ? <p className="muted text-sm">{isAr ? 'يظهر هنا بعد تسجيل أول يوم.' : 'Appears after the first day is recorded.'}</p>
            : <JointsSheet groups={cum.groups} total={cum.totals.total} totalLabel={isAr ? 'المجموع الكلي (التراكمي)' : 'Cumulative grand total'} isAr={isAr} />}
        </div>
      </section>

      <section className="card">
        <header className="card-header card-header--divided">
          <div>
            <h2 className="card-title">{isAr ? 'الجرد اليومي' : 'Daily counts'}</h2>
            <p className="card-subtitle">
              {filtersActive
                ? `${isAr ? 'مجموع الفترة' : 'Period total'}: ${num(periodTotals.total)} ${meter}`
                : (isAr ? 'اضغط على اليوم لعرض جدوله كما في ورقة الجرد' : 'Open a day to see its sheet')}
            </p>
          </div>
        </header>
        {filtered.length === 0 ? (
          <EmptyState
            icon={records.length === 0 ? Ruler : SearchX}
            title={records.length === 0 ? (isAr ? 'لا يوجد جرد جوينات بعد' : 'No joints counts yet') : (isAr ? 'لا توجد أيام في هذه الفترة' : 'No days in this period')}
            text={records.length === 0
              ? (isAr ? 'سجّل أول يوم: الفقرة المنجزة وعدد النزلات، ويُحسب المجموع تلقائياً.' : 'Record the first day: the item and downspouts; totals are calculated for you.')
              : (isAr ? 'غيّر نطاق التاريخ.' : 'Change the date range.')}
            action={records.length === 0 && editable && (
              <button type="button" className="btn btn--primary" onClick={openAdd}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'جرد يوم جديد' : 'New day'}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="dt dt--stack dt--stack3">
              <thead>
                <tr>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'الفقرات المنجزة' : 'Items'}</th>
                  <th className="c-num">{isAr ? 'الأفقية (م)' : 'Horizontal (m)'}</th>
                  <th className="c-num">{isAr ? 'العمودية (م)' : 'Vertical (m)'}</th>
                  <th className="c-num">{isAr ? 'المجموع (م)' : 'Total (m)'}</th>
                  <th className="c-num">{isAr ? 'العمال' : 'Workers'}</th>
                  <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => {
                  const t = dayTotals(rec);
                  const items = [...new Set(recordRows(rec).map(r => r.item))].join('، ');
                  const dayLabel = fmtDate(rec.report_date, lang);
                  return (
                    <tr key={rec.id}>
                      <td className="c-title">
                        <button type="button" className="link-btn" onClick={() => setViewing(rec)}>
                          <span className="num jd-date">{dayLabel}</span>
                        </button>
                      </td>
                      <td className="c-full c-muted" data-label={isAr ? 'الفقرات' : 'Items'}><span className="clamp-2">{items || '-'}</span></td>
                      <td className="c-num" data-label={isAr ? 'الأفقية (م)' : 'Horizontal (m)'}><span className="num">{t.horizontal ? num(t.horizontal) : '-'}</span></td>
                      <td className="c-num" data-label={isAr ? 'العمودية (م)' : 'Vertical (m)'}><span className="num">{t.vertical ? num(t.vertical) : '-'}</span></td>
                      <td className="c-num c-strong" data-label={isAr ? 'المجموع (م)' : 'Total (m)'}><span className="num text-accent">{num(t.total)}</span></td>
                      <td className="c-num" data-label={isAr ? 'العمال' : 'Workers'}><span className="num">{Number(rec.workers_count) ? num(rec.workers_count) : '-'}</span></td>
                      <td className="c-actions">
                        <div className="btn-row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setViewing(rec)} aria-label={`${isAr ? 'عرض جرد' : 'View'} ${dayLabel}`}>
                            <Eye size={15} aria-hidden="true" />
                            {isAr ? 'عرض' : 'View'}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => printDay(rec)} aria-label={`PDF ${dayLabel}`} title="PDF">
                            <Printer size={15} aria-hidden="true" />
                          </button>
                          {editable && (
                            <>
                              <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openEdit(rec)} aria-label={`${isAr ? 'تعديل جرد' : 'Edit'} ${dayLabel}`} title={isAr ? 'تعديل' : 'Edit'}>
                                <Pencil size={15} aria-hidden="true" />
                              </button>
                              <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => setToDelete(rec)} aria-label={`${isAr ? 'حذف جرد' : 'Delete'} ${dayLabel}`} title={isAr ? 'حذف' : 'Delete'}>
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

      {/* Day sheet */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing ? `${isAr ? 'جرد أعمال الجوينات' : 'Joints count'} · ${fmtDate(viewing.report_date, lang, 'long')}` : ''}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
        footer={viewing && (
          <>
            {editable && (
              <button type="button" className="btn btn--secondary" onClick={() => openEdit(viewing)}>
                <Pencil size={18} aria-hidden="true" />
                {isAr ? 'تعديل' : 'Edit'}
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={() => printDay(viewing)}>
              <Printer size={18} aria-hidden="true" />
              {isAr ? 'تقرير اليوم PDF' : 'Day PDF'}
            </button>
          </>
        )}
      >
        {viewing && (() => {
          const t = dayTotals(viewing);
          const upto = cumulative(records, viewing.report_date);
          return (
            <div className="stack">
              <JointsSheet groups={rowsByType(recordRows(viewing))} total={t.total} totalLabel={isAr ? 'المجموع الكلي' : 'Grand total'} isAr={isAr} showZone />
              <div className="kv jd-kv">
                <div className="kv-item"><div className="kv-label"><Users size={14} aria-hidden="true" /> {isAr ? 'عدد العمال' : 'Workers'}</div><div className="kv-value num">{Number(viewing.workers_count) ? num(viewing.workers_count) : '-'}</div></div>
                <div className="kv-item"><div className="kv-label"><Layers size={14} aria-hidden="true" /> {isAr ? 'استهلاك الصوصج' : 'Sealant use'}</div><div className="kv-value num" dir="ltr">{viewing.data?.sealant_rate || '-'}</div></div>
              </div>
              {viewing.notes && <p className="note-block">{viewing.notes}</p>}
              <div className="stack-sm">
                <h3 className="form-section-title">{isAr ? `التراكمي لغاية ${fmtDate(viewing.report_date, lang)}` : `Cumulative up to ${fmtDate(viewing.report_date, lang)}`}</h3>
                <JointsSheet groups={upto.groups} total={upto.totals.total} totalLabel={isAr ? 'المجموع الكلي (التراكمي)' : 'Cumulative grand total'} isAr={isAr} />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Add / edit */}
      <Modal
        open={formOpen}
        onClose={saving ? undefined : () => setFormOpen(false)}
        size="lg"
        title={editing ? (isAr ? 'تعديل جرد الجوينات' : 'Edit joints count') : (isAr ? 'جرد جوينات ليوم جديد' : 'New joints count')}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setFormOpen(false)} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" form="joints-form" className="btn btn--primary" aria-busy={saving}>
              <Save size={18} aria-hidden="true" />
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </>
        }
      >
        <form id="joints-form" className="stack" onSubmit={submit}>
          <div className="form-grid form-grid--3">
            <Field label={isAr ? 'تاريخ الجرد' : 'Date'} htmlFor="jd-date">
              <input id="jd-date" type="date" className="input" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} required />
            </Field>
            <Field label={isAr ? 'عدد العمال' : 'Workers'} htmlFor="jd-workers">
              <input id="jd-workers" type="number" className="input input--num" inputMode="numeric" min="0" step="1" value={form.workers_count} onChange={(e) => setForm({ ...form, workers_count: e.target.value })} />
            </Field>
            <Field label={isAr ? 'استهلاك الصوصج' : 'Sealant use'} htmlFor="jd-sealant" hint={isAr ? 'مثال: 0.6 pcs/m' : 'e.g. 0.6 pcs/m'}>
              <input id="jd-sealant" className="input" dir="ltr" value={form.sealant_rate} onChange={(e) => setForm({ ...form, sealant_rate: e.target.value })} placeholder="0.6 pcs/m" />
            </Field>
          </div>

          <fieldset className="form-section">
            <legend className="form-section-title">{isAr ? 'الفقرات المنجزة لهذا اليوم' : 'Items completed today'}</legend>
            <div className="stack-sm">
              {form.rows.map((row, i) => {
                const total = rowTotal(row);
                const rowName = `${isAr ? 'فقرة' : 'Item'} ${i + 1}`;
                return (
                  <fieldset key={i} className="row-card">
                    <legend className="sr-only">{rowName}</legend>
                    <div className="joint-row-head">
                      <Segmented label={`${isAr ? 'نوع الجوينات' : 'Joint type'} - ${rowName}`} options={typeOptions} value={row.type} onChange={(v) => setRowType(i, v)} />
                      {form.rows.length > 1 && (
                        <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => removeRow(i)} aria-label={`${isAr ? 'حذف' : 'Remove'} ${rowName}`} title={isAr ? 'حذف الفقرة' : 'Remove item'}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <Field label={isAr ? 'الفقرة المنجزة' : 'Completed item'} htmlFor={`jd-${i}-item`}>
                      <input id={`jd-${i}-item`} className="input" value={row.item} onChange={(e) => setRow(i, { item: e.target.value })} required list="jd-items" />
                    </Field>
                    <div className="chips chips--wrap" role="group" aria-label={`${isAr ? 'فقرات شائعة' : 'Common items'} - ${rowName}`}>
                      {QUICK_ITEMS.map(item => (
                        <button key={item} type="button" className="chip" aria-pressed={row.item === item} onClick={() => setRow(i, { item })}>{item}</button>
                      ))}
                    </div>
                    <div className="form-grid form-grid--3">
                      <Field label={isAr ? 'زون العمل' : 'Work zone'} htmlFor={`jd-${i}-zone`}>
                        <select id={`jd-${i}-zone`} className="select" value={row.zone} onChange={(e) => setRow(i, { zone: e.target.value })}>
                          {ZONES.map(z => <option key={z} value={z}>{zoneLabel(z, isAr)}</option>)}
                        </select>
                      </Field>
                      <Field label={isAr ? 'عدد النزلات' : 'Downspouts'} htmlFor={`jd-${i}-count`} hint={isAr ? 'يقبل الكسور مثل 0.5' : 'Fractions allowed, e.g. 0.5'}>
                        <input id={`jd-${i}-count`} type="number" className="input input--num" inputMode="decimal" min="0" step="0.5" value={row.count} onChange={(e) => setRow(i, { count: e.target.value })} required />
                      </Field>
                      <Field label={isAr ? 'أمتار الطول للنزلة الواحدة' : 'Meters per downspout'} htmlFor={`jd-${i}-length`}>
                        <input id={`jd-${i}-length`} type="number" className="input input--num" inputMode="decimal" min="0" step="0.1" value={row.length} onChange={(e) => setRow(i, { length: e.target.value })} required />
                      </Field>
                    </div>
                    <div className="row-card-foot">
                      <span className="muted text-sm">{isAr ? 'المجموع' : 'Total'}</span>
                      <strong className="num">{total ? `${num(total)} ${meter}` : '-'}</strong>
                    </div>
                  </fieldset>
                );
              })}
              <datalist id="jd-items">
                {QUICK_ITEMS.map(item => <option key={item} value={item} />)}
              </datalist>
              <button type="button" className="btn btn--secondary btn--block" onClick={addRow}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'إضافة فقرة' : 'Add item'}
              </button>
            </div>
          </fieldset>

          <div className="alert alert--success">
            <Calculator size={18} aria-hidden="true" />
            <div className="alert-body">
              {isAr ? 'المجموع الكلي لليوم' : 'Day total'}: <strong className="num">{num(formTotals.total)} {meter}</strong>
              <span className="muted text-sm"> · {isAr ? 'أفقية' : 'H'} <span className="num">{num(formTotals.horizontal)}</span> · {isAr ? 'عمودية' : 'V'} <span className="num">{num(formTotals.vertical)}</span></span>
            </div>
          </div>

          <Field label={isAr ? 'ملاحظات' : 'Notes'} htmlFor="jd-notes">
            <textarea id="jd-notes" className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={isAr ? 'مثال: أعمال تحويل مواد الماربلكس داخل شط العرب' : 'Other work done today'} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف جرد اليوم' : 'Delete day count'}
        message={isAr ? `سيُحذف جرد الجوينات ليوم ${toDelete?.report_date} نهائياً، ويتغيّر المجموع التراكمي.` : `The joints count for ${toDelete?.report_date} will be deleted and the cumulative total will change.`}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

/** On-screen version of the paper table: a band per type, then the grand total. */
function JointsSheet({ groups, total, totalLabel, isAr, showZone = false }) {
  const unit = isAr ? 'م' : 'm';
  const colCount = showZone ? 5 : 4;
  return (
    <div className="table-wrap">
      <table className="jt-sheet">
        <thead>
          <tr>
            <th scope="col">{isAr ? 'الفقرة المنجزة' : 'Item'}</th>
            {showZone && <th scope="col">{isAr ? 'الزون' : 'Zone'}</th>}
            <th scope="col" className="c-num">{isAr ? 'النزلات' : 'Downspouts'}</th>
            <th scope="col" className="c-num">{isAr ? 'م / نزلة' : 'm each'}</th>
            <th scope="col" className="c-num">{isAr ? 'المجموع' : 'Total'}</th>
          </tr>
        </thead>
        {groups.map(({ type, rows }) => (
          <tbody key={type.id}>
            <tr className="jt-band">
              <th scope="colgroup" colSpan={colCount}>{type.label[isAr ? 'ar' : 'en']}</th>
            </tr>
            {rows.map((r, i) => (
              <tr key={`${r.item}-${i}`}>
                <td>{r.item}</td>
                {showZone && <td><span className="badge badge--outline">{zoneLabel(r.zone, isAr)}</span></td>}
                <td className="c-num"><span className="num">{num(r.count)}</span></td>
                <td className="c-num"><span className="num">{num(r.length)}</span></td>
                <td className="c-num"><strong className="num">{num(r.total ?? rowTotal(r))} {unit}</strong></td>
              </tr>
            ))}
          </tbody>
        ))}
        <tfoot>
          <tr>
            <th scope="row" colSpan={colCount - 1}>{totalLabel}</th>
            <td className="c-num"><strong className="num">{num(total)} {unit}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
