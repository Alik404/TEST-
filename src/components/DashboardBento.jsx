import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Calendar
} from 'lucide-react';

const SPRING_TRANSITION = { type: 'spring', stiffness: 100, damping: 20 };

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const FADE_UP = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: SPRING_TRANSITION },
};

// Map real tasks/zones to Marble Zones
const getMarbleZones = (tasks) => {
  // Try to find marble distribution tasks or fallback to defaults
  const marbleTasks = tasks.filter(t => t.category_name?.includes('مرمر') || t.name?.includes('Sector'));
  
  if (marbleTasks.length > 0) {
    return marbleTasks.slice(0, 4).map((t, idx) => ({
      id: t.id || `z${idx}`,
      name: t.name,
      progress: Math.round(t.progress_percent || 0),
      status: t.progress_percent >= 80 ? 'optimal' : t.progress_percent >= 40 ? 'warning' : 'critical'
    }));
  }

  // Fallback to the requested demo zones if real data isn't structured this way
  return [
    { id: 'z1', name: 'Sector Prime', progress: 85, status: 'optimal' },
    { id: 'z2', name: 'Delta Complex', progress: 42, status: 'warning' },
    { id: 'z3', name: 'Sigma Quarry', progress: 91, status: 'optimal' },
    { id: 'z4', name: 'Outpost Gamma', progress: 18, status: 'critical' },
  ];
};

export default function DashboardBento({ kpis, tasks, lang }) {
  const isAr = lang === 'ar';
  const marbleZones = getMarbleZones(tasks);
  
  const [latestReport, setLatestReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestConsumption = async () => {
      try {
        const res = await fetch('/api/materials-consumption');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setLatestReport(data[0]); // The most recent log
          }
        }
      } catch (err) {
        console.error('Error fetching materials consumption for dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatestConsumption();
  }, []);

  return (
    <motion.div 
      variants={STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        marginBottom: '2.5rem'
      }}
    >
      {/* --- Dashboard Header --- */}
      <motion.header 
        variants={FADE_UP} 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            {isAr ? 'نظرة عامة على الموارد' : 'Resource Overview'}
          </h1>
          <p style={{ color: 'var(--muted)', margin: '0.25rem 0 0 0', fontSize: 'var(--text-sm)' }}>
            {isAr ? 'مقاييس لحظية وتوزيع المناطق' : 'Real-time metrics and zone distribution'}
          </p>
        </div>
        
        {/* Perpetual Micro-Interaction: Syncing Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'var(--surface)',
          padding: '0.6rem 1.25rem',
          borderRadius: '999px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ position: 'relative', display: 'flex', width: 12, height: 12 }}>
            <motion.span 
              animate={{ scale: [1, 2], opacity: [0.75, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--accent)' }}
            />
            <span style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>
            {isAr ? 'مزامنة حية' : 'Live Syncing'}
          </span>
        </div>
      </motion.header>

      {/* --- Bento Grid --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        
        {/* LEFT: Consumption Wide Stream (Simulated 8 cols via flex-basis/grid logic) */}
        <motion.section 
          variants={FADE_UP}
          className="bento-card bento-span-2"
          style={{
            flex: '2 1 0%',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.03)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, color: 'var(--fg)' }}>
              {isAr ? 'الاستهلاك والملاحظات اليومية' : 'Daily Updates & Consumption'}
            </h2>
            {latestReport && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} />
                {latestReport.date}
              </span>
            )}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            height: '100%'
          }}>
            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                {isAr ? 'جاري تحميل سجل الاستهلاك...' : 'Loading consumption log...'}
              </div>
            ) : latestReport ? (
              <>
                {/* Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '1rem' }}>
                  {/* Cement */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1.25rem',
                    borderRadius: '1.25rem',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border-soft)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Package size={16} color="var(--muted)" />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>
                        {isAr ? 'الأسمنت (كيس)' : 'Cement (Bags)'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--fg)' }}>
                      {latestReport.bulk?.cement || '0'}
                    </span>
                  </div>

                  {/* Sand */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1.25rem',
                    borderRadius: '1.25rem',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border-soft)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Package size={16} color="var(--muted)" />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>
                        {isAr ? 'الرمل (م٣)' : 'Sand (m³)'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--fg)' }}>
                      {latestReport.bulk?.sand || '0'}
                    </span>
                  </div>
                </div>

                {/* Notes Block */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1.5rem',
                  borderRadius: '1.25rem',
                  background: 'var(--accent-subtle, rgba(5,150,105,0.05))',
                  border: '1px solid var(--accent-border, rgba(5,150,105,0.2))'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="var(--accent)" />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--accent)' }}>
                      {isAr ? 'ملاحظات وتحديثات الموقع' : 'Site Notes & Updates'}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.6,
                    color: 'var(--fg)',
                    margin: 0,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {latestReport.notes || (isAr ? 'لا توجد ملاحظات لهذا اليوم.' : 'No notes available for this day.')}
                  </p>
                </div>
              </>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                {isAr ? 'لا يوجد سجل استهلاك متاح.' : 'No consumption log available.'}
              </div>
            )}
          </div>
        </motion.section>

        {/* RIGHT: Marble Zones (Simulated 4 cols via flex/grid) */}
        <motion.section 
          variants={FADE_UP}
          className="bento-card"
          style={{
            flex: '1 1 300px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.03)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, color: 'var(--fg)' }}>
              {isAr ? 'مناطق المرمر' : 'Marble Zones'}
            </h2>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              background: 'var(--bg-1)',
              color: 'var(--muted)',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid var(--border-soft)'
            }}>
              {isAr ? '٤ نشطة' : '4 ACTIVE'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {marbleZones.map((zone, idx) => {
              let color = 'var(--accent, #10b981)';
              let Icon = CheckCircle2;
              
              if (zone.status === 'warning') {
                color = '#f59e0b';
                Icon = AlertCircle;
              } else if (zone.status === 'critical') {
                color = '#ef4444';
                Icon = AlertCircle;
              }

              return (
                <div key={zone.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon size={16} color={color} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)' }}>
                        {zone.name}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>
                      {zone.progress}%
                    </span>
                  </div>
                  
                  {/* Animated Progress Bar */}
                  <div style={{ height: '10px', width: '100%', background: 'var(--bg-1)', borderRadius: '999px', overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${zone.progress}%` }}
                      transition={{ ...SPRING_TRANSITION, delay: 0.2 + (idx * 0.1) }}
                      style={{ height: '100%', background: color, borderRadius: '999px' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

      </div>
    </motion.div>
  );
}
