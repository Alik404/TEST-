import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Layers,
  LogOut, ChevronLeft, ChevronRight,
  MessageSquare, FileText, Users, Banknote, Receipt, BarChart3
} from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';

const SPRING = { type: 'spring', stiffness: 300, damping: 30 };

export default function Sidebar({
  activeTab, setActiveTab,
  collapsed, setCollapsed,
  user, onLogout,
  t, lang,
  mobileOpen, setMobileOpen,
}) {
  const isAr = lang === 'ar';

  const menuItems = [
    { id: 'executive-summary',    label: isAr ? '📊 التقرير التنفيذي الشامل' : 'Executive Summary', icon: BarChart3 },
    { id: 'dashboard',             label: t('menuDashboard'),              icon: LayoutDashboard },
    { id: 'tracking',              label: t('menuTracking'),               icon: ClipboardList   },
    { id: 'marble',                label: t('menuMarble'),                 icon: Layers          },
    { id: 'materials-consumption', label: t('menuMaterialsConsumption'),   icon: FileText        },
    { id: 'workers-wages',         label: isAr ? 'أجور العمال' : 'Workers Wages', icon: Banknote },
    { id: 'weekly-advance',        label: isAr ? 'سلفة مقدمة' : 'Advance Payment', icon: Receipt },
    { id: 'daily-updates',        label: isAr ? 'التحديث اليومي' : 'Daily Log', icon: MessageSquare },
  ];

  if (user?.role === 'super_admin') {
    menuItems.push({
      id:    'users-management',
      label: isAr ? 'إدارة الحسابات' : 'Users',
      icon:  Users,
    });
  }

  const collapseIcon = isAr
    ? (collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />)
    : (collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />);

  return (
    <motion.aside
      layout
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      transition={SPRING}
    >
      {/* ── Brand header ─────────────────────────────────────────── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img
            src={companyLogo}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
          />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sidebar-title"
              initial={{ opacity: 0, x: isAr ? 12 : -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{   opacity: 0, x: isAr ? 12 : -12 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {t('sidebarTitle')}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="sidebar-nav" aria-label={isAr ? 'القائمة الرئيسية' : 'Main navigation'}>
        {menuItems.map(({ id, label, icon: Icon }, idx) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              onClick={() => {
                setActiveTab(id);
                if (setMobileOpen) setMobileOpen(false);
              }}
              className={`nav-item ${isActive ? 'active' : ''}`}
              initial={{ opacity: 0, x: isAr ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: isAr ? -3 : 3 }}
              whileTap={{ scale: 0.97 }}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon size={19} style={{ flexShrink: 0 }} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="nav-label">{label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* ── Footer actions ──────────────────────────────────────── */}
      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {/* Logout */}
        <motion.button
          className="nav-item"
          onClick={onLogout}
          whileHover={{ x: isAr ? -3 : 3 }}
          whileTap={{ scale: 0.97 }}
          title={collapsed ? t('logout') : undefined}
          style={{
            color: 'var(--danger)',
          }}
        >
          <LogOut size={19} style={{ flexShrink: 0 }} strokeWidth={1.75} />
          <span className="nav-label">{t('logout')}</span>
        </motion.button>

        {/* Collapse toggle */}
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          whileTap={{ scale: 0.9 }}
          style={{
            background: 'var(--surface-warm)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            width: 28,
            height: 28,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted)',
            transition: 'color var(--motion-fast)',
          }}
          aria-label={collapsed ? (isAr ? 'توسيع القائمة' : 'Expand sidebar') : (isAr ? 'طي القائمة' : 'Collapse sidebar')}
        >
          {collapseIcon}
        </motion.button>
      </div>
    </motion.aside>
  );
}
