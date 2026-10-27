import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, X, Save, Loader2 } from 'lucide-react';
import { Field } from '../ui';
import { toast } from '../../utils/toast';
import { NOTE_TYPES, MAX_PHOTOS, readPref, writePref } from '../../utils/handover';
import { preparePhoto, blobToDataUrl } from '../../utils/handoverImages';

const LEVEL_KEY = 'handover_level';
const TYPE_KEY = 'handover_type';

let photoKey = 0;
const nextKey = () => `p${(photoKey += 1)}`;

const fromNote = (note) => (note?.photos || []).map(p => ({ key: nextKey(), kind: 'existing', path: p.path, preview: p.thumb || p.url }));

/**
 * Add or edit a note. Photos are shrunk on the phone as soon as they are
 * picked, so the upload is small and the preview shows what will be stored.
 * onSubmit(payload) resolves true when saved; a new-note form then clears
 * the text and photos but keeps the level and type for the next note.
 */
export default function NoteForm({ levels, isAr, note = null, onSubmit, submitLabel }) {
  const uid = useId();
  const editing = Boolean(note);
  const [level, setLevel] = useState(() => {
    const saved = note?.level || readPref(LEVEL_KEY);
    return levels.includes(saved) || editing ? saved : levels[0] || '';
  });
  const [type, setType] = useState(() => note?.note_type || readPref(TYPE_KEY, ''));
  const [description, setDescription] = useState(note?.description || '');
  const [location, setLocation] = useState(note?.location || '');
  const [photos, setPhotos] = useState(() => fromNote(note));
  const [processing, setProcessing] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; });

  // Free the preview images when the form goes away.
  useEffect(() => () => {
    photosRef.current.forEach(p => p.kind === 'new' && URL.revokeObjectURL(p.preview));
  }, []);

  const levelOptions = levels.includes(level) || !level ? levels : [level, ...levels];
  const slots = MAX_PHOTOS - photos.length - processing;

  const addFiles = async (fileList) => {
    const files = [...(fileList || [])].filter(f => f.type.startsWith('image/') || f.type === '');
    if (files.length === 0) return;
    if (slots <= 0) {
      toast.error(isAr ? `الحد الأقصى ${MAX_PHOTOS} صور للملاحظة.` : `Up to ${MAX_PHOTOS} photos per note.`);
      return;
    }
    const take = files.slice(0, slots);
    if (files.length > take.length) {
      toast.info(isAr ? `أُخذت أول ${take.length} صور فقط، الحد ${MAX_PHOTOS} للملاحظة.` : `Only the first ${take.length} were added (max ${MAX_PHOTOS}).`);
    }
    setProcessing(n => n + take.length);
    for (const file of take) {
      try {
        const { full, thumb } = await preparePhoto(file);
        setPhotos(prev => [...prev, { key: nextKey(), kind: 'new', full, thumb, preview: URL.createObjectURL(thumb) }]);
      } catch {
        toast.error(isAr ? 'تعذر قراءة إحدى الصور. جرّب صورة أخرى أو التقطها من جديد.' : 'Could not read one photo. Try another one.');
      } finally {
        setProcessing(n => n - 1);
      }
    }
    setErrors(e => ({ ...e, photos: undefined }));
  };

  const onPick = (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const removePhoto = (key) => setPhotos(prev => {
    const target = prev.find(p => p.key === key);
    if (target?.kind === 'new') URL.revokeObjectURL(target.preview);
    return prev.filter(p => p.key !== key);
  });

  const validate = () => {
    const next = {};
    if (!level) next.level = isAr ? 'اختر النزلة.' : 'Choose the level.';
    if (!type) next.type = isAr ? 'اختر نوع الملاحظة.' : 'Choose the note type.';
    if (!description.trim()) next.description = isAr ? 'اكتب وصف الملاحظة.' : 'Describe the note.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (processing > 0 || !validate()) return;
    setSaving(true);
    try {
      const added = photos.filter(p => p.kind === 'new');
      const payload = {
        level,
        note_type: type,
        description: description.trim(),
        location: location.trim(),
        keep: photos.filter(p => p.kind === 'existing').map(p => p.path),
        photos: await Promise.all(added.map(async p => ({ full: await blobToDataUrl(p.full), thumb: await blobToDataUrl(p.thumb) }))),
      };
      writePref(LEVEL_KEY, level);
      writePref(TYPE_KEY, type);
      const ok = await onSubmit(payload);
      if (ok && !editing) {
        added.forEach(p => URL.revokeObjectURL(p.preview));
        setDescription('');
        setLocation('');
        setPhotos([]);
        setErrors({});
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="stack ho-form" onSubmit={submit} noValidate aria-busy={saving}>
      <Field label={isAr ? 'النزلة' : 'Level'} htmlFor={`${uid}-level`} error={errors.level}>
        <select
          id={`${uid}-level`}
          className="select ho-select-lg"
          value={level}
          onChange={(e) => { setLevel(e.target.value); setErrors(er => ({ ...er, level: undefined })); }}
          aria-invalid={Boolean(errors.level)}
        >
          {!level && <option value="">{isAr ? 'اختر النزلة' : 'Choose'}</option>}
          {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>

      <fieldset className="form-section">
        <legend className="field-label">{isAr ? 'نوع الملاحظة' : 'Note type'}</legend>
        <div className="ho-types" role="radiogroup" aria-label={isAr ? 'نوع الملاحظة' : 'Note type'}>
          {NOTE_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={type === t.id}
              className="ho-type-option"
              onClick={() => { setType(t.id); setErrors(er => ({ ...er, type: undefined })); }}
            >
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>
        {errors.type && <span className="field-error" role="alert">{errors.type}</span>}
      </fieldset>

      <Field label={isAr ? 'وصف الملاحظة' : 'Description'} htmlFor={`${uid}-desc`} error={errors.description}>
        <textarea
          id={`${uid}-desc`}
          className="textarea"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(er => ({ ...er, description: undefined })); }}
          placeholder={isAr ? 'مثال: فراغ بالحل بين البلاطتين قرب الدرج' : 'e.g. Open joint between two slabs near the stairs'}
          aria-invalid={Boolean(errors.description)}
          required
        />
      </Field>

      <Field label={isAr ? 'الموقع داخل النزلة (اختياري)' : 'Place in the level (optional)'} htmlFor={`${uid}-loc`}>
        <input
          id={`${uid}-loc`}
          className="input"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={isAr ? 'مثال: الجهة اليسرى، الدرجة الثالثة' : 'e.g. Left side, third step'}
        />
      </Field>

      <fieldset className="form-section">
        <legend className="field-label">
          {isAr ? 'الصور' : 'Photos'} <span className="muted num">({photos.length + processing} / {MAX_PHOTOS})</span>
        </legend>
        <div className="ho-photo-actions">
          <button type="button" className="btn btn--secondary ho-btn-lg" onClick={() => cameraRef.current?.click()} disabled={slots <= 0}>
            <Camera size={20} aria-hidden="true" />
            {isAr ? 'التقاط صورة' : 'Take photo'}
          </button>
          <button type="button" className="btn btn--secondary ho-btn-lg" onClick={() => galleryRef.current?.click()} disabled={slots <= 0}>
            <ImagePlus size={20} aria-hidden="true" />
            {isAr ? 'من المعرض' : 'From gallery'}
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={onPick} hidden />

        {(photos.length > 0 || processing > 0) && (
          <ul className="ho-photos ho-photos--edit" aria-label={isAr ? 'الصور المختارة' : 'Selected photos'}>
            {photos.map((p, i) => (
              <li key={p.key} className="ho-photo">
                <img src={p.preview} alt={`${isAr ? 'صورة' : 'Photo'} ${i + 1}`} />
                <button
                  type="button"
                  className="ho-photo-remove"
                  onClick={() => removePhoto(p.key)}
                  aria-label={`${isAr ? 'إزالة الصورة' : 'Remove photo'} ${i + 1}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
            {Array.from({ length: processing }, (_, i) => (
              <li key={`busy-${i}`} className="ho-photo ho-photo--busy" role="status">
                <Loader2 size={20} className="ho-spin" aria-hidden="true" />
                <span className="sr-only">{isAr ? 'جارٍ تجهيز الصورة' : 'Preparing photo'}</span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <button type="submit" className="btn btn--primary btn--block ho-btn-lg" aria-busy={saving} disabled={processing > 0}>
        <Save size={20} aria-hidden="true" />
        {submitLabel || (isAr ? 'حفظ الملاحظة' : 'Save note')}
      </button>
    </form>
  );
}
