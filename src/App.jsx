import { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import { AlertTriangle } from 'lucide-react';
import { exportToExcel } from './utils/exportUtils';
import dictionary, { translateText } from './utils/translations';
import {
  apiFetch, getToken, getStoredUser, setSession, clearSession, setUnauthorizedHandler
} from './utils/api';
import { toast } from './utils/toast';
import { findSection, sectionsFor } from './navigation';
import { ORG } from './config/org';
import companyLogo from './assets/company-logo.webp';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import MobileBottomNav from './components/MobileBottomNav';
import ToastHost from './components/ui/ToastHost';
import ReportHost from './components/ui/ReportHost';
import { LoadingBlock } from './components/ui';

// Sections load on demand.
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

const DEFAULT_TAB = 'dashboard';

// The open section lives in the URL hash, so reloads keep the place and the
// phone's back button moves between sections.
const tabFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return findSection(id) ? id : DEFAULT_TAB;
};

const readPref = (key, fallback) => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};

const writePref = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

export default function App() {
  // A stored user is only a display hint until /api/me confirms it. With no
  // token there is no session: never fall back to a default account.
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [activeTab, setActiveTab] = useState(tabFromHash);
  const [collapsed, setCollapsed] = useState(() => readPref('project_sidebar', 'open') === 'collapsed');
  const [showLogin, setShowLogin] = useState(false);

  const [lang, setLang] = useState(() => readPref('project_lang', 'ar'));
  const [theme, setTheme] = useState(() => readPref('project_theme', 'dark'));

  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0c' : '#f5f5f6');
    writePref('project_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    writePref('project_lang', lang);
  }, [lang, isAr]);

  useEffect(() => {
    writePref('project_sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  useEffect(() => {
    const onHash = () => setActiveTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((id) => {
    if (window.location.hash !== `#${id}`) window.location.hash = id;
    setActiveTab(id);
    window.scrollTo({ top: 0 });
  }, []);

  const t = (key) => dictionary[lang]?.[key] || key;

  // Data shared by several sections.
  const [kpis, setKpis] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [nazalat, setNazalat] = useState([]);
  const [marble, setMarble] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Loads the shared data. Sets state only after the network answers, so it can
  // run from an effect; fetchData() adds the loading indicator for manual refresh.
  const loadData = async () => {
    try {
      const [dashRes, nazalatRes, marbleRes] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/nazalat'),
        apiFetch('/api/marble')
      ]);

      if (!dashRes.ok) throw new Error(isAr ? 'تعذر تحميل بيانات لوحة التحكم.' : 'Could not load dashboard data.');
      if (!nazalatRes.ok) throw new Error(isAr ? 'تعذر تحميل سجل النزلات.' : 'Could not load the downspouts log.');
      if (!marbleRes.ok) throw new Error(isAr ? 'تعذر تحميل توزيع المرمر.' : 'Could not load marble distribution.');

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
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || (isAr ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchData = () => {
    setLoading(true);
    setError('');
    return loadData();
  };

  const refreshDashboard = async () => {
    const dashRes = await apiFetch('/api/dashboard');
    if (dashRes.ok) {
      const dashData = await dashRes.json();
      setKpis(dashData.kpis);
      setTasks(dashData.tasks);
    }
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setShowLogin(true);
  };

  // An expired or revoked token signs the user out in place instead of
  // leaving an interface the server will refuse.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
      setShowLogin(true);
    });
  }, []);

  // Confirm the stored session with the server once on load. The role shown in
  // the UI is the one the server issued, not whatever sits in localStorage.
  useEffect(() => {
    if (!getToken()) return;
    apiFetch('/api/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.user) setUser(prev => ({ ...prev, ...data.user }));
      })
      .catch(() => {
        // Network failure: keep the cached user; the next API call re-checks.
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.resolve().then(loadData);
    // loadData only depends on the session, which user.id identifies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleLoginSuccess = (loggedInUser, token) => {
    setSession(loggedInUser, token);
    setUser(loggedInUser);
    toast.success(isAr ? `مرحباً بك، ${loggedInUser.name}` : `Welcome, ${loggedInUser.name}`);
  };

  // ── Mutations shared through props ───────────────────────────────────────

  const handleToggleNazala = async (id) => {
    try {
      const response = await apiFetch(`/api/nazalat/${id}/toggle`, { method: 'POST' });
      if (!response.ok) throw new Error(isAr ? 'تعذر تحديث حالة النزلة.' : 'Could not update the downspout.');

      setNazalat(prev => prev.map(n => {
        if (n.id !== id) return n;
        const nextStatus = n.status === 'منجز' ? 'متبقي' : 'منجز';
        return {
          ...n,
          status: nextStatus,
          notes: nextStatus === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل'
        };
      }));
      await refreshDashboard();
      toast.success(isAr ? 'تم تحديث حالة النزلة' : 'Downspout status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdateNazalaDetails = async (id, details) => {
    try {
      const response = await apiFetch(`/api/nazalat/${id}/details`, {
        method: 'POST',
        body: JSON.stringify(details)
      });
      if (!response.ok) throw new Error(isAr ? 'تعذر حفظ تفاصيل النزلة.' : 'Could not save downspout details.');

      setNazalat(prev => prev.map(n => (n.id === id ? { ...n, ...details } : n)));
      await refreshDashboard();
      toast.success(isAr ? 'تم حفظ تفاصيل النزلة' : 'Downspout details saved');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleUpdateProgress = async (taskId, progressPercent, notes, completedQuantity) => {
    try {
      const response = await apiFetch(`/api/tasks/${taskId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          progress_percent: progressPercent,
          notes,
          completed_quantity: completedQuantity
        }),
      });

      if (!response.ok) {
        let errMsg = isAr ? 'تعذر حفظ نسبة الإنجاز.' : 'Could not save progress.';
        try {
          const errJson = await response.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch { /* no JSON body */ }
        throw new Error(errMsg);
      }

      await fetchData();
      toast.success(isAr ? 'تم حفظ نسبة الإنجاز' : 'Progress saved');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleUpdateMarbleStatus = async (id, status, white_qty, brown_qty) => {
    try {
      const response = await apiFetch(`/api/marble/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, white_qty, brown_qty }),
      });
      if (!response.ok) throw new Error(isAr ? 'تعذر تحديث موقف المرمر.' : 'Could not update marble status.');

      setMarble(prev => prev.map(item => (item.id === id ? { ...item, status, white_qty, brown_qty } : item)));
      await refreshDashboard();
      toast.success(isAr ? 'تم تحديث موقف المرمر' : 'Marble status updated');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleExcelExport = () => {
    exportToExcel({ tasks, nazalat, marble });
    toast.info(isAr ? 'جارٍ تنزيل ملف Excel' : 'Downloading the Excel file');
  };

  const handlePrintPage = () => window.print();

  // ── Signed out ───────────────────────────────────────────────────────────

  if (!user) {
    return (
      <>
        {showLogin ? (
          <Login onLoginSuccess={handleLoginSuccess} t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
        ) : (
          <LandingPage onNavigateToLogin={() => setShowLogin(true)} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
        )}
        <ToastHost lang={lang} />
      </>
    );
  }

  // ── Signed in ────────────────────────────────────────────────────────────

  // A section the current role may not open falls back to the dashboard.
  const currentTab = sectionsFor(user).some(s => s.id === activeTab) ? activeTab : DEFAULT_TAB;
  const section = findSection(currentTab);
  const common = { user, t, lang };

  const renderSection = () => {
    switch (currentTab) {
      case 'executive-summary':
        return <ExecutiveSummary {...common} />;
      case 'tracking':
        return (
          <TrackingLogs
            {...common}
            nazalat={nazalat}
            loading={loading}
            onToggleNazala={handleToggleNazala}
            onUpdateNazalaDetails={handleUpdateNazalaDetails}
            translateText={translateText}
          />
        );
      case 'marble':
        return (
          <MaterialsReport
            {...common}
            marble={marble}
            nazalat={nazalat}
            onUpdateMarbleStatus={handleUpdateMarbleStatus}
            translateText={translateText}
          />
        );
      case 'marblex':
        return <MarblexProgress {...common} />;
      case 'materials-consumption':
        return <MaterialsConsumption {...common} />;
      case 'workers-wages':
        return <WorkersWages {...common} />;
      case 'weekly-advance':
        return <WeeklyAdvance {...common} />;
      case 'daily-updates':
        return <DailyUpdates {...common} />;
      case 'users-management':
        return <UsersManagement currentUser={user} t={t} lang={lang} />;
      case 'dashboard':
      default:
        return (
          <Dashboard
            {...common}
            kpis={kpis}
            tasks={tasks}
            categories={categories}
            onUpdateProgress={handleUpdateProgress}
            translateText={translateText}
          />
        );
    }
  };

  // The dashboard and the two field logs need the shared data before they render.
  const needsSharedData = ['dashboard', 'tracking', 'marble'].includes(currentTab);

  return (
    <div className="app" data-collapsed={collapsed ? 'true' : 'false'}>
      <a className="skip-link" href="#main">{isAr ? 'تخطي إلى المحتوى' : 'Skip to content'}</a>

      <Sidebar
        activeTab={currentTab}
        onNavigate={navigate}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        user={user}
        onLogout={handleLogout}
        t={t}
        lang={lang}
      />

      <div className="app-main">
        <Header
          section={section}
          user={user}
          t={t}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          onRefresh={fetchData}
          refreshing={loading && Boolean(kpis)}
          onExcelExport={handleExcelExport}
          onPrintPage={handlePrintPage}
          onLogout={handleLogout}
        />

        <main id="main" className="page" tabIndex={-1}>
          <div className="print-letterhead" aria-hidden="true">
            <div>
              <h2>{section ? t(section.titleKey) : ''}</h2>
              <p>{ORG.company} · {isAr ? ORG.project.ar : ORG.project.en}</p>
            </div>
            <img src={companyLogo} alt="" />
          </div>
          {error && (
            <div className="alert alert--danger" role="alert" style={{ marginBlockEnd: 'var(--section-gap)' }}>
              <AlertTriangle size={18} aria-hidden="true" />
              <div className="alert-body">{error}</div>
              <button type="button" className="btn btn--secondary btn--sm" onClick={fetchData}>
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {needsSharedData && loading && !kpis ? (
            <LoadingBlock label={t('loading')} />
          ) : (
            <Suspense fallback={<LoadingBlock label={t('loading')} />}>
              <div key={currentTab} className="page-enter">
                {renderSection()}
              </div>
            </Suspense>
          )}
        </main>
      </div>

      <MobileBottomNav
        activeTab={currentTab}
        onNavigate={navigate}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        user={user}
        onLogout={handleLogout}
      />

      <ToastHost lang={lang} />
      <ReportHost lang={lang} />
    </div>
  );
}
