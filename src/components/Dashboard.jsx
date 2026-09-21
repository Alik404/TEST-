import { useEffect, useMemo, useState } from 'react';
import {
  Award, Layers, CheckCircle2, Clock, Boxes, ListChecks, Printer,
  PackageOpen, ArrowLeft, ArrowRight, Pencil, Save
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { num, pct, qty, unit as fmtUnit, date as fmtDate } from '../utils/format';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { canEdit } from '../navigation';
import { StatCard, ProgressBar, EmptyState, Chips, Modal, Field } from './ui';
import { progressTone } from './ui/tone';
import Donut from './ui/Donut';

const AUTO_NAZALAT_TASK = 'تطبيك النزلات (محدث تلقائياً)';

const cleanName = (name = '') => name.replace(' (محدث تلقائياً)', '').replace(' (تحديث تلقائي)', '');

/**
 * Figures for one task row. The auto-updated downspouts task takes its done
 * count from the live downspout log instead of the stored quantity.
 */
function taskFigures(task, kpis) {
  const total = task.total_quantity;
  const hasQty = total !== null && total !== undefined && total > 0;
  const isAutoNazalat = task.name === AUTO_NAZALAT_TASK && task.is_manual === 0;
  const done = hasQty
    ? (isAutoNazalat ? (kpis.nazalat_completed || 0) : (task.completed_quantity || 0))
    : null;
  const remaining = hasQty
    ? (isAutoNazalat ? (kpis.nazalat_total || 0) - (kpis.nazalat_completed || 0) : Math.max(0, total - (task.completed_quantity || 0)))
    : null;
  return { hasQty, total, done, remaining, progress: Number(task.progress_percent) || 0 };
}

export default function Dashboard({ kpis, tasks, categories, user, onUpdateProgress, t, lang, translateText }) {
  const isAr = lang === 'ar';
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const k = kpis || {};
  const tr = (text) => translateText(text, lang);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [latestMaterials, setLatestMaterials] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/materials-consumption')
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (!cancelled) setLatestMaterials(Array.isArray(data) && data.length ? data[0] : null); })
      .catch(() => { if (!cancelled) setLatestMaterials(null); });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    done: safeTasks.filter(x => (Number(x.progress_percent) || 0) >= 100).length,
    active: safeTasks.filter(x => { const p = Number(x.progress_percent) || 0; return p > 0 && p < 100; }).length,
    idle: safeTasks.filter(x => (Number(x.progress_percent) || 0) === 0).length,
  }), [safeTasks]);

  const categoryStats = useMemo(() => safeCategories.map(cat => {
    const list = safeTasks.filter(x => x.category_name === cat.name);
    const avg = list.length ? list.reduce((s, x) => s + (Number(x.progress_percent) || 0), 0) / list.length : 0;
    return { ...cat, tasks: list, avg, done: list.filter(x => (Number(x.progress_percent) || 0) >= 100).length };
  }).filter(c => c.tasks.length > 0), [safeCategories, safeTasks]);

  const overall = Number(k.overall_progress_percent) || 0;
  const marblexPieces = safeTasks.find(x => x.name && x.name.includes('الماربلكس (القطع)'));
  const white = Number(k.applied_white_marble) || 0;
  const brown = Number(k.applied_brown_marble) || 0;
  const marbleTotal = Number(k.applied_marble_pieces) || white + brown;
  const editable = canEdit(user);

  const visibleCategories = categoryFilter === 'all'
    ? categoryStats
    : categoryStats.filter(c => String(c.id) === categoryFilter);

  const printReport = () => openReport(buildProgressReport({ tasks: safeTasks, categories: categoryStats, kpis: k, counts, user, lang, tr }), {
    title: isAr ? 'الجدول العام لتقدم العمل' : 'Project progress schedule',
  });

  return (
    <div className="stack">
      {/* Overview */}
      <section className="stat-grid stat-grid--bento" aria-label={isAr ? 'ملخص الإنجاز' : 'Progress summary'}>
        <StatCard
          hero
          label={t('kpiProgressTitle')}
          value={pct(overall, 2)}
          icon={Award}
          tone="accent"
          progress={overall}
          meta={
            <span className="dash-counts">
              <span><CheckCircle2 size={14} aria-hidden="true" /> {isAr ? 'منجزة' : 'Done'} <strong className="num">{counts.done}</strong></span>
              <span><Clock size={14} aria-hidden="true" /> {isAr ? 'قيد العمل' : 'In progress'} <strong className="num">{counts.active}</strong></span>
              <span><ListChecks size={14} aria-hidden="true" /> {isAr ? 'لم تبدأ' : 'Not started'} <strong className="num">{counts.idle}</strong></span>
            </span>
          }
        />
        <StatCard
          label={t('kpiNazalatTitle')}
          value={pct(k.nazalat_progress_percent || 0, 0)}
          icon={ListChecks}
          tone={progressTone(k.nazalat_progress_percent) === 'success' ? 'accent' : 'warn'}
          progress={k.nazalat_progress_percent || 0}
          meta={<><strong className="num">{num(k.nazalat_completed)}</strong> {isAr ? 'من' : 'of'} <span className="num">{num(k.nazalat_total)}</span> {isAr ? 'نزلة' : 'downspouts'}</>}
        />
        <StatCard
          label={t('kpiMarbleTitle')}
          value={num(marbleTotal)}
          unit={isAr ? 'قطعة' : 'pcs'}
          icon={Layers}
          meta={<>{isAr ? 'أبيض' : 'White'} <strong className="num">{num(white)}</strong> · {isAr ? 'جوزي' : 'Walnut'} <strong className="num">{num(brown)}</strong></>}
        />
        <StatCard
          label={t('kpiSkylightTitle')}
          value={pct(k.skylight_progress_percent || 0, 0)}
          icon={CheckCircle2}
          tone="accent"
          progress={k.skylight_progress_percent || 0}
          meta={t('kpiSkylightSubtext')}
        />
        {marblexPieces && (
          <StatCard
            label={isAr ? 'ألواح الماربلكس' : 'Marblex panels'}
            value={pct(marblexPieces.progress_percent, 1)}
            icon={Boxes}
            tone="info"
            progress={marblexPieces.progress_percent}
            meta={<><strong className="num">{num(marblexPieces.completed_quantity)}</strong> {isAr ? 'من' : 'of'} <span className="num">{num(marblexPieces.total_quantity)}</span> {isAr ? 'قطعة' : 'pcs'}</>}
          />
        )}
      </section>

      <div className="grid-main-side">
        {/* Progress by category */}
        <section className="card" aria-labelledby="dash-cat-title">
          <div className="card-header">
            <div>
              <h2 id="dash-cat-title" className="card-title">{isAr ? 'الإنجاز حسب القسم' : 'Progress by category'}</h2>
              <p className="card-subtitle">{isAr ? 'متوسط نسبة الإنجاز لفقرات كل قسم' : 'Average completion of each category’s tasks'}</p>
            </div>
          </div>
          <div className="card-body">
            {categoryStats.length === 0 ? (
              <EmptyState title={isAr ? 'لا توجد فقرات بعد' : 'No tasks yet'} />
            ) : (
              <ul className="cat-list">
                {categoryStats.map(c => (
                  <li key={c.id} className="cat-row">
                    <div className="cat-row-head">
                      <span className="fw-bold">{tr(c.name)}</span>
                      <span className="text-xs muted">
                        <span className="num">{c.done}</span>/<span className="num">{c.tasks.length}</span> {isAr ? 'مكتملة' : 'done'}
                      </span>
                    </div>
                    <ProgressBar value={c.avg} label={tr(c.name)} showValue />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="stack">
          {/* Marble by colour */}
          <section className="card" aria-labelledby="dash-marble-title">
            <div className="card-header">
              <h2 id="dash-marble-title" className="card-title">{t('chartMarbleTitle')}</h2>
            </div>
            <div className="card-body marble-split">
              <Donut
                label={isAr ? `المرمر المطبق: أبيض ${white}، جوزي ${brown}` : `Applied marble: white ${white}, walnut ${brown}`}
                centerValue={num(marbleTotal)}
                centerLabel={isAr ? 'قطعة' : 'pieces'}
                segments={[
                  { value: white, color: 'var(--viz-white)' },
                  { value: brown, color: 'var(--viz-brown)' },
                ]}
              />
              <div className="legend">
                <div className="legend-row">
                  <span className="legend-key"><span className="swatch" style={{ background: 'var(--viz-white)' }} />{isAr ? 'مرمر أبيض' : 'White marble'}</span>
                  <span className="num fw-bold">{num(white)}</span>
                </div>
                <div className="legend-row">
                  <span className="legend-key"><span className="swatch" style={{ background: 'var(--viz-brown)' }} />{isAr ? 'مرمر جوزي' : 'Walnut marble'}</span>
                  <span className="num fw-bold">{num(brown)}</span>
                </div>
                <hr className="divider" />
                <div className="legend-row fw-black">
                  <span>{t('chartTotalApplied')}</span>
                  <span className="num">{num(marbleTotal)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Latest materials */}
          <LatestMaterials report={latestMaterials} lang={lang} />
        </div>
      </div>

      {/* Progress schedule */}
      <section className="card" aria-labelledby="dash-table-title">
        <div className="card-header card-header--divided">
          <div>
            <h2 id="dash-table-title" className="card-title">{t('tableTitle')}</h2>
            <p className="card-subtitle">
              {editable
                ? (isAr ? 'اضغط على أي فقرة لتحديث الكمية المنجزة والملاحظات.' : 'Tap a task to update its completed quantity and notes.')
                : (isAr ? 'عرض فقط. التعديل متاح لمهندسي الموقع.' : 'Read only. Site engineers can edit.')}
            </p>
          </div>
          <button type="button" className="btn btn--secondary" onClick={printReport}>
            <Printer size={18} aria-hidden="true" />
            {isAr ? 'تقرير PDF' : 'PDF report'}
          </button>
        </div>

        <div className="card-body" style={{ paddingBlockEnd: 0 }}>
          <Chips
            label={isAr ? 'تصفية حسب القسم' : 'Filter by category'}
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: isAr ? 'كل الأقسام' : 'All', count: safeTasks.length },
              ...categoryStats.map(c => ({ value: String(c.id), label: tr(c.name), count: c.tasks.length })),
            ]}
          />
        </div>

        <div className="table-wrap">
          <table className="dt dt--stack dt--stack3">
            <thead>
              <tr>
                <th>{t('colTask')}</th>
                <th className="c-num">{t('colTotalQty')}</th>
                <th className="c-num">{t('colCompleted')}</th>
                <th className="c-num">{t('colRemaining')}</th>
                <th style={{ minWidth: '10rem' }}>{t('colProgress')}</th>
                <th>{t('colNotes')}</th>
                {editable && <th className="c-actions"><span className="sr-only">{isAr ? 'إجراءات' : 'Actions'}</span></th>}
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map(cat => (
                <CategoryRows
                  key={cat.id}
                  category={cat}
                  kpis={k}
                  tr={tr}
                  t={t}
                  isAr={isAr}
                  editable={editable}
                  onEdit={setEditing}
                />
              ))}
            </tbody>
            {categoryFilter === 'all' && (
              <tfoot>
                <tr>
                  <td className="c-full">
                    {isAr ? 'المحصلة الإجمالية' : 'Overall'}
                    <span className="muted text-xs"> · <span className="num">{safeTasks.length}</span> {isAr ? 'فقرة' : 'tasks'}</span>
                  </td>
                  <td className="c-num" data-label={isAr ? 'منجزة' : 'Done'}><span className="text-success num">{counts.done}</span></td>
                  <td className="c-num" data-label={isAr ? 'قيد العمل' : 'Active'}><span className="text-warn num">{counts.active}</span></td>
                  <td className="c-num" data-label={isAr ? 'لم تبدأ' : 'Not started'}><span className="num">{counts.idle}</span></td>
                  <td className="c-full"><ProgressBar value={overall} label={t('kpiProgressTitle')} showValue decimals={2} /></td>
                  <td className="c-hide-sm muted text-xs">{isAr ? 'محسوبة تراكمياً لكل الفقرات' : 'Cumulative across all tasks'}</td>
                  {editable && <td className="c-hide-sm" />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <TaskEditSheet
        task={editing}
        kpis={k}
        tr={tr}
        t={t}
        lang={lang}
        onClose={() => setEditing(null)}
        onSave={async (taskId, progress, notes, completed) => {
          await onUpdateProgress(taskId, progress, notes, completed);
          setEditing(null);
        }}
      />
    </div>
  );
}

function CategoryRows({ category, kpis, tr, t, isAr, editable, onEdit }) {
  return (
    <>
      <tr className="group-row">
        <td colSpan={editable ? 7 : 6}>
          <div className="group-row-inner">
            <span>{tr(category.name)}</span>
            <span className="muted">
              <span className="num">{category.tasks.length}</span> {isAr ? 'فقرات' : 'tasks'} · {isAr ? 'المتوسط' : 'avg'} <span className="num">{pct(category.avg)}</span>
            </span>
          </div>
        </td>
      </tr>
      {category.tasks.map(task => {
        const f = taskFigures(task, kpis);
        const rowEditable = editable && Boolean(task.is_manual);
        const u = tr(task.unit);
        return (
          <tr
            key={task.id}
            data-clickable={rowEditable || undefined}
            onClick={rowEditable ? () => onEdit(task) : undefined}
          >
            <td className="c-title">
              <span className="task-name">
                {tr(task.name)}
                {!task.is_manual && <span className="badge badge--info">{t('badgeAuto')}</span>}
              </span>
            </td>
            <td className="c-num" data-label={t('colTotalQty')}>{f.hasQty ? qty(f.total, u) : '-'}</td>
            <td className="c-num" data-label={t('colCompleted')}><span className="text-success fw-bold">{f.hasQty ? qty(f.done, u) : '-'}</span></td>
            <td className="c-num" data-label={t('colRemaining')}>{f.hasQty ? qty(f.remaining, u) : '-'}</td>
            <td className="c-sub" data-label={t('colProgress')}>
              <ProgressBar value={f.progress} label={tr(task.name)} showValue />
            </td>
            <td className="c-full c-muted" data-label={t('colNotes')}>
              <span className="clamp-2">{tr(task.notes) || '-'}</span>
            </td>
            {editable && (
              <td className="c-actions">
                {rowEditable ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    aria-label={`${isAr ? 'تعديل' : 'Edit'} ${tr(task.name)}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span>{isAr ? 'تعديل' : 'Edit'}</span>
                  </button>
                ) : (
                  <span className="text-xs muted">{isAr ? 'يُحدَّث تلقائياً' : 'Auto-updated'}</span>
                )}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

/** Edit sheet: completed quantity drives the percentage; tasks without a quantity take a direct percentage. */
function TaskEditSheet({ task, kpis, tr, t, lang, onClose, onSave }) {
  const isAr = lang === 'ar';
  const [completed, setCompleted] = useState('');
  const [progress, setProgress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(null);

  // Reset the form whenever a different task is opened.
  if (task && openedFor !== task.id) {
    setOpenedFor(task.id);
    setCompleted(String(task.completed_quantity ?? 0));
    setProgress(String(Number(task.progress_percent) || 0));
    setNotes(task.notes || '');
  }

  if (!task) {
    if (openedFor !== null) setOpenedFor(null);
    return null;
  }
  const f = taskFigures(task, kpis);
  const total = Number(task.total_quantity) || 0;
  const u = fmtUnit(tr(task.unit));

  const onCompleted = (value) => {
    let n = parseFloat(value);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(Math.max(n, 0), total);
    setCompleted(value === '' ? '' : String(n));
    setProgress(String(parseFloat(((n / total) * 100).toFixed(2))));
  };

  const onProgress = (value) => {
    let n = parseFloat(value);
    if (Number.isNaN(n)) n = 0;
    setProgress(value === '' ? '' : String(Math.min(Math.max(n, 0), 100)));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(task.id, parseFloat(progress) || 0, notes, f.hasQty ? parseFloat(completed) || 0 : parseFloat(task.completed_quantity) || 0);
    } catch {
      // The toast from App already explains the failure; keep the sheet open.
    } finally {
      setSaving(false);
    }
  };

  const liveProgress = parseFloat(progress) || 0;

  return (
    <Modal
      open={Boolean(task)}
      onClose={saving ? undefined : () => { setOpenedFor(null); onClose(); }}
      title={tr(task.name)}
      description={tr(task.category_name)}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={() => { setOpenedFor(null); onClose(); }} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="submit" form="task-edit-form" className="btn btn--primary" aria-busy={saving}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </>
      }
    >
      <form id="task-edit-form" className="stack-sm" onSubmit={submit}>
        {f.hasQty ? (
          <>
            <div className="kv">
              <div className="kv-item">
                <div className="kv-label">{t('colTotalQty')}</div>
                <div className="kv-value num">{qty(total, u)}</div>
              </div>
              <div className="kv-item">
                <div className="kv-label">{t('colRemaining')}</div>
                <div className="kv-value num">{qty(Math.max(0, total - (parseFloat(completed) || 0)), u)}</div>
              </div>
            </div>
            <Field label={`${t('colCompleted')}${u ? ` (${u})` : ''}`} htmlFor="task-completed" hint={isAr ? `بين 0 و ${num(total)}` : `Between 0 and ${num(total)}`}>
              <input
                id="task-completed"
                className="input input--num"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                max={total}
                value={completed}
                onChange={(e) => onCompleted(e.target.value)}
                data-autofocus
              />
            </Field>
          </>
        ) : (
          <Field label={`${t('colProgress')} (%)`} htmlFor="task-progress" hint={isAr ? 'هذه الفقرة بلا كمية، أدخل النسبة مباشرة.' : 'This task has no quantity; enter the percentage directly.'}>
            <input
              id="task-progress"
              className="input input--num"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => onProgress(e.target.value)}
              data-autofocus
            />
          </Field>
        )}

        <div>
          <div className="kv-label" style={{ marginBlockEnd: 'var(--space-2)' }}>{isAr ? 'النسبة بعد الحفظ' : 'Percentage after saving'}</div>
          <ProgressBar value={liveProgress} label={t('colProgress')} showValue decimals={2} />
        </div>

        <Field label={t('colNotes')} htmlFor="task-notes">
          <textarea
            id="task-notes"
            className="textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('enterNotes')}
          />
        </Field>
      </form>
    </Modal>
  );
}

function LatestMaterials({ report, lang }) {
  const isAr = lang === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const cement = report?.bulk?.cement;
  const sand = report?.bulk?.sand;
  const foam = report?.bulk?.foam;
  const notes = report?.notes || report?.basics?.notes;

  return (
    <section className="card" aria-labelledby="dash-mat-title">
      <div className="card-header">
        <div>
          <h2 id="dash-mat-title" className="card-title">{isAr ? 'آخر جرد للمواد' : 'Latest materials count'}</h2>
          {report && (
            <p className="card-subtitle">{fmtDate(report.date, lang, 'weekday')}{report.prepared_by ? ` · ${report.prepared_by}` : ''}</p>
          )}
        </div>
        <a className="btn btn--ghost btn--sm" href="#materials-consumption">
          {isAr ? 'السجل' : 'Log'}
          <Arrow size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="card-body">
        {report === undefined ? (
          <div className="stack-sm" aria-hidden="true">
            <span className="skeleton" style={{ height: '3rem' }} />
            <span className="skeleton" style={{ height: '2rem', width: '70%' }} />
          </div>
        ) : report === null ? (
          <EmptyState icon={PackageOpen} title={isAr ? 'لا يوجد جرد مسجّل' : 'No count recorded'} text={isAr ? 'سجّل أول جرد يومي من قسم استهلاك المواد.' : 'Record the first daily count in Daily Materials.'} />
        ) : (
          <div className="stack-sm">
            <div className="kv kv--3">
              <div className="kv-item">
                <div className="kv-label">{isAr ? 'الأسمنت' : 'Cement'}</div>
                <div className="kv-value kv-value--lg">{cement || '0'} <span className="stat-unit">{isAr ? 'كيس' : 'bags'}</span></div>
              </div>
              <div className="kv-item">
                <div className="kv-label">{isAr ? 'الرمل' : 'Sand'}</div>
                <div className="kv-value kv-value--lg">{sand || '0'}</div>
              </div>
              {foam && (
                <div className="kv-item">
                  <div className="kv-label">{isAr ? 'الفوم المتبقي' : 'Foam left'}</div>
                  <div className="kv-value kv-value--lg num">{foam.remaining || '0'}</div>
                </div>
              )}
            </div>
            {notes && <p className="text-sm muted clamp-2" style={{ whiteSpace: 'pre-line' }}>{notes}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

// ── PDF ───────────────────────────────────────────────────────────────────

function buildProgressReport({ tasks, categories, kpis, counts, user, lang, tr }) {
  const isAr = lang === 'ar';
  const overall = Number(kpis.overall_progress_percent) || 0;
  const mbxPieces = tasks.find(x => x.name && x.name.includes('الماربلكس (القطع)'));
  const mbxSteel = tasks.find(x => x.name && x.name.includes('ستيلات التثبيت للماربلكس'));

  const rows = [];
  let index = 0;
  categories.forEach(cat => {
    rows.push({ group: tr(cat.name), note: `${cat.tasks.length} ${isAr ? 'فقرات' : 'tasks'} · ${isAr ? 'متوسط الإنجاز' : 'average'} ${pct(cat.avg)}` });
    cat.tasks.forEach(task => {
      index += 1;
      const f = taskFigures(task, kpis);
      const u = tr(task.unit);
      rows.push({
        cls: f.progress >= 100 ? 'done' : '',
        cells: [
          { v: index, align: 'center' },
          h.raw(`<strong>${h.text(tr(cleanName(task.name))).html}</strong>${!task.is_manual ? h.badge(isAr ? 'تلقائي' : 'auto', 'info').html : ''}`),
          { v: f.hasQty ? qty(f.total, u) : '-', align: 'center' },
          { v: f.hasQty ? qty(f.done, u) : '-', align: 'center', tone: 'success', strong: true },
          { v: f.hasQty ? qty(f.remaining, u) : '-', align: 'center', tone: f.remaining > 0 ? 'warn' : undefined },
          { v: h.progress(f.progress), align: 'center' },
          { v: tr(task.notes) || '-', cls: 't-muted' },
        ],
      });
    });
  });

  const body = [
    h.kpis([
      { label: isAr ? 'نسبة الإنجاز الكلية' : 'Overall completion', value: pct(overall, 2), tone: 'success', sub: isAr ? 'متوسط كل الفقرات' : 'Average of all tasks' },
      { label: isAr ? 'حالة الفقرات' : 'Task status', value: h.raw(`<span dir="ltr"><span class="t-success">${counts.done}</span> / ${tasks.length}</span>`), sub: isAr ? `منجزة، قيد العمل ${counts.active}، لم تبدأ ${counts.idle}` : `done, ${counts.active} active, ${counts.idle} not started` },
      { label: isAr ? 'النزلات والمرمر' : 'Downspouts & marble', value: `${num(kpis.nazalat_completed)} / ${num(kpis.nazalat_total)}`, sub: isAr ? `مرمر مطبق ${num(kpis.applied_marble_pieces)} قطعة` : `${num(kpis.applied_marble_pieces)} marble pieces applied` },
      {
        label: isAr ? 'الماربلكس والستيل' : 'Marblex & steel',
        value: mbxPieces ? pct(mbxPieces.progress_percent) : '-',
        sub: mbxSteel
          ? (isAr ? `ستيل ${num(mbxSteel.completed_quantity)} / ${num(mbxSteel.total_quantity)}` : `steel ${num(mbxSteel.completed_quantity)} / ${num(mbxSteel.total_quantity)}`)
          : '',
      },
    ]),
    h.section(isAr ? 'تفاصيل الفقرات التنفيذية' : 'Task details', h.table({
      columns: [
        { label: '#', align: 'center', width: '7mm' },
        { label: isAr ? 'الفقرة التنفيذية' : 'Task' },
        { label: isAr ? 'الكمية الكلية' : 'Total', align: 'center', width: '22mm' },
        { label: isAr ? 'المنجز' : 'Done', align: 'center', width: '22mm' },
        { label: isAr ? 'المتبقي' : 'Remaining', align: 'center', width: '22mm' },
        { label: isAr ? 'الإنجاز' : 'Progress', align: 'center', width: '22mm' },
        { label: isAr ? 'الملاحظات' : 'Notes', width: '42mm' },
      ],
      rows,
      foot: [
        { v: isAr ? 'المحصلة الإجمالية' : 'Overall', colspan: 2, strong: true },
        { v: `${tasks.length} ${isAr ? 'فقرة' : 'tasks'}`, align: 'center' },
        { v: `${isAr ? 'منجزة' : 'done'} ${counts.done}`, align: 'center', tone: 'success' },
        { v: `${isAr ? 'قيد العمل' : 'active'} ${counts.active}`, align: 'center', tone: 'warn' },
        { v: pct(overall, 2), align: 'center' },
        { v: isAr ? 'مطابق لجرودات الموقع' : 'Matches site counts' },
      ],
    }), { index: 1 }),
  ].map(String).join('');

  return buildReport({
    lang,
    title: isAr ? 'الجدول العام لتقدم العمل ونسب الإنجاز' : 'Project Progress Schedule',
    code: docCode('PRG'),
    meta: [
      { label: isAr ? 'المهندس المسؤول' : 'Responsible engineer', value: user?.name || '-' },
      { label: isAr ? 'عدد الفقرات' : 'Tasks', value: `${tasks.length} ${isAr ? 'فقرة' : ''}` },
      { label: isAr ? 'الأقسام' : 'Categories', value: String(categories.length) },
      { label: isAr ? 'نسبة الإنجاز' : 'Completion', value: pct(overall, 2) },
    ],
    body,
    signatures: [
      { ar: 'مهندس الموقع والمتابعة الميدانية', en: 'Site Engineer' },
      { ar: 'المهندس المقيم للمشروع', en: 'Resident Engineer' },
      { ar: 'مدير المشروع / دائرة المهندس المقيم', en: 'Project Director' },
    ],
  });
}
