import { useState } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import Modal from './Modal';
import { progressTone } from './tone';

export { default as Modal } from './Modal';

const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));


export function ProgressBar({ value, label, tone, thin = false, showValue = false, decimals = 1 }) {
  const pct = clampPct(value);
  const resolved = tone || progressTone(pct);
  const cls = ['progress', thin && 'progress--thin', resolved === 'warn' && 'progress--warn',
    resolved === 'danger' && 'progress--danger', resolved === 'neutral' && 'progress--neutral',
    resolved === 'info' && 'progress--info'].filter(Boolean).join(' ');
  const bar = (
    <div
      className={cls}
      role="progressbar"
      aria-valuenow={Number(pct.toFixed(decimals))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-fill" style={{ '--value': `${pct}%` }} />
    </div>
  );
  if (!showValue) return bar;
  return (
    <div className="progress-row">
      {bar}
      <span className="progress-value">{pct.toFixed(decimals)}%</span>
    </div>
  );
}

export function StatCard({ label, value, unit, meta, icon: Icon, tone = 'neutral', progress, progressLabel, hero = false, wide = false, className = '', children }) {
  return (
    <div className={`stat${hero ? ' stat--hero' : ''}${wide ? ' stat--wide' : ''}${className ? ` ${className}` : ''}`}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className={`stat-icon${tone !== 'neutral' ? ` stat-icon--${tone}` : ''}`} aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="stat-value">
        <span className="num">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {progress !== undefined && <ProgressBar value={progress} label={progressLabel || label} thin />}
      {meta && <div className="stat-meta">{meta}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true"><Icon size={22} /></span>
      {title && <p className="empty-title">{title}</p>}
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

export function LoadingBlock({ label }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Two-to-four option toggle (view mode, filters). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {Icon && <Icon size={15} aria-hidden="true" />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}

/** Filter chips with optional counts; single-select. */
export function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(({ value: v, label: l, count }) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
          <span>{l}</span>
          {count !== undefined && <span className="chip-count num">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

/**
 * Confirmation for destructive actions. The confirm button is always the
 * danger variant, and it shows a loading state while the async action runs.
 */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = 'إلغاء', onConfirm, onClose, danger = true, lang = 'ar' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      closeLabel={lang === 'ar' ? 'إغلاق' : 'Close'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy} data-autofocus>
            {lang === 'ar' ? cancelLabel : 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={run}
            aria-busy={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className={`alert ${danger ? 'alert--danger' : 'alert--info'}`}>
        <AlertTriangle size={18} aria-hidden="true" />
        <div className="alert-body">{message}</div>
      </div>
    </Modal>
  );
}
