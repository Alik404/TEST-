import { useState } from 'react';
import { Hourglass, CircleCheck, Clock, Ban, MapPin, User, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { Modal } from '../ui';
import { STATUSES, noteType, noteText, rejectReason, dmy } from '../../utils/handover';

const STATUS_ICON = { pending: Hourglass, approved: CircleCheck, deferred: Clock, rejected: Ban };

export function StatusBadge({ status, isAr }) {
  const s = STATUSES[status] || STATUSES.pending;
  const Icon = STATUS_ICON[status] || Hourglass;
  return (
    <span className={`badge badge--${s.tone}`}>
      <Icon size={13} aria-hidden="true" />
      {isAr ? s.ar : s.en}
    </span>
  );
}

/** Note number as printed on the image. Always left to right: B37-01, B37-D01. */
export function NumberBadge({ number }) {
  if (!number) return null;
  return <span className="ho-number" dir="ltr">{number}</span>;
}

/** Thumbnails that open the full photo. Every thumb is a real button. */
export function PhotoThumbs({ photos, isAr, label }) {
  const [open, setOpen] = useState(null);
  if (!photos?.length) return null;
  return (
    <>
      <div className="ho-photos">
        {photos.map((p, i) => (
          <button
            key={p.path || i}
            type="button"
            className="ho-photo"
            onClick={() => setOpen(i)}
            aria-label={`${isAr ? 'عرض الصورة' : 'View photo'} ${i + 1} ${label ? `- ${label}` : ''}`}
          >
            {p.thumb ? <img src={p.thumb} alt="" loading="lazy" decoding="async" /> : <ImageOff size={20} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <PhotoViewer photos={photos} index={open} onIndex={setOpen} isAr={isAr} />
    </>
  );
}

export function PhotoViewer({ photos, index, onIndex, isAr }) {
  const open = index !== null && index !== undefined && photos[index];
  const count = photos.length;
  const step = (delta) => onIndex((index + delta + count) % count);
  return (
    <Modal
      open={Boolean(open)}
      onClose={() => onIndex(null)}
      size="xl"
      title={open ? `${isAr ? 'الصورة' : 'Photo'} ${index + 1} / ${count}` : ''}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      bodyClassName="ho-viewer-body"
      footer={count > 1 && (
        <>
          <button type="button" className="btn btn--secondary" onClick={() => step(-1)}>
            {isAr ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
            {isAr ? 'السابقة' : 'Previous'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => step(1)}>
            {isAr ? 'التالية' : 'Next'}
            {isAr ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          </button>
        </>
      )}
    >
      {open && <img className="ho-viewer-img" src={open.url || open.thumb} alt={`${isAr ? 'صورة الملاحظة' : 'Note photo'} ${index + 1}`} />}
    </Modal>
  );
}

/**
 * One note: number or status, level, type and date on top, the text, the
 * place inside the level, the photos, who recorded it, then any actions.
 */
export default function NoteCard({ note, isAr, actions, showOriginal = false, children }) {
  const type = noteType(note.note_type);
  const text = noteText(note);
  const reason = note.status === 'rejected' ? rejectReason(note.reject_reason) : null;
  const edited = showOriginal && note.final_text && note.final_text.trim() !== note.description.trim();

  return (
    <article className="card ho-card" aria-label={`${note.number || note.level} - ${isAr ? type.ar : type.en}`}>
      <div className="ho-card-head">
        <NumberBadge number={note.number} />
        <span className="ho-level" dir="ltr">{note.level}</span>
        <span className="ho-type">{isAr ? type.ar : type.en}</span>
        <span className="ho-date num" dir="ltr">{dmy(note.created_at)}</span>
        <span className="ho-card-status"><StatusBadge status={note.status} isAr={isAr} /></span>
      </div>

      <p className="ho-card-text">{text}</p>
      {edited && (
        <p className="ho-card-original">
          <span className="muted">{isAr ? 'النص الأصلي: ' : 'Original: '}</span>{note.description}
        </p>
      )}

      {(note.location || reason) && (
        <div className="ho-card-tags">
          {note.location && (
            <span className="ho-meta"><MapPin size={14} aria-hidden="true" />{note.location}</span>
          )}
          {reason && <span className="badge badge--danger">{isAr ? `سبب الاستبعاد: ${reason.ar}` : `Reason: ${reason.en}`}</span>}
        </div>
      )}

      <PhotoThumbs photos={note.photos} isAr={isAr} label={note.number || note.level} />

      {children}

      <div className="ho-card-foot">
        <span className="ho-meta"><User size={14} aria-hidden="true" />{note.created_by_name || (isAr ? 'غير معروف' : 'Unknown')}</span>
        {actions && <div className="btn-row">{actions}</div>}
      </div>
    </article>
  );
}
