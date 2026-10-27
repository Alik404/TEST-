import { useEffect, useMemo, useRef, useState } from 'react';
import { Images, Share2, Download, Wand2, TriangleAlert, ImageOff } from 'lucide-react';
import { EmptyState, Modal, ProgressBar } from '../ui';
import { toast } from '../../utils/toast';
import { noteType, noteText, dmy, sortNotes, exportFileName } from '../../utils/handover';
import {
  ensureExportFonts, loadPhoto, renderNoteImage, canShareFiles, shareFiles, downloadFiles, SHARE_BATCH,
} from '../../utils/handoverImages';

const exportable = (note, includeDeferred) =>
  Boolean(note.number) && (note.status === 'approved' || (includeDeferred && note.status === 'deferred'));

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const asFile = (item) => new File([item.blob], item.name, { type: 'image/jpeg', lastModified: Date.now() });

/**
 * Turns approved notes into ready-to-send images: choose the levels (deferred
 * notes only when asked), build the images on this phone, check them in the
 * preview, then share to Viber/WhatsApp or save each one to the gallery.
 */
export default function ExportTab({ notes, levels, isAr, refreshNotes }) {
  const [excluded, setExcluded] = useState(() => new Set());
  const [includeDeferred, setIncludeDeferred] = useState(false);
  const [items, setItems] = useState([]);
  const [failed, setFailed] = useState([]);
  const [progress, setProgress] = useState(null);
  const [shareIndex, setShareIndex] = useState(0);
  const [saving, setSaving] = useState(null);
  const [preview, setPreview] = useState(null);

  // Object URLs of the previews are released when replaced or when leaving the tab.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });
  useEffect(() => () => itemsRef.current.forEach(i => URL.revokeObjectURL(i.url)), []);

  const clearItems = () => {
    items.forEach(i => URL.revokeObjectURL(i.url));
    setItems([]);
    setFailed([]);
    setShareIndex(0);
  };

  const levelCounts = useMemo(() => {
    const counts = new Map();
    for (const n of notes) {
      if (exportable(n, includeDeferred)) counts.set(n.level, (counts.get(n.level) || 0) + 1);
    }
    return counts;
  }, [notes, includeDeferred]);

  const levelOptions = useMemo(() => [
    ...levels.filter(l => levelCounts.has(l)),
    ...[...levelCounts.keys()].filter(l => !levels.includes(l)).sort(),
  ], [levels, levelCounts]);

  const pickNotes = (list) => sortNotes(list.filter(n => exportable(n, includeDeferred) && !excluded.has(n.level)), levels);
  const chosenNotes = pickNotes(notes);
  const imageTotal = chosenNotes.reduce((sum, n) => sum + Math.max(1, n.photos.length), 0);

  const toggleLevel = (level) => {
    clearItems();
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });
  };

  const setAllLevels = (on) => {
    clearItems();
    setExcluded(on ? new Set() : new Set(levelOptions));
  };

  const generate = async () => {
    clearItems();
    setProgress({ done: 0, total: imageTotal });
    try {
      if (!(await ensureExportFonts())) {
        toast.error(isAr ? 'تعذر تحميل الخط العربي (Cairo). تأكد من الإنترنت وأعد المحاولة.' : 'Could not load the Cairo font. Check the connection and retry.');
        return;
      }
      // Fresh signed links, and any note approved since the tab opened.
      const fresh = pickNotes(await refreshNotes());
      const total = fresh.reduce((sum, n) => sum + Math.max(1, n.photos.length), 0);
      const built = [];
      const errors = [];
      let done = 0;
      setProgress({ done, total });

      for (const note of fresh) {
        const base = {
          number: note.number,
          level: note.level,
          typeLabel: noteType(note.note_type).ar,
          date: dmy(note.created_at),
          text: noteText(note),
        };
        const photos = note.photos.length ? note.photos : [null];
        for (let i = 0; i < photos.length; i += 1) {
          const name = exportFileName(note.number, photos[i] ? i + 1 : 0);
          try {
            const bitmap = photos[i] ? await loadPhoto(photos[i].url) : null;
            const blob = await renderNoteImage({ ...base, photo: bitmap });
            bitmap?.close?.();
            built.push({ id: `${note.id}-${i}`, name, blob, url: URL.createObjectURL(blob), selected: true });
          } catch (err) {
            console.error('Export image failed:', name, err);
            errors.push(name);
          }
          done += 1;
          setProgress({ done, total });
        }
      }

      setItems(built);
      setFailed(errors);
      if (built.length) {
        toast.success(isAr ? `جهزت ${built.length} صورة. راجعها ثم شاركها أو احفظها.` : `${built.length} images ready. Review, then share or save.`);
      }
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر تجهيز الصور.' : 'Could not build the images.'));
    } finally {
      setProgress(null);
    }
  };

  const chosen = items.filter(i => i.selected);
  const batches = chunk(chosen, SHARE_BATCH);
  const batch = batches[Math.min(shareIndex, Math.max(0, batches.length - 1))] || [];

  const setSelected = (id, selected) => {
    setShareIndex(0);
    setItems(prev => prev.map(i => (i.id === id ? { ...i, selected } : i)));
  };

  const setAllSelected = (selected) => {
    setShareIndex(0);
    setItems(prev => prev.map(i => ({ ...i, selected })));
  };

  const save = async (list) => {
    setSaving({ done: 0, total: list.length });
    try {
      await downloadFiles(list, done => setSaving({ done, total: list.length }));
      toast.success(isAr ? `تم حفظ ${list.length} صورة.` : `${list.length} images saved.`);
    } finally {
      setSaving(null);
    }
  };

  const share = async () => {
    if (batch.length === 0) return;
    const files = batch.map(asFile);
    if (!canShareFiles(files)) {
      toast.info(isAr ? 'المشاركة المباشرة غير مدعومة بهذا المتصفح، فراح تنحفظ الصور بدلها.' : 'Sharing is not supported here, so the images are saved instead.');
      await save(chosen);
      return;
    }
    try {
      await shareFiles(files);
      if (shareIndex + 1 < batches.length) {
        setShareIndex(shareIndex + 1);
        toast.info(isAr ? `أُرسلت الدفعة ${shareIndex + 1}. اضغط «مشاركة» للدفعة التالية.` : `Batch ${shareIndex + 1} sent. Tap Share for the next one.`);
      } else {
        setShareIndex(0);
        toast.success(isAr ? 'تمت مشاركة كل الصور المختارة.' : 'All selected images shared.');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      toast.error(isAr ? 'تعذرت المشاركة. جرّب «حفظ الصور» ثم أرسلها من المعرض.' : 'Sharing failed. Save the images and send them from the gallery.');
    }
  };

  if (levelOptions.length === 0) {
    return (
      <section className="card">
        <EmptyState
          icon={Images}
          title={isAr ? 'لا توجد ملاحظات معتمدة للتصدير' : 'No approved notes to export'}
          text={isAr ? 'اعتمد ملاحظات من تبويب «الفلترة» أولاً، وتظهر هنا بأرقامها.' : 'Approve notes in the Review tab first.'}
        />
      </section>
    );
  }

  const busy = Boolean(progress || saving);
  const shareLabel = batches.length > 1
    ? (isAr ? `مشاركة الدفعة ${shareIndex + 1} من ${batches.length}` : `Share batch ${shareIndex + 1} of ${batches.length}`)
    : (isAr ? 'مشاركة' : 'Share');

  return (
    <div className="stack">
      <section className="card" aria-labelledby="ho-ex-title">
        <header className="card-header">
          <div>
            <h2 className="card-title" id="ho-ex-title">{isAr ? 'اختيار النزلات' : 'Choose levels'}</h2>
            <p className="card-subtitle">{isAr ? 'كل صورة تطلع برقم الملاحظة والنزلة والنوع والتاريخ ونص الملاحظة فقط.' : 'Each image shows only the note number, level, type, date and text.'}</p>
          </div>
        </header>
        <div className="card-body stack-sm">
          <div className="btn-row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllLevels(true)} disabled={busy}>{isAr ? 'تحديد الكل' : 'Select all'}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllLevels(false)} disabled={busy}>{isAr ? 'إلغاء التحديد' : 'Clear'}</button>
          </div>
          <div className="chips chips--wrap" role="group" aria-label={isAr ? 'النزلات' : 'Levels'}>
            {levelOptions.map(level => (
              <button key={level} type="button" className="chip" aria-pressed={!excluded.has(level)} onClick={() => toggleLevel(level)} disabled={busy}>
                <span dir="ltr">{level}</span>
                <span className="chip-count num">{levelCounts.get(level)}</span>
              </button>
            ))}
          </div>

          <label className="ho-switch">
            <input
              type="checkbox"
              role="switch"
              checked={includeDeferred}
              onChange={(e) => { clearItems(); setIncludeDeferred(e.target.checked); }}
              disabled={busy}
            />
            <span className="ho-switch-track" aria-hidden="true" />
            <span>{isAr ? 'تضمين المؤجلة' : 'Include deferred'}</span>
            <span className="muted text-xs num" dir="ltr">B37-D01</span>
          </label>

          <p className="muted text-sm">
            <span className="num">{chosenNotes.length}</span> {isAr ? 'ملاحظة' : 'notes'}
            {' · '}
            <span className="num">{imageTotal}</span> {isAr ? 'صورة' : 'images'}
          </p>

          {progress ? (
            <div className="stack-sm" role="status" aria-live="polite">
              <ProgressBar value={progress.total ? (progress.done / progress.total) * 100 : 0} label={isAr ? 'تقدم التجهيز' : 'Progress'} />
              <span className="text-sm">{isAr ? `جارٍ تجهيز ${progress.done} من ${progress.total}` : `Building ${progress.done} of ${progress.total}`}</span>
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--block ho-btn-lg" onClick={generate} disabled={imageTotal === 0 || busy}>
              <Wand2 size={20} aria-hidden="true" />
              {isAr ? `تجهيز الصور (${imageTotal})` : `Build images (${imageTotal})`}
            </button>
          )}
        </div>
      </section>

      {failed.length > 0 && (
        <div className="alert alert--danger" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <div className="alert-body">
            {isAr ? 'تعذر تجهيز هذه الصور، أعد المحاولة: ' : 'These images failed, try again: '}
            <span dir="ltr">{failed.join(', ')}</span>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <section className="card" aria-labelledby="ho-pv-title">
          <header className="card-header card-header--divided">
            <div>
              <h2 className="card-title" id="ho-pv-title">{isAr ? 'معاينة قبل الإرسال' : 'Preview before sending'}</h2>
              <p className="card-subtitle">
                {isAr ? `مختارة ${chosen.length} من ${items.length}. اضغط الصورة لعرضها كاملة.` : `${chosen.length} of ${items.length} selected. Tap an image to see it full size.`}
              </p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllSelected(true)}>{isAr ? 'تحديد الكل' : 'Select all'}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllSelected(false)}>{isAr ? 'إلغاء التحديد' : 'Clear'}</button>
            </div>
          </header>
          <div className="card-body stack">
            <ul className="ho-export-grid">
              {items.map(item => (
                <li key={item.id} className="ho-export-item" data-selected={item.selected}>
                  <button type="button" className="ho-export-thumb" onClick={() => setPreview(item)} aria-label={`${isAr ? 'عرض' : 'View'} ${item.name}`}>
                    <img src={item.url} alt="" />
                  </button>
                  <label className="ho-export-check">
                    <input type="checkbox" checked={item.selected} onChange={(e) => setSelected(item.id, e.target.checked)} />
                    <span dir="ltr" className="num">{item.name}</span>
                  </label>
                </li>
              ))}
            </ul>

            {saving && (
              <div role="status" aria-live="polite" className="text-sm">
                {isAr ? `جارٍ الحفظ ${saving.done} من ${saving.total}` : `Saving ${saving.done} of ${saving.total}`}
              </div>
            )}

            <div className="ho-export-actions">
              <button type="button" className="btn btn--primary ho-btn-lg" onClick={share} disabled={chosen.length === 0 || busy}>
                <Share2 size={20} aria-hidden="true" />
                {shareLabel}
              </button>
              <button type="button" className="btn btn--secondary ho-btn-lg" onClick={() => save(chosen)} disabled={chosen.length === 0 || busy}>
                <Download size={20} aria-hidden="true" />
                {isAr ? 'حفظ الصور' : 'Save images'}
              </button>
            </div>
            <p className="muted text-xs">
              {isAr
                ? `المشاركة ترسل ${SHARE_BATCH} صور كحد أقصى بكل مرة. عند الحفظ، إذا سألك المتصفح عن تنزيل عدة ملفات اختر «السماح».`
                : `Sharing sends up to ${SHARE_BATCH} images at a time. When saving, allow multiple downloads if the browser asks.`}
            </p>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        size="xl"
        title={preview?.name || ''}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
        bodyClassName="ho-viewer-body"
      >
        {preview ? <img className="ho-viewer-img" src={preview.url} alt={preview.name} /> : <ImageOff size={24} aria-hidden="true" />}
      </Modal>
    </div>
  );
}
