import { ArrowLeft, ArrowRight, Sun, Moon, Languages, LogIn } from 'lucide-react';
import companyLogo from '../assets/company-logo.webp';
import { ORG } from '../config/org';
import { GROUPS, SECTIONS } from '../navigation';

/**
 * First screen for signed-out visitors: what the system is and a direct way
 * in. The section list below comes from the same navigation config the app
 * uses, so it always matches what users will find after signing in.
 */
export default function LandingPage({ onNavigateToLogin, lang, setLang, theme, setTheme }) {
  const isAr = lang === 'ar';
  const L = (o) => o[isAr ? 'ar' : 'en'];
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const groups = GROUPS
    .map(g => ({ ...g, items: SECTIONS.filter(s => s.group === g.id && !s.roles) }))
    .filter(g => g.items.length);

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
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-eyebrow">{L(ORG.project)}</p>
          <h1 className="landing-title">
            {isAr ? <>متابعة موقع <span className="text-accent">الجندي المجهول</span></> : <>Unknown Soldier <span className="text-accent">site tracking</span></>}
          </h1>
          <p className="landing-lead">
            {isAr
              ? 'نسب الإنجاز، سجل النزلات والمرمر، جرد المواد اليومي، الأجور والسلف، وتقارير PDF رسمية. من الموقع أو المكتب، على الهاتف أو الحاسوب.'
              : 'Progress, downspouts and marble, daily materials, wages and advances, and formal PDF reports. From site or office, on phone or desktop.'}
          </p>
          <button type="button" className="btn btn--primary landing-cta" onClick={onNavigateToLogin}>
            <LogIn size={19} aria-hidden="true" style={{ transform: isAr ? 'scaleX(-1)' : undefined }} />
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
            <Arrow size={18} aria-hidden="true" />
          </button>
        </section>

        <section className="landing-sections" aria-label={isAr ? 'أقسام النظام' : 'What is inside'}>
          {groups.map(g => (
            <div key={g.id} className="landing-group">
              <h2>{L(g.label)}</h2>
              <ul>
                {g.items.map(({ id, icon: Icon, label }) => (
                  <li key={id}><Icon size={17} aria-hidden="true" />{L(label)}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>

      <footer className="landing-foot">
        <span>{ORG.company}</span>
        <span>{L(ORG.client)}</span>
      </footer>
    </div>
  );
}
