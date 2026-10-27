import { useId, useMemo, useState } from 'react';
import { CircleCheck, Clock, Ban, Pencil, ListChecks, TriangleAlert } from 'lucide-react';
import { EmptyState, Field, Modal } from '../ui';
import NoteCard from './NoteCard';
import { NOTE_TYPES, REJECT_REASONS, groupByLevel } from '../../utils/handover';

/**
 * The reviewer's queue: notes awaiting review, grouped by level. Each note can
 * be reworded, reclassified, then approved, deferred or rejected with a reason.
 * Cracks are deferred by procedure, so for them "Defer" is the main button.
 */
export default function ReviewTab({ notes, levels, isAr, onReview, onEdit }) {
  const groups = useMemo(() => groupByLevel(notes.filter(n => n.status === 'pending'), levels), [notes, levels]);
  const [rejecting, setRejecting] = useState(null);

  if (groups.length === 0) {
    return (
      <section className="card">
        <EmptyState
          icon={ListChecks}
          title={isAr ? 'لا توجد ملاحظات بانتظار الفلترة' : 'Nothing to review'}
          text={isAr ? 'كل الملاحظات المسجلة تمت فلترتها. الملاحظات الجديدة تظهر هنا مباشرة.' : 'Every recorded note has been reviewed. New notes appear here.'}
        />
      </section>
    );
  }

  return (
    <div className="stack">
      {groups.map(({ level, notes: list }) => (
        <section key={level} className="ho-level-group" aria-labelledby={`ho-rv-${level}`}>
          <h2 className="ho-level-title" id={`ho-rv-${level}`}>
            <span dir="ltr">{level}</span>
            <span className="badge badge--info num">{list.length}</span>
          </h2>
          <div className="ho-grid">
            {list.map(note => (
              <ReviewCard
                key={note.id}
                note={note}
                isAr={isAr}
                onReview={onReview}
                onEdit={onEdit}
                onReject={(draft) => setRejecting({ note, ...draft })}
              />
            ))}
          </div>
        </section>
      ))}

      <RejectDialog
        target={rejecting}
        isAr={isAr}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const ok = await onReview(rejecting.note, { action: 'reject', reason, final_text: rejecting.final_text, note_type: rejecting.note_type });
          if (ok) setRejecting(null);
        }}
      />
    </div>
  );
}

function ReviewCard({ note, isAr, onReview, onEdit, onReject }) {
  const uid = useId();
  const [text, setText] = useState(note.final_text || note.description);
  const [type, setType] = useState(note.note_type);
  const [busy, setBusy] = useState('');
  const isCrack = type === 'cracks';

  const act = async (action) => {
    if (!text.trim()) return;
    setBusy(action);
    try {
      await onReview(note, { action, final_text: text.trim(), note_type: type });
    } finally {
      setBusy('');
    }
  };

  const approve = (
    <button key="approve" type="button" className={`btn ${isCrack ? 'btn--secondary' : 'btn--primary'} ho-btn-lg`} onClick={() => act('approve')} aria-busy={busy === 'approve'} disabled={Boolean(busy) || !text.trim()}>
      <CircleCheck size={18} aria-hidden="true" />
      {isAr ? 'اعتماد' : 'Approve'}
    </button>
  );
  const defer = (
    <button key="defer" type="button" className={`btn ${isCrack ? 'btn--warn' : 'btn--secondary'} ho-btn-lg`} onClick={() => act('defer')} aria-busy={busy === 'defer'} disabled={Boolean(busy) || !text.trim()}>
      <Clock size={18} aria-hidden="true" />
      {isAr ? 'تأجيل' : 'Defer'}
    </button>
  );

  return (
    <NoteCard
      note={note}
      isAr={isAr}
      actions={(
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(note)}>
          <Pencil size={15} aria-hidden="true" />
          {isAr ? 'تعديل النزلة أو الصور' : 'Edit level or photos'}
        </button>
      )}
    >
      <div className="ho-review">
        <Field
          label={isAr ? 'الصياغة النهائية (تُطبع على الصورة)' : 'Final wording (printed on the image)'}
          htmlFor={`${uid}-text`}
          error={!text.trim() ? (isAr ? 'اكتب الصياغة النهائية.' : 'Write the final wording.') : undefined}
        >
          <textarea id={`${uid}-text`} className="textarea" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>

        <div className="ho-types ho-types--sm" role="radiogroup" aria-label={isAr ? 'نوع الملاحظة' : 'Note type'}>
          {NOTE_TYPES.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className="ho-type-option" onClick={() => setType(t.id)}>
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>

        {isCrack && (
          <div className="alert alert--warn">
            <TriangleAlert size={18} aria-hidden="true" />
            <div className="alert-body">{isAr ? 'التشققات تبقى مؤجلة حسب البروسيجر.' : 'By procedure, cracks stay deferred.'}</div>
          </div>
        )}

        <div className="ho-review-actions">
          {isCrack ? [defer, approve] : [approve, defer]}
          <button type="button" className="btn btn--danger-ghost ho-btn-lg" onClick={() => onReject({ final_text: text.trim(), note_type: type })} disabled={Boolean(busy)}>
            <Ban size={18} aria-hidden="true" />
            {isAr ? 'استبعاد' : 'Reject'}
          </button>
        </div>
      </div>
    </NoteCard>
  );
}

function RejectDialog({ target, isAr, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason('');
    onClose();
  };

  const confirm = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await onConfirm(reason);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={busy ? undefined : close}
      title={isAr ? 'استبعاد الملاحظة' : 'Reject note'}
      description={target ? `${target.note.level} - ${target.note.description.slice(0, 80)}` : ''}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className="btn btn--danger" onClick={confirm} aria-busy={busy} disabled={!reason}>
            <Ban size={18} aria-hidden="true" />
            {isAr ? 'استبعاد' : 'Reject'}
          </button>
        </>
      )}
    >
      <fieldset className="form-section">
        <legend className="field-label">{isAr ? 'سبب الاستبعاد' : 'Reason'}</legend>
        <div className="ho-radios">
          {REJECT_REASONS.map(r => (
            <label key={r.id} className="ho-radio">
              <input type="radio" name="ho-reject-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
              <span>{isAr ? r.ar : r.en}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
