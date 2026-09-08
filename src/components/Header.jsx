import React from 'react';
import { User, ShieldAlert, FileSpreadsheet, Printer, RefreshCw, Sun, Moon, Languages, Menu } from 'lucide-react';

export default function Header({ 
  activeTab, 
  user, 
  onRoleToggle, 
  onExcelExport, 
  onPdfPrint, 
  onRefresh, 
  t, 
  lang, 
  setLang, 
  theme, 
  setTheme,
  onMenuToggle
}) {
  const getTitle = () => {
    switch (activeTab) {
      case 'executive-summary':
        return t('headerExecutiveTitle');
      case 'dashboard':
        return t('headerDashboardTitle');
      case 'tracking':
        return t('headerTrackingTitle');
      case 'marble':
        return t('headerMarbleTitle');
      case 'marblex':
        return t('headerMarblexTitle');
      case 'materials-consumption':
        return t('headerMaterialsConsumptionTitle');
      case 'workers-wages':
        return t('headerWorkersWagesTitle');
      case 'weekly-advance':
        return t('headerWeeklyAdvanceTitle');
      case 'daily-updates':
        return t('headerDailyUpdatesTitle');
      case 'users-management':
        return t('headerUsersTitle');
      default:
        return t('headerDefaultTitle');
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'executive-summary':
        return t('headerExecutiveSubtitle');
      case 'dashboard':
        return t('headerDashboardSubtitle');
      case 'tracking':
        return t('headerTrackingSubtitle');
      case 'marble':
        return t('headerMarbleSubtitle');
      case 'marblex':
        return t('headerMarblexSubtitle');
      case 'materials-consumption':
        return t('headerMaterialsConsumptionSubtitle');
      case 'workers-wages':
        return t('headerWorkersWagesSubtitle');
      case 'weekly-advance':
        return t('headerWeeklyAdvanceSubtitle');
      case 'daily-updates':
        return t('headerDailyUpdatesSubtitle');
      case 'users-management':
        return t('headerUsersSubtitle');
      default:
        return t('headerDefaultSubtitle');
    }
  };

  return (
    <header className="header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
      <div className="header-title-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '240px' }}>
        <button 
          className="mobile-menu-btn" 
          onClick={onMenuToggle}
          aria-label={lang === 'ar' ? 'فتح القائمة الجانبية' : 'Open Sidebar'}
          style={{
            background: 'var(--surface-warm)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            cursor: 'pointer',
            padding: '0.5rem',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            minWidth: '40px',
            minHeight: '40px'
          }}
        >
          <Menu size={22} />
        </button>
        <div>
          <h1 className="header-title" style={{ fontSize: '1.35rem', fontWeight: '800', lineHeight: 1.3 }}>{getTitle()}</h1>
          <p className="header-subtitle" style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>{getSubtitle()}</p>
        </div>
      </div>

      <div className="header-actions" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {/* Theme Switcher */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className="btn-pill"
          title={lang === 'ar' ? 'تغيير المظهر' : 'Toggle Theme'}
          aria-label={lang === 'ar' ? 'تغيير المظهر' : 'Toggle Theme'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span className="btn-pill-label">
            {theme === 'dark' 
              ? (lang === 'ar' ? 'فاتح' : 'Light') 
              : (lang === 'ar' ? 'داكن' : 'Dark')}
          </span>
        </button>

        {/* Language Switcher */}
        <button 
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
          className="btn-pill"
          title={lang === 'ar' ? 'English' : 'العربية'}
          aria-label={lang === 'ar' ? 'English' : 'العربية'}
        >
          <Languages size={17} />
          <span className="btn-pill-label">{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Refresh button */}
        <button 
          onClick={onRefresh} 
          className="btn-pill"
          title={t('refresh')}
          aria-label={t('refresh')}
          style={{ padding: '0.6rem' }}
        >
          <RefreshCw size={17} />
        </button>

        {/* Smart Export Actions */}
        <button onClick={onExcelExport} className="btn-pill" title={t('exportExcel')} aria-label={t('exportExcel')}>
          <FileSpreadsheet size={17} />
          <span className="btn-pill-label">{lang === 'ar' ? 'Excel' : 'Excel'}</span>
        </button>

        <button onClick={onPdfPrint} className="btn-pill" title={t('exportPdf')} aria-label={t('exportPdf')}>
          <Printer size={17} />
          <span className="btn-pill-label">{lang === 'ar' ? 'PDF' : 'PDF'}</span>
        </button>

        {/* User profile */}
        <div className="user-profile">
          <div className="avatar">
            <User size={16} />
          </div>
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className={`user-role-badge ${user.role === 'super_admin' ? 'role-super-admin' : user.role === 'admin' ? 'role-admin' : 'role-viewer'}`}>
                {user.role === 'super_admin'
                  ? (lang === 'ar' ? 'المدير العام' : 'General Director')
                  : user.role === 'admin'
                    ? (lang === 'ar' ? 'مهندس الموقع' : 'Site Engineer')
                    : (lang === 'ar' ? 'إدارة عليا' : 'Senior Management')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
