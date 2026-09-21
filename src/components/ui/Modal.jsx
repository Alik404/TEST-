import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[tabindex]:not([tabindex="-1"])'
].join(',');

let openCount = 0;

/**
 * Dialog that is a bottom sheet on phones and a centered dialog on wider screens.
 * Traps focus, closes on Escape or a backdrop tap, locks page scroll and returns
 * focus to whatever opened it.
 *
 * size: undefined | 'lg' | 'xl' | 'full'
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size,
  closeLabel = 'إغلاق',
  dismissible = true,
  bodyClassName = '',
  initialFocusRef,
}) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    openerRef.current = document.activeElement;
    openCount += 1;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    const focusFirst = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const target = initialFocusRef?.current
        || dialog.querySelector('[data-autofocus]')
        || dialog.querySelector('.modal-body ' + FOCUSABLE)
        || dialog;
      target.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      openCount -= 1;
      if (openCount === 0) body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, dismissible, initialFocusRef]);

  if (!open) return null;

  const onBackdrop = (event) => {
    if (dismissible && event.target === event.currentTarget) onClose?.();
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <div
        ref={dialogRef}
        className={`modal${size ? ` modal--${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {(title || dismissible) && (
          <div className="modal-header">
            <div className="modal-heading">
              {title && <h2 id={titleId} className="modal-title">{title}</h2>}
              {description && <p id={descId} className="modal-desc">{description}</p>}
            </div>
            {dismissible && (
              <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label={closeLabel}>
                <X size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className={`modal-body ${bodyClassName}`}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
