import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Sun, Moon, Languages, AlertCircle, LogIn } from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';

const EASE_EXPO = [0.16, 1, 0.3, 1];
const SPRING    = { type: 'spring', stiffness: 90, damping: 18 };

export default function Login({ onLoginSuccess, t, lang, setLang, theme, setTheme }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const isAr  = lang === 'ar';
  const reduce = useReducedMotion();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(
          isAr
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
            : 'Incorrect email or password.',
        );
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم.' : 'Connection error. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* ── Full-page centred layout ─────────────────────────────── */
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        gap: '1.25rem',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: isAr ? 'var(--font-arabic)' : 'var(--font-english)',
      }}
    >
      {/* Ambient orb */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-20vw',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.10) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Top controls ────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_EXPO }}
        style={{ display: 'flex', gap: '0.5rem', zIndex: 10 }}
      >
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="switch-btn"
          aria-label={isAr ? 'تغيير المظهر' : 'Toggle theme'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? (isAr ? 'فاتح' : 'Light') : (isAr ? 'داكن' : 'Dark')}</span>
        </button>

        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="switch-btn"
          aria-label={isAr ? 'Switch to English' : 'التبديل للعربية'}
        >
          <Languages size={14} />
          <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>
      </motion.div>

      {/* ── Login card ──────────────────────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE_EXPO, delay: 0.05 }}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.25rem 2rem',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: 'var(--elev-raised)',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Top accent line */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 24,
            right: 24,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          }}
        />

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: '#fff',
              borderRadius: 'var(--radius-md)',
              padding: 4,
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            <img src={companyLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--fg)', margin: 0, letterSpacing: '-0.02em' }}>
              {t('loginTitle')}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: '0.3rem' }}>
              {t('loginSubtitle')}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label
              htmlFor="login-email"
              style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}
            >
              {t('email')}
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@project.com"
              required
              style={{
                background: 'var(--surface-warm)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.9rem',
                color: 'var(--fg)',
                fontSize: 'var(--text-sm)',
                width: '100%',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow   = 'var(--focus-ring)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow   = 'none';
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label
              htmlFor="login-password"
              style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}
            >
              {t('password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  background: 'var(--surface-warm)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 2.5rem 0.65rem 0.9rem',
                  color: 'var(--fg)',
                  fontSize: 'var(--text-sm)',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  /* RTL: toggle-button position flipped below */
                  paddingRight: isAr ? '0.9rem' : '2.5rem',
                  paddingLeft:  isAr ? '2.5rem' : '0.9rem',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow   = 'var(--focus-ring)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow   = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={isAr ? 'إظهار/إخفاء كلمة المرور' : 'Show/hide password'}
                style={{
                  position: 'absolute',
                  [isAr ? 'left' : 'right']: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  borderRadius: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={  { opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE_EXPO }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  background: 'var(--badge-danger-bg)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            whileHover={!loading ? { translateY: -1, boxShadow: '0 8px 24px var(--accent-glow)' } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            transition={SPRING}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginTop: '0.25rem',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              gap: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                {/* Inline spinner — no circular-spinner cliché, use rotating icon */}
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-flex' }}
                >
                  <LogIn size={16} />
                </motion.span>
                {t('checking')}
              </>
            ) : (
              <>
                <LogIn size={16} />
                {t('loginBtn')}
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
