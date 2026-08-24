import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Save, Edit3, X, Printer, LayoutGrid, 
  Table, CheckCircle2, Clock, Check, ChevronDown 
} from 'lucide-react';

export default function TrackingLogs({ nazalat, user, onUpdateNazalaDetails, loading, t, lang, translateText }) {
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  
  // View mode toggle for mobile/desktop
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'cards' | 'table'
  const isAr = lang === 'ar';
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  // Apply filters
  const filteredNazalat = nazalat.filter((n) => {
    const matchesZone = selectedZone === '' || n.zone === selectedZone;
    const matchesStatus = selectedStatus === '' || n.status === selectedStatus;
    const matchesSearch = searchQuery === '' || n.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesStatus && matchesSearch;
  });

  const getStats = () => {
    const total = filteredNazalat.length;
    const completed = filteredNazalat.filter(n => n.status === 'منجز').length;
    const pending = total - completed;
    return { total, completed, pending };
  };

  const stats = getStats();

  const handleEditClick = (n) => {
    setEditingId(n.id);
    setEditForm({
      white_marked: n.white_marked || 0,
      white_extra: n.white_extra || 0,
      white_applied: n.white_applied || 0,
      white_date: n.white_date || '',
      brown_marked: n.brown_marked || 0,
      brown_extra: n.brown_extra || 0,
      brown_applied: n.brown_applied || 0,
      brown_date: n.brown_date || '',
      status: n.status || 'متبقي'
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id) => {
    setSavingId(id);
    try {
      await onUpdateNazalaDetails(id, editForm);
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = (e, field) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value;
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleExportPDF = (zoneFilter = null) => {
    const source = zoneFilter
      ? filteredNazalat.filter(n => n.zone === zoneFilter)
      : filteredNazalat;

    const grouped = source.reduce((acc, n) => {
      acc[n.zone] = acc[n.zone] || [];
      acc[n.zone].push(n);
      return acc;
    }, {});

    let titleZone = zoneFilter || selectedZone;
    const docTitle = titleZone
      ? `جدول تقدم أعمال سجل النزلات - ${titleZone.replace('Zone', 'زون')}`
      : 'جدول تقدم أعمال سجل النزلات - جميع الزونات';

    let zonesHTML = '';
    let grandWhiteApplied = 0;
    let grandBrownApplied = 0;

    Object.entries(grouped).forEach(([zone, zoneNazalat]) => {
      const zTWM = zoneNazalat.reduce((s, n) => s + (n.white_marked || 0), 0);
      const zTWE = zoneNazalat.reduce((s, n) => s + (n.white_extra || 0), 0);
      const zTWA = zoneNazalat.reduce((s, n) => s + (n.white_applied || 0), 0);
      const zTBM = zoneNazalat.reduce((s, n) => s + (n.brown_marked || 0), 0);
      const zTBE = zoneNazalat.reduce((s, n) => s + (n.brown_extra || 0), 0);
      const zTBA = zoneNazalat.reduce((s, n) => s + (n.brown_applied || 0), 0);
      const zEntitlement = zTWA + zTBA;

      grandWhiteApplied += zTWA;
      grandBrownApplied += zTBA;

      const rowsHTML = zoneNazalat.map((n, i) => {
        const ent = (n.white_applied || 0) + (n.brown_applied || 0);
        const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
        return `
          <tr style="background:${bg};">
            <td style="font-weight:700; text-align:center;">${n.code}</td>
            <td style="text-align:center;">${n.white_marked || 0}</td>
            <td style="text-align:center; color:#16a34a;">${n.white_extra || 0}</td>
            <td style="text-align:center; font-weight:600;">${n.white_applied || 0}</td>
            <td style="text-align:center; color:#6b7280;">${n.white_date || '-'}</td>
            <td style="text-align:center;">${n.brown_marked || 0}</td>
            <td style="text-align:center; color:#16a34a;">${n.brown_extra || 0}</td>
            <td style="text-align:center; font-weight:600; color:#b45309;">${n.brown_applied || 0}</td>
            <td style="text-align:center; color:#6b7280;">${n.brown_date || '-'}</td>
            <td style="text-align:center; font-weight:700; color:#0284c7;">${ent}</td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:${n.status === 'منجز' ? '#dcfce7; color:#15803d;' : '#fef3c7; color:#b45309;'}">
                ${n.status}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      zonesHTML += `
        <div style="margin-bottom:28px; page-break-inside:avoid;">
          <div style="background:#0f172a; color:#fff; padding:8px 14px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; font-size:13px;">${zone.replace('Zone', 'المنطقة (زون)')} &mdash; ${zoneNazalat.length} نزلة</span>
            <span style="font-size:11px; color:#94a3b8;">إجمالي استحقاق الخلفة: <strong>${zEntitlement.toLocaleString()}</strong> قطعة</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11px; border:1px solid #cbd5e1;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:2px solid #94a3b8;">
                <th rowspan="2" style="padding:6px; border:1px solid #cbd5e1; width:55px;">الجناح</th>
                <th colspan="4" style="padding:4px; border:1px solid #cbd5e1; background:#f8fafc; color:#0f172a;">المرمر الأبيض</th>
                <th colspan="4" style="padding:4px; border:1px solid #cbd5e1; background:#fef3c7; color:#78350f;">المرمر الجوزي</th>
                <th rowspan="2" style="padding:6px; border:1px solid #cbd5e1; width:80px;">استحقاق الخلفة</th>
                <th rowspan="2" style="padding:6px; border:1px solid #cbd5e1; width:65px;">الحالة</th>
              </tr>
              <tr style="background:#e2e8f0; font-size:10px;">
                <th style="padding:4px; border:1px solid #cbd5e1;">المؤشر</th>
                <th style="padding:4px; border:1px solid #cbd5e1; color:#15803d;">إضافي أخضر</th>
                <th style="padding:4px; border:1px solid #cbd5e1; font-weight:700;">التطبيك</th>
                <th style="padding:4px; border:1px solid #cbd5e1;">التاريخ</th>
                <th style="padding:4px; border:1px solid #cbd5e1;">المؤشر</th>
                <th style="padding:4px; border:1px solid #cbd5e1; color:#15803d;">إضافي أخضر</th>
                <th style="padding:4px; border:1px solid #cbd5e1; font-weight:700;">التطبيك</th>
                <th style="padding:4px; border:1px solid #cbd5e1;">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
            <tfoot>
              <tr style="background:#e2e8f0; font-weight:800; border-top:2px solid #475569;">
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">مجموع ${zone.replace('Zone', 'زون')}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">${zTWM}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1; color:#15803d;">${zTWE}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1; color:#0f172a;">${zTWA}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">-</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">${zTBM}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1; color:#15803d;">${zTBE}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1; color:#b45309;">${zTBA}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">-</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1; color:#0284c7; font-size:12px;">${zEntitlement.toLocaleString()}</td>
                <td style="padding:6px; text-align:center; border:1px solid #cbd5e1;">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });

    const now = new Date();
    const today = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeNow = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }
    body { background: #fff; color: #1e293b; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div>
    <h2 style="text-align:center;">${docTitle}</h2>
    <p style="text-align:center; color:#666;">تاريخ الطباعة: ${today} - ${timeNow}</p>
    ${zonesHTML}
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 600); };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=900');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'hidden' }}>
      
      {/* Search, Filter & Stats Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Top KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <div className="stat-pill" style={{ padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{t('statsShowing')}</span>
            <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)' }}>{stats.total}</span>
          </div>
          <div className="stat-pill" style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>{t('statsCompleted')}</span>
            <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{stats.completed}</span>
          </div>
          <div className="stat-pill" style={{ padding: '0.75rem 1rem', background: 'rgba(217, 119, 6, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(217, 119, 6, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--warn)' }}>{t('statsPending')}</span>
            <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>{stats.pending}</span>
          </div>
        </div>

        {/* Filter controls bar */}
        <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <input
                type="text"
                className="form-input"
                style={{ 
                  paddingRight: isAr ? '2.4rem' : '1rem', 
                  paddingLeft: isAr ? '1rem' : '2.4rem', 
                  fontSize: '0.85rem',
                  width: '100%'
                }}
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search 
                size={16} 
                style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  right: isAr ? '0.75rem' : 'auto', 
                  left: isAr ? 'auto' : '0.75rem', 
                  color: 'var(--muted)',
                  pointerEvents: 'none'
                }} 
              />
            </div>

            {/* Zone Filter */}
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.85rem' }}
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="">{t('allZones')}</option>
              <option value="Zone A">{isAr ? 'زون A' : 'Zone A'}</option>
              <option value="Zone B">{isAr ? 'زون B' : 'Zone B'}</option>
              <option value="Zone C">{isAr ? 'زون C' : 'Zone C'}</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.85rem' }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="منجز">{t('statusDone')}</option>
              <option value="متبقي">{t('statusPending')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-warm)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px' }}>
              <button
                onClick={() => setViewMode('cards')}
                className={`btn-pill-small ${viewMode === 'cards' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.65rem', border: 'none', background: viewMode === 'cards' ? 'var(--accent)' : 'transparent', color: viewMode === 'cards' ? '#fff' : 'var(--muted)', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}
                title={isAr ? 'عرض البطاقات' : 'Cards View'}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`btn-pill-small ${viewMode === 'table' ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.65rem', border: 'none', background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? '#fff' : 'var(--muted)', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}
                title={isAr ? 'عرض الجدول' : 'Table View'}
              >
                <Table size={15} />
              </button>
            </div>

            {/* PDF Export */}
            <button
              onClick={() => handleExportPDF()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              <Printer size={15} />
              <span>{isAr ? 'PDF' : 'PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Rendering: Mobile Cards vs Desktop Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          {t('loadingNazalat')}
        </div>
      ) : filteredNazalat.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          {t('noNazalatFound')}
        </div>
      ) : (
        <>
          {/* 1. Mobile Cards View (Visible on mobile or when 'cards' view is chosen) */}
          <div className={`nazalat-cards-grid ${viewMode === 'table' ? 'force-hide-cards' : ''}`}>
            {filteredNazalat.map((n) => {
              const entitlement = (n.white_applied || 0) + (n.brown_applied || 0);
              const isDone = n.status === 'منجز';

              return (
                <div 
                  key={n.id} 
                  className="nazala-touch-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
                        {n.code}
                      </span>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-warm)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {n.zone}
                      </span>
                    </div>

                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: 'var(--radius-pill)', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      backgroundColor: isDone ? 'rgba(16, 185, 129, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                      color: isDone ? 'var(--success)' : 'var(--warn)'
                    }}>
                      {n.status}
                    </span>
                  </div>

                  {/* White & Brown quantities breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--surface-warm)', padding: '0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{isAr ? 'الأبيض (مطبق/مؤشر)' : 'White (App/Mark)'}</div>
                      <div style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--success)' }}>{n.white_applied || 0}</span> / <span>{n.white_marked || 0}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{isAr ? 'الجوزي (مطبق/مؤشر)' : 'Brown (App/Mark)'}</div>
                      <div style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'hsl(35, 90%, 52%)' }}>{n.brown_applied || 0}</span> / <span>{n.brown_marked || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>{isAr ? 'الاستحقاق: ' : 'Entitlement: '}</span>
                      <span style={{ fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{entitlement}</span>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleEditClick(n)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit3 size={13} />
                        <span>{t('edit')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Desktop Table View */}
          <div className={`nazalat-table-wrapper ${viewMode === 'cards' ? 'force-hide-table' : ''}`} style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <table className="custom-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead style={{ backgroundColor: 'var(--bg-3)', borderBottom: '2px solid var(--border)' }}>
                <tr>
                  <th rowSpan="2" style={{ padding: '0.75rem', borderRight: '1px solid var(--border)' }}>الجناح</th>
                  <th colSpan="4" style={{ padding: '0.5rem', borderRight: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.05)' }}>المرمر الأبيض</th>
                  <th colSpan="4" style={{ padding: '0.5rem', borderRight: '1px solid var(--border)', backgroundColor: 'rgba(139, 69, 19, 0.08)' }}>المرمر الجوزي</th>
                  <th rowSpan="2" style={{ padding: '0.75rem', borderRight: '1px solid var(--border)' }}>استحقاق الخلفة</th>
                  <th rowSpan="2" style={{ padding: '0.75rem', borderRight: '1px solid var(--border)' }}>الحالة</th>
                  {isAdmin && <th rowSpan="2" style={{ padding: '0.75rem' }}>إجراء</th>}
                </tr>
                <tr style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>المؤشر</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)', color: 'var(--success)' }}>إضافي</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>المطبق</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>التاريخ</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>المؤشر</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)', color: 'var(--success)' }}>إضافي</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>المطبق</th>
                  <th style={{ padding: '0.5rem', borderRight: '1px solid var(--border)' }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  filteredNazalat.reduce((acc, n) => {
                    acc[n.zone] = acc[n.zone] || [];
                    acc[n.zone].push(n);
                    return acc;
                  }, {})
                ).map(([zone, zoneNazalat]) => {
                  const totalWhiteApplied = zoneNazalat.reduce((sum, n) => sum + (n.white_applied || 0), 0);
                  const totalBrownApplied = zoneNazalat.reduce((sum, n) => sum + (n.brown_applied || 0), 0);
                  const zoneEntitlement = totalWhiteApplied + totalBrownApplied;

                  return (
                    <React.Fragment key={zone}>
                      {zoneNazalat.map((n) => {
                        const entitlement = (n.white_applied || 0) + (n.brown_applied || 0);

                        return (
                          <tr key={n.id} className="hover-row" style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', fontWeight: 'bold' }}>
                              {n.code} <br/> <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{n.zone}</span>
                            </td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>{n.white_marked || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--success)' }}>{n.white_extra || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', fontWeight: '700' }}>{n.white_applied || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.8rem' }}>{n.white_date || '-'}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>{n.brown_marked || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--success)' }}>{n.brown_extra || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', fontWeight: '700', color: 'hsl(35, 90%, 52%)' }}>{n.brown_applied || 0}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.8rem' }}>{n.brown_date || '-'}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', fontWeight: '700', color: 'var(--accent)' }}>{entitlement}</td>
                            <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>
                              <span style={{ 
                                padding: '3px 8px', 
                                borderRadius: '12px', 
                                fontSize: '0.75rem', 
                                backgroundColor: n.status === 'منجز' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: n.status === 'منجز' ? 'var(--success)' : 'var(--warn)'
                              }}>
                                {n.status}
                              </span>
                            </td>
                            {isAdmin && (
                              <td style={{ padding: '0.65rem' }}>
                                <button 
                                  onClick={() => handleEditClick(n)} 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Edit3 size={13} /> {t('edit')}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Zone Summary */}
                      <tr style={{ backgroundColor: 'var(--bg-3)', fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>مجموع {zone}</td>
                        <td colSpan="2" style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>-</td>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--success)' }}>{totalWhiteApplied}</td>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>-</td>
                        <td colSpan="2" style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>-</td>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'hsl(35, 90%, 52%)' }}>{totalBrownApplied}</td>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)' }}>-</td>
                        <td style={{ padding: '0.65rem', borderRight: '1px solid var(--border)', color: 'var(--accent)', fontSize: '1.05rem' }}>{zoneEntitlement}</td>
                        <td colSpan={isAdmin ? 2 : 1} style={{ padding: '0.65rem' }}>
                          <button
                            onClick={() => handleExportPDF(zone)}
                            style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            طباعة الزون
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Touch-Friendly Mobile / Desktop Edit Modal */}
      <AnimatePresence>
        {editingId && (
          <motion.div
            className="mobile-edit-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={handleCancelEdit}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '520px',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>
                  {t('quickEditNazala')}
                </h3>
                <button onClick={handleCancelEdit} className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', padding: '4px' }}>
                {/* White Marble Fields */}
                <div style={{ background: 'var(--surface-warm)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--fg)' }}>المرمر الأبيض</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('whiteMarked')}</label>
                      <input type="number" className="form-input" value={editForm.white_marked || 0} onChange={(e) => handleChange(e, 'white_marked')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('whiteExtra')}</label>
                      <input type="number" className="form-input" value={editForm.white_extra || 0} onChange={(e) => handleChange(e, 'white_extra')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('whiteApplied')}</label>
                      <input type="number" className="form-input" value={editForm.white_applied || 0} onChange={(e) => handleChange(e, 'white_applied')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('whiteDate')}</label>
                      <input type="text" className="form-input" placeholder="DD/MM/YYYY" value={editForm.white_date || ''} onChange={(e) => handleChange(e, 'white_date')} />
                    </div>
                  </div>
                </div>

                {/* Brown Marble Fields */}
                <div style={{ background: 'var(--surface-warm)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'hsl(35, 90%, 52%)' }}>المرمر الجوزي</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('brownMarked')}</label>
                      <input type="number" className="form-input" value={editForm.brown_marked || 0} onChange={(e) => handleChange(e, 'brown_marked')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('brownExtra')}</label>
                      <input type="number" className="form-input" value={editForm.brown_extra || 0} onChange={(e) => handleChange(e, 'brown_extra')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('brownApplied')}</label>
                      <input type="number" className="form-input" value={editForm.brown_applied || 0} onChange={(e) => handleChange(e, 'brown_applied')} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('brownDate')}</label>
                      <input type="text" className="form-input" placeholder="DD/MM/YYYY" value={editForm.brown_date || ''} onChange={(e) => handleChange(e, 'brown_date')} />
                    </div>
                  </div>
                </div>

                {/* Status Field */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--fg)', display: 'block', marginBottom: '4px' }}>
                    الحالة الميدانية
                  </label>
                  <select 
                    className="form-input" 
                    value={editForm.status || 'متبقي'} 
                    onChange={(e) => handleChange(e, 'status')}
                    style={{ width: '100%' }}
                  >
                    <option value="متبقي">متبقي</option>
                    <option value="منجز">منجز</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <button onClick={handleCancelEdit} className="btn btn-secondary">
                  {t('cancel')}
                </button>
                <button 
                  onClick={() => handleSave(editingId)} 
                  disabled={savingId === editingId}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={16} />
                  <span>{savingId === editingId ? t('updating') : t('save')}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
