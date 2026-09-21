import { LogOut, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';
import { GROUPS, sectionsFor } from '../navigation';

/**
 * Desktop navigation (≥ 1024px). Sections are grouped; the rail can collapse
 * to icons. Phones and tablets use MobileBottomNav instead.
 */
export default function Sidebar({ activeTab, onNavigate, collapsed, setCollapsed, user, onLogout, t, lang }) {
  const isAr = lang === 'ar';
  const sections = sectionsFor(user);
  const CollapseIcon = isAr
    ? (collapsed ? PanelRightOpen : PanelRightClose)
    : (collapsed ? PanelLeftOpen : PanelLeftClose);

  return (
    <aside className="sidebar" aria-label={isAr ? 'التنقل الرئيسي' : 'Main navigation'}>
      <div className="sidebar-brand">
        <span className="brand-mark"><img src={companyLogo} alt={isAr ? 'شعار الشركة' : 'Company logo'} /></span>
        <span className="brand-text">
          <span className="brand-name">{t('sidebarTitle')}</span>
          <span className="brand-sub">{isAr ? 'نظام متابعة المشروع' : 'Project tracking'}</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {GROUPS.map(group => {
          const items = sections.filter(s => s.group === group.id);
          if (items.length === 0) return null;
          return (
            <div className="nav-group" key={group.id}>
              <span className="nav-group-label">{group.label[isAr ? 'ar' : 'en']}</span>
              {items.map(({ id, icon: Icon, label }) => {
                const text = label[isAr ? 'ar' : 'en'];
                return (
                  <button
                    key={id}
                    type="button"
                    className="nav-item"
                    aria-current={activeTab === id ? 'page' : undefined}
                    onClick={() => onNavigate(id)}
                    title={collapsed ? text : undefined}
                  >
                    <Icon size={19} strokeWidth={activeTab === id ? 2.25 : 1.75} aria-hidden="true" />
                    <span className="nav-label">{text}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-item nav-item--danger" onClick={onLogout} title={collapsed ? t('logout') : undefined}>
          <LogOut size={19} strokeWidth={1.75} aria-hidden="true" />
          <span className="nav-label">{t('logout')}</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? (isAr ? 'توسيع القائمة' : 'Expand sidebar') : (isAr ? 'طي القائمة' : 'Collapse sidebar')}
          aria-expanded={!collapsed}
        >
          <CollapseIcon size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
