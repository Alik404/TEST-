import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  CornerUpLeft, 
  X, 
  RefreshCw, 
  User, 
  Activity, 
  Bot, 
  CheckCircle2, 
  Paperclip,
  Maximize2,
  Mic
} from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function DailyUpdates({ user, t, lang }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  
  // Media Upload State
  const [attachment, setAttachment] = useState(null); // { data, name, type }
  const [previewUrl, setPreviewUrl] = useState('');
  
  // Mention List Popover State
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const textInputRef = useRef(null);

  const chatScrollRef = useRef(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const teamMembers = [
    { name: lang === 'ar' ? 'المهندس المقيم' : 'Resident Engineer', role: 'admin' },
    { name: lang === 'ar' ? 'مهندس الموقع' : 'Site Engineer', role: 'viewer' },
    { name: lang === 'ar' ? 'الإدارة العليا' : 'Senior Management', role: 'viewer' },
    { name: lang === 'ar' ? 'النظام' : 'System', role: 'system' }
  ];

  // Fetch messages
  const fetchMessages = async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    if (messages.length === 0) setLoading(true);
    try {
      const res = await apiFetch('/api/daily-updates');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Poll for messages
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 30000); // Poll every 30 seconds to reduce lag
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Matches MAX_UPLOAD_BYTES on the server. Checking here avoids uploading a
    // large file only to have it rejected.
    const MAX_UPLOAD_MB = 12;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      alert(
        lang === 'ar'
          ? `حجم الملف أكبر من ${MAX_UPLOAD_MB} ميغابايت. اختر ملفاً أصغر أو صوّر مقطعاً أقصر.`
          : `File is larger than ${MAX_UPLOAD_MB} MB. Choose a smaller file or record a shorter clip.`
      );
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const isVideo = file.type.startsWith('video/');
      setAttachment({
        data: reader.result,
        name: file.name,
        type: isVideo ? 'video' : 'image'
      });
      setPreviewUrl(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = null;
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' };
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachment({
            data: reader.result,
            name: `voice_${Date.now()}.${ext}`,
            type: 'audio'
          });
          setPreviewUrl(URL.createObjectURL(audioBlob));
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      alert(lang === 'ar' ? 'فشل بدء تسجيل الصوت. يرجى التحقق من أذونات الميكروفون.' : 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = (shouldSave = true) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!shouldSave) {
        mediaRecorderRef.current.onstop = () => {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
        };
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Parse text for mentions to highlight them
  const renderMessageText = (text) => {
    if (!text) return '';
    
    // Find all mentions (@Something)
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const cleanName = part.substring(1);
        const isMember = teamMembers.some(m => m.name.toLowerCase() === cleanName.toLowerCase());
        
        return (
          <span 
            key={index} 
            className="mention-badge"
            style={{
              background: isMember ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.1)',
              color: isMember ? 'var(--accent)' : 'inherit',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: '700',
              direction: 'ltr',
              display: 'inline-block'
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachment) return;

    setLoading(true);
    try {
      // Sender identity is taken from the session on the server.
      const body = {
        message_text: inputText,
        reply_to_id: replyTo ? replyTo.id : null,
      };

      if (attachment) {
        body.media_data = attachment.data;
      }

      const res = await apiFetch('/api/daily-updates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setInputText('');
        setReplyTo(null);
        removeAttachment();
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
      } else {
        const errData = await res.json();
        alert(errData.error || 'فشل إرسال الرسالة.');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  };

  // Mention autocomplete trigger
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    // Check if user just typed @ or is typing a mention
    const words = val.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentionList(true);
      setMentionFilter(lastWord.substring(1));
    } else {
      setShowMentionList(false);
    }
  };

  const selectMention = (member) => {
    const words = inputText.split(/\s/);
    words.pop(); // Remove the typed @part
    words.push(`@${member.name} `); // Append select member name
    setInputText(words.join(' '));
    setShowMentionList(false);
    setMentionIndex(-1);
    if (textInputRef.current) {
      textInputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (showMentionList) {
      const filtered = teamMembers.filter(m => 
        m.name.toLowerCase().includes(mentionFilter.toLowerCase())
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mentionIndex >= 0 && mentionIndex < filtered.length) {
          selectMention(filtered[mentionIndex]);
        } else if (filtered.length > 0) {
          selectMention(filtered[0]);
        }
      } else if (e.key === 'Escape') {
        setShowMentionList(false);
        setMentionIndex(-1);
      }
    }
  };

  // Helper to format date
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateHeader = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Group messages by date to render headers
  const renderMessages = () => {
    let lastDate = '';

    return messages.map((msg, index) => {
      const msgDate = new Date(msg.created_at).toDateString();
      let dateHeader = null;
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        dateHeader = (
          <div key={`header-${msg.created_at}`} style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
            <span style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(4px)',
              padding: '0.25rem 1rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              border: '1px solid var(--border-soft)'
            }}>
              {formatDateHeader(msg.created_at)}
            </span>
          </div>
        );
      }

      const isSystemLog = msg.sender_role === 'system';
      const isMyMessage = msg.user_id === user.id;

      return (
        <React.Fragment key={msg.id}>
          {dateHeader}
          
          {isSystemLog ? (
            // Centered System Logs
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}
            >
              <div 
                className="system-log-card"
                style={{
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, rgba(255,255,255,0.02) 100%)',
                  borderRight: lang === 'ar' ? '3px solid var(--accent)' : 'none',
                  borderLeft: lang === 'en' ? '3px solid var(--accent)' : 'none',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  maxWidth: '85%',
                  boxShadow: 'var(--elev-raised)'
                }}
              >
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', padding: '6px', borderRadius: '50%' }}>
                  <Activity size={15} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--fg-2)', fontWeight: '500', lineHeight: 1.4 }}>
                    {msg.message_text}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'left' }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            // User Chat Messages
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ 
                display: 'flex', 
                justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                margin: '0.75rem 0',
                position: 'relative'
              }}
            >
              <div 
                className={`chat-bubble-wrapper ${isMyMessage ? 'mine' : 'theirs'}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  maxWidth: '70%',
                  alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                  gap: '4px'
                }}
              >
                {/* User Sender details */}
                 {!isMyMessage && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginRight: '6px', marginLeft: '6px', fontWeight: '600' }}>
                    {msg.sender_name} ({
                      msg.sender_role === 'super_admin'
                        ? (lang === 'ar' ? 'المدير العام' : 'General Director')
                        : msg.sender_role === 'admin'
                          ? t('quickEngineer')
                          : t('quickAdmin')
                    })
                  </span>
                )}

                {/* Actual Bubble */}
                <div 
                  className="chat-bubble"
                  style={{
                    background: isMyMessage 
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.08) 100%)'
                      : 'rgba(255, 255, 255, 0.04)',
                    backdropFilter: 'blur(10px)',
                    border: isMyMessage ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid var(--border-soft)',
                    borderRadius: isMyMessage ? '1.5rem 1.5rem 0.25rem 1.5rem' : '0.25rem 1.5rem 1.5rem 1.5rem',
                    padding: '0.75rem 1rem',
                    boxShadow: 'var(--elev-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    position: 'relative',
                    overflow: 'visible'
                  }}
                >
                  {/* Quoted Reply if present */}
                  {msg.reply_to_id && (
                    <div 
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderLeft: lang === 'en' ? '3px solid var(--accent)' : 'none',
                        borderRight: lang === 'ar' ? '3px solid var(--accent)' : 'none',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--fg-2)',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        maxWidth: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <span style={{ fontWeight: '700', fontSize: '0.7rem', color: 'var(--accent)' }}>
                        {msg.reply_sender_name}
                      </span>
                      <span className="text-truncate" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {msg.reply_message_text || (msg.reply_media_url ? `[${msg.reply_media_type === 'video' ? 'فيديو' : 'صورة'}]` : '')}
                      </span>
                    </div>
                  )}

                  {/* Message Media (Images/Videos/Audio) */}
                  {msg.media_url && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', maxWidth: '100%', marginTop: '2px' }}>
                      {msg.media_type === 'video' ? (
                        <video 
                          src={msg.media_url} 
                          controls 
                          style={{ width: '100%', maxHeight: '250px', borderRadius: '12px', background: 'black' }}
                        />
                      ) : msg.media_type === 'audio' ? (
                        <audio 
                          src={msg.media_url} 
                          controls 
                          style={{ width: '100%', minWidth: '200px', height: '40px', marginTop: '4px' }}
                        />
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={msg.media_url} 
                            alt="Attached file" 
                            style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '12px' }}
                          />
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(0,0,0,0.5)',
                              color: 'white',
                              padding: '4px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Maximize2 size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text content */}
                  {msg.message_text && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--fg)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {renderMessageText(msg.message_text)}
                    </p>
                  )}

                  {/* Timestamp & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                      {formatTime(msg.created_at)}
                    </span>
                    
                    {/* Reply triggers */}
                    <button 
                      onClick={() => setReplyTo(msg)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}
                      className="reply-hover-btn"
                      title={lang === 'ar' ? 'رد' : 'Reply'}
                    >
                      <CornerUpLeft size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="glass-panel daily-updates-panel" style={{ height: 'calc(100dvh - 200px)', minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', padding: '8px', borderRadius: '10px' }}>
            <Activity size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>
              {lang === 'ar' ? 'التحديث اليومي وسجل الموقف' : 'Daily Logs & Chat'}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {lang === 'ar' ? 'سجل العمليات التلقائي وتنسيق المهندسين' : 'Auditable system logs and engineer chat updates'}
            </p>
          </div>
        </div>

        <button 
          onClick={() => fetchMessages(true)} 
          className="btn btn-secondary"
          style={{ padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'spin-anim' : ''} />
          <span style={{ fontSize: '0.8rem' }}>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      {/* Messages Timeline area */}
      <div 
        ref={chatScrollRef}
        className="chat-messages-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '6px',
          paddingLeft: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start',
                  flexDirection: i % 2 === 0 ? 'row-reverse' : 'row',
                  width: '70%',
                  alignItems: 'flex-start'
                }}
              >
                <div className="skeleton-hint" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '0.75rem 1rem', 
                    borderRadius: i % 2 === 0 ? '1.5rem 0.25rem 1.5rem 1.5rem' : '0.25rem 1.5rem 1.5rem 1.5rem',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div className="skeleton-hint" style={{ width: '40%', height: '12px', borderRadius: '4px' }}></div>
                  <div className="skeleton-hint" style={{ width: '90%', height: '16px', borderRadius: '4px' }}></div>
                  <div className="skeleton-hint" style={{ width: '60%', height: '16px', borderRadius: '4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--muted)' }}>
            <Bot size={40} style={{ opacity: 0.5 }} />
            <p style={{ fontSize: '0.85rem' }}>
              {lang === 'ar' ? 'لا توجد سجلات أو رسائل اليوم. سيتم تدوين التحديثات تلقائياً.' : 'No updates logged yet today. Actions will be logged automatically.'}
            </p>
          </div>
        ) : (
          renderMessages()
        )}
      </div>

      {/* Mention Dropdown Popover */}
      {showMentionList && (
        <div 
          className="glass-panel mention-popover"
          style={{
            position: 'absolute',
            bottom: '100px',
            right: lang === 'ar' ? '24px' : 'auto',
            left: lang === 'en' ? '24px' : 'auto',
            width: '240px',
            zIndex: 1000,
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '0.5rem',
            background: 'var(--surface-warm)',
            boxShadow: 'var(--elev-raised)',
            borderRadius: '12px'
          }}
        >
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: '0 0.5rem 0.25rem 0.5rem', fontWeight: '700' }}>
            {lang === 'ar' ? 'أعضاء الفريق للمنشن:' : 'Team Members to Mention:'}
          </p>
          {teamMembers
            .filter(member => member.name.toLowerCase().includes(mentionFilter.toLowerCase()))
            .map((member, i) => (
              <div 
                key={member.name}
                onClick={() => selectMention(member)}
                className={`mention-item ${mentionIndex === i ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  background: mentionIndex === i ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: mentionIndex === i ? 'var(--accent)' : 'inherit',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ background: member.role === 'system' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {member.role === 'system' ? <Bot size={12} /> : <User size={12} />}
                </div>
                <div>
                  <div style={{ fontWeight: '600' }}>{member.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{member.role}</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Compose & Inputs Form */}
      <form 
        onSubmit={handleSend}
        style={{
          borderTop: '1px solid var(--border-soft)',
          paddingTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          position: 'relative'
        }}
      >
        {/* Reply Quote Bar */}
        {replyTo && (
          <div 
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              borderRight: lang === 'ar' ? '3px solid var(--accent)' : 'none',
              borderLeft: lang === 'en' ? '3px solid var(--accent)' : 'none',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)' }}>
                {lang === 'ar' ? `الرد على ${replyTo.sender_name}` : `Reply to ${replyTo.sender_name}`}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyTo.message_text || (replyTo.media_url ? `[${replyTo.media_type === 'video' ? 'فيديو' : 'صورة'}]` : '')}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setReplyTo(null)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Selected File Attachment Preview */}
        {attachment && (
          <div 
            style={{
              background: 'rgba(255,255,255,0.03)',
              padding: '0.5rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              border: '1px dashed var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              {attachment.type === 'video' ? (
                <video src={previewUrl} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: 'black' }} />
              ) : attachment.type === 'audio' ? (
                <audio src={previewUrl} controls style={{ height: '36px', maxWidth: '200px', outline: 'none' }} />
              ) : (
                <img src={previewUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachment.name}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                  {attachment.type === 'video' ? 'ملف فيديو' : attachment.type === 'audio' ? 'تسجيل صوتي' : 'ملف صورة'}
                </span>
              </div>
            </div>
            <button 
              type="button" 
              onClick={removeAttachment}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Bar row */}
        {isRecording ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            width: '100%',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--danger)',
                animation: 'pulse 1.2s infinite'
              }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--fg)' }}>
                {lang === 'ar' ? 'جاري تسجيل رسالة صوتية...' : 'Recording voice message...'}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                title={lang === 'ar' ? 'إلغاء' : 'Cancel'}
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                title={lang === 'ar' ? 'إنهاء المايك وحفظ المقطع' : 'Stop and attach'}
              >
                {lang === 'ar' ? 'إرفاق الصوت' : 'Attach'}
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-input-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* File input attachment buttons */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <input 
                type="file" 
                id="chat-image-input" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
              />
              <label 
                htmlFor="chat-image-input"
                className="btn btn-secondary"
                style={{ padding: '0.6rem', borderRadius: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                title={lang === 'ar' ? 'إرفاق صورة' : 'Attach Image'}
              >
                <ImageIcon size={16} />
              </label>

              <input 
                type="file" 
                id="chat-video-input" 
                accept="video/*" 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
              />
              <label 
                htmlFor="chat-video-input"
                className="btn btn-secondary"
                style={{ padding: '0.6rem', borderRadius: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                title={lang === 'ar' ? 'إرفاق فيديو' : 'Attach Video'}
              >
                <VideoIcon size={16} />
              </label>
              
              <button
                type="button"
                onClick={startRecording}
                className="btn btn-secondary"
                style={{ padding: '0.6rem', borderRadius: '10px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                title={lang === 'ar' ? 'تسجيل رسالة صوتية' : 'Record Voice'}
              >
                <Mic size={16} />
              </button>
            </div>

            {/* Text Input area */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={textInputRef}
                type="text"
                className="form-input"
                placeholder={lang === 'ar' ? 'اكتب تحديثاً أو منشن للاعضاء باستخدام @...' : 'Write an update or mention with @...'}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.875rem', borderRadius: '10px' }}
              />
            </div>

            {/* Send Action */}
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading || (!inputText.trim() && !attachment)}
              style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Send size={16} />
              <span style={{ fontSize: '0.85rem' }}>{lang === 'ar' ? 'إرسال' : 'Send'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Extra CSS Styles for elements in this component */}
      <style>{`
        .chat-bubble-wrapper.mine {
          align-self: flex-end;
        }
        .chat-bubble-wrapper.theirs {
          align-self: flex-start;
        }
        .chat-messages-area::-webkit-scrollbar {
          width: 6px;
        }
        .chat-messages-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-messages-area::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
        }
        .chat-messages-area::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .spin-anim {
          animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .reply-hover-btn {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .chat-bubble:hover .reply-hover-btn {
          opacity: 1;
        }
        .mention-item:hover {
          background: rgba(245, 158, 11, 0.1) !important;
        }

        /* Mobile Responsive for DailyUpdates */
        @media (max-width: 768px) {
          .daily-updates-panel {
            height: calc(100dvh - 160px) !important;
            min-height: 350px !important;
            max-height: none !important;
            padding: var(--space-3) !important;
          }
          .chat-input-bar {
            flex-wrap: wrap;
          }
          .chat-input-bar > div:first-child {
            gap: 0.15rem !important;
          }
          .chat-input-bar .btn {
            padding: 0.5rem !important;
          }
          .chat-input-bar .btn span {
            display: none;
          }
          .chat-input-bar .form-input {
            font-size: 0.8rem !important;
            padding: 0.6rem 0.75rem !important;
          }
        }
        @media (max-width: 480px) {
          .daily-updates-panel {
            height: calc(100dvh - 130px) !important;
          }
        }
      `}</style>

    </div>
  );
}
