import { useEffect, useMemo, useRef, useState } from 'react';
import { Images, Share2, Download, Wand2, TriangleAlert, ImageOff } from 'lucide-react';
import { EmptyState, Modal, ProgressBar } from '../ui';
import { toast } from '../../utils/toast';
import { noteType, noteText, dmy, sortNotes, exportFileName, isAllLevels, levelLabel } from '../../utils/handover';
import {
  ensureExportFonts, loadPhoto, renderNoteImage, renderLevelCover, canShareFiles, shareFiles, downloadFiles, SHARE_BATCH,
} from '../../utils/handoverImages';
import { readPref, writePref } from '../../utils/handover';

const exportable = (note, includeDeferred) =>
  Boolean(note.number) && (note.status === 'approved' || (includeDeferred && note.status === 'deferred'));

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const ALL = '__all';
const COVER_PREF = 'handover_export_cover';

/** Cover file name, sorted before the level's notes: B37-00_cover.jpg. */
const coverFileName = (level) => `${String(level).replace(/[^A-Za-z0-9-]/g, '') || 'level'}-00_cover.jpg`;

/** Notes of the chosen levels, grouped in the order they were sorted. */
const groupByLevel = (notes) => {
  const map = new Map();
  for (const n of notes) {
    if (!map.has(n.level)) map.set(n.level, []);
    map.get(n.level).push(n);
  }
  return [...map].map(([level, list]) => ({ level, notes: list }));
};

const groupItems = (items) => {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.level)) map.set(item.level, []);
    map.get(item.level).push(item);
  }
  return [...map].map(([level, list]) => ({ level, items: list }));
};

const asFile = (item) => new File([item.blob], item.name, { type: 'image/jpeg', lastModified: Date.now() });

/**
 * Turns approved notes into ready-to-send images: choose the levels (deferred
 * notes only when asked), build the images on this phone, check them in the
 * preview, then share to Viber/WhatsApp or save each one to the gallery.
 *
 * Images are prepared and sent level by level: each level can open with a
 * cover image, has its own share and save buttons, and share batches never
 * mix two levels, so every level lands in the chat as its own group.
 */
export default function ExportTab({ notes, levels, isAr, refreshNotes }) {
  const [excluded, setExcluded] = useState(() => new Set());
  const [includeDeferred, setIncludeDeferred] = useState(false);
  const [items, setItems] = useState([]);
  const [failed, setFailed] = useState([]);
  const [progress, setProgress] = useState(null);
  // Next batch to share, per level (ALL = sharing every level in turn).
  const [shareAt, setShareAt] = useState({});
  const [withCover, setWithCover] = useState(() => readPref(COVER_PREF, '1') === '1');
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
    setShareAt({});
  };

  const levelCounts = useMemo(() => {
    const counts = new Map();
    for (const n of notes) {
      if (exportable(n, includeDeferred)) counts.set(n.level, (counts.get(n.level) || 0) + 1);
    }
    return counts;
  }, [notes, includeDeferred]);

  const levelOptions = useMemo(() => [
    ...[...levelCounts.keys()].filter(isAllLevels),
    ...levels.filter(l => levelCounts.has(l)),
    ...[...levelCounts.keys()].filter(l => !levels.includes(l) && !isAllLevels(l)).sort(),
  ], [levels, levelCounts]);

  const pickNotes = (list) => sortNotes(list.filter(n => exportable(n, includeDeferred) && !excluded.has(n.level)), levels);
  const chosenNotes = pickNotes(notes);
  const chosenLevels = new Set(chosenNotes.map(n => n.level)).size;
  const imageTotal = chosenNotes.reduce((sum, n) => sum + Math.max(1, n.photos.length), 0)
    + (withCover ? chosenLevels : 0);

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
      const levelGroups = groupByLevel(fresh);
      const total = fresh.reduce((sum, n) => sum + Math.max(1, n.photos.length), 0)
        + (withCover ? levelGroups.length : 0);
      const built = [];
      const errors = [];
      let done = 0;
      setProgress({ done, total });

      for (const { level, notes: levelNotes } of levelGroups) {
        if (withCover) {
          const name = coverFileName(level);
          try {
            const blob = await renderLevelCover({
              level: levelLabel(level, true),
              noteCount: levelNotes.length,
              imageCount: levelNotes.reduce((sum, n) => sum + Math.max(1, n.photos.length), 0),
              date: dmy(new Date().toISOString()),
              numbers: levelNotes.map(n => n.number),
            });
            built.push({ id: `cover-${level}`, level, cover: true, name, blob, url: URL.createObjectURL(blob), selected: true });
          } catch (err) {
            console.error('Export cover failed:', name, err);
            errors.push(name);
          }
          done += 1;
          setProgress({ done, total });
        }

        for (const note of levelNotes) {
          const base = {
            number: note.number,
            level: levelLabel(note.level, true),
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
              built.push({ id: `${note.id}-${i}`, level, name, blob, url: URL.createObjectURL(blob), selected: true });
            } catch (err) {
              console.error('Export image failed:', name, err);
              errors.push(name);
            }
            done += 1;
            setProgress({ done, total });
          }
        }
      }

      setItems(built);
      setFailed(errors);
      if (built.length) {
        toast.success(isAr
          ? `جهزت ${built.length} صورة لـ ${levelGroups.length} نزلة. شارك كل نزلة على حدة أو احفظها.`
          : `${built.length} images ready for ${levelGroups.length} levels. Share or save each level on its own.`);
      }
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر تجهيز الصور.' : 'Could not build the images.'));
    } finally {
      setProgress(null);
    }
  };

  const chosen = items.filter(i => i.selected);
  const groups = groupItems(items);

  // Batches never cross a level: sharing everything goes level by level.
  const batchesFor = (key) => (key === ALL
    ? groups.flatMap(g => chunk(g.items.filter(i => i.selected), SHARE_BATCH))
    : chunk(items.filter(i => i.selected && i.level === key), SHARE_BATCH));

  const setSelected = (id, selected) => {
    setShareAt({});
    setItems(prev => prev.map(i => (i.id === id ? { ...i, selected } : i)));
  };

  const setAllSelected = (selected, level) => {
    setShareAt({});
    setItems(prev => prev.map(i => (level === undefined || i.level === level ? { ...i, selected } : i)));
  };

  const toggleCover = (on) => {
    clearItems();
    setWithCover(on);
    writePref(COVER_PREF, on ? '1' : '0');
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

  const share = async (key) => {
    const batches = batchesFor(key);
    const index = Math.min(shareAt[key] || 0, Math.max(0, batches.length - 1));
    const batch = batches[index] || [];
    if (batch.length === 0) return;
    const files = batch.map(asFile);
    if (!canShareFiles(files)) {
      toast.info(isAr ? 'المشاركة المباشرة غير مدعومة بهذا المتصفح، فراح تنحفظ الصور بدلها.' : 'Sharing is not supported here, so the images are saved instead.');
      await save(batches.flat());
      return;
    }
    const where = key === ALL ? '' : isAllLevels(key) ? (isAr ? ' لكل النزلات' : ' for all levels') : (isAr ? ` للنزلة ${key}` : ` for ${key}`);
    try {
      await shareFiles(files);
      if (index + 1 < batches.length) {
        setShareAt(prev => ({ ...prev, [key]: index + 1 }));
        toast.info(isAr
          ? `أُرسلت الدفعة ${index + 1}${where}. اضغط «مشاركة» للدفعة التالية.`
          : `Batch ${index + 1}${where} sent. Tap Share for the next one.`);
      } else {
        setShareAt(prev => ({ ...prev, [key]: 0 }));
        toast.success(isAr ? `تمت مشاركة كل الصور المختارة${where}.` : `All selected images${where} shared.`);
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
  const shareLabel = (key, base) => {
    const count = batchesFor(key).length;
    const index = Math.min(shareAt[key] || 0, Math.max(0, count - 1));
    return count > 1
      ? (isAr ? `${base} (دفعة ${index + 1} من ${count})` : `${base} (batch ${index + 1} of ${count})`)
      : base;
  };

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
                <span dir={isAllLevels(level) ? undefined : 'ltr'}>{levelLabel(level, isAr)}</span>
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

          <label className="ho-switch">
            <input
              type="checkbox"
              role="switch"
              checked={withCover}
              onChange={(e) => toggleCover(e.target.checked)}
              disabled={busy}
            />
            <span className="ho-switch-track" aria-hidden="true" />
            <span>{isAr ? 'صورة غلاف لكل نزلة' : 'Cover image per level'}</span>
          </label>

          <p className="muted text-sm">
            <span className="num">{chosenLevels}</span> {isAr ? 'نزلة' : 'levels'}
            {' · '}
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
                {isAr
                  ? `مختارة ${chosen.length} من ${items.length}. شارك كل نزلة على حدة من زرها، واضغط الصورة لعرضها كاملة.`
                  : `${chosen.length} of ${items.length} selected. Share each level from its own button; tap an image to see it full size.`}
              </p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllSelected(true)}>{isAr ? 'تحديد الكل' : 'Select all'}</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllSelected(false)}>{isAr ? 'إلغاء التحديد' : 'Clear'}</button>
            </div>
          </header>
          <div className="card-body stack">
            {groups.map(group => {
              const picked = group.items.filter(i => i.selected);
              const allPicked = picked.length === group.items.length;
              return (
                <section key={group.level} className="ho-export-level" aria-labelledby={`ho-lv-${group.level}`}>
                  <header className="ho-export-level-head">
                    <h3 id={`ho-lv-${group.level}`}>
                      {isAllLevels(group.level)
                        ? levelLabel(group.level, isAr)
                        : <>{isAr ? 'النزلة' : 'Level'} <span dir="ltr" className="num">{group.level}</span></>}
                      <span className="chip-count num">{picked.length}/{group.items.length}</span>
                    </h3>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllSelected(!allPicked, group.level)} disabled={busy}>
                      {allPicked ? (isAr ? 'إلغاء التحديد' : 'Clear') : (isAr ? 'تحديد الكل' : 'Select all')}
                    </button>
                  </header>

                  <ul className="ho-export-grid">
                    {group.items.map(item => (
                      <li key={item.id} className="ho-export-item" data-selected={item.selected}>
                        <button type="button" className="ho-export-thumb" onClick={() => setPreview(item)} aria-label={`${isAr ? 'عرض' : 'View'} ${item.name}`}>
                          <img src={item.url} alt="" />
                        </button>
                        <label className="ho-export-check">
                          <input type="checkbox" checked={item.selected} onChange={(e) => setSelected(item.id, e.target.checked)} />
                          <span dir="ltr" className="num">{item.cover ? (isAr ? 'غلاف' : 'Cover') : item.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div className="ho-export-actions">
                    <button type="button" className="btn btn--primary" onClick={() => share(group.level)} disabled={picked.length === 0 || busy}>
                      <Share2 size={18} aria-hidden="true" />
                      {shareLabel(group.level, isAr ? `مشاركة ${levelLabel(group.level, isAr)}` : `Share ${levelLabel(group.level, isAr)}`)}
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => save(picked)} disabled={picked.length === 0 || busy}>
                      <Download size={18} aria-hidden="true" />
                      {isAr ? `حفظ ${levelLabel(group.level, isAr)}` : `Save ${levelLabel(group.level, isAr)}`}
                    </button>
                  </div>
                </section>
              );
            })}

            {saving && (
              <div role="status" aria-live="polite" className="text-sm">
                {isAr ? `جارٍ الحفظ ${saving.done} من ${saving.total}` : `Saving ${saving.done} of ${saving.total}`}
              </div>
            )}

            {groups.length > 1 && (
              <div className="ho-export-actions ho-export-actions--all">
                <button type="button" className="btn btn--secondary ho-btn-lg" onClick={() => share(ALL)} disabled={chosen.length === 0 || busy}>
                  <Share2 size={20} aria-hidden="true" />
                  {shareLabel(ALL, isAr ? 'مشاركة كل النزلات' : 'Share all levels')}
                </button>
                <button type="button" className="btn btn--secondary ho-btn-lg" onClick={() => save(chosen)} disabled={chosen.length === 0 || busy}>
                  <Download size={20} aria-hidden="true" />
                  {isAr ? 'حفظ كل الصور' : 'Save all images'}
                </button>
              </div>
            )}
            <p className="muted text-xs">
              {isAr
                ? `كل نزلة تُرسل لوحدها، ${SHARE_BATCH} صور كحد أقصى بكل مرة، ولا تختلط صور نزلتين بنفس الدفعة. عند الحفظ، إذا سألك المتصفح عن تنزيل عدة ملفات اختر «السماح».`
                : `Each level is sent on its own, up to ${SHARE_BATCH} images at a time, and a batch never mixes two levels. When saving, allow multiple downloads if the browser asks.`}
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
