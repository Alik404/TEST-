import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, Plus, Search, Pencil, Trash2, FileSpreadsheet, Printer, Save,
  Clock, Calculator, ListChecks, SearchX, X
} from 'lucide-react';
import { exportRowsToExcel } from '../utils/exportUtils';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { num, iqd, isoDay, date as fmtDate } from '../utils/format';
import { toast } from '../utils/toast';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { canEdit } from '../navigation';
import { StatCard, EmptyState, Modal, Field, ConfirmDialog, LoadingBlock } from './ui';

const QUICK_TAGS = [
  'تصنيف جوينات',
  'أعمال بياض وجص وسقالة',
  'ترتيب وتبريز الرخام',
  'تفكيك كرات',
  'تصنيف نزلات',
  'تنظيف هراوة المقل',
  'تنزيل المقل المقل',
  'تريبه كورنيش',
  'فرز وتصنيف ألواح المقل',
  'معالجة وشحذ المودول'
];

const DEFAULT_CREW = 'عمال ابو حيدر';

const emptyForm = () => ({
  work_date: isoDay(),
  work_item: QUICK_TAGS[0],
  worker_name: DEFAULT_CREW,
  shifts_count: 2,
  shift_price: 30000,
  notes: ''
});

export default function WorkersWages({ user, lang }) {
  const isAr = lang === 'ar';
  const editable = canEdit(user);

  const [wages, setWages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    try {
      const res = await apiFetch('/api/workers-wages');
      if (res.ok) setWages(await res.json());
    } catch (err) {
      console.error('Failed to fetch wages:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  useEffect(() => { Promise.resolve().then(load); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wages.filter(item =>
      (!q || [item.work_item, item.worker_name, item.notes].some(v => (v || '').toLowerCase().includes(q))) &&
      (!from || item.work_date >= from) &&
      (!to || item.work_date <= to));
  }, [wages, query, from, to]);

  const totals = useMemo(() => {
    const amount = filtered.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const shifts = filtered.reduce((s, i) => s + (Number(i.shifts_count) || 0), 0);
    return { amount, shifts, count: filtered.length, avg: shifts > 0 ? Math.round(amount / shifts) : 0 };
  }, [filtered]);

  const filtersActive = Boolean(query || from || to);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      work_date: record.work_date || isoDay(),
      work_item: record.work_item || '',
      worker_name: record.worker_name || '',
      shifts_count: record.shifts_count || 1,
      shift_price: record.shift_price || 0,
      notes: record.notes || ''
    });
    setFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.work_item.trim() || !form.work_date) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        shifts_count: Number(form.shifts_count),
        shift_price: Number(form.shift_price),
        total_amount: Number(form.shifts_count) * Number(form.shift_price)
      };
      const res = await apiFetch(editing ? `/api/workers-wages/${editing.id}` : '/api/workers-wages', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ السجل.' : 'Could not save the record.'));
      await load();
      setFormOpen(false);
      toast.success(editing ? (isAr ? 'تم تحديث السجل' : 'Record updated') : (isAr ? 'تمت إضافة السجل' : 'Record added'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/workers-wages/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حذف السجل.' : 'Could not delete the record.'));
      await load();
      setToDelete(null);
      toast.success(isAr ? 'تم حذف السجل' : 'Record deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportExcel = async () => {
    const rows = filtered.map((item, i) => ({
      '#': i + 1,
      'التاريخ': item.work_date,
      'فقرة العمل': item.work_item,
      'العامل / الوجبة': item.worker_name,
      'عدد الشفتات': Number(item.shifts_count) || 0,
      'سعر الشفت (د.ع)': Number(item.shift_price) || 0,
      'الإجمالي (د.ع)': Number(item.total_amount) || 0,
      'ملاحظات': item.notes || ''
    }));
    if (await exportRowsToExcel(rows, 'سجل_أجور_الشفتات_والعمال', 'أجور العمال')) {
      toast.info(isAr ? 'جارٍ تنزيل ملف Excel' : 'Downloading the Excel file');
    }
  };

  const print = () => openReport(buildWagesReport({ list: filtered, totals, from, to, lang }), {
    title: isAr ? 'تقرير أجور وشفتات العمال' : 'Workers wages report',
  });

  if (loading && wages.length === 0) return <LoadingBlock label={isAr ? 'جارٍ تحميل سجل الأجور' : 'Loading wages'} />;

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص الأجور' : 'Wages summary'}>
        <StatCard className="stat--span2" label={isAr ? 'إجمالي الأجور' : 'Total wages'} value={num(totals.amount, { decimals: 0 })} unit={isAr ? 'د.ع' : 'IQD'} icon={Banknote} tone="accent"
          meta={filtersActive ? (isAr ? 'حسب التصفية الحالية' : 'For the current filter') : (isAr ? 'كل السجلات' : 'All records')} />
        <StatCard label={isAr ? 'مجموع الشفتات' : 'Total shifts'} value={num(totals.shifts)} icon={Clock} />
        <StatCard label={isAr ? 'عدد السجلات' : 'Records'} value={num(totals.count)} icon={ListChecks} />
        <StatCard className="stat--span2" label={isAr ? 'متوسط سعر الشفت' : 'Average shift price'} value={num(totals.avg, { decimals: 0 })} unit={isAr ? 'د.ع' : 'IQD'} icon={Calculator} tone="warn" />
      </section>

      <section className="card">
        <div className="card-body stack-sm">
          <div className="toolbar">
            <div className="input-group toolbar-grow">
              <Search size={18} aria-hidden="true" />
              <input type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={isAr ? 'ابحث بفقرة العمل أو العامل أو الملاحظات' : 'Search work item, crew or notes'}
                aria-label={isAr ? 'بحث' : 'Search'} enterKeyHint="search" />
            </div>
            <div className="toolbar-end">
              <button type="button" className="btn btn--secondary" onClick={exportExcel} disabled={filtered.length === 0}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                Excel
              </button>
              <button type="button" className="btn btn--secondary" onClick={print} disabled={filtered.length === 0}>
                <Printer size={18} aria-hidden="true" />
                PDF
              </button>
              {editable && (
                <button type="button" className="btn btn--primary" onClick={openAdd}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'سجل جديد' : 'New record'}
                </button>
              )}
            </div>
          </div>
          <div className="date-range">
            <Field label={isAr ? 'من تاريخ' : 'From'} htmlFor="ww-from">
              <input id="ww-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
            </Field>
            <Field label={isAr ? 'إلى تاريخ' : 'To'} htmlFor="ww-to">
              <input id="ww-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
            </Field>
            {filtersActive && (
              <button type="button" className="btn btn--ghost" onClick={() => { setQuery(''); setFrom(''); setTo(''); }}>
                <X size={16} aria-hidden="true" />
                {isAr ? 'مسح التصفية' : 'Clear'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={wages.length === 0 ? Banknote : SearchX}
            title={wages.length === 0 ? (isAr ? 'لا توجد سجلات أجور بعد' : 'No wage records yet') : (isAr ? 'لا توجد نتائج' : 'No matches')}
            text={wages.length === 0
              ? (isAr ? 'سجّل أول يوم عمل بعدد الشفتات وسعر الشفت.' : 'Record the first work day with shifts and shift price.')
              : (isAr ? 'غيّر البحث أو نطاق التاريخ.' : 'Change the search or date range.')}
            action={wages.length === 0 && editable && (
              <button type="button" className="btn btn--primary" onClick={openAdd}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'سجل جديد' : 'New record'}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="dt dt--stack dt--stack3">
              <thead>
                <tr>
                  <th>{isAr ? 'فقرة العمل' : 'Work item'}</th>
                  <th>{isAr ? 'التاريخ' : 'Date'}</th>
                  <th>{isAr ? 'العامل / الوجبة' : 'Crew'}</th>
                  <th className="c-num">{isAr ? 'الشفتات' : 'Shifts'}</th>
                  <th className="c-num">{isAr ? 'سعر الشفت' : 'Shift price'}</th>
                  <th className="c-num">{isAr ? 'الإجمالي' : 'Total'}</th>
                  <th>{isAr ? 'ملاحظات' : 'Notes'}</th>
                  {editable && <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td className="c-title">{item.work_item}</td>
                    <td data-label={isAr ? 'التاريخ' : 'Date'}><span className="num">{item.work_date}</span></td>
                    <td data-label={isAr ? 'الوجبة' : 'Crew'}>{item.worker_name || '-'}</td>
                    <td className="c-num" data-label={isAr ? 'الشفتات' : 'Shifts'}><span className="num">{num(item.shifts_count)}</span></td>
                    <td className="c-num" data-label={isAr ? 'سعر الشفت' : 'Price'}><span className="num">{num(item.shift_price, { decimals: 0 })}</span></td>
                    <td className="c-num c-strong" data-label={isAr ? 'الإجمالي (د.ع)' : 'Total (IQD)'}><span className="num text-accent">{num(item.total_amount, { decimals: 0 })}</span></td>
                    <td className="c-full c-muted" data-label={isAr ? 'ملاحظات' : 'Notes'}>{item.notes ? <span className="clamp-2">{item.notes}</span> : null}</td>
                    {editable && (
                      <td className="c-actions">
                        <div className="btn-row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(item)} aria-label={`${isAr ? 'تعديل' : 'Edit'} ${item.work_item} ${item.work_date}`}>
                            <Pencil size={15} aria-hidden="true" />
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => setToDelete(item)} aria-label={`${isAr ? 'حذف' : 'Delete'} ${item.work_item} ${item.work_date}`} title={isAr ? 'حذف' : 'Delete'}>
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="c-full">{isAr ? 'المجموع' : 'Total'} <span className="muted text-xs">· <span className="num">{totals.count}</span> {isAr ? 'سجل' : 'records'}</span></td>
                  <td className="c-hide-sm" />
                  <td className="c-hide-sm" />
                  <td className="c-num" data-label={isAr ? 'الشفتات' : 'Shifts'}><span className="num">{num(totals.shifts)}</span></td>
                  <td className="c-hide-sm" />
                  <td className="c-num" data-label={isAr ? 'الإجمالي (د.ع)' : 'Total (IQD)'}><span className="num text-accent">{num(totals.amount, { decimals: 0 })}</span></td>
                  <td className="c-hide-sm" colSpan={editable ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={saving ? undefined : () => setFormOpen(false)}
        size="lg"
        title={editing ? (isAr ? 'تعديل سجل أجور' : 'Edit wage record') : (isAr ? 'سجل أجور جديد' : 'New wage record')}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setFormOpen(false)} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" form="wage-form" className="btn btn--primary" aria-busy={saving}>
              <Save size={18} aria-hidden="true" />
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </>
        }
      >
        <form id="wage-form" className="stack-sm" onSubmit={submit}>
          <div className="form-grid">
            <Field label={isAr ? 'تاريخ العمل' : 'Work date'} htmlFor="ww-date">
              <input id="ww-date" type="date" className="input" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} required />
            </Field>
            <Field label={isAr ? 'العامل / الوجبة' : 'Crew'} htmlFor="ww-crew">
              <input id="ww-crew" className="input" value={form.worker_name} onChange={(e) => setForm({ ...form, worker_name: e.target.value })} placeholder={DEFAULT_CREW} />
            </Field>
            <Field label={isAr ? 'فقرة العمل' : 'Work item'} htmlFor="ww-item" className="span-all">
              <input id="ww-item" className="input" value={form.work_item} onChange={(e) => setForm({ ...form, work_item: e.target.value })} required data-autofocus />
            </Field>
          </div>
          <div className="chips chips--wrap" role="group" aria-label={isAr ? 'فقرات شائعة' : 'Common items'}>
            {QUICK_TAGS.map(tag => (
              <button key={tag} type="button" className="chip" aria-pressed={form.work_item === tag} onClick={() => setForm({ ...form, work_item: tag })}>
                {tag}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field label={isAr ? 'عدد الشفتات' : 'Shifts'} htmlFor="ww-shifts">
              <input id="ww-shifts" type="number" className="input input--num" inputMode="decimal" min="0" step="0.5" value={form.shifts_count} onChange={(e) => setForm({ ...form, shifts_count: e.target.value })} required />
            </Field>
            <Field label={isAr ? 'سعر الشفت (د.ع)' : 'Shift price (IQD)'} htmlFor="ww-price">
              <input id="ww-price" type="number" className="input input--num" inputMode="numeric" min="0" step="500" value={form.shift_price} onChange={(e) => setForm({ ...form, shift_price: e.target.value })} required />
            </Field>
          </div>
          <div className="alert alert--success">
            <Calculator size={18} aria-hidden="true" />
            <div className="alert-body">
              {isAr ? 'الإجمالي' : 'Total'}: <strong className="num">{iqd((Number(form.shifts_count) || 0) * (Number(form.shift_price) || 0), lang)}</strong>
            </div>
          </div>
          <Field label={isAr ? 'ملاحظات' : 'Notes'} htmlFor="ww-notes">
            <textarea id="ww-notes" className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف سجل الأجور' : 'Delete wage record'}
        message={isAr ? `سيُحذف سجل "${toDelete?.work_item}" بتاريخ ${toDelete?.work_date} نهائياً.` : `"${toDelete?.work_item}" on ${toDelete?.work_date} will be deleted permanently.`}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function buildWagesReport({ list, totals, from, to, lang }) {
  const isAr = lang === 'ar';
  const range = from || to
    ? `${from ? fmtDate(from, lang) : '...'} - ${to ? fmtDate(to, lang) : '...'}`
    : (isAr ? 'كل الفترات' : 'All dates');
  const body = [
    h.kpis([
      { label: isAr ? 'إجمالي الأجور' : 'Total wages', value: iqd(totals.amount, lang), tone: 'success' },
      { label: isAr ? 'مجموع الشفتات' : 'Total shifts', value: num(totals.shifts) },
      { label: isAr ? 'عدد السجلات' : 'Records', value: num(totals.count) },
      { label: isAr ? 'متوسط سعر الشفت' : 'Average shift', value: iqd(totals.avg, lang) },
    ]),
    h.section(isAr ? 'تفاصيل الأجور اليومية' : 'Daily wage records', h.table({
      columns: [
        { label: '#', align: 'center', width: '8mm' },
        { label: isAr ? 'التاريخ' : 'Date', align: 'center', width: '22mm' },
        { label: isAr ? 'فقرة العمل' : 'Work item' },
        { label: isAr ? 'العامل / الوجبة' : 'Crew', width: '30mm' },
        { label: isAr ? 'الشفتات' : 'Shifts', align: 'center', width: '15mm' },
        { label: isAr ? 'سعر الشفت' : 'Price', align: 'center', width: '22mm' },
        { label: isAr ? 'الإجمالي' : 'Total', align: 'center', width: '26mm' },
        { label: isAr ? 'ملاحظات' : 'Notes', width: '32mm' },
      ],
      rows: list.map((item, i) => [
        i + 1, item.work_date, { v: item.work_item, strong: true }, item.worker_name || DEFAULT_CREW,
        num(item.shifts_count), num(item.shift_price, { decimals: 0 }),
        { v: num(item.total_amount, { decimals: 0 }), strong: true, tone: 'success' },
        { v: item.notes || '-', tone: 'muted' },
      ]),
      foot: [
        { v: isAr ? 'المجموع الكلي' : 'Grand total', colspan: 4, strong: true },
        num(totals.shifts), '-', iqd(totals.amount, lang), '',
      ],
    }), { index: 1 }),
  ].map(String).join('');

  return buildReport({
    lang,
    title: isAr ? 'تقرير أجور وشفتات العمال التفصيلي' : 'Workers Wages & Shifts Report',
    subtitle: range,
    code: docCode('WGS'),
    meta: [
      { label: isAr ? 'الفترة' : 'Period', value: range },
      { label: isAr ? 'عدد السجلات' : 'Records', value: num(totals.count) },
      { label: isAr ? 'إجمالي الأجور' : 'Total', value: iqd(totals.amount, lang) },
    ],
    body,
    signatures: [
      { ar: 'دائرة المهندس المقيم', en: 'Resident Engineer Office' },
      { ar: 'مسؤول جرد وأجور الموقع', en: 'Site Wages Officer' },
      { ar: 'ممثل الجهة المستفيدة', en: 'Client Representative' },
    ],
  });
}
