/**
 * App-wide toast notifications. Any module can call toast.success(...) or
 * toast.error(...); <ToastHost/> (mounted once in App) renders them.
 * Replaces blocking alert() calls, which are jarring on phones.
 */
const EVENT = 'app:toast';

const emit = (type, message, options = {}) => {
  if (!message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { type, message, duration: options.duration } }));
};

export const toast = {
  success: (message, options) => emit('success', message, options),
  error: (message, options) => emit('error', message, { duration: 6000, ...options }),
  info: (message, options) => emit('info', message, options),
};

export const TOAST_EVENT = EVENT;
