import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Send, Image as ImageIcon, Video as VideoIcon, CornerUpLeft, X, RefreshCw, Bot,
  Mic, Square, Trash2, MessageSquare, Activity
} from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { toast } from '../utils/toast';
import { date as fmtDate, time as fmtTime } from '../utils/format';
import { roleLabel, initials } from '../navigation';
import { EmptyState, LoadingBlock, Modal } from './ui';

const MAX_UPLOAD_MB = 12; // matches MAX_UPLOAD_BYTES on the server
const POLL_MS = 30000;

export default function DailyUpdates({ user, lang }) {
  const isAr = lang === 'ar';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [attachment, setAttachment] = useState(null); // { data, name, type }
  const [previewUrl, setPreviewUrl] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);

  const teamMembers = [
    { name: isAr ? 'المهندس المقيم' : 'Resident Engineer', role: 'admin' },
    { name: isAr ? 'مهندس الموقع' : 'Site Engineer', role: 'viewer' },
    { name: isAr ? 'الإدارة العليا' : 'Senior Management', role: 'viewer' },
    { name: isAr ? 'النظام' : 'System', role: 'system' }
  ];
  const mentionMatches = teamMembers.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));

  const fetchMessages = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/daily-updates');
      if (res.ok) setMessages(await res.json());
    } catch (err) {
      console.error('Error fetching logs:', err);
      if (manual) toast.error(isAr ? 'تعذر تحديث السجل.' : 'Could not refresh.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Load now, then poll quietly while the section is open.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await apiFetch('/api/daily-updates');
        if (res.ok && alive) setMessages(await res.json());
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Stop the microphone and timer if the section closes mid-recording.
  useEffect(() => () => {
    clearInterval(timerRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stream?.getTracks().forEach(t => t.stop());
  }, []);

  const clearAttachment = () => {
    setAttachment(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(isAr
        ? `حجم الملف أكبر من ${MAX_UPLOAD_MB} ميغابايت. اختر ملفاً أصغر أو صوّر مقطعاً أقصر.`
        : `File is larger than ${MAX_UPLOAD_MB} MB. Choose a smaller file or record a shorter clip.`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      clearAttachment();
      setAttachment({ data: reader.result, name: file.name, type: file.type.startsWith('video/') ? 'video' : 'image' });
      setPreviewUrl(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
        else if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };
        else if (MediaRecorder.isTypeSupported('audio/ogg')) options = { mimeType: 'audio/ogg' };
      }
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          clearAttachment();
          setAttachment({ data: reader.result, name: `voice_${Date.now()}.${ext}`, type: 'audio' });
          setPreviewUrl(URL.createObjectURL(blob));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordSecs(0);
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      toast.error(isAr ? 'تعذر بدء التسجيل. اسمح للمتصفح باستخدام الميكروفون ثم أعد المحاولة.' : 'Could not start recording. Allow microphone access and try again.');
    }
  };

  const stopRecording = (keep = true) => {
    clearInterval(timerRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      if (!keep) {
        rec.onstop = () => rec.stream.getTracks().forEach(t => t.stop());
      }
      rec.stop();
    }
    setIsRecording(false);
    setRecordSecs(0);
  };

  const onTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const lastWord = val.split(/\s/).pop();
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionFilter(lastWord.substring(1));
    } else {
      setShowMentions(false);
    }
    // Grow the box with its content, up to four lines.
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };

  const selectMention = (member) => {
    const words = text.split(/\s/);
    words.pop();
    words.push(`@${member.name} `);
    setText(words.join(' '));
    setShowMentions(false);
    setMentionIndex(-1);
    inputRef.current?.focus();
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() && !attachment) return;
    setSending(true);
    try {
      // Sender identity is taken from the session on the server.
      const body = { message_text: text, reply_to_id: replyTo ? replyTo.id : null };
      if (attachment) body.media_data = attachment.data;
      const res = await apiFetch('/api/daily-updates', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر إرسال الرسالة.' : 'Could not send the message.'));
      const msg = await res.json();
      setText('');
      if (inputRef.current) inputRef.current.style.height = '';
      setReplyTo(null);
      clearAttachment();
      setMessages(prev => [...prev, msg]);
    } catch (err) {
      toast.error(err.message || (isAr ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (showMentions && mentionMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectMention(mentionMatches[Math.max(0, mentionIndex)]); return; }
      if (e.key === 'Escape') { setShowMentions(false); setMentionIndex(-1); return; }
    }
    // Enter sends on keyboards; Shift+Enter adds a line. Phones keep Enter as a new line.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send();
    }
  };

  const renderText = (value) => {
    if (!value) return null;
    return value.split(/(@[^\s@]+)/g).map((part, i) => (part.startsWith('@')
      ? <span key={i} className="mention">{part}</span>
      : <Fragment key={i}>{part}</Fragment>));
  };

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let lastDay = '';

  return (
    <section className="chat card" aria-label={isAr ? 'التحديث اليومي' : 'Daily log'}>
      <header className="chat-head">
        <span className="stat-icon stat-icon--accent" aria-hidden="true"><Activity size={16} /></span>
        <div className="chat-head-text">
          <h2 className="card-title">{isAr ? 'سجل الموقف والمحادثة' : 'Site log & chat'}</h2>
          <p className="text-xs muted">{isAr ? 'تحديثات النظام التلقائية ورسائل الفريق' : 'Automatic system entries and team messages'}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => fetchMessages(true)} aria-busy={refreshing || undefined}
          aria-label={isAr ? 'تحديث' : 'Refresh'} title={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="chat-scroll" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions">
        {loading ? (
          <LoadingBlock label={isAr ? 'جارٍ تحميل السجل' : 'Loading'} />
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title={isAr ? 'لا توجد رسائل بعد' : 'No messages yet'}
            text={isAr ? 'اكتب أول تحديث للموقع أو أرفق صورة من الميدان.' : 'Write the first site update or attach a photo.'} />
        ) : messages.map(msg => {
          const day = new Date(msg.created_at).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const system = msg.sender_role === 'system';
          const mine = msg.user_id === user.id;
          return (
            <Fragment key={msg.id}>
              {showDay && <div className="chat-day"><span>{fmtDate(msg.created_at, lang, 'weekday')}</span></div>}
              {system ? (
                <div className="chat-system">
                  <Bot size={15} aria-hidden="true" />
                  <p>{msg.message_text}</p>
                  <time className="num">{fmtTime(msg.created_at, lang)}</time>
                </div>
              ) : (
                <div className={`chat-row${mine ? ' is-mine' : ''}`}>
                  {!mine && <span className="avatar" aria-hidden="true">{initials(msg.sender_name)}</span>}
                  <div className="bubble">
                    {!mine && (
                      <div className="bubble-sender">
                        {msg.sender_name} <span className="muted">· {roleLabel(msg.sender_role, lang)}</span>
                      </div>
                    )}
                    {msg.reply_to_id && (
                      <div className="bubble-quote">
                        <strong>{msg.reply_sender_name}</strong>
                        <span className="clamp-2">{msg.reply_message_text || (msg.reply_media_url ? (msg.reply_media_type === 'video' ? (isAr ? 'فيديو' : 'Video') : msg.reply_media_type === 'audio' ? (isAr ? 'تسجيل صوتي' : 'Voice note') : (isAr ? 'صورة' : 'Photo')) : '')}</span>
                      </div>
                    )}
                    {msg.media_url && (
                      <div className="bubble-media">
                        {msg.media_type === 'video' ? (
                          <video src={msg.media_url} controls preload="metadata" playsInline />
                        ) : msg.media_type === 'audio' ? (
                          <audio src={msg.media_url} controls preload="metadata" />
                        ) : (
                          <button type="button" className="bubble-image" onClick={() => setLightbox(msg.media_url)} aria-label={isAr ? 'عرض الصورة بالحجم الكامل' : 'View full size'}>
                            <img src={msg.media_url} alt={isAr ? `صورة من ${msg.sender_name}` : `Photo from ${msg.sender_name}`} loading="lazy" />
                          </button>
                        )}
                      </div>
                    )}
                    {msg.message_text && <p className="bubble-text">{renderText(msg.message_text)}</p>}
                    <div className="bubble-foot">
                      <time className="num">{fmtTime(msg.created_at, lang)}</time>
                      <button type="button" className="bubble-reply" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                        aria-label={isAr ? `رد على ${msg.sender_name}` : `Reply to ${msg.sender_name}`}>
                        <CornerUpLeft size={14} aria-hidden="true" />
                        {isAr ? 'رد' : 'Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <form className="composer" onSubmit={send}>
        {showMentions && mentionMatches.length > 0 && (
          <ul className="mention-list" role="listbox" aria-label={isAr ? 'اختر عضواً' : 'Choose a member'}>
            {mentionMatches.map((m, i) => (
              <li key={m.name} role="option" aria-selected={mentionIndex === i}>
                <button type="button" onClick={() => selectMention(m)}>
                  {m.role === 'system' ? <Bot size={14} aria-hidden="true" /> : <span className="avatar avatar--sm" aria-hidden="true">{initials(m.name)}</span>}
                  <span>{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {replyTo && (
          <div className="composer-context">
            <CornerUpLeft size={16} aria-hidden="true" />
            <div className="composer-context-text">
              <strong>{isAr ? `رد على ${replyTo.sender_name}` : `Replying to ${replyTo.sender_name}`}</strong>
              <span className="truncate">{replyTo.message_text || (isAr ? 'مرفق' : 'Attachment')}</span>
            </div>
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => setReplyTo(null)} aria-label={isAr ? 'إلغاء الرد' : 'Cancel reply'}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {attachment && (
          <div className="composer-context">
            {attachment.type === 'image' && <img className="composer-thumb" src={previewUrl} alt="" />}
            {attachment.type === 'video' && <video className="composer-thumb" src={previewUrl} muted playsInline />}
            {attachment.type === 'audio' && <audio src={previewUrl} controls className="composer-audio" />}
            {attachment.type !== 'audio' && (
              <div className="composer-context-text">
                <strong>{attachment.type === 'video' ? (isAr ? 'فيديو مرفق' : 'Video attached') : (isAr ? 'صورة مرفقة' : 'Photo attached')}</strong>
                <span className="truncate">{attachment.name}</span>
              </div>
            )}
            <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={clearAttachment} aria-label={isAr ? 'إزالة المرفق' : 'Remove attachment'}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {isRecording ? (
          <div className="composer-row recording">
            <span className="rec-dot" aria-hidden="true" />
            <span className="fw-bold">{isAr ? 'جارٍ التسجيل' : 'Recording'}</span>
            <span className="num muted">{mmss(recordSecs)}</span>
            <button type="button" className="btn btn--danger-ghost btn--icon" onClick={() => stopRecording(false)} aria-label={isAr ? 'إلغاء التسجيل' : 'Discard recording'} style={{ marginInlineStart: 'auto' }}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn--primary" onClick={() => stopRecording(true)}>
              <Square size={16} aria-hidden="true" />
              {isAr ? 'إنهاء وإرفاق' : 'Stop & attach'}
            </button>
          </div>
        ) : (
          <div className="composer-row">
            <input ref={imageRef} type="file" accept="image/*" hidden onChange={onFile} />
            <input ref={videoRef} type="file" accept="video/*" hidden onChange={onFile} />
            <div className="composer-tools">
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => imageRef.current?.click()} aria-label={isAr ? 'إرفاق صورة' : 'Attach photo'} title={isAr ? 'صورة' : 'Photo'}>
                <ImageIcon size={20} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => videoRef.current?.click()} aria-label={isAr ? 'إرفاق فيديو' : 'Attach video'} title={isAr ? 'فيديو' : 'Video'}>
                <VideoIcon size={20} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn--ghost btn--icon" onClick={startRecording} aria-label={isAr ? 'تسجيل رسالة صوتية' : 'Record voice note'} title={isAr ? 'تسجيل صوتي' : 'Voice'}>
                <Mic size={20} aria-hidden="true" />
              </button>
            </div>
            <textarea
              ref={inputRef}
              className="textarea composer-input"
              rows={1}
              value={text}
              onChange={onTextChange}
              onKeyDown={onKeyDown}
              placeholder={isAr ? 'اكتب تحديثاً' : 'Write an update'}
              title={isAr ? 'اكتب @ للإشارة إلى عضو' : 'Type @ to mention someone'}
              aria-label={isAr ? 'نص الرسالة' : 'Message'}
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn--primary btn--icon" aria-busy={sending} disabled={!text.trim() && !attachment}
              aria-label={isAr ? 'إرسال' : 'Send'}>
              <Send size={18} aria-hidden="true" style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
            </button>
          </div>
        )}
      </form>

      <Modal open={Boolean(lightbox)} onClose={() => setLightbox(null)} size="xl" title={isAr ? 'صورة من الموقع' : 'Site photo'} closeLabel={isAr ? 'إغلاق' : 'Close'}>
        {lightbox && <img src={lightbox} alt="" className="lightbox-img" />}
      </Modal>
    </section>
  );
}
