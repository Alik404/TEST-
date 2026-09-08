import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Construction, CheckCircle2, ShieldAlert, Loader2, Info } from 'lucide-react';
import { exportToExcel, exportToPDF } from './utils/exportUtils';
import dictionary, { translateText } from './utils/translations';

// Static Critical Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import MobileBottomNav from './components/MobileBottomNav';
import companyLogo from './assets/company-logo.webp';

// Lazy-Loaded Tab Modules for Optimal Performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const TrackingLogs = lazy(() => import('./components/TrackingLogs'));
const MaterialsReport = lazy(() => import('./components/MaterialsReport'));
const DailyUpdates = lazy(() => import('./components/DailyUpdates'));
const MaterialsConsumption = lazy(() => import('./components/MaterialsConsumption'));
const WorkersWages = lazy(() => import('./components/WorkersWages'));
const WeeklyAdvance = lazy(() => import('./components/WeeklyAdvance'));
const UsersManagement = lazy(() => import('./components/UsersManagement'));
const ExecutiveSummary = lazy(() => import('./components/ExecutiveSummary'));
const MarblexProgress = lazy(() => import('./components/MarblexProgress'));

// Sleek Component Loading Fallback
function TabSkeletonLoader({ t }) {
  return (
    <div className="tab-skeleton-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card" style={{ height: '110px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-warm)', border: '1px solid var(--border)', animation: 'pulse 1.5s infinite ease-in-out' }} />
        ))}
      </div>
      <div className="skeleton-panel" style={{ height: '350px', borderRadius: 'var(--radius-xl)', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 size={32} className="spin-animation" style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{t('loading')}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('project_user');
    return saved ? JSON.parse(saved) : { id: 1, name: 'المهندس علي حاتم', role: 'admin', email: 'admin@company.com' };
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
  // Global Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(prev => (prev?.id === toast?.id ? null : prev));
    }, 3500);
  };
  
  // Theme & Language State
  const [lang, setLang] = useState(() => localStorage.getItem('project_lang') || 'ar');
  const [theme, setTheme] = useState(() => localStorage.getItem('project_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('project_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    localStorage.setItem('project_lang', lang);
  }, [lang]);

  const t = (key) => {
    return dictionary[lang]?.[key] || key;
  };
  
  // Data State
  const [kpis, setKpis] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [nazalat, setNazalat] = useState([]);
  const [marble, setMarble] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all core project data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, nazalatRes, marbleRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/nazalat'),
        fetch('/api/marble')
      ]);

      if (!dashRes.ok) throw new Error('فشل جلب بيانات لوحة التحكم.');
      if (!nazalatRes.ok) throw new Error('فشل جلب سجل النزلات.');
      if (!marbleRes.ok) throw new Error('فشل جلب سجل توزيع المرمر.');

      const [dashData, nazalatData, marbleData] = await Promise.all([
        dashRes.json(),
        nazalatRes.json(),
        marbleRes.json()
      ]);
      
      setKpis(dashData.kpis);
      setTasks(dashData.tasks);
      setCategories(dashData.categories);
      setNazalat(nazalatData);
      setMarble(marbleData);

    } catch (err) {
      console.error(err);
      setError(err.message || 'تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('project_user', JSON.stringify(loggedInUser));
    showToast(lang === 'ar' ? `مرحباً بك، ${loggedInUser.name}` : `Welcome, ${loggedInUser.name}`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('project_user');
  };

  // Developer role-toggle helper
  const handleRoleToggle = () => {
    if (!user) return;
    const nextRole = user.role === 'admin' ? 'viewer' : 'admin';
    const nextName = nextRole === 'admin' ? 'المهندس المقيم' : 'الإدارة العليا';
    const updatedUser = { ...user, role: nextRole, name: nextName };
    setUser(updatedUser);
    localStorage.setItem('project_user', JSON.stringify(updatedUser));
    showToast(lang === 'ar' ? `تم التبديل إلى: ${nextName}` : `Switched role to: ${nextRole}`);
  };

  // Toggle Nazala Status (Admin only)
  const handleToggleNazala = async (id) => {
    try {
      const response = await fetch(`/api/nazalat/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: user.name, userRole: user.role })
      });
      if (!response.ok) throw new Error('فشل تحديث حالة النزلة.');
      
      setNazalat(prev => prev.map(n => {
        if (n.id === id) {
          const nextStatus = n.status === 'منجز' ? 'متبقي' : 'منجز';
          return {
            ...n,
            status: nextStatus,
            notes: nextStatus === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل'
          };
        }
        return n;
      }));

      // Update background dashboard data
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
      showToast(lang === 'ar' ? 'تم تحديث حالة النزلة بنجاح' : 'Downspout status updated');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Update Nazala Details (Admin only)
  const handleUpdateNazalaDetails = async (id, details) => {
    try {
      const response = await fetch(`/api/nazalat/${id}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, userName: user.name, userRole: user.role })
      });
      if (!response.ok) throw new Error('فشل تحديث تفاصيل النزلة.');
      
      setNazalat(prev => prev.map(n => n.id === id ? { ...n, ...details } : n));
      
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
      showToast(lang === 'ar' ? 'تم حفظ تفاصيل النزلة' : 'Downspout details saved');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Update Manual Task Progress (Admin only)
  const handleUpdateProgress = async (taskId, progressPercent, notes, completedQuantity) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          progress_percent: progressPercent, 
          notes,
          completed_quantity: completedQuantity,
          userName: user?.name || 'المهندس المقيم',
          userRole: user?.role || 'admin'
        }),
      });

      if (!response.ok) {
        let errMsg = 'فشل تحديث نسبة الإنجاز.';
        try {
          const errJson = await response.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      await fetchData();
      showToast(lang === 'ar' ? 'تم حفظ وتحديث نسبة الإنجاز' : 'Progress updated successfully');
    } catch (err) {
      showToast(err.message || 'فشل تحديث نسبة الإنجاز.', 'error');
      throw err;
    }
  };

  // Update Marble Zone Field Status & Quantities (Admin only)
  const handleUpdateMarbleStatus = async (id, status, white_qty, brown_qty) => {
    try {
      const response = await fetch(`/api/marble/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status,
          white_qty,
          brown_qty,
          userName: user.name,
          userRole: user.role
        }),
      });

      if (!response.ok) throw new Error('فشل تحديث موقف وكميات المرمر.');
      
      setMarble(prev => prev.map(item => item.id === id ? { ...item, status, white_qty, brown_qty } : item));
      
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
      showToast(lang === 'ar' ? 'تم تحديث موقف المرمر' : 'Marble status updated');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Excel & PDF Exports
  const handleExcelExport = () => {
    exportToExcel({ tasks, nazalat, marble });
    showToast(lang === 'ar' ? 'جاري تنزيل ملف Excel...' : 'Downloading Excel sheet...');
  };

  const handlePdfPrint = () => {
    exportToPDF();
  };

  if (!user) {
    if (!showLogin) {
      return (
        <LandingPage 
          onNavigateToLogin={() => setShowLogin(true)}
          lang={lang} 
          setLang={setLang} 
          theme={theme} 
          setTheme={setTheme} 
        />
      );
    }

    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        t={t} 
        lang={lang} 
        setLang={setLang} 
        theme={theme} 
        setTheme={setTheme} 
      />
    );
  }

  const displayProjectName = t('projectName');
  const displayReportTitle = lang === 'ar' ? 'تقرير الموقف الميداني ونسب الإنجاز' : 'Field Status & Progress Report';
  const displayIssuedBy = t('issuedBy');
  const displayReportDateLabel = t('reportDate');

  return (
    <div
      className="app-container"
      style={{ background: 'var(--bg-1)' }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '-25vw',
          right: '-10vw',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.10) 0%, transparent 68%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`global-toast-notification toast-${toast.type}`}
            style={{
              position: 'fixed',
              top: '1rem',
              right: lang === 'ar' ? '1.5rem' : 'auto',
              left: lang === 'ar' ? 'auto' : '1.5rem',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.75rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-solid)',
              border: `1px solid ${toast.type === 'error' ? 'var(--danger)' : 'var(--accent)'}`,
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--fg)',
              fontSize: 'var(--text-sm)',
              fontWeight: '600'
            }}
          >
            {toast.type === 'error' ? (
              <ShieldAlert size={18} style={{ color: 'var(--danger)' }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: 'var(--accent)' }} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print header for physical document exports */}
      <div className="print-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="print-logo" style={{ width: '48px', height: '48px', background: '#fff', padding: '4px', borderRadius: '8px' }}>
            <img src={companyLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{displayProjectName}</h2>
            <p style={{ fontSize: '0.8rem', color: '#555' }}>{displayReportTitle}</p>
          </div>
        </div>
        <div style={{ textAlign: 'left', fontSize: '0.85rem', color: '#555' }}>
          <p>{displayReportDateLabel}: {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</p>
          <p>{t('issuedBy')}: {displayIssuedBy}</p>
        </div>
      </div>

      {mobileMenuOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            zIndex: 99,
          }}
        />
      )}

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        user={user}
        onLogout={handleLogout}
        t={t}
        lang={lang}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Header 
          activeTab={activeTab} 
          user={user} 
          onRoleToggle={handleRoleToggle}
          onExcelExport={handleExcelExport}
          onPdfPrint={handlePdfPrint}
          onRefresh={fetchData}
          t={t}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {error && (
          <div className="glass-panel" style={{ borderColor: 'var(--danger)', background: 'rgba(220, 38, 38, 0.06)', display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
            <ShieldAlert style={{ color: 'var(--danger)' }} />
            <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{error}</span>
            <button onClick={fetchData} className="btn btn-secondary" style={{ marginRight: 'auto', padding: '0.4rem 0.8rem' }}>
              {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        )}

        {loading && !kpis ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: '1.25rem' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Construction size={36} style={{ color: 'var(--accent)' }} />
            </motion.div>
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>{t('loading')}</p>
          </div>
        ) : (
          <Suspense fallback={<TabSkeletonLoader t={t} />}>
            <AnimatePresence mode="wait">
              {activeTab === 'executive-summary' && (
                <motion.div
                  key="executive-summary"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <ExecutiveSummary lang={lang} t={t} />
                </motion.div>
              )}

              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <Dashboard 
                    kpis={kpis} 
                    tasks={tasks} 
                    categories={categories} 
                    user={user}
                    onUpdateProgress={handleUpdateProgress}
                    onUpdateNotes={handleUpdateProgress}
                    t={t}
                    lang={lang}
                    translateText={translateText}
                  />
                </motion.div>
              )}
              
              {activeTab === 'tracking' && (
                <motion.div
                  key="tracking"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <TrackingLogs 
                    nazalat={nazalat} 
                    user={user}
                    onToggleNazala={handleToggleNazala}
                    onUpdateNazalaDetails={handleUpdateNazalaDetails}
                    loading={loading}
                    t={t}
                    lang={lang}
                    translateText={translateText}
                  />
                </motion.div>
              )}

              {activeTab === 'marble' && (
                <motion.div
                  key="marble"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <MaterialsReport 
                    marble={marble}
                    nazalat={nazalat}
                    user={user}
                    onUpdateMarbleStatus={handleUpdateMarbleStatus}
                    t={t}
                    lang={lang}
                    translateText={translateText}
                  />
                </motion.div>
              )}

              {activeTab === 'marblex' && (
                <motion.div
                  key="marblex"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <MarblexProgress 
                    user={user}
                    lang={lang}
                    t={t}
                  />
                </motion.div>
              )}

              {activeTab === 'materials-consumption' && (
                <motion.div
                  key="materials-consumption"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <MaterialsConsumption 
                    user={user}
                    t={t}
                    lang={lang}
                  />
                </motion.div>
              )}

              {activeTab === 'workers-wages' && (
                <motion.div
                  key="workers-wages"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <WorkersWages 
                    user={user}
                    t={t}
                    lang={lang}
                  />
                </motion.div>
              )}

              {activeTab === 'weekly-advance' && (
                <motion.div
                  key="weekly-advance"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <WeeklyAdvance
                    user={user}
                    t={t}
                    lang={lang}
                  />
                </motion.div>
              )}

              {activeTab === 'daily-updates' && (
                <motion.div
                  key="daily-updates"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <DailyUpdates 
                    user={user}
                    t={t}
                    lang={lang}
                  />
                </motion.div>
              )}

              {activeTab === 'users-management' && (
                <motion.div
                  key="users-management"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <UsersManagement 
                    currentUser={user}
                    t={t}
                    lang={lang}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        )}

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lang={lang}
          user={user}
        />
      </div>
    </div>
  );
}
