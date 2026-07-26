import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Construction, CheckCircle2, ShieldAlert } from 'lucide-react';
import { exportToExcel, exportToPDF, CONFIG_PDF } from './utils/exportUtils';
import dictionary, { translateText } from './utils/translations';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import companyLogo from './assets/company-logo.webp';
import Dashboard from './components/Dashboard';
import TrackingLogs from './components/TrackingLogs';
import MaterialsReport from './components/MaterialsReport';
import DailyUpdates from './components/DailyUpdates';
import MaterialsConsumption from './components/MaterialsConsumption';
import WorkersWages from './components/WorkersWages';
import WeeklyAdvance from './components/WeeklyAdvance';
import UsersManagement from './components/UsersManagement';
import LandingPage from './components/LandingPage';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('project_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
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

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch dashboard data
      const dashRes = await fetch('/api/dashboard');
      if (!dashRes.ok) throw new Error('فشل جلب بيانات لوحة التحكم.');
      const dashData = await dashRes.json();
      
      setKpis(dashData.kpis);
      setTasks(dashData.tasks);
      setCategories(dashData.categories);

      // Fetch detailed nazalat
      const nazalatRes = await fetch('/api/nazalat');
      if (!nazalatRes.ok) throw new Error('فشل جلب سجل النزلات.');
      const nazalatData = await nazalatRes.json();
      setNazalat(nazalatData);

      // Fetch marble distribution
      const marbleRes = await fetch('/api/marble');
      if (!marbleRes.ok) throw new Error('فشل جلب سجل توزيع المرمر.');
      const marbleData = await marbleRes.json();
      setMarble(marbleData);

    } catch (err) {
      console.error(err);
      setError(err.message || 'تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('project_user', JSON.stringify(loggedInUser));
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
  };

  // 1. Toggle Nazala Status (Admin only)
  const handleToggleNazala = async (id) => {
    try {
      const response = await fetch(`/api/nazalat/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName: user.name, userRole: user.role })
      });
      if (!response.ok) throw new Error('فشل تحديث حالة النزلة.');
      
      // Fast local update for responsive UI, then refresh background
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

      // Fetch fresh data in background to update all KPIs/Task progress
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // 1b. Update Nazala Details (Admin only)
  const handleUpdateNazalaDetails = async (id, details) => {
    try {
      const response = await fetch(`/api/nazalat/${id}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, userName: user.name, userRole: user.role })
      });
      if (!response.ok) throw new Error('فشل تحديث تفاصيل النزلة.');
      
      // Local update
      setNazalat(prev => prev.map(n => n.id === id ? { ...n, ...details } : n));
      
      // Background refresh
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // 2. Update Manual Task Progress (Admin only)
  const handleUpdateProgress = async (taskId, progressPercent, notes, completedQuantity) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          progress_percent: progressPercent, 
          notes,
          completed_quantity: completedQuantity,
          userName: user.name,
          userRole: user.role
        }),
      });

      if (!response.ok) throw new Error('فشل تحديث نسبة الإنجاز.');

      // Refresh
      await fetchData();
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  // 3. Update Marble Zone Field Status & Quantities (Admin only)
  const handleUpdateMarbleStatus = async (id, status, white_qty, brown_qty) => {
    try {
      const response = await fetch(`/api/marble/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status,
          white_qty,
          brown_qty,
          userName: user.name,
          userRole: user.role
        }),
      });

      if (!response.ok) throw new Error('فشل تحديث موقف وكميات المرمر.');
      
      // Update state locally
      setMarble(prev => prev.map(item => item.id === id ? { ...item, status, white_qty, brown_qty } : item));
      
      // Fetch fresh data in background to update all KPIs/Task progress
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setKpis(dashData.kpis);
        setTasks(dashData.tasks);
      }
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  // ── تصدير Excel (من exportUtils.js) ──
  const handleExcelExport = () => exportToExcel({ tasks, nazalat, marble });

  // ── تصدير PDF / طباعة (من exportUtils.js) ──
  const handlePdfPrint = () => exportToPDF();

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
      {/* Subtle ambient emerald orb — single accent lock */}
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

      {/* ── ترويسة التقرير المطبوع — مأخوذة من CONFIG_PDF ── */}
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
            backgroundColor: 'rgba(0,0,0,0.4)',
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
          <div className="glass-panel" style={{ borderColor: 'var(--color-danger)', background: 'hsla(355, 85%, 55%, 0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ShieldAlert style={{ color: 'var(--color-danger)' }} />
            <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>{error}</span>
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
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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

            {activeTab === 'materials-consumption' && (
              <motion.div
                key="materials-consumption"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <UsersManagement 
                  currentUser={user}
                  t={t}
                  lang={lang}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

      </div>
    </div>
  );
}
