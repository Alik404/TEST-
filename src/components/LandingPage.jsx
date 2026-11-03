import {
  ArrowLeft, ArrowRight, Sun, Moon, Languages, LogIn,
  Gauge, FileDown, Smartphone, ShieldCheck, ChevronDown,
} from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';
import { ORG } from '../config/org';
import { GROUPS, SECTIONS, ROLE_LABELS } from '../navigation';

/** What the system does, in four short points. */
const FEATURES = [
  {
    icon: Gauge,
    title: { ar: 'نسب إنجاز لحظية', en: 'Live progress' },
    body: {
      ar: 'نسب تراكمية لكل فقرة وزون تُحسب تلقائياً من الإدخالات اليومية.',
      en: 'Cumulative progress per item and zone, computed from daily entries.',
    },
  },
  {
    icon: FileDown,
    title: { ar: 'تقارير رسمية جاهزة', en: 'Formal reports' },
    body: {
      ar: 'تصدير PDF بترويسة الشركة وتواقيع الاعتماد، وتصدير Excel للبيانات.',
      en: 'PDF export with letterhead and sign-off block, plus Excel data export.',
    },
  },
  {
    icon: Smartphone,
    title: { ar: 'من الموقع مباشرة', en: 'Built for the site' },
    body: {
      ar: 'واجهة مصممة للهاتف أولاً، تعمل كتطبيق ويمكن تثبيتها على الشاشة الرئيسية.',
      en: 'Phone-first interface that installs to the home screen like an app.',
    },
  },
  {
    icon: ShieldCheck,
    title: { ar: 'صلاحيات حسب الدور', en: 'Role-based access' },
    body: {
      ar: 'كل مستخدم يرى ويعدّل ما يخصه فقط، مع سجل محفوظ لكل تحديث.',
      en: 'Each user sees and edits only what their role allows; every update is kept.',
    },
  },
];

/** The daily loop, in three steps. */
const STEPS = [
  {
    title: { ar: 'إدخال من الموقع', en: 'Record on site' },
    body: { ar: 'مهندس الموقع يسجل الكميات والملاحظات خلال اليوم.', en: 'The site engineer logs quantities and notes during the day.' },
  },
  {
    title: { ar: 'احتساب تلقائي', en: 'Computed instantly' },
    body: { ar: 'النظام يحدّث النسب والمخططات والملخصات فوراً.', en: 'Percentages, charts and summaries update immediately.' },
  },
  {
    title: { ar: 'متابعة واعتماد', en: 'Review and sign off' },
    body: { ar: 'الإدارة تتابع وتصدر التقارير الرسمية للاعتماد.', en: 'Management reviews and issues formal reports for approval.' },
  },
];

/**
 * First screen for signed-out visitors: what the system is and a direct way
 * in. The section list comes from the same navigation config the app uses,
 * so it always matches what users will find after signing in.
 */
export default function LandingPage({ onNavigateToLogin, lang, setLang, theme, setTheme }) {
  const isAr = lang === 'ar';
  const L = (o) => o[isAr ? 'ar' : 'en'];
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const groups = GROUPS
    .map(g => ({ ...g, items: SECTIONS.filter(s => s.group === g.id && !s.roles) }))
    .filter(g => g.items.length);
  const sectionCount = groups.reduce((n, g) => n + g.items.length, 0);
  const year = new Date().getFullYear();

  const stats = [
    { value: sectionCount, label: isAr ? 'قسم متابعة' : 'sections' },
    { value: Object.keys(ROLE_LABELS).length, label: isAr ? 'مستويات صلاحية' : 'access levels' },
    { value: 'PDF · Excel', label: isAr ? 'صيغ التصدير' : 'export formats' },
  ];

  const scrollToSections = () => {
    document.getElementById('landing-sections')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const signIn = (
    <button type="button" className="btn btn--primary landing-cta" onClick={onNavigateToLogin}>
      <LogIn size={19} aria-hidden="true" style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
      {isAr ? 'تسجيل الدخول' : 'Sign in'}
      <Arrow size={18} aria-hidden="true" />
    </button>
  );

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="brand-mark"><img src={companyLogo} alt="" /></span>
          <span className="brand-text">
            <span className="brand-name">{L(ORG.siteName)}</span>
            <span className="brand-sub">{ORG.company}</span>
          </span>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light mode') : (isAr ? 'الوضع الداكن' : 'Dark mode')}>
            {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setLang(isAr ? 'en' : 'ar')} aria-label={isAr ? 'English' : 'العربية'}>
            <Languages size={19} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn--secondary landing-nav-signin" onClick={onNavigateToLogin}>
            {isAr ? 'دخول' : 'Sign in'}
          </button>
        </div>
      </header>

      <main className="landing-body">
        <div className="landing-main">
          <section className="landing-hero">
            <p className="landing-eyebrow">
              <span className="landing-dot" aria-hidden="true" />
              {L(ORG.project)}
            </p>
            <h1 className="landing-title">
              {isAr ? <>متابعة موقع <span className="text-accent">الجندي المجهول</span></> : <>Unknown Soldier <span className="text-accent">site tracking</span></>}
            </h1>
            <p className="landing-lead">
              {isAr
                ? 'نسب الإنجاز، سجل النزلات والمرمر، جرد المواد اليومي، الأجور والسلف، وتقارير PDF رسمية. من الموقع أو المكتب، على الهاتف أو الحاسوب.'
                : 'Progress, downspouts and marble, daily materials, wages and advances, and formal PDF reports. From site or office, on phone or desktop.'}
            </p>
            <div className="landing-actions">
              {signIn}
              <button type="button" className="btn btn--ghost landing-cta-alt" onClick={scrollToSections}>
                {isAr ? 'استعراض الأقسام' : 'See what is inside'}
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </div>
            <dl className="landing-stats">
              {stats.map(s => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="landing-sections" className="landing-sections" aria-label={isAr ? 'أقسام النظام' : 'What is inside'}>
            {groups.map(g => (
              <div key={g.id} className="landing-group">
                <h2>
                  {L(g.label)}
                  <span className="landing-count">{g.items.length}</span>
                </h2>
                <ul>
                  {g.items.map(({ id, icon: Icon, label }) => (
                    <li key={id}><Icon size={17} aria-hidden="true" />{L(label)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>

        <section className="landing-band" aria-labelledby="landing-features-title">
          <div className="landing-band-inner">
            <h2 id="landing-features-title" className="landing-h2">
              {isAr ? 'لماذا هذا النظام' : 'Why this system'}
            </h2>
            <ul className="landing-features">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title.en} className="landing-feature">
                  <span className="landing-feature-icon"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{L(title)}</h3>
                  <p>{L(body)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-band landing-band--plain" aria-labelledby="landing-steps-title">
          <div className="landing-band-inner">
            <h2 id="landing-steps-title" className="landing-h2">
              {isAr ? 'كيف يعمل' : 'How it works'}
            </h2>
            <ol className="landing-steps">
              {STEPS.map((s, i) => (
                <li key={s.title.en} className="landing-step">
                  <span className="landing-step-num" aria-hidden="true">{(i + 1).toLocaleString(isAr ? 'ar-IQ' : 'en')}</span>
                  <div>
                    <h3>{L(s.title)}</h3>
                    <p>{L(s.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-final" aria-labelledby="landing-final-title">
          <div className="landing-final-card">
            <div>
              <h2 id="landing-final-title" className="landing-h2">
                {isAr ? 'جاهز للمتابعة؟' : 'Ready to continue?'}
              </h2>
              <p>{L(ORG.supervision)} — {L(ORG.client)}</p>
            </div>
            {signIn}
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <span>© {year} {ORG.company}</span>
        <span>{L(ORG.client)}</span>
      </footer>
    </div>
  );
}
