import { useState } from 'react';
import { Eye, EyeOff, Sun, Moon, Languages, AlertCircle, LogIn } from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';
import { ORG } from '../config/org';

export default function Login({ onLoginSuccess, t, lang, setLang, theme, setTheme }) {
  const isAr = lang === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(isAr ? 'أدخل البريد الإلكتروني وكلمة المرور.' : 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(isAr
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة. تحقق منهما وأعد المحاولة.'
          : 'Incorrect email or password. Check them and try again.');
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.' : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-tools">
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}>
          {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setLang(isAr ? 'en' : 'ar')} lang={isAr ? 'en' : 'ar'}>
          <Languages size={18} aria-hidden="true" />
          {isAr ? 'English' : 'العربية'}
        </button>
      </div>

      <main className="auth-card card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark--lg"><img src={companyLogo} alt={isAr ? 'شعار الشركة' : 'Company logo'} /></span>
          <h1 className="auth-title">{t('loginTitle')}</h1>
          <p className="auth-sub">{t('loginSubtitle')}</p>
        </div>

        <form className="stack-sm" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div className="alert-body">{error}</div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="login-email">{t('email')}</label>
            <input
              id="login-email"
              className="input"
              type="email"
              dir="ltr"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error && !email ? 'true' : undefined}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">{t('password')}</label>
            <div className="input-group">
              <input
                id="login-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingInlineStart: 'var(--space-3)', paddingInlineEnd: '3rem' }}
                required
              />
              <button type="button" className="btn btn--ghost btn--icon btn--sm input-addon" onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--block auth-submit" aria-busy={loading}>
            <LogIn size={18} aria-hidden="true" style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
            {loading ? t('checking') : t('loginBtn')}
          </button>
        </form>
      </main>

      <p className="auth-foot">{ORG.company}</p>
    </div>
  );
}
