import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  TrendingUp, 
  Package, 
  Users, 
  Printer, 
  Calendar, 
  Sparkles, 
  DollarSign, 
  BarChart3,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';

export default function ExecutiveSummary({ lang = 'ar', t = (k) => k }) {
  const [loading, setLoading] = useState(true);
  const [materialsReports, setMaterialsReports] = useState([]);
  const [weeklyAdvances, setWeeklyAdvances] = useState([]);
  const [workersWages, setWorkersWages] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'this_month', 'last_month'

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [matRes, advRes, wagRes] = await Promise.all([
          fetch('/api/materials-consumption').catch(() => null),
          fetch('/api/weekly-advance').catch(() => null),
          fetch('/api/workers-wages').catch(() => null)
        ]);

        if (matRes && matRes.ok) {
          const matData = await matRes.json();
          setMaterialsReports(matData);
        }
        if (advRes && advRes.ok) {
          const advData = await advRes.json();
          setWeeklyAdvances(advData);
        }
        if (wagRes && wagRes.ok) {
          const wagData = await wagRes.json();
          setWorkersWages(wagData);
        }
      } catch (err) {
        console.error('Error fetching executive summary data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Filter reports based on date range
  const filterByDate = (items) => {
    if (dateFilter === 'all') return items;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return items.filter(item => {
      const itemDate = new Date(item.date || item.created_at || Date.now());
      if (isNaN(itemDate.getTime())) return true;
      
      if (dateFilter === 'this_month') {
        return itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth;
      }
      if (dateFilter === 'last_month') {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return itemDate.getFullYear() === prevYear && itemDate.getMonth() === prevMonth;
      }
      return true;
    });
  };

  const filteredMaterials = filterByDate(materialsReports);
  const filteredAdvances  = filterByDate(weeklyAdvances);
  const filteredWages     = filterByDate(workersWages);

  // Executive KPI Calculations
  const latestMaterial = filteredMaterials[0] || {};
  const latestAdvance  = filteredAdvances[0] || {};

  // Marble stock from latest report
  let latestNetWhite = 0, latestNetBrown = 0;
  if (latestMaterial.marble) {
    ['zone_a', 'zone_b', 'zone_c'].forEach(z => {
      latestNetWhite += parseInt(latestMaterial.marble?.[z]?.white?.total) || 0;
      latestNetBrown += parseInt(latestMaterial.marble?.[z]?.brown?.total) || 0;
    });
  }

  // Calculate total advance due across filtered advances
  const totalAdvancesDue = filteredAdvances.reduce((acc, curr) => {
    const dataObj = curr.data || curr;
    const due = parseFloat(dataObj.due_advance_override || dataObj.due_advance || 0);
    return acc + (isNaN(due) ? 0 : due);
  }, 0);

  // Calculate total worker wages across filtered wages
  const totalWagesPaid = filteredWages.reduce((acc, curr) => {
    const dataObj = curr.data || curr;
    const total = parseFloat(dataObj.total_wages || dataObj.grand_total || 0);
    return acc + (isNaN(total) ? 0 : total);
  }, 0);

  // Master Executive PDF Export
  const handlePrintMasterReport = () => {
    const printDate = new Date().toLocaleDateString('ar-EG');

    let advancesHtmlRows = '';
    filteredAdvances.slice(0, 10).forEach(adv => {
      const d = adv.data || adv;
      advancesHtmlRows += `
        <tr>
          <td>${d.date || '-'}</td>
          <td>${d.tech_name || d.team_leader || '-'}</td>
          <td>${d.work_type || d.team_number || '-'}</td>
          <td style="text-align:center;font-weight:700;">${(parseFloat(d.cumulative_total || 0)).toLocaleString()} د.ع</td>
          <td style="text-align:center;font-weight:800;color:#b45309;">${(parseFloat(d.due_advance_override || d.due_advance || 0)).toLocaleString()} د.ع</td>
        </tr>
      `;
    });

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>التقرير التنفيذي الشامل - موقع الجندي المجهول</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Cairo', sans-serif;
      color: #1a1a2e; background: #fff; direction: rtl; font-size: 10.5pt; line-height: 1.6;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm 15mm; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 20px; }
    .org h1 { font-size: 15pt; font-weight: 900; }
    .org p { font-size: 9pt; color: #555; }
    .badge { background: #f59e0b; color: #fff; font-size: 8.5pt; font-weight: 700; padding: 3px 12px; border-radius: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-card { border: 1.5px solid #d0d0d8; border-radius: 8px; padding: 10px; text-align: center; background: #fafafa; }
    .kpi-lbl { font-size: 8.5pt; color: #666; font-weight: 600; }
    .kpi-val { font-size: 13pt; font-weight: 900; color: #1a1a2e; margin-top: 4px; }
    .sec-title { font-size: 11pt; font-weight: 800; color: #fff; background: #1a1a2e; padding: 6px 12px; border-radius: 6px 6px 0 0; margin-top: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1.5px solid #d0d0d8; }
    th { background: #f0f0f5; font-weight: 700; padding: 6px 10px; border: 1px solid #d0d0d8; font-size: 9.5pt; }
    td { padding: 6px 10px; border: 1px solid #e0e0e8; font-size: 9.5pt; }
    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
    .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 25px; }
    .sig-box { border: 1px solid #ccc; border-radius: 6px; padding: 8px; text-align: center; font-size: 8.5pt; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="org">
        <h1>متابعة موقع الجندي المجهول</h1>
        <p>شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</p>
      </div>
      <div style="text-align:left;">
        <div style="font-size:13pt;font-weight:900;">📊 التقرير التنفيذي والمالي الشامل</div>
        <span class="badge">تقرير إداري معتمد</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-lbl">إجمالي السلف المستحقة</div>
        <div class="kpi-val" style="color:#b45309;">${totalAdvancesDue.toLocaleString()} د.ع</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">رصيد المرمر الأبيض</div>
        <div class="kpi-val">${latestNetWhite.toLocaleString()} قطعة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">رصيد المرمر الجوزي</div>
        <div class="kpi-val" style="color:#b45309;">${latestNetBrown.toLocaleString()} قطعة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-lbl">إجمالي أجور العمال</div>
        <div class="kpi-val">${totalWagesPaid.toLocaleString()} د.ع</div>
      </div>
    </div>

    <div class="sec-title">1. سجل السلف المقدمة الأخيرة</div>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>المسؤول / الفني</th>
          <th>نوع العمل</th>
          <th style="text-align:center;">التراكمي الإجمالي</th>
          <th style="text-align:center;">مبلغ السلفة المستحق</th>
        </tr>
      </thead>
      <tbody>
        ${advancesHtmlRows || '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات سلف في هذه الفترة</td></tr>'}
      </tbody>
    </table>

    <div class="sec-title">2. ملخص رصيد المخزن والمواد الحالية</div>
    <table>
      <thead>
        <tr>
          <th>المادة</th>
          <th style="text-align:center;">حالة الرصيد</th>
          <th>ملاحظات وتوجيهات الإدارة</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>مرمر أبيض (إجمالي كافة الزونات)</td>
          <td style="text-align:center;font-weight:800;">${latestNetWhite.toLocaleString()} قطعة</td>
          <td>متوفر ومستمر في موقع الإكساء</td>
        </tr>
        <tr>
          <td>مرمر جوزي (إجمالي كافة الزونات)</td>
          <td style="text-align:center;font-weight:800;color:#b45309;">${latestNetBrown.toLocaleString()} قطعة</td>
          <td>مستمر في زون B و C</td>
        </tr>
        <tr>
          <td>مواد البناء السائبة (أسمنت ورمل)</td>
          <td style="text-align:center;font-weight:700;">${latestMaterial.bulk?.cement || '-'} كيس أسمنت | ${latestMaterial.bulk?.sand || '-'} رمل</td>
          <td>متابعة التجهيز الموقعي</td>
        </tr>
      </tbody>
    </table>

    <div class="sigs">
      <div class="sig-box"><strong>مشرف الموقع</strong><br/><br/>التوقيع والختم</div>
      <div class="sig-box"><strong>المعاون الفني</strong><br/><br/>التوقيع والختم</div>
      <div class="sig-box"><strong>مدير المشروع</strong><br/><br/>التوقيع والختم</div>
    </div>

    <div class="footer">
      <span>متابعة موقع الجندي المجهول - شركة رؤية الحداثة للخدمات الهندسية</span>
      <span>تاريخ طباعة التقرير: ${printDate}</span>
    </div>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 500); };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', width: '100%' }}>
      {/* Header Panel */}
      <motion.div 
        className="glass-panel"
        style={{ gridColumn: 'span 12', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem' }}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <BarChart3 size={24} style={{ color: 'var(--accent)' }} />
            {lang === 'ar' ? 'التقرير التنفيذي الشامل للمشروع' : 'Executive Summary Dashboard'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px', marginBottom: 0 }}>
            {lang === 'ar' ? 'ملخص مالي وميداني شامل يجمع السلف، رصيد المواد، وأجور العمال في مكان واحد' : 'Unified executive overview of advances, inventory, and worker wages'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Date Range Selector */}
          <select 
            className="form-input" 
            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="all">{lang === 'ar' ? '📅 كافة الفترات السابقة' : 'All Time'}</option>
            <option value="this_month">{lang === 'ar' ? '📅 هذا الشهر الحالي' : 'This Month'}</option>
            <option value="last_month">{lang === 'ar' ? '📅 الشهر الماضي' : 'Last Month'}</option>
          </select>

          <button 
            className="btn btn-primary"
            onClick={handlePrintMasterReport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            <Printer size={18} />
            {lang === 'ar' ? 'تصدير التقرير الشهري الشامل PDF' : 'Export Monthly PDF Report'}
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
        
        {/* Card 1: Total Advances */}
        <motion.div className="glass-panel" style={{ padding: '1.25rem', borderRight: '4px solid var(--accent)' }} whileHover={{ y: -3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{lang === 'ar' ? 'إجمالي السلف المستحقة' : 'Total Due Advances'}</span>
            <DollarSign size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--accent)' }}>
            {totalAdvancesDue.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>د.ع</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {lang === 'ar' ? `المجموع لـ ${filteredAdvances.length} طلب سلفة مقدمة` : `Sum of ${filteredAdvances.length} advance requests`}
          </span>
        </motion.div>

        {/* Card 2: Marble White Stock */}
        <motion.div className="glass-panel" style={{ padding: '1.25rem', borderRight: '4px solid var(--info)' }} whileHover={{ y: -3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{lang === 'ar' ? 'رصيد المرمر الأبيض المتبقي' : 'White Marble Stock'}</span>
            <Package size={20} style={{ color: 'var(--info)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#eef2f7' }}>
            {latestNetWhite.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>قطعة</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {lang === 'ar' ? 'إجمالي كافة الزونات من آخر جرد' : 'Total across all zones from last audit'}
          </span>
        </motion.div>

        {/* Card 3: Marble Brown Stock */}
        <motion.div className="glass-panel" style={{ padding: '1.25rem', borderRight: '4px solid #f59e0b' }} whileHover={{ y: -3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{lang === 'ar' ? 'رصيد المرمر الجوزي المتبقي' : 'Brown Marble Stock'}</span>
            <Package size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#f59e0b' }}>
            {latestNetBrown.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>قطعة</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {lang === 'ar' ? 'إجمالي كافة الزونات من آخر جرد' : 'Total across all zones from last audit'}
          </span>
        </motion.div>

        {/* Card 4: Total Wages */}
        <motion.div className="glass-panel" style={{ padding: '1.25rem', borderRight: '4px solid var(--success)' }} whileHover={{ y: -3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{lang === 'ar' ? 'إجمالي أجور العمال' : 'Total Worker Wages'}</span>
            <Users size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--success)' }}>
            {totalWagesPaid.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>د.ع</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {lang === 'ar' ? `المجموع لـ ${filteredWages.length} سجل أجور موثق` : `Sum of ${filteredWages.length} wage records`}
          </span>
        </motion.div>
      </div>

      {/* Main Breakdown Section */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileCheck2 size={20} style={{ color: 'var(--accent)' }} />
          {lang === 'ar' ? 'جدول السلف المقدمة والاستحقاقات المالية الحالية' : 'Recent Advances & Financial Settlements'}
        </h3>

        <div className="table-responsive">
          <table className="project-table">
            <thead>
              <tr>
                <th>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th>{lang === 'ar' ? 'المسؤول / الفني' : 'Team Leader'}</th>
                <th>{lang === 'ar' ? 'نوع العمل' : 'Work Type'}</th>
                <th style={{ textAlign: 'center' }}>{lang === 'ar' ? 'الإجمالي التراكمي' : 'Cumulative'}</th>
                <th style={{ textAlign: 'center' }}>{lang === 'ar' ? 'مبلغ السلفة المستحق' : 'Due Advance'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvances.length > 0 ? (
                filteredAdvances.slice(0, 8).map((adv, idx) => {
                  const d = adv.data || adv;
                  return (
                    <tr key={adv.id || idx}>
                      <td>{d.date || '-'}</td>
                      <td style={{ fontWeight: '700' }}>{d.tech_name || d.team_leader || '-'}</td>
                      <td>{d.work_type || d.team_number || '-'}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}>
                        {(parseFloat(d.cumulative_total || 0)).toLocaleString()} د.ع
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '800', color: 'var(--accent)', fontFamily: 'var(--font-english)' }}>
                        {(parseFloat(d.due_advance_override || d.due_advance || 0)).toLocaleString()} د.ع
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                    {lang === 'ar' ? 'لا توجد سجلات سلف مقدمة في هذه الفترة' : 'No advance records found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
