import { useMemo, useState } from 'react';
import { Layers, CheckCircle2, AlertCircle, Save, Printer, Pencil } from 'lucide-react';
import { num } from '../utils/format';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { canEdit } from '../navigation';
import { StatCard, Modal, Field } from './ui';

const ZONES = ['Zone A', 'Zone B', 'Zone C'];
const PALLET = 198; // pieces per pallet (سكيبة)

const zoneLabel = (zone, isAr) => (isAr ? zone.replace('Zone', 'المنطقة') : zone);
const palletText = (total, isAr) => (isAr
  ? `${num(Math.floor(total / PALLET))} سكيبة · ${num(total % PALLET)} فرط`
  : `${num(Math.floor(total / PALLET))} pallets · ${num(total % PALLET)} loose`);
const isSettled = (s) => Boolean(s) && (s.includes('مكتمل') || s.includes('Completed') || s.includes('مستقر'));
const rowTotal = (i) => (i.white_qty !== null || i.brown_qty !== null ? (i.white_qty || 0) + (i.brown_qty || 0) : null);

export default function MaterialsReport({ marble, user, onUpdateMarbleStatus, t, lang, translateText }) {
  const isAr = lang === 'ar';
  const editable = canEdit(user);
  const tr = (x) => translateText(x, lang);
  const list = useMemo(() => (Array.isArray(marble) ? marble : []), [marble]);
  const [editing, setEditing] = useState(null);

  const totals = useMemo(() => {
    const white = list.reduce((s, i) => s + (i.white_qty || 0), 0);
    const brown = list.reduce((s, i) => s + (i.brown_qty || 0), 0);
    return { white, brown, all: white + brown };
  }, [list]);

  const zones = useMemo(() => ZONES.map(z => {
    const items = list.filter(i => i.zone === z);
    const white = items.reduce((s, i) => s + (i.white_qty || 0), 0);
    const brown = items.reduce((s, i) => s + (i.brown_qty || 0), 0);
    return { zone: z, items, white, brown };
  }).filter(g => g.items.length), [list]);

  const statusSuggestions = useMemo(() => [...new Set(list.map(i => i.status).filter(Boolean))], [list]);

  const print = () => openReport(buildMarbleReport({ zones, totals, lang, tr }), {
    title: isAr ? 'تقرير توزيع المرمر' : 'Marble distribution report',
  });

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص المرمر' : 'Marble summary'}>
        <StatCard className="stat--span2" label={t('marbleTotalTitle')} value={num(totals.all)} unit={isAr ? 'قطعة' : 'pcs'} icon={Layers} tone="accent" meta={palletText(totals.all, isAr)} />
        <StatCard label={t('marbleWhiteTitle')} value={num(totals.white)} icon={Layers} meta={palletText(totals.white, isAr)} />
        <StatCard label={t('marbleBrownTitle')} value={num(totals.brown)} icon={Layers} tone="warn" meta={palletText(totals.brown, isAr)} />
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <div>
            <h2 className="card-title">{t('tableMaterialsTitle')}</h2>
            <p className="card-subtitle">
              {editable
                ? (isAr ? 'اضغط "تعديل" لتحديث الكميات والموقف الميداني.' : 'Use "Edit" to update quantities and field status.')
                : (isAr ? `كل سكيبة ${PALLET} قطعة.` : `${PALLET} pieces per pallet.`)}
            </p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={print}>
            <Printer size={18} aria-hidden="true" />
            {isAr ? 'تقرير PDF' : 'PDF report'}
          </button>
        </div>

        <div className="table-wrap">
          <table className="dt dt--stack dt--stack3">
            <thead>
              <tr>
                <th>{t('colTaskNature')}</th>
                <th className="c-num">{t('colWhiteQty')}</th>
                <th className="c-num">{t('colBrownQty')}</th>
                <th className="c-num">{t('colTotal')}</th>
                <th>{t('colFieldStatus')}</th>
                {editable && <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>}
              </tr>
            </thead>
            <tbody>
              {zones.map(g => (
                <ZoneBlock key={g.zone} group={g} isAr={isAr} t={t} tr={tr} editable={editable} onEdit={setEditing} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="c-full">{t('grandTotalCumulative')}</td>
                <td className="c-num" data-label={isAr ? 'أبيض' : 'White'}><span className="num">{num(totals.white)}</span></td>
                <td className="c-num" data-label={isAr ? 'جوزي' : 'Walnut'}><span className="num">{num(totals.brown)}</span></td>
                <td className="c-num" data-label={isAr ? 'المجموع' : 'Total'}><span className="num text-accent">{num(totals.all)}</span></td>
                <td className="c-hide-sm" colSpan={editable ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <MarbleEditSheet
        item={editing}
        lang={lang}
        t={t}
        tr={tr}
        suggestions={statusSuggestions}
        onClose={() => setEditing(null)}
        onSave={async (id, status, white, brown) => {
          await onUpdateMarbleStatus(id, status, white, brown);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ZoneBlock({ group, isAr, t, tr, editable, onEdit }) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={editable ? 6 : 5}>
          <div className="group-row-inner">
            <span>{zoneLabel(group.zone, isAr)}</span>
            <span className="muted">
              {isAr ? 'أبيض' : 'White'} <span className="num">{num(group.white)}</span> · {isAr ? 'جوزي' : 'Walnut'} <span className="num">{num(group.brown)}</span> · {isAr ? 'المجموع' : 'Total'} <span className="num">{num(group.white + group.brown)}</span>
            </span>
          </div>
        </td>
      </tr>
      {group.items.map(item => {
        const total = rowTotal(item);
        const settled = isSettled(item.status);
        return (
          <tr key={item.id}>
            <td className="c-title">{tr(item.task_name)}</td>
            <td className="c-num" data-label={isAr ? 'أبيض' : 'White'}>{item.white_qty !== null ? num(item.white_qty) : '-'}</td>
            <td className="c-num" data-label={isAr ? 'جوزي' : 'Walnut'}>{item.brown_qty !== null ? num(item.brown_qty) : '-'}</td>
            <td className="c-num c-strong" data-label={isAr ? 'المجموع' : 'Total'}>{total !== null ? num(total) : '-'}</td>
            <td className="c-full" data-label={t('colFieldStatus')}>
              <span className={`status-line ${settled ? 'is-ok' : 'is-open'}`}>
                {settled ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
                <span>{tr(item.status) || t('notSpecifiedYet')}</span>
              </span>
            </td>
            {editable && (
              <td className="c-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(item)} aria-label={`${isAr ? 'تعديل' : 'Edit'} ${tr(item.task_name)}`}>
                  <Pencil size={15} aria-hidden="true" />
                  {isAr ? 'تعديل' : 'Edit'}
                </button>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

function MarbleEditSheet({ item, lang, t, tr, suggestions, onClose, onSave }) {
  const isAr = lang === 'ar';
  const [white, setWhite] = useState('');
  const [brown, setBrown] = useState('');
  const [status, setStatus] = useState('');
  const [openedFor, setOpenedFor] = useState(null);
  const [saving, setSaving] = useState(false);

  if (item && openedFor !== item.id) {
    setOpenedFor(item.id);
    setWhite(item.white_qty !== null ? String(item.white_qty) : '');
    setBrown(item.brown_qty !== null ? String(item.brown_qty) : '');
    setStatus(item.status || '');
  }
  if (!item) {
    if (openedFor !== null) setOpenedFor(null);
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(item.id, status, white === '' ? null : parseInt(white, 10), brown === '' ? null : parseInt(brown, 10));
    } catch {
      // App shows the error; keep the sheet open.
    } finally {
      setSaving(false);
    }
  };

  const total = (parseInt(white, 10) || 0) + (parseInt(brown, 10) || 0);

  return (
    <Modal
      open={Boolean(item)}
      onClose={saving ? undefined : onClose}
      title={tr(item.task_name)}
      description={zoneLabel(item.zone, isAr)}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="submit" form="marble-form" className="btn btn--primary" aria-busy={saving}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </>
      }
    >
      <form id="marble-form" className="stack-sm" onSubmit={submit}>
        <div className="form-grid form-grid--tight">
          <Field label={t('colWhiteQty')} htmlFor="mr-white" hint={isAr ? 'اتركه فارغاً إن لم يُحدد' : 'Leave empty if not set'}>
            <input id="mr-white" className="input input--num" type="number" inputMode="numeric" min="0" value={white} onChange={(e) => setWhite(e.target.value)} data-autofocus />
          </Field>
          <Field label={t('colBrownQty')} htmlFor="mr-brown">
            <input id="mr-brown" className="input input--num" type="number" inputMode="numeric" min="0" value={brown} onChange={(e) => setBrown(e.target.value)} />
          </Field>
        </div>
        <div className="alert">
          <span className="fw-bold">{isAr ? 'المجموع' : 'Total'}:</span>
          <span className="num fw-black">{num(total)}</span>
          <span className="muted">{palletText(total, isAr)}</span>
        </div>
        <Field label={t('colFieldStatus')} htmlFor="mr-status">
          <input id="mr-status" className="input" list="marble-status-options" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('enterFieldStatus')} />
          <datalist id="marble-status-options">
            {suggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>
      </form>
    </Modal>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

function buildMarbleReport({ zones, totals, lang, tr }) {
  const isAr = lang === 'ar';
  const rows = [];
  zones.forEach(g => {
    rows.push({ group: zoneLabel(g.zone, isAr), note: `${isAr ? 'أبيض' : 'White'} ${num(g.white)} · ${isAr ? 'جوزي' : 'Walnut'} ${num(g.brown)} · ${isAr ? 'المجموع' : 'Total'} ${num(g.white + g.brown)}` });
    g.items.forEach(item => {
      const total = rowTotal(item);
      rows.push([
        { v: tr(item.task_name), strong: true },
        { v: item.white_qty !== null ? num(item.white_qty) : '-', align: 'center' },
        { v: item.brown_qty !== null ? num(item.brown_qty) : '-', align: 'center' },
        { v: total !== null ? num(total) : '-', align: 'center', strong: true },
        { v: tr(item.status) || '-', tone: isSettled(item.status) ? 'success' : undefined },
      ]);
    });
  });

  const body = [
    h.kpis([
      { label: isAr ? 'المرمر الأبيض' : 'White marble', value: `${num(totals.white)}`, sub: palletText(totals.white, isAr) },
      { label: isAr ? 'المرمر الجوزي' : 'Walnut marble', value: `${num(totals.brown)}`, sub: palletText(totals.brown, isAr) },
      { label: isAr ? 'المجموع الكلي' : 'Grand total', value: `${num(totals.all)}`, tone: 'success', sub: palletText(totals.all, isAr) },
    ]),
    h.section(isAr ? 'التوزيع حسب المنطقة وطبيعة العمل' : 'Distribution by zone and task', h.table({
      columns: [
        { label: isAr ? 'طبيعة العمل' : 'Task' },
        { label: isAr ? 'أبيض (قطعة)' : 'White (pcs)', align: 'center', width: '26mm' },
        { label: isAr ? 'جوزي (قطعة)' : 'Walnut (pcs)', align: 'center', width: '26mm' },
        { label: isAr ? 'الإجمالي' : 'Total', align: 'center', width: '24mm' },
        { label: isAr ? 'الموقف الميداني' : 'Field status', width: '50mm' },
      ],
      rows,
      foot: [
        { v: isAr ? 'الإجمالي التراكمي لكل المناطق' : 'Grand total, all zones', strong: true },
        num(totals.white), num(totals.brown), num(totals.all), '',
      ],
    }), { index: 1 }),
  ].map(String).join('');

  return buildReport({
    lang,
    title: isAr ? 'تقرير توزيع قطع المرمر حسب المناطق والألوان' : 'Marble Distribution by Zone and Colour',
    code: docCode('MRB'),
    meta: [
      { label: isAr ? 'المناطق' : 'Zones', value: String(zones.length) },
      { label: isAr ? 'فقرات العمل' : 'Tasks', value: String(zones.reduce((s, g) => s + g.items.length, 0)) },
      { label: isAr ? 'قطع في السكيبة' : 'Pieces per pallet', value: String(PALLET) },
    ],
    body,
  });
}
