import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Printer, Eye, Pencil, Trash2, Search, ArrowLeft, ArrowRight, Save, Receipt,
  CalendarDays, SearchX, Calculator
} from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { num, isoDay } from '../utils/format';
import { toast } from '../utils/toast';
import { buildReport, openReport, h } from '../utils/report';
import { canEdit } from '../navigation';
import { advanceData, cumTotal, pct70, dueAdvance } from '../utils/advance';
import { StatCard, EmptyState, Field, Segmented, ConfirmDialog, LoadingBlock } from './ui';

const EMPTY_FORM = {
  site_name: 'موقع الجندي المجهول',
  tech_name: '',
  receipt_date: isoDay(),
  receipt_voucher: '',
  receipt_type: 'جزئي',
  measuring_unit: '',
  start_date: '',
  supervisor: '',
  has_contract: 'لا',
  work_type: '',
  has_blueprints: 'نعم',
  daily_staff_rate: '',
  unit_price: '',
  expected_end_date: '',
  // The nine criteria printed on the paper form.
  performance: [
    { criteria: 'الالتزام بالتشغيل أثناء وبعد العمل', rating: 'جيد', notes: '' },
    { criteria: 'الالتزام بالعمل ضمن المخططات', rating: 'جيد', notes: '' },
    { criteria: 'المحافظة على المواد المستلمة', rating: 'جيد', notes: '' },
    { criteria: 'حالة المخزن', rating: 'جيد', notes: '' },
    { criteria: 'مدى التفاهم بين الفني وفريق الإشراف', rating: 'جيد', notes: '' },
    { criteria: 'عدد الكوادر مقارنة بحجم العمل', rating: 'جيد', notes: '' },
    { criteria: 'الالتزام بشروط السلامة', rating: 'جيد', notes: '' },
    { criteria: 'وقت طلب المواد', rating: 'جيد', notes: '' },
    { criteria: 'سرعة سير العمل', rating: 'جيد', notes: '' },
  ],
  materials: [
    { name: 'مرمر', received: '', prepared: '', consumed: '', notes: '' },
    { name: 'رمل', received: '', prepared: '', consumed: '', notes: '' },
    { name: 'اسمنت', received: '', prepared: '', consumed: '', notes: '' },
    { name: '', received: '', prepared: '', consumed: '', notes: '' },
  ],
  quantities: [
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
  ],
  total_notes: '',
  resolved_notes: '',
  unresolved_notes: '',
  last_memo_date: '',
  partial_or_final: 'جزئي',
  pct_70_override: '',
  previous_advances: '',
  due_advance_override: '',
  remaining_balance: '',
};

const RATINGS = ['جيد', 'متوسط', 'ضعيف'];
const MATERIAL_FIELDS = [
  ['received', 'المستلمة'],
  ['prepared', 'المجهزة'],
  ['consumed', 'المنتهية'],
];

// Older records keep the technician and work type only in the table columns.
const parseData = (rec) => {
  const d = { ...EMPTY_FORM, ...advanceData(rec) };
  if (!d.tech_name && rec?.team_leader) d.tech_name = rec.team_leader;
  if (!d.work_type && rec?.team_number) d.work_type = rec.team_number;
  return d;
};


export default function WeeklyAdvance({ user, lang }) {
  const isAr = lang === 'ar';
  const editable = canEdit(user);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list'); // list | form | view
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    try {
      const r = await apiFetch('/api/weekly-advance');
      if (r.ok) setRecords(await r.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  useEffect(() => { Promise.resolve().then(load); }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return records;
    return records.filter(r => [r.team_leader, r.site_name, r.receipt_date, r.team_number]
      .some(v => String(v || '').includes(q)));
  }, [records, search]);

  const thisMonth = records.filter(r => r.receipt_date?.startsWith(isoDay().slice(0, 7))).length;

  const openNew = () => { setForm({ ...EMPTY_FORM, receipt_date: isoDay() }); setEditingId(null); setMode('form'); window.scrollTo({ top: 0 }); };
  const openEdit = (r) => { setForm(parseData(r)); setEditingId(r.id); setMode('form'); window.scrollTo({ top: 0 }); };
  const openView = (r) => { setForm(parseData(r)); setEditingId(r.id); setMode('view'); window.scrollTo({ top: 0 }); };
  const back = () => { setMode('list'); setEditingId(null); window.scrollTo({ top: 0 }); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        receipt_date: form.receipt_date,
        team_leader: form.tech_name || '',
        site_name: form.site_name || '',
        team_number: form.work_type || '',
        data: JSON.stringify(form),
      };
      const res = await apiFetch(editingId ? `/api/weekly-advance/${editingId}` : '/api/weekly-advance', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ القائمة.' : 'Could not save.'));
      await load();
      toast.success(isAr ? 'تم حفظ القائمة' : 'Saved');
      back();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/weekly-advance/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر الحذف.' : 'Could not delete.'));
      await load();
      setToDelete(null);
      toast.success(isAr ? 'تم حذف القائمة' : 'Deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const print = (rec) => openReport(buildAdvanceReport(rec ? parseData(rec) : form), {
    title: isAr ? 'قائمة استلام الأعمال وإطلاق المبالغ' : 'Works receipt & payment release',
  });

  if (mode !== 'list') {
    return (
      <AdvanceForm
        form={form}
        setForm={setForm}
        readOnly={mode === 'view'}
        editingId={editingId}
        saving={saving}
        lang={lang}
        editable={editable}
        onBack={back}
        onSubmit={save}
        onPrint={() => print(null)}
        onEdit={() => setMode('form')}
      />
    );
  }

  if (loading && records.length === 0) return <LoadingBlock label={isAr ? 'جارٍ التحميل' : 'Loading'} />;

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص القوائم' : 'Summary'}>
        <StatCard label={isAr ? 'إجمالي القوائم' : 'All lists'} value={num(records.length)} icon={Receipt} tone="accent" />
        <StatCard label={isAr ? 'هذا الشهر' : 'This month'} value={num(thisMonth)} icon={CalendarDays} />
      </section>

      <section className="card">
        <div className="card-body">
          <div className="toolbar">
            <div className="input-group toolbar-grow">
              <Search size={18} aria-hidden="true" />
              <input type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم الفني أو الموقع أو التاريخ' : 'Search technician, site or date'} aria-label={isAr ? 'بحث' : 'Search'} />
            </div>
            {editable && (
              <div className="toolbar-end">
                <button type="button" className="btn btn--primary" onClick={openNew}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'قائمة جديدة' : 'New list'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={records.length === 0 ? Receipt : SearchX}
            title={records.length === 0 ? (isAr ? 'لا توجد قوائم بعد' : 'No lists yet') : (isAr ? 'لا توجد نتائج' : 'No matches')}
            text={records.length === 0
              ? (isAr ? 'أنشئ أول قائمة استلام أعمال وإطلاق مبالغ.' : 'Create the first works receipt list.')
              : (isAr ? 'غيّر كلمة البحث.' : 'Change the search.')}
            action={records.length === 0 && editable && (
              <button type="button" className="btn btn--primary" onClick={openNew}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'قائمة جديدة' : 'New list'}
              </button>
            )}
          />
        ) : (
          <ul className="list">
            {filtered.map(rec => {
              const d = parseData(rec);
              return (
                <li key={rec.id} className="list-item record-item">
                  <span className="stat-icon stat-icon--accent" aria-hidden="true"><Receipt size={16} /></span>
                  <button type="button" className="list-item-main record-open" onClick={() => openView(rec)}>
                    <span className="list-item-title">{rec.team_leader || (isAr ? 'بدون اسم فني' : 'No technician')}{rec.team_number ? ` · ${rec.team_number}` : ''}</span>
                    <span className="list-item-sub">
                      <span className="num">{rec.receipt_date}</span> · {rec.site_name}
                      {' · '}{isAr ? 'المستحق' : 'Due'} <strong className="num">{num(dueAdvance(d), { decimals: 0 })}</strong>
                    </span>
                  </button>
                  <div className="btn-row">
                    <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openView(rec)} aria-label={isAr ? 'عرض' : 'View'} title={isAr ? 'عرض' : 'View'}><Eye size={16} aria-hidden="true" /></button>
                    <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => print(rec)} aria-label="PDF" title="PDF"><Printer size={16} aria-hidden="true" /></button>
                    {editable && (
                      <>
                        <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openEdit(rec)} aria-label={isAr ? 'تعديل' : 'Edit'} title={isAr ? 'تعديل' : 'Edit'}><Pencil size={16} aria-hidden="true" /></button>
                        <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => setToDelete(rec)} aria-label={isAr ? 'حذف' : 'Delete'} title={isAr ? 'حذف' : 'Delete'}><Trash2 size={16} aria-hidden="true" /></button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف القائمة' : 'Delete list'}
        message={isAr ? `ستُحذف قائمة ${toDelete?.team_leader || ''} بتاريخ ${toDelete?.receipt_date || ''} نهائياً.` : 'This list will be deleted permanently.'}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function AdvanceForm({ form, setForm, readOnly, editingId, saving, lang, editable, onBack, onSubmit, onPrint, onEdit }) {
  const isAr = lang === 'ar';
  const Back = isAr ? ArrowRight : ArrowLeft;
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setRow = (list, i, key, value) => setForm(f => {
    const rows = f[list].map((r, idx) => (idx === i ? { ...r, [key]: value } : r));
    return { ...f, [list]: rows };
  });

  const ct = cumTotal(form);
  const p70 = pct70(form);
  const due = dueAdvance(form);

  const input = (key, label, type = 'text', options) => (
    <Field label={label} htmlFor={`wa-${key}`}>
      {readOnly ? (
        <div className="kv-value" id={`wa-${key}`}>{form[key] || '-'}</div>
      ) : options ? (
        <select id={`wa-${key}`} className="select" value={form[key]} onChange={set(key)}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={`wa-${key}`} className={`input${type === 'number' ? ' input--num' : ''}`} type={type} value={form[key] || ''} onChange={set(key)}
          inputMode={type === 'number' ? 'decimal' : undefined} />
      )}
    </Field>
  );

  const title = readOnly
    ? (isAr ? 'قائمة استلام الأعمال' : 'Works receipt list')
    : editingId ? (isAr ? 'تعديل القائمة' : 'Edit list') : (isAr ? 'قائمة جديدة' : 'New list');

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="form-head">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <Back size={18} aria-hidden="true" />
          {isAr ? 'العودة للقوائم' : 'Back'}
        </button>
        <h2 className="form-head-title">{title}</h2>
      </div>

      <section className="card">
        <div className="card-header card-header--divided">
          <h2 className="card-title"><span className="step-index">1</span>{isAr ? 'بيانات القائمة' : 'Details'}</h2>
        </div>
        <div className="card-body">
          <div className={`form-grid form-grid--3${readOnly ? ' form-grid--read' : ''}`}>
            {input('site_name', 'اسم الموقع')}
            {input('tech_name', 'اسم الفني')}
            {input('receipt_date', 'التاريخ', 'date')}
            {input('receipt_voucher', 'رقم وصل الاستلام (الحسابات)')}
            {input('receipt_type', 'نوع الاستلام', 'text', ['جزئي', 'نهائي'])}
            {input('measuring_unit', 'وحدة القياس')}
            {input('start_date', 'تاريخ البدء بالعمل', 'date')}
            {input('expected_end_date', 'تاريخ الانتهاء المتوقع', 'date')}
            {input('supervisor', 'مشرف الموقع')}
            {input('has_contract', 'هل يوجد عقد عمل؟', 'text', ['نعم', 'لا'])}
            {input('work_type', 'نوع العمل')}
            {input('has_blueprints', 'هل توجد مخططات؟', 'text', ['نعم', 'لا', 'لا حاجة للمخططات'])}
            {input('daily_staff_rate', 'معدل الكوادر اليومي')}
            {input('unit_price', 'سعر الوحدة', 'number')}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <h2 className="card-title"><span className="step-index">2</span>{isAr ? 'تقييم الأداء الميداني' : 'Field performance'}</h2>
        </div>
        <ul className="list criteria-list">
          {form.performance.map((p, i) => (
            <li key={p.criteria} className="criteria-item">
              <span className="criteria-text"><span className="num muted">{i + 1}.</span> {p.criteria}</span>
              {readOnly ? (
                <span className={`badge ${p.rating === 'جيد' ? 'badge--success' : p.rating === 'متوسط' ? 'badge--warn' : 'badge--danger'}`}>{p.rating}</span>
              ) : (
                <Segmented label={p.criteria} value={p.rating} onChange={(v) => setRow('performance', i, 'rating', v)}
                  options={RATINGS.map(r => ({ value: r, label: r }))} />
              )}
              {readOnly ? (
                p.notes ? <span className="text-sm muted criteria-notes">{p.notes}</span> : null
              ) : (
                <input className="input input--sm criteria-notes" value={p.notes} onChange={(e) => setRow('performance', i, 'notes', e.target.value)}
                  placeholder={isAr ? 'ملاحظة (اختياري)' : 'Note (optional)'} aria-label={`${p.criteria}: ${isAr ? 'ملاحظة' : 'note'}`} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <h2 className="card-title"><span className="step-index">3</span>{isAr ? 'كمية المواد المستهلكة' : 'Materials used'}</h2>
        </div>
        <div className="card-body stack-sm">
          {form.materials.map((m, i) => (
            <fieldset key={i} className="row-card">
              <legend className="sr-only">{m.name || `${isAr ? 'مادة' : 'Material'} ${i + 1}`}</legend>
              <div className="form-grid form-grid--4">
                <Field label={isAr ? 'المادة' : 'Material'} htmlFor={`wm-${i}-name`}>
                  {readOnly ? <div className="kv-value">{m.name || '-'}</div>
                    : <input id={`wm-${i}-name`} className="input input--sm" value={m.name} onChange={(e) => setRow('materials', i, 'name', e.target.value)} />}
                </Field>
                {MATERIAL_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`wm-${i}-${key}`}>
                    {readOnly ? <div className="kv-value num">{m[key] || '-'}</div>
                      : <input id={`wm-${i}-${key}`} className="input input--sm input--num" value={m[key]} onChange={(e) => setRow('materials', i, key, e.target.value)} inputMode="decimal" />}
                  </Field>
                ))}
              </div>
              {(!readOnly || m.notes) && (
                readOnly ? <p className="text-sm muted">{m.notes}</p>
                  : <input className="input input--sm" value={m.notes} onChange={(e) => setRow('materials', i, 'notes', e.target.value)} placeholder={isAr ? 'ملاحظات' : 'Notes'} aria-label={isAr ? 'ملاحظات' : 'Notes'} />
              )}
            </fieldset>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <h2 className="card-title"><span className="step-index">4</span>{isAr ? 'الكمية المنجزة التراكمية من بداية العمل' : 'Cumulative completed quantities'}</h2>
        </div>
        <div className="card-body stack-sm">
          {form.quantities.map((q, i) => {
            const amt = (parseFloat(q.price) || 0) * (parseFloat(q.qty) || 0);
            return (
              <fieldset key={i} className="row-card">
                <legend className="sr-only">{`${isAr ? 'فقرة' : 'Item'} ${i + 1}`}</legend>
                <div className="form-grid form-grid--4">
                  <Field label={isAr ? 'فقرة العمل' : 'Work item'} htmlFor={`wq-${i}-p`} className="span-all">
                    {readOnly ? <div className="kv-value">{q.paragraph || '-'}</div>
                      : <input id={`wq-${i}-p`} className="input input--sm" value={q.paragraph} onChange={(e) => setRow('quantities', i, 'paragraph', e.target.value)} />}
                  </Field>
                  {[['zone', 'رقم التطبيق', false], ['unit', 'وحدة القياس', false], ['price', 'السعر', true], ['qty', 'الكمية', true]].map(([key, label, numeric]) => (
                    <Field key={key} label={label} htmlFor={`wq-${i}-${key}`}>
                      {readOnly ? <div className={`kv-value${numeric ? ' num' : ''}`}>{numeric && q[key] ? num(q[key]) : (q[key] || '-')}</div>
                        : <input id={`wq-${i}-${key}`} className={`input input--sm${numeric ? ' input--num' : ''}`} type={numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : undefined}
                          value={q[key]} onChange={(e) => setRow('quantities', i, key, e.target.value)} />}
                    </Field>
                  ))}
                </div>
                <div className="row-card-foot">
                  <span className="muted text-sm">{isAr ? 'المبلغ' : 'Amount'}</span>
                  <strong className="num">{amt ? num(amt, { decimals: 0 }) : '-'}</strong>
                </div>
                {(!readOnly || q.notes) && (
                  readOnly ? <p className="text-sm muted">{q.notes}</p>
                    : <input className="input input--sm" value={q.notes} onChange={(e) => setRow('quantities', i, 'notes', e.target.value)} placeholder={isAr ? 'ملاحظة' : 'Note'} aria-label={isAr ? 'ملاحظة' : 'Note'} />
                )}
              </fieldset>
            );
          })}
          <div className="alert alert--success">
            <Calculator size={18} aria-hidden="true" />
            <div className="alert-body">{isAr ? 'المجموع الكلي التراكمي' : 'Cumulative total'}: <strong className="num">{num(ct, { decimals: 0 })}</strong></div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <h2 className="card-title"><span className="step-index">5</span>{isAr ? 'ملاحظات الموقع ومتابعة المذكرات' : 'Site notes & memos'}</h2>
        </div>
        <div className="card-body">
          <div className={`form-grid form-grid--3${readOnly ? ' form-grid--read' : ''}`}>
            {input('total_notes', 'عدد الملاحظات التراكمي', 'number')}
            {input('resolved_notes', 'عدد الملاحظات المنجزة', 'number')}
            {input('unresolved_notes', 'عدد الملاحظات غير المنجزة', 'number')}
            {input('last_memo_date', 'تاريخ آخر استلام للمذكرة', 'date')}
            {input('partial_or_final', 'نوعه', 'text', ['جزئي', 'نهائي'])}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <div>
            <h2 className="card-title"><span className="step-index">6</span>{isAr ? 'الملخص المالي' : 'Financial summary'}</h2>
            {!readOnly && <p className="card-subtitle">{isAr ? 'اترك الحقول القابلة للتعديل فارغة لتُحسب تلقائياً.' : 'Leave the editable fields empty to calculate them automatically.'}</p>}
          </div>
        </div>
        <div className="card-body">
          <div className={`form-grid${readOnly ? ' form-grid--read' : ''}`}>
            <Field label={isAr ? '70% من المجموع الكلي التراكمي' : '70% of cumulative total'} htmlFor="wa-p70" hint={!readOnly ? `${isAr ? 'التلقائي' : 'Automatic'}: ${num(Math.round(ct * 0.7), { decimals: 0 })}` : undefined}>
              {readOnly ? <div className="kv-value kv-value--lg num">{num(p70, { decimals: 0 })}</div>
                : <input id="wa-p70" className="input input--num" type="number" inputMode="decimal" value={form.pct_70_override} onChange={set('pct_70_override')} placeholder={String(Math.round(ct * 0.7))} />}
            </Field>
            <Field label={isAr ? 'مجموع المبالغ المستلمة سابقاً' : 'Previously received'} htmlFor="wa-prev">
              {readOnly ? <div className="kv-value kv-value--lg num">{num(form.previous_advances || 0, { decimals: 0 })}</div>
                : <input id="wa-prev" className="input input--num" type="number" inputMode="decimal" value={form.previous_advances} onChange={set('previous_advances')} />}
            </Field>
            <Field label={isAr ? 'مبلغ السلفة المستحق' : 'Advance due'} htmlFor="wa-due" hint={!readOnly ? `${isAr ? 'التلقائي' : 'Automatic'}: ${num(Math.max(0, p70 - (parseFloat(form.previous_advances) || 0)), { decimals: 0 })}` : undefined}>
              {readOnly ? <div className="kv-value kv-value--lg num text-accent">{num(due, { decimals: 0 })}</div>
                : <input id="wa-due" className="input input--num" type="number" inputMode="decimal" value={form.due_advance_override} onChange={set('due_advance_override')} placeholder={String(Math.max(0, p70 - (parseFloat(form.previous_advances) || 0)))} />}
            </Field>
            <Field label={isAr ? 'المبلغ المتبقي' : 'Remaining balance'} htmlFor="wa-rem">
              {readOnly ? <div className="kv-value kv-value--lg num">{num(form.remaining_balance || 0, { decimals: 0 })}</div>
                : <input id="wa-rem" className="input input--num" type="number" inputMode="decimal" value={form.remaining_balance} onChange={set('remaining_balance')} />}
            </Field>
          </div>
        </div>
      </section>

      <div className="form-actionbar">
        <button type="button" className="btn btn--secondary" onClick={onPrint}>
          <Printer size={18} aria-hidden="true" />
          PDF
        </button>
        {readOnly ? (
          editable && (
            <button type="button" className="btn btn--primary" onClick={onEdit}>
              <Pencil size={18} aria-hidden="true" />
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          )
        ) : (
          <button type="submit" className="btn btn--primary" aria-busy={saving}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ القائمة' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}

// ── PDF: the paper form "قائمة استلام الأعمال وإطلاق المبالغ" ───────────────

function buildAdvanceReport(f) {
  const ct = cumTotal(f);
  const p70 = pct70(f);
  const due = dueAdvance(f);
  const money = (v) => (v ? num(v, { decimals: 0 }) : '-');

  const info = h.table({
    columns: [{ label: 'البيان', width: '24%' }, { label: 'القيمة' }, { label: 'البيان', width: '24%' }, { label: 'القيمة' }],
    rows: [
      ['اسم الموقع', { v: f.site_name, strong: true }, 'مشرف الموقع', { v: f.supervisor, strong: true }],
      ['اسم الفني', { v: f.tech_name, strong: true }, 'هل يوجد عقد عمل؟', f.has_contract || 'لا'],
      ['التاريخ', f.receipt_date, 'نوع العمل', f.work_type],
      ['رقم وصل الاستلام (الحسابات)', f.receipt_voucher, 'هل توجد مخططات؟', f.has_blueprints || 'نعم'],
      ['نوع الاستلام', h.raw(`${h.check(f.receipt_type === 'جزئي', 'جزئي')}${h.check(f.receipt_type === 'نهائي', 'نهائي')}`), 'معدل الكوادر اليومي', f.daily_staff_rate],
      ['وحدة القياس', f.measuring_unit, 'سعر الوحدة', f.unit_price],
      ['تاريخ البدء بالعمل', f.start_date, 'تاريخ الانتهاء المتوقع', f.expected_end_date],
    ],
    compact: true,
  });

  const perf = h.table({
    columns: [
      { label: 'ت', align: 'center', width: '7mm' }, { label: 'المعايير' },
      { label: 'جيد', align: 'center', width: '14mm' }, { label: 'متوسط', align: 'center', width: '14mm' }, { label: 'ضعيف', align: 'center', width: '14mm' },
      { label: 'ملاحظات', width: '45mm' },
    ],
    rows: f.performance.map((p, i) => [
      i + 1, { v: p.criteria, strong: true },
      h.check(p.rating === 'جيد'), h.check(p.rating === 'متوسط'), h.check(p.rating === 'ضعيف'),
      { v: p.notes || '', tone: 'muted' },
    ]),
    compact: true,
  });

  const mats = h.table({
    columns: [
      { label: 'ت', align: 'center', width: '7mm' }, { label: 'المادة' },
      { label: 'المستلمة', align: 'center', width: '24mm' }, { label: 'المجهزة', align: 'center', width: '24mm' }, { label: 'المنتهية', align: 'center', width: '24mm' },
      { label: 'ملاحظات', width: '40mm' },
    ],
    rows: f.materials.map((m, i) => [i + 1, { v: m.name, strong: true }, m.received, m.prepared, m.consumed, { v: m.notes || '', tone: 'muted' }]),
    foot: [{ v: 'توقيع المعاون الإداري', colspan: 4 }, { v: '', colspan: 2 }],
    compact: true,
  });

  const qtys = h.table({
    columns: [
      { label: 'ت', align: 'center', width: '7mm' }, { label: 'الفقرة' },
      { label: 'رقم التطبيق', align: 'center', width: '20mm' }, { label: 'وحدة القياس', align: 'center', width: '18mm' },
      { label: 'السعر', align: 'center', width: '20mm' }, { label: 'العدد', align: 'center', width: '14mm' },
      { label: 'المبلغ الكلي (قبل خصم 70%)', align: 'center', width: '30mm' }, { label: 'الملاحظات', width: '30mm' },
    ],
    rows: f.quantities.map((q, i) => {
      const amt = (parseFloat(q.price) || 0) * (parseFloat(q.qty) || 0);
      return [i + 1, { v: q.paragraph, strong: true }, q.zone, q.unit, money(parseFloat(q.price)), q.qty, { v: money(amt), strong: true }, { v: q.notes || '', tone: 'muted' }];
    }),
    foot: [{ v: 'المجموع الكلي التراكمي', colspan: 6, strong: true }, money(ct), 'توقيع المعاون الفني'],
    compact: true,
  });

  const notes = h.table({
    columns: [
      { label: 'عدد الملاحظات التراكمي', align: 'center' }, { label: 'المنجزة', align: 'center' },
      { label: 'غير المنجزة', align: 'center' }, { label: 'تاريخ آخر استلام', align: 'center' }, { label: 'نوعه', align: 'center' },
    ],
    rows: [
      [f.total_notes, f.resolved_notes, f.unresolved_notes, f.last_memo_date,
        h.raw(`${h.check(f.partial_or_final === 'جزئي', 'جزئي')}${h.check(f.partial_or_final === 'نهائي', 'نهائي')}`)],
      [{ v: '(تملأ من قبل PMO)', colspan: 2 }, 'توقيع مسؤول المتابعة', { v: '', colspan: 2 }],
    ],
    compact: true,
  });

  const finance = h.kpis([
    { label: '70% من المجموع الكلي التراكمي', value: money(p70) },
    { label: 'مجموع المبالغ المستلمة سابقاً', value: money(parseFloat(f.previous_advances)) },
    { label: 'مبلغ السلفة المستحق', value: money(due), tone: 'success' },
    { label: 'المبلغ المتبقي', value: money(parseFloat(f.remaining_balance)) },
  ]);

  return buildReport({
    lang: 'ar',
    title: 'قائمة استلام الأعمال وإطلاق المبالغ',
    subtitle: 'ترسل قبل 24 ساعة للحسابات بعد توقيع رئيس الفريق',
    code: `ADV-${f.receipt_date || ''}`,
    meta: [
      { label: 'الفني', value: f.tech_name || '-' },
      { label: 'التاريخ', value: f.receipt_date || '-' },
      { label: 'نوع الاستلام', value: f.receipt_type || '-' },
      { label: 'السلفة المستحقة', value: money(due) },
    ],
    body: [
      h.section('بيانات القائمة', info, { index: 1 }),
      h.section('تقييم الأداء', perf, { index: 2 }),
      h.section('كمية المواد المستهلكة', mats, { index: 3 }),
      h.section('الكمية المنجزة التراكمية الكلية من بداية العمل', qtys, { index: 4 }),
      h.section('ملاحظات الموقع', notes, { index: 5 }),
      h.section('الملخص المالي', finance, { index: 6 }),
    ].map(String).join(''),
    signatures: [
      { ar: 'مشرف الموقع', en: 'Site Supervisor', name: f.supervisor || '' },
      { ar: 'المعاون الفني', en: 'Technical Assistant' },
      { ar: 'رئيس الفريق', en: 'Team Leader', name: f.tech_name || '' },
    ],
  });
}
