import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { TOAST_EVENT } from '../../utils/toast';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

/**
 * Renders toasts raised through utils/toast. Each toast dismisses itself
 * (errors stay longer) and can be closed early. Announced politely to
 * screen readers; errors are announced assertively.
 */
export default function ToastHost({ lang }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems(list => list.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const map = timers.current;
    const onToast = (event) => {
      const { type = 'info', message, duration } = event.detail || {};
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems(list => [...list.slice(-2), { id, type, message }]);
      map.set(id, setTimeout(() => dismiss(id), duration || 3500));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [dismiss]);

  return (
    <div className="toast-region">
      <div aria-live="polite" className="sr-only">
        {items.filter(t => t.type !== 'error').map(t => <span key={t.id}>{t.message}</span>)}
      </div>
      <div aria-live="assertive" className="sr-only">
        {items.filter(t => t.type === 'error').map(t => <span key={t.id}>{t.message}</span>)}
      </div>
      {items.map(({ id, type, message }) => {
        const Icon = ICONS[type] || Info;
        return (
          <div key={id} className={`toast toast--${type}`}>
            <Icon size={18} aria-hidden="true" />
            <span className="toast-message">{message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(id)} aria-label={lang === 'ar' ? 'إغلاق التنبيه' : 'Dismiss'}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
