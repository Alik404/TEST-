import { useEffect, useRef, useState } from 'react';
import { PencilLine, ListChecks, ListFilter, Images, ClipboardCheck, Settings, TriangleAlert, Database, RotateCcw } from 'lucide-react';
import { LoadingBlock, Modal, ConfirmDialog, EmptyState } from '../ui';
import { toast } from '../../utils/toast';
import { handoverRequest, readPref, writePref } from '../../utils/handover';
import NoteForm from './NoteForm';
import NotesTab from './NotesTab';
import ReviewTab from './ReviewTab';
import ExportTab from './ExportTab';
import ReceiptsTab from './ReceiptsTab';
import SettingsModal from './SettingsModal';

const TAB_KEY = 'handover_tab';

const TABS = [
  { id: 'entry',    icon: PencilLine,     label: { ar: 'إدخال ملاحظة', en: 'New note' },         short: { ar: 'إدخال', en: 'New' },        when: p => p.canEnter },
  { id: 'notes',    icon: ListChecks,     label: { ar: 'الملاحظات', en: 'Notes' },               short: { ar: 'الملاحظات', en: 'Notes' },  when: () => true },
  { id: 'review',   icon: ListFilter,     label: { ar: 'الفلترة', en: 'Review' },                short: { ar: 'الفلترة', en: 'Review' },   when: p => p.canReview },
  { id: 'export',   icon: Images,         label: { ar: 'تصدير الصور', en: 'Export images' },     short: { ar: 'التصدير', en: 'Export' },   when: p => p.canReview },
  { id: 'receipts', icon: ClipboardCheck, label: { ar: 'استلام الجلي', en: 'Polishing handover' }, short: { ar: 'الاستلام', en: 'Handover' }, when: () => true },
];

const REVIEW_TOAST = {
  approve: (n, ar) => (ar ? `اعتُمدت برقم ${n.number}` : `Approved as ${n.number}`),
  defer:   (n, ar) => (ar ? `أُجّلت برقم ${n.number}` : `Deferred as ${n.number}`),
  reject:  (n, ar) => (ar ? 'استُبعدت الملاحظة' : 'Note rejected'),
  return:  (n, ar) => (ar ? 'رجعت الملاحظة للفلترة' : 'Sent back to review'),
};

/**
 * Handover notes section: engineers record notes with photos per level, the
 * reviewer approves them (numbered per level), exports them as images for
 * Viber/WhatsApp, and keeps the polishing handover register.
 */
export default function HandoverNotes({ user, lang }) {
  const isAr = lang === 'ar';
  const L = (o) => o[isAr ? 'ar' : 'en'];

  const [boot, setBoot] = useState(null);
  const [failure, setFailure] = useState(null);
  const [notes, setNotes] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [tab, setTab] = useState(() => readPref(TAB_KEY));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const tabRefs = useRef({});

  const loadAll = async () => {
    try {
      const [b, n, r] = await Promise.all([
        handoverRequest('/bootstrap'),
        handoverRequest('/notes'),
        handoverRequest('/receipts'),
      ]);
      setBoot(b);
      setNotes(n);
      setReceipts(r);
      setFailure(null);
    } catch (err) {
      setFailure({ message: err.message, setup: err.status === 503 });
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  useEffect(() => { Promise.resolve().then(loadAll); }, []);

  const refreshNotes = async () => {
    const fresh = await handoverRequest('/notes');
    setNotes(fresh);
    return fresh;
  };

  const upsert = (note) => setNotes(prev => (prev.some(n => n.id === note.id)
    ? prev.map(n => (n.id === note.id ? note : n))
    : [...prev, note]));

  const createNote = async (payload) => {
    try {
      const note = await handoverRequest('/notes', { method: 'POST', body: JSON.stringify(payload) });
      upsert(note);
      toast.success(isAr ? `حُفظت الملاحظة على ${note.level}، وهي بانتظار الفلترة.` : `Saved on ${note.level}, awaiting review.`);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const updateNote = async (payload) => {
    try {
      const note = await handoverRequest(`/notes/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      upsert(note);
      setEditing(null);
      toast.success(isAr ? 'تم حفظ التعديل.' : 'Changes saved.');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const deleteNote = async () => {
    try {
      await handoverRequest(`/notes/${deleting.id}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== deleting.id));
      setDeleting(null);
      toast.success(isAr ? 'حُذفت الملاحظة.' : 'Note deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const review = async (note, body) => {
    try {
      const saved = await handoverRequest(`/notes/${note.id}/review`, { method: 'POST', body: JSON.stringify(body) });
      upsert(saved);
      toast.success(REVIEW_TOAST[body.action](saved, isAr));
      return true;
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) refreshNotes().catch(() => {});
      return false;
    }
  };

  const saveSettings = async (payload) => {
    try {
      const next = await handoverRequest('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      setBoot(prev => ({ ...prev, ...next }));
      toast.success(isAr ? 'حُفظت الإعدادات.' : 'Settings saved.');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const saveReceipt = async (level, payload) => {
    try {
      const row = await handoverRequest(`/receipts/${encodeURIComponent(level)}`, { method: 'PUT', body: JSON.stringify(payload) });
      setReceipts(prev => [...prev.filter(r => r.level !== level), row]);
      toast.success(isAr ? `حُدّث استلام ${level}.` : `${level} updated.`);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  if (failure && !boot) {
    return (
      <section className="card">
        <EmptyState
          icon={failure.setup ? Database : TriangleAlert}
          title={failure.setup ? (isAr ? 'القسم يحتاج تجهيز قاعدة البيانات' : 'The database needs setting up') : (isAr ? 'تعذر تحميل الملاحظات' : 'Could not load notes')}
          text={failure.message}
          action={(
            <button type="button" className="btn btn--secondary" onClick={loadAll}>
              <RotateCcw size={18} aria-hidden="true" />
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          )}
        />
      </section>
    );
  }

  if (!boot) return <LoadingBlock label={isAr ? 'جارٍ تحميل ملاحظات الاستلام' : 'Loading handover notes'} />;

  const p = boot.permissions;
  const tabs = TABS.filter(t => t.when(p));
  const fallbackTab = p.canReview ? 'review' : p.canEnter ? 'entry' : 'notes';
  const active = tabs.some(t => t.id === tab) ? tab : fallbackTab;
  const pending = notes.filter(n => n.status === 'pending').length;
  const canManage = p.canManageLevels || p.canManageFilterers;

  const select = (id) => {
    setTab(id);
    writePref(TAB_KEY, id);
  };

  // Arrow keys move between tabs (mirrored in Arabic), Home/End jump to the ends.
  const onTabKey = (event, index) => {
    const forward = isAr ? 'ArrowLeft' : 'ArrowRight';
    const back = isAr ? 'ArrowRight' : 'ArrowLeft';
    let next = null;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === back) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  };

  const renderTab = () => {
    switch (active) {
      case 'entry':
        return (
          <section className="card" aria-label={L(TABS[0].label)}>
            <div className="card-body">
              <NoteForm levels={boot.levels} isAr={isAr} onSubmit={createNote} />
            </div>
          </section>
        );
      case 'review':
        return <ReviewTab notes={notes} levels={boot.levels} isAr={isAr} onReview={review} onEdit={setEditing} />;
      case 'export':
        return <ExportTab notes={notes} levels={boot.levels} isAr={isAr} refreshNotes={refreshNotes} />;
      case 'receipts':
        return <ReceiptsTab levels={boot.levels} notes={notes} receipts={receipts} isAr={isAr} canEdit={p.canEditReceipts} onSave={saveReceipt} />;
      case 'notes':
      default:
        return (
          <NotesTab
            notes={notes}
            levels={boot.levels}
            user={user}
            permissions={p}
            isAr={isAr}
            onEdit={setEditing}
            onDelete={setDeleting}
            onReturn={(note) => review(note, { action: 'return' })}
          />
        );
    }
  };

  return (
    <div className="stack ho">
      {boot.storage === 'local' && canManage && (
        <div className="alert alert--warn" role="status">
          <TriangleAlert size={18} aria-hidden="true" />
          <div className="alert-body">
            {isAr
              ? 'الحفظ حالياً محلي على السيرفر لأن Supabase غير مربوط، والملاحظات والصور تنحذف عند إعادة تشغيل الموقع. اربط Supabase قبل الاستخدام الفعلي.'
              : 'Notes are stored locally because Supabase is not connected; they are lost when the server restarts.'}
          </div>
        </div>
      )}

      <div className="ho-tabs" role="tablist" aria-label={isAr ? 'أقسام ملاحظات الاستلام' : 'Handover notes'}>
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              ref={el => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`ho-tab-${t.id}`}
              aria-selected={selected}
              aria-controls="ho-panel"
              tabIndex={selected ? 0 : -1}
              className="ho-tab"
              onClick={() => select(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="ho-tab-icon">
                <Icon size={20} strokeWidth={selected ? 2.25 : 1.75} aria-hidden="true" />
                {t.id === 'review' && pending > 0 && <span className="ho-tab-count num">{pending}</span>}
              </span>
              <span className="ho-tab-label ho-tab-label--short">{L(t.short)}</span>
              <span className="ho-tab-label ho-tab-label--full">{L(t.label)}</span>
            </button>
          );
        })}
      </div>

      {canManage && (
        <div className="ho-toolbar">
          <span className="muted text-sm">
            <span className="num">{boot.levels.length}</span> {isAr ? 'نزلة' : 'levels'}
            {' · '}
            <span className="num">{pending}</span> {isAr ? 'بانتظار الفلترة' : 'awaiting review'}
            {' · '}
            {boot.filterers.length
              ? (isAr ? `المفلتر: ${(boot.users || []).filter(u => boot.filterers.includes(u.id)).map(u => u.name).join('، ')}` : `${boot.filterers.length} reviewer(s)`)
              : (isAr ? 'لم يُحدَّد مفلتر بعد' : 'No reviewer set')}
          </span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} aria-hidden="true" />
            {isAr ? 'الإعدادات' : 'Settings'}
          </button>
        </div>
      )}

      <div role="tabpanel" id="ho-panel" aria-labelledby={`ho-tab-${active}`} key={active}>
        {renderTab()}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing ? (isAr ? `تعديل ملاحظة - ${editing.level}` : `Edit note - ${editing.level}`) : ''}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
      >
        {editing && (
          <NoteForm key={editing.id} levels={boot.levels} isAr={isAr} note={editing} onSubmit={updateNote} submitLabel={isAr ? 'حفظ التعديل' : 'Save changes'} />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        lang={lang}
        title={isAr ? 'حذف الملاحظة' : 'Delete note'}
        message={isAr ? 'تنحذف الملاحظة وصورها نهائياً.' : 'The note and its photos will be deleted permanently.'}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={deleteNote}
        onClose={() => setDeleting(null)}
      />

      {settingsOpen && (
        <SettingsModal open onClose={() => setSettingsOpen(false)} boot={boot} notes={notes} isAr={isAr} onSave={saveSettings} />
      )}
    </div>
  );
}
