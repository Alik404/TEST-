import { useId, useMemo, useState } from 'react';
import { CircleCheck, CircleAlert, CircleDashed, Pencil, Save, ClipboardCheck } from 'lucide-react';
import { StatCard, Chips, Modal, Field, EmptyState } from '../ui';
import { RECEIPT_STATUSES, receiptStatus } from '../../utils/handover';
import { isoDay, isoToDmy } from '../../utils/format';

const STATUS_ICON = { not_received: CircleDashed, with_notes: CircleAlert, received: CircleCheck };
const BADGE = { neutral: 'badge--outline', warn: 'badge--warn', success: 'badge--success' };

export function ReceiptBadge({ status, isAr }) {
  const s = receiptStatus(status);
  const Icon = STATUS_ICON[s.id];
  return (
    <span className={`badge ${BADGE[s.tone]}`}>
      <Icon size={13} aria-hidden="true" />
      {isAr ? s.ar : s.en}
    </span>
  );
}

/**
 * Polishing handover register: one line per level with its handover state,
 * date, and how many notes are open on it. The reviewer and the general
 * director update it; everyone else reads it.
 */
export default function ReceiptsTab({ levels, notes, receipts, isAr, canEdit, onSave }) {
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const byLevel = useMemo(() => new Map(receipts.map(r => [r.level, r])), [receipts]);

  const noteCounts = useMemo(() => {
    const map = new Map();
    for (const n of notes) {
      const c = map.get(n.level) || { approved: 0, deferred: 0, pending: 0 };
      if (c[n.status] !== undefined) c[n.status] += 1;
      map.set(n.level, c);
    }
    return map;
  }, [notes]);

  const rows = levels.map(level => ({
    level,
    receipt: byLevel.get(level) || { level, status: 'not_received', received_on: null, notes: '' },
    counts: noteCounts.get(level) || { approved: 0, deferred: 0, pending: 0 },
  }));

  const totals = rows.reduce((acc, r) => {
    acc[r.receipt.status] = (acc[r.receipt.status] || 0) + 1;
    return acc;
  }, {});
  const handed = (totals.received || 0) + (totals.with_notes || 0);
  const pct = levels.length ? (handed / levels.length) * 100 : 0;

  const visible = rows.filter(r => filter === 'all' || r.receipt.status === filter);
  const options = [
    { value: 'all', label: isAr ? 'الكل' : 'All', count: rows.length },
    ...RECEIPT_STATUSES.map(s => ({ value: s.id, label: isAr ? s.ar : s.en, count: totals[s.id] || 0 })),
  ];

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص استلام الجلي' : 'Polishing handover summary'}>
        <StatCard className="stat--span2" label={isAr ? 'النزلات المستلمة' : 'Levels handed over'} value={`${handed} / ${levels.length}`}
          icon={ClipboardCheck} tone="accent" progress={pct} progressLabel={isAr ? 'نسبة الاستلام' : 'Handover progress'} />
        <StatCard label={isAr ? 'مستلمة' : 'Received'} value={totals.received || 0} icon={CircleCheck} tone="accent" />
        <StatCard label={isAr ? 'مستلمة بملاحظات' : 'With notes'} value={totals.with_notes || 0} icon={CircleAlert} tone="warn" />
      </section>

      <section className="card">
        <div className="card-body">
          <Chips options={options} value={filter} onChange={setFilter} label={isAr ? 'حالة الاستلام' : 'Handover state'} />
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="card">
          <EmptyState icon={ClipboardCheck} title={isAr ? 'لا توجد نزلات بهذه الحالة' : 'No levels in this state'} />
        </section>
      ) : (
        <ul className="ho-receipts">
          {visible.map(({ level, receipt, counts }) => (
            <li key={level} className="card ho-receipt">
              <div className="ho-receipt-main">
                <span className="ho-receipt-level" dir="ltr">{level}</span>
                <ReceiptBadge status={receipt.status} isAr={isAr} />
                {receipt.received_on && <span className="ho-date num" dir="ltr">{isoToDmy(receipt.received_on)}</span>}
              </div>
              <p className="ho-receipt-counts text-sm">
                <span>{isAr ? 'معتمدة' : 'Approved'} <strong className="num">{counts.approved}</strong></span>
                <span>{isAr ? 'مؤجلة' : 'Deferred'} <strong className="num">{counts.deferred}</strong></span>
                <span>{isAr ? 'بانتظار الفلترة' : 'Awaiting'} <strong className="num">{counts.pending}</strong></span>
              </p>
              {receipt.notes && <p className="note-block">{receipt.notes}</p>}
              {canEdit && (
                <button type="button" className="btn btn--secondary btn--sm ho-receipt-edit" onClick={() => setEditing({ level, receipt, counts })}>
                  <Pencil size={15} aria-hidden="true" />
                  {isAr ? `تحديث ${level}` : `Update ${level}`}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ReceiptDialog
          key={editing.level}
          target={editing}
          isAr={isAr}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            if (await onSave(editing.level, payload)) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ReceiptDialog({ target, isAr, onClose, onSave }) {
  const uid = useId();
  const [status, setStatus] = useState(target.receipt.status);
  const [date, setDate] = useState(target.receipt.received_on || isoDay());
  const [notes, setNotes] = useState(target.receipt.notes || '');
  const [busy, setBusy] = useState(false);
  const open = target.counts.approved + target.counts.pending;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ status, received_on: status === 'not_received' ? null : date, notes: notes.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={isAr ? `استلام الجلي - ${target.level}` : `Polishing handover - ${target.level}`}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="submit" form={`${uid}-form`} className="btn btn--primary" aria-busy={busy}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </>
      )}
    >
      <form id={`${uid}-form`} className="stack" onSubmit={submit}>
        <fieldset className="form-section">
          <legend className="field-label">{isAr ? 'حالة الاستلام' : 'Handover state'}</legend>
          <div className="ho-radios">
            {RECEIPT_STATUSES.map(s => {
              const Icon = STATUS_ICON[s.id];
              return (
                <label key={s.id} className="ho-radio">
                  <input type="radio" name={`${uid}-status`} value={s.id} checked={status === s.id} onChange={() => setStatus(s.id)} />
                  <Icon size={18} aria-hidden="true" />
                  <span>{isAr ? s.ar : s.en}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {status === 'received' && open > 0 && (
          <div className="alert alert--warn">
            <CircleAlert size={18} aria-hidden="true" />
            <div className="alert-body">
              {isAr
                ? `على هذه النزلة ${open} ملاحظات معتمدة أو بانتظار الفلترة. إذا ما زالت مفتوحة اختر «مستلمة بملاحظات».`
                : `This level still has ${open} approved or pending notes. If they are open, choose "Received with notes".`}
            </div>
          </div>
        )}

        {status !== 'not_received' && (
          <Field label={isAr ? 'تاريخ الاستلام' : 'Handover date'} htmlFor={`${uid}-date`}>
            <input id={`${uid}-date`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        )}

        <Field label={isAr ? 'ملاحظات الاستلام (اختياري)' : 'Notes (optional)'} htmlFor={`${uid}-notes`}>
          <textarea id={`${uid}-notes`} className="textarea" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
