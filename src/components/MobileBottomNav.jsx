import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Layers,
  MessageSquare, FileText, Banknote, BarChart3, Receipt, Users, MoreHorizontal, X
} from 'lucide-react';
import { useState } from 'react';

export default function MobileBottomNav({ activeTab, setActiveTab, lang, user }) {
  const [showMore, setShowMore] = useState(false);
  const isAr = lang === 'ar';

  const primaryItems = [
    { id: 'dashboard',  label: isAr ? 'الرئيسية' : 'Home',     icon: LayoutDashboard },
    { id: 'tracking',   label: isAr ? 'النزلات'  : 'Tracking',  icon: ClipboardList   },
    { id: 'marble',     label: isAr ? 'المرمر'   : 'Marble',    icon: Layers          },
    { id: 'daily-updates', label: isAr ? 'التحديثات' : 'Updates', icon: MessageSquare  },
  ];

  const moreItems = [
    { id: 'executive-summary',     label: isAr ? 'التقرير التنفيذي' : 'Executive',       icon: BarChart3 },
    { id: 'materials-consumption', label: isAr ? 'استهلاك المواد'   : 'Materials',        icon: FileText  },
    { id: 'workers-wages',         label: isAr ? 'أجور العمال'     : 'Wages',            icon: Banknote  },
    { id: 'weekly-advance',        label: isAr ? 'سلفة مقدمة'      : 'Advance',          icon: Receipt   },
  ];

  if (user?.role === 'super_admin' || user?.role === 'admin') {
    moreItems.push({
      id: 'users-management',
      label: isAr ? 'إدارة الحسابات' : 'Users',
      icon: Users
    });
  }

  const isMoreActive = moreItems.some(item => item.id === activeTab);

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
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-more-handle" onClick={() => setShowMore(false)} />
              <div className="mobile-more-header">
                <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--fg)' }}>
                  {isAr ? 'الأقسام الإضافية' : 'All Modules'}
                </span>
                <button 
                  className="mobile-more-close" 
                  onClick={() => setShowMore(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mobile-more-grid">
                {moreItems.map(({ id, label, icon: Icon }) => (
                  <motion.button
                    key={id}
                    className={`mobile-more-item ${activeTab === id ? 'active' : ''}`}
                    onClick={() => { 
                      setActiveTab(id); 
                      setShowMore(false); 
                    }}
                    whileTap={{ scale: 0.94 }}
                  >
                    <div className="mobile-more-icon">
                      <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.75} />
                    </div>
                    <span className="mobile-more-label">{label}</span>
                  </motion.button>
                ))}
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
