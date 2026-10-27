import { useMemo, useState } from 'react';
import { Pencil, Trash2, Undo2, SearchX, Inbox } from 'lucide-react';
import { EmptyState, Field, Chips } from '../ui';
import NoteCard from './NoteCard';
import { STATUSES, sortNotes, canEditNote } from '../../utils/handover';

/** Every note with filters; owners edit or delete while pending, the reviewer can send any note back. */
export default function NotesTab({ notes, levels, user, permissions, isAr, onEdit, onDelete, onReturn }) {
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('all');
  const [mine, setMine] = useState(false);

  const scoped = useMemo(() => notes.filter(n =>
    (!level || n.level === level) && (!mine || Number(n.created_by) === Number(user.id))), [notes, level, mine, user.id]);

  const counts = useMemo(() => scoped.reduce((acc, n) => {
    acc[n.status] = (acc[n.status] || 0) + 1;
    return acc;
  }, {}), [scoped]);

  const visible = useMemo(() => sortNotes(scoped.filter(n => status === 'all' || n.status === status), levels), [scoped, status, levels]);

  const levelOptions = useMemo(() => {
    const used = new Set(notes.map(n => n.level));
    return [...levels.filter(l => used.has(l)), ...[...used].filter(l => !levels.includes(l)).sort()];
  }, [notes, levels]);

  const statusOptions = [
    { value: 'all', label: isAr ? 'الكل' : 'All', count: scoped.length },
    ...Object.entries(STATUSES).map(([id, s]) => ({ value: id, label: isAr ? s.ar : s.en, count: counts[id] || 0 })),
  ];

  return (
    <div className="stack">
      <section className="card">
        <div className="card-body stack-sm">
          <div className="ho-filters">
            <Field label={isAr ? 'النزلة' : 'Level'} htmlFor="ho-notes-level">
              <select id="ho-notes-level" className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">{isAr ? 'كل النزلات' : 'All levels'}</option>
                {levelOptions.map(l => <option key={l} value={l} dir="ltr">{l}</option>)}
              </select>
            </Field>
            <div className="chips chips--wrap ho-mine" role="group" aria-label={isAr ? 'صاحب الملاحظة' : 'Author'}>
              <button type="button" className="chip" aria-pressed={mine} onClick={() => setMine(m => !m)}>
                {isAr ? 'ملاحظاتي فقط' : 'Only mine'}
              </button>
            </div>
          </div>
          <Chips options={statusOptions} value={status} onChange={setStatus} label={isAr ? 'حالة الملاحظة' : 'Status'} />
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={notes.length === 0 ? Inbox : SearchX}
            title={notes.length === 0 ? (isAr ? 'لا توجد ملاحظات بعد' : 'No notes yet') : (isAr ? 'لا توجد ملاحظات بهذه التصفية' : 'No notes match')}
            text={notes.length === 0
              ? (isAr ? 'سجّل أول ملاحظة من تبويب «إدخال ملاحظة» مع صورها.' : 'Record the first note from the New note tab.')
              : (isAr ? 'غيّر النزلة أو الحالة.' : 'Change the level or status.')}
          />
        </section>
      ) : (
        <div className="ho-grid">
          {visible.map(note => {
            const editable = canEditNote(note, user, permissions);
            const returnable = permissions.canReview && note.status !== 'pending';
            return (
              <NoteCard
                key={note.id}
                note={note}
                isAr={isAr}
                showOriginal={permissions.canReview}
                actions={(editable || returnable) && (
                  <>
                    {returnable && (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onReturn(note)}>
                        <Undo2 size={15} aria-hidden="true" />
                        {isAr ? 'إرجاع للفلترة' : 'Back to review'}
                      </button>
                    )}
                    {editable && (
                      <>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => onEdit(note)}>
                          <Pencil size={15} aria-hidden="true" />
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => onDelete(note)}>
                          <Trash2 size={15} aria-hidden="true" />
                          {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </>
                    )}
                  </>
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
