import { useId, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Save, RotateCcw } from 'lucide-react';
import { Modal, Field } from '../ui';
import { roleLabel } from '../../navigation';

const DEFAULT_LEVELS = Array.from({ length: 37 }, (_, i) => `B${37 - i}`);
const LEVEL_RE = /^[A-Z0-9][A-Z0-9-]{0,11}$/;

/**
 * Section settings: the ordered list of levels (reviewer and general director)
 * and who reviews (general director only). Saved together on "Save".
 */
export default function SettingsModal({ open, onClose, boot, notes, isAr, onSave }) {
  const uid = useId();
  const can = boot.permissions;
  const [levels, setLevels] = useState(boot.levels);
  const [filterers, setFilterers] = useState(() => new Set(boot.filterers));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const used = new Set(notes.map(n => n.level));

  const add = (where) => {
    const value = draft.trim().toUpperCase();
    if (!LEVEL_RE.test(value)) {
      setError(isAr ? 'استخدم حروفاً لاتينية وأرقاماً فقط، مثل B38.' : 'Use Latin letters and digits only, e.g. B38.');
      return;
    }
    if (levels.includes(value)) {
      setError(isAr ? `${value} موجودة بالقائمة.` : `${value} is already listed.`);
      return;
    }
    setLevels(prev => (where === 'start' ? [value, ...prev] : [...prev, value]));
    setDraft('');
    setError('');
  };

  const move = (index, delta) => setLevels(prev => {
    const next = [...prev];
    const target = index + delta;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const remove = (level) => setLevels(prev => prev.filter(l => l !== level));

  const toggleFilterer = (id) => setFilterers(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    if (levels.length === 0) {
      setError(isAr ? 'القائمة يجب أن تحتوي نزلة واحدة على الأقل.' : 'Keep at least one level.');
      return;
    }
    setBusy(true);
    try {
      const payload = {};
      if (can.canManageLevels) payload.levels = levels;
      if (can.canManageFilterers) payload.filterers = [...filterers];
      if (await onSave(payload)) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      size="lg"
      title={isAr ? 'إعدادات ملاحظات الاستلام' : 'Handover notes settings'}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={(
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className="btn btn--primary" onClick={save} aria-busy={busy}>
            <Save size={18} aria-hidden="true" />
            {isAr ? 'حفظ الإعدادات' : 'Save settings'}
          </button>
        </>
      )}
    >
      <div className="stack">
        {can.canManageFilterers && (
          <fieldset className="form-section">
            <legend className="form-section-title">{isAr ? 'المفلتر (يعتمد ويصدّر الصور)' : 'Reviewer (approves and exports)'}</legend>
            <p className="muted text-sm">{isAr ? 'تقدر تختار أكثر من شخص. البقية يدخلون الملاحظات فقط.' : 'You can pick more than one. Everyone else only adds notes.'}</p>
            <div className="ho-radios">
              {(boot.users || []).map(u => (
                <label key={u.id} className="ho-radio">
                  <input type="checkbox" checked={filterers.has(u.id)} onChange={() => toggleFilterer(u.id)} />
                  <span>{u.name}</span>
                  <span className="muted text-xs">{roleLabel(u.role, isAr ? 'ar' : 'en')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {can.canManageLevels && (
          <fieldset className="form-section">
            <legend className="form-section-title">{isAr ? 'النزلات بالترتيب' : 'Levels, in order'}</legend>
            <div className="ho-level-add">
              <Field label={isAr ? 'نزلة جديدة' : 'New level'} htmlFor={`${uid}-new`} error={error}>
                <input
                  id={`${uid}-new`}
                  className="input"
                  dir="ltr"
                  value={draft}
                  maxLength={12}
                  autoCapitalize="characters"
                  onChange={(e) => { setDraft(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add('start'); } }}
                  placeholder="B38"
                />
              </Field>
              <div className="btn-row">
                <button type="button" className="btn btn--secondary" onClick={() => add('start')}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'إضافة بالبداية' : 'Add at start'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => add('end')}>
                  <Plus size={18} aria-hidden="true" />
                  {isAr ? 'إضافة بالنهاية' : 'Add at end'}
                </button>
              </div>
            </div>

            <ol className="ho-level-list">
              {levels.map((level, i) => (
                <li key={level} className="ho-level-item">
                  <span className="ho-level-code" dir="ltr">{level}</span>
                  {used.has(level) && <span className="muted text-xs">{isAr ? 'عليها ملاحظات' : 'has notes'}</span>}
                  <span className="ho-level-tools">
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${isAr ? 'تحريك للأعلى' : 'Move up'} ${level}`}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => move(i, 1)} disabled={i === levels.length - 1} aria-label={`${isAr ? 'تحريك للأسفل' : 'Move down'} ${level}`}>
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn--danger-ghost btn--icon btn--sm" onClick={() => remove(level)} aria-label={`${isAr ? 'إزالة' : 'Remove'} ${level}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            <p className="muted text-xs">
              {isAr
                ? 'إزالة نزلة من القائمة تخفيها من الإدخال فقط، وملاحظاتها السابقة تبقى محفوظة.'
                : 'Removing a level only hides it from new notes; its existing notes are kept.'}
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLevels(DEFAULT_LEVELS)}>
              <RotateCcw size={15} aria-hidden="true" />
              {isAr ? 'إرجاع القائمة الافتراضية B37 إلى B1' : 'Reset to B37 to B1'}
            </button>
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
