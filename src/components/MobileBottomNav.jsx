import { useState } from 'react';
import { LayoutGrid, LogOut, Sun, Moon, Languages } from 'lucide-react';
import { Modal } from './ui';
import { GROUPS, sectionsFor, roleLabel, initials } from '../navigation';

/**
 * Phone and tablet navigation (< 1024px): four primary sections plus a
 * "More" sheet holding the rest, grouped the same way as the sidebar,
 * with the account and quick settings at the top.
 */
export default function MobileBottomNav({ activeTab, onNavigate, lang, setLang, theme, setTheme, user, onLogout }) {
  const isAr = lang === 'ar';
  const [showMore, setShowMore] = useState(false);
  const sections = sectionsFor(user);
  const primary = sections.filter(s => s.bottom);
  const rest = sections.filter(s => !s.bottom);
  const moreActive = rest.some(s => s.id === activeTab);

  const go = (id) => {
    setShowMore(false);
    onNavigate(id);
  };

  return (
    <>
      <nav className="bottom-nav" aria-label={isAr ? 'التنقل السفلي' : 'Bottom navigation'}>
        {primary.map(({ id, icon: Icon, short }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              className="bottom-nav-item"
              aria-current={active ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <span className="bottom-nav-icon"><Icon size={21} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" /></span>
              <span className="bottom-nav-label">{short[isAr ? 'ar' : 'en']}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="bottom-nav-item"
          aria-current={moreActive ? 'page' : undefined}
          aria-haspopup="dialog"
          aria-expanded={showMore}
          onClick={() => setShowMore(true)}
        >
          <span className="bottom-nav-icon"><LayoutGrid size={21} strokeWidth={moreActive ? 2.25 : 1.75} aria-hidden="true" /></span>
          <span className="bottom-nav-label">{isAr ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      <Modal
        open={showMore}
        onClose={() => setShowMore(false)}
        title={isAr ? 'كل الأقسام' : 'All sections'}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
      >
        <div className="more-account">
          <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="more-account-text">
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role, lang)}</span>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}
          >
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            aria-label={isAr ? 'English' : 'العربية'}
          >
            <Languages size={20} aria-hidden="true" />
          </button>
        </div>

        {GROUPS.map(group => {
          const items = sections.filter(s => s.group === group.id);
          if (items.length === 0) return null;
          return (
            <div className="more-group" key={group.id}>
              <p className="more-group-label">{group.label[isAr ? 'ar' : 'en']}</p>
              <div className="more-grid">
                {items.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    className="more-item"
                    aria-current={activeTab === id ? 'page' : undefined}
                    onClick={() => go(id)}
                  >
                    <Icon size={22} aria-hidden="true" />
                    <span>{label[isAr ? 'ar' : 'en']}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button type="button" className="btn btn--danger-ghost btn--block" style={{ marginBlockStart: 'var(--space-5)' }} onClick={() => { setShowMore(false); onLogout(); }}>
          <LogOut size={18} aria-hidden="true" />
          {isAr ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </Modal>
    </>
  );
}
