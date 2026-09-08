import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Layers, Boxes,
  MessageSquare, FileText, Banknote, BarChart3, Receipt, Users, MoreHorizontal, X
} from 'lucide-react';
import { useState } from 'react';

export default function MobileBottomNav({ activeTab, setActiveTab, lang, user }) {
  const [showMore, setShowMore] = useState(false);
  const isAr = lang === 'ar';

  const primaryItems = [
    { id: 'dashboard',  label: isAr ? 'الرئيسية' : 'Home',     icon: LayoutDashboard },
    { id: 'marblex',    label: isAr ? 'الماربلكس' : 'Marblex',  icon: Boxes           },
    { id: 'tracking',   label: isAr ? 'النزلات'  : 'Tracking',  icon: ClipboardList   },
    { id: 'marble',     label: isAr ? 'المرمر'   : 'Marble',    icon: Layers          },
  ];

  const reportModules = [
    { id: 'executive-summary',     label: isAr ? 'التقرير التنفيذي' : 'Executive Report', icon: BarChart3, color: '#3b82f6' },
    { id: 'materials-consumption', label: isAr ? 'استهلاك المواد'   : 'Materials',        icon: FileText,  color: '#10b981' },
    { id: 'daily-updates',         label: isAr ? 'التحديث اليومي'  : 'Daily Log',         icon: MessageSquare, color: '#f59e0b' },
  ];

  const financeModules = [
    { id: 'workers-wages',         label: isAr ? 'أجور العمال'     : 'Workers Wages',    icon: Banknote,  color: '#8b5cf6' },
    { id: 'weekly-advance',        label: isAr ? 'سلفة مقدمة'      : 'Advance Payment',  icon: Receipt,   color: '#ec4899' },
  ];

  const adminModules = [];
  if (user?.role === 'super_admin' || user?.role === 'admin') {
    adminModules.push({
      id: 'users-management',
      label: isAr ? 'إدارة الحسابات' : 'Users Management',
      icon: Users,
      color: '#06b6d4'
    });
  }

  const allMoreModules = [...reportModules, ...financeModules, ...adminModules];
  const isMoreActive = allMoreModules.some(item => item.id === activeTab);

  return (
    <>
      {/* More menu bottom sheet */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            className="mobile-more-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowMore(false)}
          >
            <motion.div
              className="mobile-more-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-more-handle" onClick={() => setShowMore(false)} />
              <div className="mobile-more-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--fg)' }}>
                    {isAr ? 'كافة أقسام ووحدات المشروع' : 'All Project Modules'}
                  </span>
                </div>
                <button 
                  className="mobile-more-close" 
                  onClick={() => setShowMore(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '68vh', overflowY: 'auto', paddingBottom: '1rem' }}>
                {/* Section 1: Reports & Supervision */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem' }}>
                    {isAr ? 'التقارير والمتابعة الميدانية' : 'Reports & Site Tracking'}
                  </div>
                  <div className="mobile-more-grid">
                    {reportModules.map(({ id, label, icon: Icon, color }) => (
                      <motion.button
                        key={id}
                        className={`mobile-more-item ${activeTab === id ? 'active' : ''}`}
                        onClick={() => { 
                          setActiveTab(id); 
                          setShowMore(false); 
                        }}
                        whileTap={{ scale: 0.94 }}
                      >
                        <div className="mobile-more-icon" style={{ background: activeTab === id ? 'var(--accent)' : 'var(--surface-warm)', color: activeTab === id ? '#ffffff' : color }}>
                          <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
                        </div>
                        <span className="mobile-more-label">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Section 2: Finance & Workers */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem' }}>
                    {isAr ? 'الشؤون المالية وأجور العمال' : 'Finance & Site Wages'}
                  </div>
                  <div className="mobile-more-grid">
                    {financeModules.map(({ id, label, icon: Icon, color }) => (
                      <motion.button
                        key={id}
                        className={`mobile-more-item ${activeTab === id ? 'active' : ''}`}
                        onClick={() => { 
                          setActiveTab(id); 
                          setShowMore(false); 
                        }}
                        whileTap={{ scale: 0.94 }}
                      >
                        <div className="mobile-more-icon" style={{ background: activeTab === id ? 'var(--accent)' : 'var(--surface-warm)', color: activeTab === id ? '#ffffff' : color }}>
                          <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
                        </div>
                        <span className="mobile-more-label">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Section 3: Administration if Admin */}
                {adminModules.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem' }}>
                      {isAr ? 'إدارة النظام والصلاحيات' : 'System Administration'}
                    </div>
                    <div className="mobile-more-grid">
                      {adminModules.map(({ id, label, icon: Icon, color }) => (
                        <motion.button
                          key={id}
                          className={`mobile-more-item ${activeTab === id ? 'active' : ''}`}
                          onClick={() => { 
                            setActiveTab(id); 
                            setShowMore(false); 
                          }}
                          whileTap={{ scale: 0.94 }}
                        >
                          <div className="mobile-more-icon" style={{ background: activeTab === id ? 'var(--accent)' : 'var(--surface-warm)', color: activeTab === id ? '#ffffff' : color }}>
                            <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
                          </div>
                          <span className="mobile-more-label">{label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label={isAr ? 'التنقل السفلي' : 'Bottom navigation'}>
        {primaryItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(id);
                if (showMore) setShowMore(false);
              }}
              whileTap={{ scale: 0.88 }}
              aria-label={label}
            >
              <div className="mobile-nav-icon">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                {isActive && (
                  <motion.div
                    className="mobile-nav-indicator"
                    layoutId="mobile-indicator"
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}
              </div>
              <span className="mobile-nav-label">{label}</span>
            </motion.button>
          );
        })}
        <motion.button
          className={`mobile-nav-item ${(showMore || isMoreActive) ? 'active' : ''}`}
          onClick={() => setShowMore(!showMore)}
          whileTap={{ scale: 0.88 }}
          aria-label={isAr ? 'المزيد' : 'More'}
        >
          <div className="mobile-nav-icon">
            <MoreHorizontal size={20} strokeWidth={(showMore || isMoreActive) ? 2.5 : 1.75} />
            {isMoreActive && !primaryItems.some(i => i.id === activeTab) && (
              <motion.div
                className="mobile-nav-indicator"
                layoutId="mobile-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            )}
          </div>
          <span className="mobile-nav-label">{isAr ? 'المزيد' : 'More'}</span>
        </motion.button>
      </nav>
    </>
  );
}
