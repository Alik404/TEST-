import { useEffect, useRef, useState } from 'react';
import {
  Sun, Moon, Languages, RefreshCw, FileSpreadsheet, Printer, LogOut, ChevronDown
} from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';
import { roleLabel, initials } from '../navigation';

/**
 * Top bar: section title on the start side, quick actions and the account
 * menu on the end side. On phones only refresh and the account menu stay
 * visible; everything else lives inside the menu.
 */
export default function Header({
  section,
  user,
  t,
  lang,
  setLang,
  theme,
  setTheme,
  onRefresh,
  refreshing,
  onExcelExport,
  onPrintPage,
  onLogout,
}) {
  const isAr = lang === 'ar';
  const title = section ? t(section.titleKey) : t('headerDefaultTitle');
  const subtitle = section ? t(section.subtitleKey) : t('headerDefaultSubtitle');
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const toggleLang = () => setLang(isAr ? 'en' : 'ar');

  return (
    <header className="topbar">
      <span className="topbar-brand brand-mark" aria-hidden="true">
        <img src={companyLogo} alt="" />
      </span>

      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="btn btn--ghost btn--icon topbar-wide"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}
          title={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}
        >
          {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>

        <button type="button" className="btn btn--ghost topbar-wide" onClick={toggleLang} lang={isAr ? 'en' : 'ar'}>
          <Languages size={18} aria-hidden="true" />
          {isAr ? 'English' : 'العربية'}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onRefresh}
          aria-label={t('refresh')}
          title={t('refresh')}
          aria-busy={refreshing || undefined}
        >
          <RefreshCw size={19} aria-hidden="true" />
        </button>

        <AccountMenu
          user={user}
          lang={lang}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleLang={toggleLang}
          onExcelExport={onExcelExport}
          onPrintPage={onPrintPage}
          onLogout={onLogout}
          t={t}
        />
      </div>
    </header>
  );
}

function AccountMenu({ user, lang, theme, onToggleTheme, onToggleLang, onExcelExport, onPrintPage, onLogout, t }) {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const first = menuRef.current?.querySelector('[role="menuitem"]');
    first?.focus();

    const onPointer = (event) => {
      if (!anchorRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
      event.preventDefault();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="menu-anchor" ref={anchorRef}>
      <button
        ref={buttonRef}
        type="button"
        className="user-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        aria-label={isAr ? `قائمة الحساب: ${user.name}` : `Account menu: ${user.name}`}
      >
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="user-chip-text">
          <span className="user-chip-name">{user.name}</span>
          <span className="user-chip-role">{roleLabel(user.role, lang)}</span>
        </span>
        <ChevronDown size={16} className="muted" aria-hidden="true" />
      </button>

      {open && (
        <div className="menu" role="menu" ref={menuRef} aria-label={isAr ? 'قائمة الحساب' : 'Account menu'}>
          <div className="menu-header">
            <div className="fw-black text-sm truncate">{user.name}</div>
            <div className="text-xs muted">{roleLabel(user.role, lang)}</div>
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={run(onToggleTheme)}>
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            {theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={run(onToggleLang)}>
            <Languages size={18} aria-hidden="true" />
            <span lang={isAr ? 'en' : 'ar'}>{isAr ? 'English' : 'العربية'}</span>
          </button>
          <div className="menu-sep" role="separator" />
          <button type="button" role="menuitem" className="menu-item" onClick={run(onExcelExport)}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {isAr ? 'تصدير بيانات المشروع (Excel)' : 'Export project data (Excel)'}
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={run(onPrintPage)}>
            <Printer size={18} aria-hidden="true" />
            {isAr ? 'طباعة الصفحة الحالية' : 'Print this page'}
          </button>
          <div className="menu-sep" role="separator" />
          <button type="button" role="menuitem" className="menu-item menu-item--danger" onClick={run(onLogout)}>
            <LogOut size={18} aria-hidden="true" />
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}
