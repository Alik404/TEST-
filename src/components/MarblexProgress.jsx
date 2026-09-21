import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Printer, Search, Pencil, Trash2, Copy, Save, Layers, BarChart2, Award,
  SearchX, AlertTriangle, RefreshCw, Boxes
} from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { num, pct } from '../utils/format';
import { toast } from '../utils/toast';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { canEdit } from '../navigation';
import { StatCard, ProgressBar, EmptyState, Chips, Modal, Field, ConfirmDialog, LoadingBlock } from './ui';

const ZONES = ['Zone A', 'Zone B1', 'Zone B2', 'Zone C'];
const DONE = 'منجز';
const ACTIVE = 'قيد التنفيذ';
const NOT_APPLIED = 'غير مطبق';

const isRemaining = (s) => s === NOT_APPLIED || s === 'متبقي';

const statusTone = (s) => (s === DONE ? 'success' : s === ACTIVE ? 'warn' : 'outline');

const statusLabel = (s, isAr) => {
  if (s === DONE) return isAr ? 'منجز' : 'Completed';
  if (s === ACTIVE) return isAr ? 'قيد التنفيذ' : 'In progress';
  return isAr ? 'غير مطبق' : 'Not applied';
};

const EMPTY_FORM = {
  zone: 'Zone A', item_name: '', total_pieces: '', applied_pieces: '',
  total_steel: '', applied_steel: '', notes: '', status: 'auto',
};

const computeStats = (list) => {
  let totPieces = 0, appPieces = 0, totSteel = 0, appSteel = 0;
  list.forEach(i => {
    totPieces += Number(i.total_pieces) || 0;
    appPieces += Number(i.applied_pieces) || 0;
    totSteel += Number(i.total_steel) || 0;
    appSteel += Number(i.applied_steel) || 0;
  });
  const piecesProg = totPieces > 0 ? parseFloat(((appPieces / totPieces) * 100).toFixed(2)) : 0;
  const steelProg = totSteel > 0 ? parseFloat(((appSteel / totSteel) * 100).toFixed(2)) : 0;
  let overallProg = 0;
  if (totPieces > 0 && totSteel > 0) overallProg = parseFloat(((piecesProg + steelProg) / 2).toFixed(2));
  else if (totPieces > 0) overallProg = piecesProg;
  else if (totSteel > 0) overallProg = steelProg;
  return {
    count: list.length, totPieces, appPieces, remPieces: totPieces - appPieces, piecesProg,
    totSteel, appSteel, remSteel: totSteel - appSteel, steelProg, overallProg,
    completedCount: list.filter(i => i.status === DONE).length,
    inProgressCount: list.filter(i => i.status === ACTIVE).length,
    remainingCount: list.filter(i => isRemaining(i.status)).length,
  };
};

export default function MarblexProgress({ user, lang }) {
  const isAr = lang === 'ar';
  const editable = canEdit(user);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zone, setZone] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isClone, setIsClone] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    try {
      const res = await apiFetch('/api/marblex');
      if (!res.ok) throw new Error(isAr ? 'تعذر تحميل بيانات الماربلكس.' : 'Could not load Marblex data.');
      setItems(await res.json());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { Promise.resolve().then(load); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      (zone === 'all' || i.zone === zone) &&
      (status === 'all' || (status === NOT_APPLIED ? isRemaining(i.status) : i.status === status)) &&
      (!q || (i.item_name || '').toLowerCase().includes(q) || (i.notes || '').toLowerCase().includes(q)));
  }, [items, zone, status, query]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const openCreate = () => {
    setEditingItem(null);
    setIsClone(false);
    setForm({ ...EMPTY_FORM, zone: zone !== 'all' ? zone : 'Zone A' });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setIsClone(false);
    setForm({
      zone: item.zone, item_name: item.item_name, total_pieces: item.total_pieces, applied_pieces: item.applied_pieces,
      total_steel: item.total_steel, applied_steel: item.applied_steel, notes: item.notes || '', status: item.status || 'auto',
    });
    setFormOpen(true);
  };

  const openClone = (item) => {
    setEditingItem(null);
    setIsClone(true);
    setForm({
      zone: item.zone,
      item_name: `${item.item_name} (نسخة)`,
      total_pieces: item.total_pieces,
      applied_pieces: item.applied_pieces || 0,
      total_steel: item.total_steel,
      applied_steel: item.applied_steel || 0,
      notes: item.notes ? `${item.notes} [مستنسخ]` : '',
      status: item.status || 'auto',
    });
    setFormOpen(true);
  };

  const submit = async (payloadForm) => {
    setSaving(true);
    try {
      const payload = {
        zone: payloadForm.zone,
        item_name: payloadForm.item_name.trim(),
        total_pieces: parseInt(payloadForm.total_pieces, 10) || 0,
        applied_pieces: parseInt(payloadForm.applied_pieces, 10) || 0,
        total_steel: parseInt(payloadForm.total_steel, 10) || 0,
        applied_steel: parseInt(payloadForm.applied_steel, 10) || 0,
        notes: payloadForm.notes.trim(),
        status: payloadForm.status === 'auto' ? undefined : payloadForm.status,
      };
      if (editingItem) {
        const res = await apiFetch(`/api/marblex/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ التعديل.' : 'Could not save changes.'));
        const updated = await res.json();
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
        toast.success(isAr ? 'تم حفظ المقطع' : 'Section saved');
      } else {
        const res = await apiFetch('/api/marblex', { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر إضافة المقطع.' : 'Could not add the section.'));
        const created = await res.json();
        setItems(prev => [...prev, created]);
        toast.success(isAr ? 'تمت إضافة المقطع' : 'Section added');
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/marblex/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حذف المقطع.' : 'Could not delete the section.'));
      setItems(prev => prev.filter(i => i.id !== toDelete.id));
      if (formOpen && editingItem?.id === toDelete.id) setFormOpen(false);
      toast.success(isAr ? 'تم حذف المقطع' : 'Section deleted');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const printReport = () => openReport(buildMarblexReport({ list: filtered, stats, zone, status, user, lang }), {
    title: isAr ? 'تقرير تقدم أعمال الماربلكس' : 'Marblex progress report',
    orientation: 'landscape',
  });

  if (loading && items.length === 0) return <LoadingBlock label={isAr ? 'جارٍ تحميل بيانات الماربلكس' : 'Loading Marblex data'} />;

  return (
    <div className="stack">
      {error && (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="alert-body">{error}</div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={load}>
            <RefreshCw size={15} aria-hidden="true" />
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      <section className="stat-grid stat-grid--bento" aria-label={isAr ? 'ملخص الماربلكس' : 'Marblex summary'}>
        <StatCard
          hero
          label={isAr ? 'نسبة الإنجاز الكلية للماربلكس' : 'Overall Marblex completion'}
          value={pct(stats.overallProg, 2)}
          icon={Award}
          tone="accent"
          progress={stats.overallProg}
          meta={
            <span className="dash-counts">
              <span>{isAr ? 'منجز' : 'Done'} <strong className="num">{stats.completedCount}</strong></span>
              <span>{isAr ? 'قيد التنفيذ' : 'Active'} <strong className="num">{stats.inProgressCount}</strong></span>
              <span>{isAr ? 'غير مطبق' : 'Not applied'} <strong className="num">{stats.remainingCount}</strong></span>
              <span>{isAr ? 'من' : 'of'} <strong className="num">{stats.count}</strong> {isAr ? 'مقطع' : 'sections'}</span>
            </span>
          }
        />
        <StatCard
          className="stat--span2"
          label={isAr ? 'القطع المطبقة / الكلية' : 'Panels applied / total'}
          value={`${num(stats.appPieces)} / ${num(stats.totPieces)}`}
          icon={Layers}
          tone="accent"
          progress={stats.piecesProg}
          meta={<>{pct(stats.piecesProg)} {isAr ? 'منجز' : 'done'} · {isAr ? 'متبقي' : 'remaining'} <strong className="num">{num(stats.remPieces)}</strong></>}
        />
        <StatCard
          className="stat--span2"
          label={isAr ? 'الستيلات المطبقة / الكلية' : 'Steel applied / total'}
          value={`${num(stats.appSteel)} / ${num(stats.totSteel)}`}
          icon={BarChart2}
          tone="warn"
          progress={stats.steelProg}
          meta={<>{pct(stats.steelProg)} {isAr ? 'منجز' : 'done'} · {isAr ? 'متبقي' : 'remaining'} <strong className="num">{num(stats.remSteel)}</strong></>}
        />
      </section>

      <section className="card">
        <div className="card-body stack-sm">
          <div className="toolbar">
            <div className="input-group toolbar-grow">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                className="input"
                placeholder={isAr ? 'ابحث باسم المقطع أو الملاحظات' : 'Search section or notes'}
                aria-label={isAr ? 'بحث' : 'Search'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
            </div>
            <div className="toolbar-end">
              <button type="button" className="btn btn--secondary" onClick={printReport}>
                <Printer size={18} aria-hidden="true" />
                {isAr ? 'تقرير PDF' : 'PDF report'}
              </button>
              {editable && (
                <button type="button" className="btn btn--primary" onClick={openCreate}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'إضافة مقطع' : 'Add section'}
                </button>
              )}
            </div>
          </div>
          <Chips
            label={isAr ? 'تصفية حسب الزون' : 'Filter by zone'}
            value={zone}
            onChange={setZone}
            options={[
              { value: 'all', label: isAr ? 'كل الزونات' : 'All zones', count: items.length },
              ...ZONES.map(z => ({ value: z, label: z, count: items.filter(i => i.zone === z).length })),
            ]}
          />
          <Chips
            label={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: isAr ? 'كل الحالات' : 'All statuses' },
              { value: DONE, label: statusLabel(DONE, isAr) },
              { value: ACTIVE, label: statusLabel(ACTIVE, isAr) },
              { value: NOT_APPLIED, label: statusLabel(NOT_APPLIED, isAr) },
            ]}
          />
        </div>
      </section>

      <section className="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={items.length === 0 ? Boxes : SearchX}
            title={items.length === 0 ? (isAr ? 'لا توجد مقاطع بعد' : 'No sections yet') : (isAr ? 'لا توجد نتائج' : 'No matches')}
            text={items.length === 0
              ? (isAr ? 'أضف أول مقطع لبدء متابعة ألواح الماربلكس والستيلات.' : 'Add the first section to start tracking panels and steel.')
              : (isAr ? 'غيّر البحث أو الزون أو الحالة.' : 'Change the search, zone or status.')}
            action={items.length === 0 && editable && (
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                <Plus size={18} aria-hidden="true" />
                {isAr ? 'إضافة مقطع' : 'Add section'}
              </button>
            )}
          />
        ) : (
          <div className="table-wrap">
            <table className="dt dt--stack">
              <thead>
                <tr>
                  <th>{isAr ? 'المقطع / الجدار' : 'Section'}</th>
                  <th>{isAr ? 'الزون' : 'Zone'}</th>
                  <th className="c-num">{isAr ? 'القطع' : 'Panels'}</th>
                  <th className="c-num">{isAr ? 'الستيل' : 'Steel'}</th>
                  <th style={{ minWidth: '10rem' }}>{isAr ? 'النسبة الكلية' : 'Overall'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th>{isAr ? 'الملاحظات' : 'Notes'}</th>
                  {editable && <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}>
                    <td className="c-title">{item.item_name}</td>
                    <td data-label={isAr ? 'الزون' : 'Zone'}><span className="badge badge--outline">{item.zone}</span></td>
                    <td className="c-num" data-label={isAr ? 'القطع' : 'Panels'}>
                      <span className="num"><strong className="text-success">{num(item.applied_pieces)}</strong><span className="muted"> / {num(item.total_pieces)}</span> <small className="muted">({pct(item.pieces_progress || 0)})</small></span>
                    </td>
                    <td className="c-num" data-label={isAr ? 'الستيل' : 'Steel'}>
                      <span className="num"><strong>{num(item.applied_steel)}</strong><span className="muted"> / {num(item.total_steel)}</span> <small className="muted">({pct(item.steel_progress || 0)})</small></span>
                    </td>
                    <td className="c-sub" data-label={isAr ? 'النسبة الكلية' : 'Overall'}>
                      <ProgressBar value={item.overall_progress || 0} label={item.item_name} showValue />
                    </td>
                    <td data-label={isAr ? 'الحالة' : 'Status'}>
                      <span className={`badge badge--${statusTone(item.status)}`}>{statusLabel(item.status, isAr)}</span>
                    </td>
                    <td className="c-full c-muted" data-label={isAr ? 'الملاحظات' : 'Notes'}>
                      {item.notes ? <span className="clamp-2">{item.notes}</span> : null}
                    </td>
                    {editable && (
                      <td className="c-actions">
                        <div className="btn-row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(item)} aria-label={`${isAr ? 'تعديل' : 'Edit'} ${item.item_name}`}>
                            <Pencil size={15} aria-hidden="true" />
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openClone(item)} aria-label={`${isAr ? 'نسخ' : 'Duplicate'} ${item.item_name}`} title={isAr ? 'نسخ' : 'Duplicate'}>
                            <Copy size={15} aria-hidden="true" />
                          </button>
                          <button type="button" className="btn btn--danger-ghost btn--sm btn--icon" onClick={() => setToDelete(item)} aria-label={`${isAr ? 'حذف' : 'Delete'} ${item.item_name}`} title={isAr ? 'حذف' : 'Delete'}>
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
                  <td className="c-full">{isAr ? 'المجموع' : 'Total'} <span className="muted text-xs">· <span className="num">{stats.count}</span> {isAr ? 'مقطع' : 'sections'}</span></td>
                  <td className="c-hide-sm" />
                  <td className="c-num" data-label={isAr ? 'القطع' : 'Panels'}><span className="num">{num(stats.appPieces)} / {num(stats.totPieces)}</span></td>
                  <td className="c-num" data-label={isAr ? 'الستيل' : 'Steel'}><span className="num">{num(stats.appSteel)} / {num(stats.totSteel)}</span></td>
                  <td className="c-full"><ProgressBar value={stats.overallProg} label={isAr ? 'النسبة الكلية' : 'Overall'} showValue decimals={2} /></td>
                  <td className="c-hide-sm" colSpan={editable ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <MarblexForm
        open={formOpen}
        form={form}
        setForm={setForm}
        editing={editingItem}
        isClone={isClone}
        saving={saving}
        lang={lang}
        onClose={() => !saving && setFormOpen(false)}
        onSubmit={submit}
        onDelete={editingItem ? () => setToDelete(editingItem) : undefined}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف المقطع' : 'Delete section'}
        message={isAr ? `سيُحذف "${toDelete?.item_name}" نهائياً ولا يمكن التراجع عن ذلك.` : `"${toDelete?.item_name}" will be deleted permanently. This cannot be undone.`}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function MarblexForm({ open, form, setForm, editing, isClone, saving, lang, onClose, onSubmit, onDelete }) {
  const isAr = lang === 'ar';
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const totP = parseInt(form.total_pieces, 10) || 0;
  const appP = parseInt(form.applied_pieces, 10) || 0;
  const totS = parseInt(form.total_steel, 10) || 0;
  const appS = parseInt(form.applied_steel, 10) || 0;
  const piecesErr = totP > 0 && appP > totP;
  const steelErr = totS > 0 && appS > totS;
  const preview = computeStats([{ total_pieces: totP, applied_pieces: appP, total_steel: totS, applied_steel: appS }]).overallProg;

  const submit = (e) => {
    e.preventDefault();
    if (!form.item_name.trim() || piecesErr || steelErr) return;
    onSubmit(form);
  };

  const title = editing
    ? (isAr ? 'تعديل المقطع' : 'Edit section')
    : isClone ? (isAr ? 'نسخ مقطع' : 'Duplicate section') : (isAr ? 'إضافة مقطع جديد' : 'Add section');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={isClone ? (isAr ? 'نسخة جديدة من مقطع قائم. عدّل ما يلزم ثم احفظ.' : 'A new copy of an existing section. Adjust and save.') : undefined}
      size="lg"
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn--danger-ghost" onClick={onDelete} style={{ marginInlineEnd: 'auto' }} disabled={saving}>
              <Trash2 size={17} aria-hidden="true" />
              {isAr ? 'حذف' : 'Delete'}
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="submit" form="marblex-form" className="btn btn--primary" aria-busy={saving}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </>
      }
    >
      <form id="marblex-form" className="stack-sm" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label={isAr ? 'اسم المقطع / الجدار' : 'Section name'} htmlFor="mbx-name" className="span-all">
            <input id="mbx-name" className="input" value={form.item_name} onChange={set('item_name')} required data-autofocus
              aria-invalid={!form.item_name.trim() && form.item_name !== '' ? 'true' : undefined} />
          </Field>
          <Field label={isAr ? 'الزون' : 'Zone'} htmlFor="mbx-zone">
            <select id="mbx-zone" className="select" value={form.zone} onChange={set('zone')}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field label={isAr ? 'الحالة' : 'Status'} htmlFor="mbx-status" hint={form.status === 'auto' ? (isAr ? 'تُحسب من نسبة الإنجاز' : 'Derived from completion') : undefined}>
            <select id="mbx-status" className="select" value={form.status} onChange={set('status')}>
              <option value="auto">{isAr ? 'تلقائي حسب النسبة' : 'Automatic'}</option>
              <option value={DONE}>{statusLabel(DONE, isAr)}</option>
              <option value={ACTIVE}>{statusLabel(ACTIVE, isAr)}</option>
              <option value={NOT_APPLIED}>{statusLabel(NOT_APPLIED, isAr)}</option>
            </select>
          </Field>
        </div>

        <fieldset className="form-section">
          <legend className="form-section-title">{isAr ? 'ألواح الماربلكس (قطعة)' : 'Marblex panels (pcs)'}</legend>
          <div className="form-grid form-grid--tight">
            <Field label={isAr ? 'الكلي' : 'Total'} htmlFor="mbx-tp">
              <input id="mbx-tp" className="input input--num" type="number" inputMode="numeric" min="0" value={form.total_pieces} onChange={set('total_pieces')} />
            </Field>
            <Field label={isAr ? 'المطبق' : 'Applied'} htmlFor="mbx-ap" error={piecesErr ? (isAr ? 'أكبر من الكلي' : 'More than total') : undefined}>
              <input id="mbx-ap" className="input input--num" type="number" inputMode="numeric" min="0" value={form.applied_pieces} onChange={set('applied_pieces')} aria-invalid={piecesErr || undefined} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend className="form-section-title">{isAr ? 'ستيلات التثبيت' : 'Fixing steel'}</legend>
          <div className="form-grid form-grid--tight">
            <Field label={isAr ? 'الكلي' : 'Total'} htmlFor="mbx-ts">
              <input id="mbx-ts" className="input input--num" type="number" inputMode="numeric" min="0" value={form.total_steel} onChange={set('total_steel')} />
            </Field>
            <Field label={isAr ? 'المطبق' : 'Applied'} htmlFor="mbx-as" error={steelErr ? (isAr ? 'أكبر من الكلي' : 'More than total') : undefined}>
              <input id="mbx-as" className="input input--num" type="number" inputMode="numeric" min="0" value={form.applied_steel} onChange={set('applied_steel')} aria-invalid={steelErr || undefined} />
            </Field>
          </div>
        </fieldset>

        <div>
          <div className="kv-label" style={{ marginBlockEnd: 'var(--space-2)' }}>{isAr ? 'النسبة الكلية بعد الحفظ' : 'Overall after saving'}</div>
          <ProgressBar value={preview} label={isAr ? 'النسبة الكلية' : 'Overall'} showValue decimals={2} />
        </div>

        <Field label={isAr ? 'الملاحظات' : 'Notes'} htmlFor="mbx-notes">
          <textarea id="mbx-notes" className="textarea" rows={3} value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

function buildMarblexReport({ list, stats, zone, status, user, lang }) {
  const isAr = lang === 'ar';
  const zoneText = zone === 'all' ? (isAr ? 'جميع الزونات' : 'All zones') : zone;
  const statusText = status === 'all' ? (isAr ? 'جميع الحالات' : 'All statuses') : statusLabel(status, isAr);

  const body = [
    h.kpis([
      { label: isAr ? 'النسبة الكلية' : 'Overall', value: pct(stats.overallProg, 2), tone: 'success', sub: isAr ? 'متوسط القطع والستيل' : 'Panels and steel average' },
      { label: isAr ? 'القطع المطبقة' : 'Panels applied', value: `${num(stats.appPieces)} / ${num(stats.totPieces)}`, sub: `${pct(stats.piecesProg)}` },
      { label: isAr ? 'الستيل المطبق' : 'Steel applied', value: `${num(stats.appSteel)} / ${num(stats.totSteel)}`, sub: `${pct(stats.steelProg)}` },
      { label: isAr ? 'حالة المقاطع' : 'Sections', value: `${stats.completedCount} / ${stats.count}`, sub: isAr ? `قيد التنفيذ ${stats.inProgressCount}، غير مطبق ${stats.remainingCount}` : `${stats.inProgressCount} active, ${stats.remainingCount} not applied` },
    ]),
    h.section(isAr ? 'تفاصيل المقاطع' : 'Sections', h.table({
      columns: [
        { label: '#', align: 'center', width: '8mm' },
        { label: isAr ? 'المقطع / الجدار' : 'Section' },
        { label: isAr ? 'الزون' : 'Zone', align: 'center', width: '18mm' },
        { label: isAr ? 'القطع الكلية' : 'Panels', align: 'center' },
        { label: isAr ? 'المطبقة' : 'Applied', align: 'center' },
        { label: isAr ? 'إنجاز القطع' : 'Panels %', align: 'center' },
        { label: isAr ? 'الستيل الكلي' : 'Steel', align: 'center' },
        { label: isAr ? 'المطبق' : 'Applied', align: 'center' },
        { label: isAr ? 'إنجاز الستيل' : 'Steel %', align: 'center' },
        { label: isAr ? 'النسبة الكلية' : 'Overall', align: 'center', width: '22mm' },
        { label: isAr ? 'الحالة' : 'Status', align: 'center' },
        { label: isAr ? 'الملاحظات' : 'Notes', width: '40mm' },
      ],
      rows: list.map((item, i) => ({
        cls: item.status === DONE ? 'done' : '',
        cells: [
          i + 1,
          { v: item.item_name, strong: true },
          item.zone,
          num(item.total_pieces),
          { v: num(item.applied_pieces), tone: 'success', strong: true },
          pct(item.pieces_progress || 0),
          num(item.total_steel),
          { v: num(item.applied_steel), strong: true },
          pct(item.steel_progress || 0),
          h.progress(item.overall_progress || 0),
          h.badge(statusLabel(item.status, isAr), item.status === DONE ? 'success' : item.status === ACTIVE ? 'warn' : undefined),
          { v: item.notes || '-', tone: 'muted' },
        ],
      })),
      foot: [
        { v: isAr ? 'المجموع الكلي' : 'Total', colspan: 3, strong: true },
        num(stats.totPieces), { v: num(stats.appPieces), tone: 'success' }, pct(stats.piecesProg),
        num(stats.totSteel), num(stats.appSteel), pct(stats.steelProg),
        pct(stats.overallProg, 2),
        `${stats.completedCount} / ${stats.count}`,
        '',
      ],
    }), { index: 1 }),
  ].map(String).join('');

  return buildReport({
    lang,
    orientation: 'landscape',
    title: isAr ? 'تقرير تقدم أعمال الماربلكس وستيلات التثبيت' : 'Marblex & Fixing Steel Progress',
    subtitle: `${zoneText} · ${statusText}`,
    code: docCode('MBX'),
    meta: [
      { label: isAr ? 'المهندس المسؤول' : 'Engineer', value: user?.name || '-' },
      { label: isAr ? 'الزون' : 'Zone', value: zoneText },
      { label: isAr ? 'الحالة' : 'Status', value: statusText },
      { label: isAr ? 'عدد المقاطع' : 'Sections', value: String(list.length) },
    ],
    body,
    signatures: [
      { ar: 'مهندس الموقع الميداني', en: 'Site Engineer' },
      { ar: 'المهندس المقيم', en: 'Resident Engineer' },
      { ar: 'دائرة المهندس المقيم / الإشراف', en: 'Supervision Office' },
    ],
  });
}
