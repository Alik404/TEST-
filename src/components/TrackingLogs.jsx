import { useMemo, useState } from 'react';
import { Search, Printer, Pencil, Save, SearchX, CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { num, dmyToIso, isoToDmy } from '../utils/format';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { canEdit } from '../navigation';
import useMediaQuery, { WIDE } from '../hooks/useMediaQuery';
import { StatCard, EmptyState, Chips, Segmented, Modal, Field, LoadingBlock } from './ui';

const ZONES = ['Zone A', 'Zone B', 'Zone C'];
const DONE = 'منجز';
const PENDING = 'متبقي';

const zoneLabel = (zone, isAr) => (isAr ? zone.replace('Zone', 'زون') : zone);
const entitlement = (n) => (n.white_applied || 0) + (n.brown_applied || 0);

const sumBy = (list, key) => list.reduce((s, n) => s + (Number(n[key]) || 0), 0);

export default function TrackingLogs({ nazalat, user, onUpdateNazalaDetails, loading, t, lang }) {
  const isAr = lang === 'ar';
  const wide = useMediaQuery(WIDE);
  const editable = canEdit(user);

  const [zone, setZone] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);

  const all = useMemo(() => (Array.isArray(nazalat) ? nazalat : []), [nazalat]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(n =>
      (zone === 'all' || n.zone === zone) &&
      (status === 'all' || n.status === status) &&
      (!q || String(n.code).toLowerCase().includes(q)));
  }, [all, zone, status, query]);

  const grouped = useMemo(() => ZONES
    .map(z => ({ zone: z, items: filtered.filter(n => n.zone === z) }))
    .filter(g => g.items.length > 0), [filtered]);

  const doneCount = filtered.filter(n => n.status === DONE).length;

  const print = (onlyZone) => {
    const source = onlyZone ? filtered.filter(n => n.zone === onlyZone) : filtered;
    openReport(buildTrackingReport({ list: source, zoneFilter: onlyZone || (zone !== 'all' ? zone : null), lang }), {
      title: isAr ? 'سجل تقدم النزلات' : 'Downspouts progress log',
      orientation: 'landscape',
    });
  };

  if (loading && all.length === 0) return <LoadingBlock label={t('loadingNazalat')} />;

  return (
    <div className="stack">
      <section className="stat-grid stat-grid--3" aria-label={isAr ? 'ملخص النزلات' : 'Downspouts summary'}>
        <StatCard label={t('statsShowing')} value={num(filtered.length)} icon={ListChecks} />
        <StatCard label={t('statsCompleted')} value={num(doneCount)} icon={CheckCircle2} tone="accent" />
        <StatCard label={t('statsPending')} value={num(filtered.length - doneCount)} icon={Clock} tone="warn" />
      </section>

      <section className="card">
        <div className="card-body stack-sm">
          <div className="toolbar">
            <div className="input-group toolbar-grow">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                className="input"
                placeholder={t('searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('searchPlaceholder')}
                inputMode="search"
                enterKeyHint="search"
              />
            </div>
            <Segmented
              label={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: isAr ? 'الكل' : 'All' },
                { value: DONE, label: t('statusDone') },
                { value: PENDING, label: t('statusPending') },
              ]}
            />
            <button type="button" className="btn btn--secondary" onClick={() => print()}>
              <Printer size={18} aria-hidden="true" />
              <span>{isAr ? 'تقرير PDF' : 'PDF report'}</span>
            </button>
          </div>
          <Chips
            label={isAr ? 'تصفية حسب الزون' : 'Filter by zone'}
            value={zone}
            onChange={setZone}
            options={[
              { value: 'all', label: t('allZones'), count: all.length },
              ...ZONES.map(z => ({ value: z, label: zoneLabel(z, isAr), count: all.filter(n => n.zone === z).length })),
            ]}
          />
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={SearchX}
            title={t('noNazalatFound')}
            text={isAr ? 'غيّر كلمة البحث أو الزون أو الحالة.' : 'Change the search, zone or status.'}
            action={(query || zone !== 'all' || status !== 'all') && (
              <button type="button" className="btn btn--secondary" onClick={() => { setQuery(''); setZone('all'); setStatus('all'); }}>
                {isAr ? 'مسح التصفية' : 'Clear filters'}
              </button>
            )}
          />
        </section>
      ) : wide ? (
        <TrackingTable groups={grouped} isAr={isAr} t={t} editable={editable} onEdit={setEditing} onPrintZone={print} />
      ) : (
        grouped.map(g => (
          <ZoneTiles key={g.zone} group={g} isAr={isAr} editable={editable} onEdit={setEditing} onPrintZone={print} />
        ))
      )}

      <NazalaEditSheet
        item={editing}
        t={t}
        lang={lang}
        onClose={() => setEditing(null)}
        onSave={async (id, form) => {
          await onUpdateNazalaDetails(id, form);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ZoneSummary({ items, isAr }) {
  return (
    <span className="text-xs muted">
      <span className="num">{items.length}</span> {isAr ? 'نزلة' : 'downspouts'} · {isAr ? 'الاستحقاق' : 'entitlement'} <strong className="num text-accent">{num(items.reduce((s, n) => s + entitlement(n), 0))}</strong>
    </span>
  );
}

function StatusBadge({ value, t }) {
  const done = value === DONE;
  return (
    <span className={`badge ${done ? 'badge--success' : 'badge--warn'}`}>
      {done ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />}
      {done ? t('statusDone') : t('statusPending')}
    </span>
  );
}

/** Phones: two compact tiles per row, grouped by zone. */
function ZoneTiles({ group, isAr, editable, onEdit, onPrintZone }) {
  return (
    <section className="card" aria-label={zoneLabel(group.zone, isAr)}>
      <div className="card-header card-header--divided">
        <div>
          <h2 className="card-title">{zoneLabel(group.zone, isAr)}</h2>
          <ZoneSummary items={group.items} isAr={isAr} />
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPrintZone(group.zone)}>
          <Printer size={16} aria-hidden="true" />
          {isAr ? 'طباعة الزون' : 'Print zone'}
        </button>
      </div>
      <ul className="tile-grid">
        {group.items.map(n => {
          const done = n.status === DONE;
          const content = (
            <>
              <span className="tile-top">
                <span className="tile-code num">{n.code}</span>
                <span className={`status-dot ${done ? 'is-done' : 'is-pending'}`} aria-hidden="true" />
                <span className="sr-only">{done ? 'منجز' : 'متبقي'}</span>
              </span>
              <span className="tile-figs">
                <span><span className="swatch" style={{ background: 'var(--viz-white)' }} /><span className="num">{n.white_applied || 0}</span><span className="muted">/<span className="num">{n.white_marked || 0}</span></span></span>
                <span><span className="swatch" style={{ background: 'var(--viz-brown)' }} /><span className="num">{n.brown_applied || 0}</span><span className="muted">/<span className="num">{n.brown_marked || 0}</span></span></span>
              </span>
              <span className="tile-foot">
                <span className="muted">{isAr ? 'الاستحقاق' : 'Due'}</span>
                <strong className="num">{entitlement(n)}</strong>
              </span>
            </>
          );
          return (
            <li key={n.id}>
              {editable ? (
                <button
                  type="button"
                  className="tile"
                  onClick={() => onEdit(n)}
                  aria-label={`${n.code}، ${done ? 'منجز' : 'متبقي'}. ${isAr ? 'اضغط للتعديل' : 'Tap to edit'}`}
                >
                  {content}
                </button>
              ) : (
                <div className="tile">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tile-legend text-xs muted">
        <span><span className="swatch" style={{ background: 'var(--viz-white)' }} />{isAr ? 'أبيض مطبق / مؤشر' : 'White applied / marked'}</span>
        <span><span className="swatch" style={{ background: 'var(--viz-brown)' }} />{isAr ? 'جوزي مطبق / مؤشر' : 'Walnut applied / marked'}</span>
      </p>
    </section>
  );
}

/** Wide screens: the full register with white / walnut column groups. */
function TrackingTable({ groups, isAr, t, editable, onEdit, onPrintZone }) {
  const cols = editable ? 12 : 11;
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="dt dt--grouped dt--dense">
          <thead>
            <tr>
              <th rowSpan={2}>{isAr ? 'النزلة' : 'Downspout'}</th>
              <th colSpan={4} className="c-center th-group">{isAr ? 'المرمر الأبيض' : 'White marble'}</th>
              <th colSpan={4} className="c-center th-group th-group--brown">{isAr ? 'المرمر الجوزي' : 'Walnut marble'}</th>
              <th rowSpan={2} className="c-num">{isAr ? 'الاستحقاق' : 'Entitlement'}</th>
              <th rowSpan={2}>{isAr ? 'الحالة' : 'Status'}</th>
              {editable && <th rowSpan={2} className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>}
            </tr>
            <tr>
              <th className="c-num">{isAr ? 'المؤشر' : 'Marked'}</th>
              <th className="c-num">{isAr ? 'إضافي' : 'Extra'}</th>
              <th className="c-num">{isAr ? 'المطبق' : 'Applied'}</th>
              <th className="c-num">{isAr ? 'التاريخ' : 'Date'}</th>
              <th className="c-num">{isAr ? 'المؤشر' : 'Marked'}</th>
              <th className="c-num">{isAr ? 'إضافي' : 'Extra'}</th>
              <th className="c-num">{isAr ? 'المطبق' : 'Applied'}</th>
              <th className="c-num">{isAr ? 'التاريخ' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <ZoneRows key={g.zone} group={g} cols={cols} isAr={isAr} t={t} editable={editable} onEdit={onEdit} onPrintZone={onPrintZone} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ZoneRows({ group, cols, isAr, t, editable, onEdit, onPrintZone }) {
  const { items } = group;
  return (
    <>
      <tr className="group-row">
        <td colSpan={cols}>
          <div className="group-row-inner">
            <span>{zoneLabel(group.zone, isAr)} <ZoneSummary items={items} isAr={isAr} /></span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPrintZone(group.zone)}>
              <Printer size={15} aria-hidden="true" />
              {isAr ? 'طباعة الزون' : 'Print zone'}
            </button>
          </div>
        </td>
      </tr>
      {items.map(n => (
        <tr key={n.id}>
          <td className="c-strong"><span className="num">{n.code}</span></td>
          <td className="c-num">{n.white_marked || 0}</td>
          <td className="c-num text-success">{n.white_extra || 0}</td>
          <td className="c-num c-strong">{n.white_applied || 0}</td>
          <td className="c-num c-muted">{n.white_date || '-'}</td>
          <td className="c-num">{n.brown_marked || 0}</td>
          <td className="c-num text-success">{n.brown_extra || 0}</td>
          <td className="c-num c-strong">{n.brown_applied || 0}</td>
          <td className="c-num c-muted">{n.brown_date || '-'}</td>
          <td className="c-num c-strong text-accent">{entitlement(n)}</td>
          <td><StatusBadge value={n.status} t={t} /></td>
          {editable && (
            <td className="c-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(n)} aria-label={`${t('edit')} ${n.code}`}>
                <Pencil size={15} aria-hidden="true" />
                {t('edit')}
              </button>
            </td>
          )}
        </tr>
      ))}
      <tr className="subtotal-row">
        <td>{isAr ? 'مجموع' : 'Total'} {zoneLabel(group.zone, isAr)}</td>
        <td className="c-num">{num(sumBy(items, 'white_marked'))}</td>
        <td className="c-num">{num(sumBy(items, 'white_extra'))}</td>
        <td className="c-num">{num(sumBy(items, 'white_applied'))}</td>
        <td />
        <td className="c-num">{num(sumBy(items, 'brown_marked'))}</td>
        <td className="c-num">{num(sumBy(items, 'brown_extra'))}</td>
        <td className="c-num">{num(sumBy(items, 'brown_applied'))}</td>
        <td />
        <td className="c-num text-accent">{num(items.reduce((s, n) => s + entitlement(n), 0))}</td>
        <td colSpan={editable ? 2 : 1} />
      </tr>
    </>
  );
}

const FIELDS = ['marked', 'extra', 'applied'];

function NazalaEditSheet({ item, t, lang, onClose, onSave }) {
  const isAr = lang === 'ar';
  const [form, setForm] = useState({});
  const [openedFor, setOpenedFor] = useState(null);
  const [saving, setSaving] = useState(false);

  if (item && openedFor !== item.id) {
    setOpenedFor(item.id);
    setForm({
      white_marked: item.white_marked || 0,
      white_extra: item.white_extra || 0,
      white_applied: item.white_applied || 0,
      white_date: item.white_date || '',
      brown_marked: item.brown_marked || 0,
      brown_extra: item.brown_extra || 0,
      brown_applied: item.brown_applied || 0,
      brown_date: item.brown_date || '',
      status: item.status || PENDING,
    });
  }
  if (!item) {
    if (openedFor !== null) setOpenedFor(null);
    return null;
  }

  const setNum = (key) => (e) => setForm(f => ({ ...f, [key]: parseInt(e.target.value, 10) || 0 }));
  const setDate = (key) => (e) => setForm(f => ({ ...f, [key]: isoToDmy(e.target.value) }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(item.id, form);
    } catch {
      // App shows the error toast; keep the sheet open so nothing is lost.
    } finally {
      setSaving(false);
    }
  };

  const labels = {
    white: { marked: t('whiteMarked'), extra: t('whiteExtra'), applied: t('whiteApplied'), date: t('whiteDate') },
    brown: { marked: t('brownMarked'), extra: t('brownExtra'), applied: t('brownApplied'), date: t('brownDate') },
  };

  const colourBlock = (colour) => {
    const dateKey = `${colour}_date`;
    const stored = form[dateKey];
    const iso = dmyToIso(stored);
    return (
      <fieldset className="form-section">
        <legend className="form-section-title">
          <span><span className="swatch" style={{ background: `var(--viz-${colour})`, display: 'inline-block', marginInlineEnd: 'var(--space-2)' }} />
            {colour === 'white' ? (isAr ? 'المرمر الأبيض' : 'White marble') : (isAr ? 'المرمر الجوزي' : 'Walnut marble')}</span>
        </legend>
        <div className="form-grid form-grid--tight">
          {FIELDS.map(f => (
            <Field key={f} label={labels[colour][f]} htmlFor={`${colour}-${f}`}>
              <input
                id={`${colour}-${f}`}
                className="input input--num"
                type="number"
                inputMode="numeric"
                min="0"
                value={form[`${colour}_${f}`] ?? 0}
                onChange={setNum(`${colour}_${f}`)}
              />
            </Field>
          ))}
          <Field
            label={labels[colour].date}
            htmlFor={`${colour}-date`}
            hint={stored && !iso ? `${isAr ? 'القيمة المسجلة' : 'Stored value'}: ${stored}` : undefined}
          >
            <input id={`${colour}-date`} className="input" type="date" value={iso} onChange={setDate(dateKey)} />
          </Field>
        </div>
      </fieldset>
    );
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={saving ? undefined : onClose}
      title={`${t('quickEditNazala')} ${item.code}`}
      description={zoneLabel(item.zone, isAr)}
      size="lg"
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>{t('cancel')}</button>
          <button type="submit" form="nazala-form" className="btn btn--primary" aria-busy={saving}>
            <Save size={18} aria-hidden="true" />
            {t('save')}
          </button>
        </>
      }
    >
      <form id="nazala-form" onSubmit={submit} className="stack-sm">
        <Field label={isAr ? 'الحالة الميدانية' : 'Field status'}>
          <Segmented
            label={isAr ? 'الحالة الميدانية' : 'Field status'}
            value={form.status}
            onChange={(v) => setForm(f => ({ ...f, status: v }))}
            options={[
              { value: PENDING, label: t('statusPending'), icon: Clock },
              { value: DONE, label: t('statusDone'), icon: CheckCircle2 },
            ]}
          />
        </Field>
        {colourBlock('white')}
        {colourBlock('brown')}
        <div className="alert">
          <span className="fw-bold">{isAr ? 'استحقاق الخلفة' : 'Entitlement'}:</span>
          <span className="num fw-black">{(form.white_applied || 0) + (form.brown_applied || 0)}</span>
          <span className="muted">{isAr ? 'قطعة (أبيض مطبق + جوزي مطبق)' : 'pieces (white + walnut applied)'}</span>
        </div>
      </form>
    </Modal>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

function buildTrackingReport({ list, zoneFilter, lang }) {
  const isAr = lang === 'ar';
  const zones = ZONES.map(z => ({ zone: z, items: list.filter(n => n.zone === z) })).filter(g => g.items.length);
  const done = list.filter(n => n.status === DONE).length;
  const totalEnt = list.reduce((s, n) => s + entitlement(n), 0);

  const columns = [
    { label: isAr ? 'النزلة' : 'Code', align: 'center', width: '16mm' },
    { label: isAr ? 'المؤشر' : 'Marked', align: 'center' },
    { label: isAr ? 'إضافي' : 'Extra', align: 'center' },
    { label: isAr ? 'المطبق' : 'Applied', align: 'center' },
    { label: isAr ? 'التاريخ' : 'Date', align: 'center' },
    { label: isAr ? 'المؤشر' : 'Marked', align: 'center' },
    { label: isAr ? 'إضافي' : 'Extra', align: 'center' },
    { label: isAr ? 'المطبق' : 'Applied', align: 'center' },
    { label: isAr ? 'التاريخ' : 'Date', align: 'center' },
    { label: isAr ? 'الاستحقاق' : 'Entitlement', align: 'center' },
    { label: isAr ? 'الحالة' : 'Status', align: 'center' },
  ];
  const groups = [
    { label: '', span: 1 },
    { label: isAr ? 'المرمر الأبيض' : 'White marble', span: 4 },
    { label: isAr ? 'المرمر الجوزي' : 'Walnut marble', span: 4 },
    { label: '', span: 2 },
  ];

  const sections = zones.map((g, i) => h.section(
    zoneLabel(g.zone, isAr),
    h.table({
      columns,
      groups,
      compact: true,
      rows: g.items.map(n => ({
        cls: n.status === DONE ? 'done' : '',
        cells: [
          { v: n.code, strong: true },
          n.white_marked || 0, { v: n.white_extra || 0, tone: 'success' }, { v: n.white_applied || 0, strong: true }, { v: n.white_date || '-', tone: 'muted' },
          n.brown_marked || 0, { v: n.brown_extra || 0, tone: 'success' }, { v: n.brown_applied || 0, strong: true }, { v: n.brown_date || '-', tone: 'muted' },
          { v: entitlement(n), strong: true },
          h.badge(n.status, n.status === DONE ? 'success' : 'warn'),
        ],
      })),
      foot: [
        { v: `${isAr ? 'مجموع' : 'Total'} ${zoneLabel(g.zone, isAr)}` },
        num(sumBy(g.items, 'white_marked')), num(sumBy(g.items, 'white_extra')), num(sumBy(g.items, 'white_applied')), '-',
        num(sumBy(g.items, 'brown_marked')), num(sumBy(g.items, 'brown_extra')), num(sumBy(g.items, 'brown_applied')), '-',
        num(g.items.reduce((s, n) => s + entitlement(n), 0)), '-',
      ],
    }),
    { index: i + 1, note: `${g.items.length} ${isAr ? 'نزلة' : 'downspouts'}` }
  )).map(String).join('');

  return buildReport({
    lang,
    orientation: 'landscape',
    title: isAr ? 'جدول تقدم أعمال سجل النزلات' : 'Downspouts Progress Register',
    subtitle: zoneFilter ? zoneLabel(zoneFilter, isAr) : (isAr ? 'جميع الزونات' : 'All zones'),
    code: docCode('NZL'),
    meta: [
      { label: isAr ? 'عدد النزلات' : 'Downspouts', value: num(list.length) },
      { label: isAr ? 'المنجز' : 'Done', value: num(done) },
      { label: isAr ? 'المتبقي' : 'Remaining', value: num(list.length - done) },
      { label: isAr ? 'أبيض مطبق' : 'White applied', value: num(sumBy(list, 'white_applied')) },
      { label: isAr ? 'إجمالي الاستحقاق' : 'Total entitlement', value: num(totalEnt) },
    ],
    body: sections,
  });
}
