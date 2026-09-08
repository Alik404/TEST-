import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Layers, 
  Grid, 
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Save,
  MessageSquare,
  Printer
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import DashboardBento from './DashboardBento';

export default function Dashboard({ kpis, tasks, categories, user, onUpdateProgress, t, lang, translateText }) {
  const [editingTask, setEditingTask] = useState(null);
  const [tempProgress, setTempProgress] = useState({});
  const [tempCompleted, setTempCompleted] = useState({});
  const [tempNotes, setTempNotes] = useState({});
  const [savingId, setSavingId] = useState(null);

  // Safeguard props against null or undefined values to prevent UI crash
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeKpis = kpis || {
    total_marble_pieces: 0,
    applied_marble_pieces: 0,
    applied_white_marble: 0,
    applied_brown_marble: 0,
    overall_progress_percent: 0,
    skylight_progress_percent: 0,
    nazalat_total: 0,
    nazalat_completed: 0,
    nazalat_progress_percent: 0
  };

  const isAr = lang === 'ar';

  // Group tasks by category
  const groupedTasks = safeCategories.reduce((acc, cat) => {
    acc[cat.name] = safeTasks.filter(t => t.category_name === cat.name);
    return acc;
  }, {});

  // Prepare chart data for task progress
  const chartData = safeTasks.map(t => {
    const cleanName = (t.name || '').replace(' (محدث تلقائياً)', '').replace(' (تحديث تلقائي)', '');
    return {
      name: translateText(cleanName, lang),
      [lang === 'ar' ? 'نسبة الإنجاز %' : 'Progress %']: parseFloat((Number(t.progress_percent) || 0).toFixed(1))
    };
  });

  // Prepare pie chart data for marble pieces (White vs Brown)
  const marbleChartData = [
    { name: lang === 'ar' ? 'مرمر أبيض مطبق' : 'Applied White Marble', value: safeKpis.applied_white_marble || 0, color: '#eef2f7' },
    { name: lang === 'ar' ? 'مرمر جوزي مطبق' : 'Applied Brown Marble', value: safeKpis.applied_brown_marble || 0, color: 'hsl(35, 90%, 52%)' }
  ];

  const handleEditClick = (task) => {
    if ((user.role !== 'admin' && user.role !== 'super_admin') || task.is_manual === 0) return;
    setEditingTask(task.id);
    setTempCompleted({ ...tempCompleted, [task.id]: task.completed_quantity ?? 0 });
    setTempProgress({ ...tempProgress, [task.id]: task.progress_percent });
    setTempNotes({ ...tempNotes, [task.id]: task.notes || '' });
  };

  const handleSaveClick = async (taskId) => {
    setSavingId(taskId);
    try {
      const progress = parseFloat(tempProgress[taskId]);
      const completed = parseFloat(tempCompleted[taskId]);
      const notes = tempNotes[taskId];

      await onUpdateProgress(taskId, progress, notes, completed);
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(false);
    }
  };

  const handleCompletedChange = (task, val) => {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > task.total_quantity) num = task.total_quantity;
    
    setTempCompleted({
      ...tempCompleted,
      [task.id]: num
    });

    // Dynamically calculate progress percent from completed quantity
    const pct = parseFloat(((num / task.total_quantity) * 100).toFixed(2));
    setTempProgress({
      ...tempProgress,
      [task.id]: pct
    });
  };

  const handleProgressChange = (taskId, val) => {
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setTempProgress({
      ...tempProgress,
      [taskId]: num
    });
  };

  const handleNotesChange = (taskId, val) => {
    setTempNotes({
      ...tempNotes,
      [taskId]: val
    });
  };

  const textDirectionStyle = {
    textAlign: lang === 'ar' ? 'right' : 'left'
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const handlePrintProgressReport = () => {
    const totalTasks = safeTasks.length;
    const completedTasks = safeTasks.filter(t => (Number(t.progress_percent) || 0) >= 100).length;
    const inProgressTasks = safeTasks.filter(t => (Number(t.progress_percent) || 0) > 0 && (Number(t.progress_percent) || 0) < 100).length;
    const notStartedTasks = safeTasks.filter(t => (Number(t.progress_percent) || 0) === 0).length;
    
    const overallProgNum = safeKpis.overall_progress_percent !== undefined 
      ? Number(safeKpis.overall_progress_percent) 
      : (safeTasks.length > 0 ? (safeTasks.reduce((s, t) => s + (Number(t.progress_percent) || 0), 0) / safeTasks.length) : 0);
    const overallProg = overallProgNum.toFixed(2);

    // Marble & Nazalat
    const nazalatDone = safeKpis.nazalat_completed || 0;
    const nazalatTot = safeKpis.nazalat_total || 113;
    const appliedMarble = safeKpis.applied_marble_pieces || 0;

    // Marblex Tasks
    const mbxPieceTask = safeTasks.find(t => t.name && t.name.includes('الماربلكس (القطع)'));
    const mbxSteelTask = safeTasks.find(t => t.name && t.name.includes('ستيلات التثبيت للماربلكس'));
    const mbxPiecesDone = mbxPieceTask ? (mbxPieceTask.completed_quantity || 0) : (safeKpis.applied_marblex_pieces || 0);
    const mbxPiecesTot = mbxPieceTask ? (mbxPieceTask.total_quantity || 0) : (safeKpis.total_marblex_pieces || 0);
    const mbxPiecesProg = mbxPieceTask ? Number(mbxPieceTask.progress_percent).toFixed(1) : (Number(safeKpis.marblex_pieces_progress || 0).toFixed(1));
    const mbxSteelDone = mbxSteelTask ? (mbxSteelTask.completed_quantity || 0) : (safeKpis.applied_marblex_steel || 0);
    const mbxSteelTot = mbxSteelTask ? (mbxSteelTask.total_quantity || 0) : (safeKpis.total_marblex_steel || 0);
    const mbxSteelProg = mbxSteelTask ? Number(mbxSteelTask.progress_percent).toFixed(1) : (Number(safeKpis.marblex_steel_progress || 0).toFixed(1));

    let rowsHTML = '';
    let globalIndex = 0;

    safeCategories.forEach((cat) => {
      const catTasks = safeTasks.filter(t => t.category_name === cat.name);
      if (catTasks.length === 0) return;

      const catAvgProg = (catTasks.reduce((acc, t) => acc + (Number(t.progress_percent) || 0), 0) / catTasks.length).toFixed(1);

      rowsHTML += `
        <tr class="category-banner-row">
          <td colspan="8">
            <div class="category-banner">
              <span class="cat-name">📁 ${translateText(cat.name, lang)}</span>
              <span class="cat-pill">${catTasks.length} ${isAr ? 'فقرات' : 'tasks'} | ${isAr ? 'متوسط الإنجاز' : 'Avg'}: ${catAvgProg}%</span>
            </div>
          </td>
        </tr>
      `;

      catTasks.forEach((task) => {
        globalIndex++;
        const isAuto = !task.is_manual;
        const unitTrans = translateText(task.unit, lang);
        const hasQty = task.total_quantity !== null && task.total_quantity > 0;
        
        let totDisplay = hasQty ? `${Number(task.total_quantity).toLocaleString()} ${unitTrans}` : '-';
        let compDisplay = hasQty ? `${Number(task.completed_quantity || 0).toLocaleString()} ${unitTrans}` : '-';
        let remVal = hasQty ? Math.max(0, task.total_quantity - (task.completed_quantity || 0)) : null;
        let remDisplay = remVal !== null ? `${Number(remVal).toLocaleString()} ${unitTrans}` : '-';

        const progVal = Number(task.progress_percent) || 0;
        const progDisplay = progVal.toFixed(1);
        const isDone = progVal >= 100;
        const barColor = isDone ? '#10b981' : (progVal >= 50 ? '#2563eb' : (progVal > 0 ? '#f59e0b' : '#cbd5e1'));

        rowsHTML += `
          <tr class="task-row ${isDone ? 'task-done' : ''}">
            <td style="text-align:center;font-weight:bold;color:#64748b;width:38px;">${globalIndex}</td>
            <td style="font-weight:700;color:#0f172a;">
              ${translateText(task.name, lang)}
              ${isAuto ? `<span class="badge-auto">${isAr ? 'محدث تلقائياً' : 'Auto'}</span>` : ''}
            </td>
            <td style="text-align:center;color:#475569;font-size:12px;width:65px;">${unitTrans || '-'}</td>
            <td style="text-align:center;font-weight:600;width:95px;">${totDisplay}</td>
            <td style="text-align:center;font-weight:bold;color:#047857;width:95px;">${compDisplay}</td>
            <td style="text-align:center;font-weight:bold;color:#b45309;width:95px;">${remDisplay}</td>
            <td style="text-align:center;width:120px;">
              <div class="prog-wrapper">
                <span class="prog-val" style="color: ${isDone ? '#047857' : '#0f172a'}">${progDisplay}%</span>
                <div class="prog-track">
                  <div class="prog-fill" style="width: ${Math.min(100, progVal)}%; background-color: ${barColor};"></div>
                </div>
              </div>
            </td>
            <td style="font-size:12px;color:#64748b;">${translateText(task.notes, lang) || '-'}</td>
          </tr>
        `;
      });
    });

    const currentDate = new Date().toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString(isAr ? 'ar-IQ' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8"/>
  <title>${isAr ? 'الجدول العام لتقدم العمل بالمشروع' : 'General Project Work Progress Schedule'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 15px;
      color: #0f172a;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.4;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px double #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-right, .header-left {
      flex: 1;
    }
    .header-center {
      flex: 2;
      text-align: center;
    }
    .header-logo-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 50%;
      margin-bottom: 4px;
      font-weight: 900;
      font-size: 20px;
    }
    .project-name {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
      letter-spacing: -0.3px;
    }
    .doc-title {
      font-size: 15px;
      font-weight: 700;
      color: #2563eb;
      margin: 0;
    }
    .inst-name {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }

    .meta-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 14px;
    }
    .meta-item {
      font-size: 11.5px;
      color: #334155;
    }
    .meta-item strong {
      color: #0f172a;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.emerald::before { background: #10b981; }
    .kpi-card.amber::before { background: #f59e0b; }
    .kpi-card.purple::before { background: #8b5cf6; }

    .kpi-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 3px;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .kpi-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 3px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 14px;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 8px 6px;
      font-weight: 700;
      border: 1px solid #0f172a;
      text-align: center;
      font-size: 11.5px;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 7px 6px;
      vertical-align: middle;
      text-align: ${isAr ? 'right' : 'left'};
    }
    tr:nth-child(even) {
      background-color: #fbfcfe;
    }
    .task-done {
      background-color: #f0fdf4 !important;
    }
    .task-row:hover {
      background-color: #f1f5f9;
    }

    .category-banner-row td {
      background: #0f172a !important;
      color: #ffffff !important;
      padding: 6px 12px !important;
      border: 1px solid #0f172a;
    }
    .category-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cat-name {
      font-weight: 800;
      font-size: 12.5px;
      letter-spacing: 0.2px;
    }
    .cat-pill {
      font-size: 10.5px;
      background: rgba(255, 255, 255, 0.15);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }

    .badge-auto {
      font-size: 9.5px;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 3px;
      padding: 1px 5px;
      margin-right: 5px;
      font-weight: normal;
      display: inline-block;
    }

    .prog-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .prog-val {
      font-size: 11.5px;
      font-weight: 800;
      direction: ltr;
    }
    .prog-track {
      width: 68px;
      height: 5px;
      background-color: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }
    .prog-fill {
      height: 100%;
      border-radius: 3px;
    }

    tfoot tr {
      background: #0f172a !important;
      color: #ffffff;
      font-weight: bold;
    }
    tfoot td {
      border: 1px solid #0f172a;
      padding: 9px 8px;
    }

    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .sig-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      background: #fafafa;
    }
    .sig-role {
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .sig-sub {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 25px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 4px;
      font-size: 10px;
      color: #64748b;
    }

    @media print {
      body {
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr { page-break-inside: avoid; }
      .signatures { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="header-right" style="text-align:${isAr ? 'right' : 'left'};">
      <div class="inst-name">جمهورية العراق</div>
      <div class="inst-name">أمانة بغداد - دائرة المشاريع</div>
      <div class="inst-name" style="font-size:10.5px;color:#64748b;">نظام الإدارة الهندسية الذكي</div>
    </div>
    <div class="header-center">
      <div class="header-logo-badge">🏛️</div>
      <h1 class="project-name">مشروع تأهيل وصيانة النصب التذكاري للجندي المجهول</h1>
      <h2 class="doc-title">الجدول العام لتقدم العمل بالمشروع ونسب الإنجاز التراكمية</h2>
    </div>
    <div class="header-left" style="text-align:${isAr ? 'left' : 'right'};">
      <div class="inst-name">دائرة المهندس المقيم</div>
      <div class="inst-name" style="color:#047857;font-weight:700;">موقف رسمي معتمد</div>
      <div class="inst-name" style="font-size:10.5px;color:#64748b;">كود الوثيقة: PRG-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}</div>
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item"><strong>تاريخ التقرير:</strong> ${currentDate}</div>
    <div class="meta-item"><strong>وقت الإصدار:</strong> ${currentTime}</div>
    <div class="meta-item"><strong>المهندس المسؤول:</strong> ${user?.name || (isAr ? 'المهندس المقيم' : 'Resident Engineer')}</div>
    <div class="meta-item"><strong>إجمالي الفقرات:</strong> ${totalTasks} فقرة (${safeCategories.length} تصنيفات)</div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card emerald">
      <div class="kpi-title">🏆 نسبة الإنجاز الكلية للمشروع</div>
      <div class="kpi-val" style="color:#047857;">${overallProg}%</div>
      <div class="kpi-sub">المعدل التراكمي الشامل لكافة الأعمال</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-title">📋 حالة الفقرات التنفيذية</div>
      <div class="kpi-val" style="font-size:16px;">
        <span style="color:#047857;">منجز: ${completedTasks}</span> | <span style="color:#d97706;">قيد العمل: ${inProgressTasks}</span>
      </div>
      <div class="kpi-sub">لم تبدأ بعد: ${notStartedTasks} فقرة</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-title">🏛️ أعمال المرمر والنزلات</div>
      <div class="kpi-val" style="font-size:16px;">
        نزلات: ${nazalatDone} / ${nazalatTot}
      </div>
      <div class="kpi-sub">مرمر مطبق: ${appliedMarble.toLocaleString()} قطعة</div>
    </div>
    <div class="kpi-card purple">
      <div class="kpi-title">🔷 تقدم أعمال الماربلكس والستيل</div>
      <div class="kpi-val" style="font-size:15px;color:#6d28d9;">
        ألواح: ${Number(mbxPiecesDone).toLocaleString()} (${mbxPiecesProg}%)
      </div>
      <div class="kpi-sub">ستيل: ${Number(mbxSteelDone).toLocaleString()} / ${Number(mbxSteelTot).toLocaleString()} (${mbxSteelProg}%)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 38px;">#</th>
        <th>الفقرة التنفيذية</th>
        <th style="width: 65px;">الوحدة</th>
        <th style="width: 95px;">الكمية الكلية</th>
        <th style="width: 95px;">المنجز الفعلي</th>
        <th style="width: 95px;">المتبقي</th>
        <th style="width: 120px;">نسبة الإنجاز</th>
        <th>الملاحظات والموقف التنفيذي</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:center;padding:9px;font-size:13px;letter-spacing:0.3px;">
          ★ المحصلة الإجمالية ومعدل تقدم المشروع العام:
        </td>
        <td style="text-align:center;padding:9px;">${totalTasks} فقرة</td>
        <td style="text-align:center;padding:9px;color:#34d399;">منجز: ${completedTasks}</td>
        <td style="text-align:center;padding:9px;color:#fbbf24;">قيد العمل: ${inProgressTasks}</td>
        <td style="text-align:center;padding:9px;background:#1e293b;color:#38bdf8;font-size:14px;direction:ltr;">
          ${overallProg}%
        </td>
        <td style="font-size:11px;color:#cbd5e1;">الموقف العام معتمد ومطابق لجرودات الموقع</td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sig-card">
      <div class="sig-role">مهندس الموقع والمتابعة الميدانية</div>
      <div class="sig-sub">Site Engineer</div>
      <div class="sig-line">التوقيع والتاريخ: .......................................</div>
    </div>
    <div class="sig-card">
      <div class="sig-role">المهندس المقيم للمشروع</div>
      <div class="sig-sub">Resident Engineer</div>
      <div class="sig-line">التوقيع والتاريخ: .......................................</div>
    </div>
    <div class="sig-card">
      <div class="sig-role">مدير المشروع / دائرة المهندس المقيم</div>
      <div class="sig-sub">Project Director / Supervision Authority</div>
      <div class="sig-line">الختم والمصادقة: .......................................</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    };
  </script>
</body>
</html>`;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.top = '-1000px';
      printFrame.style.left = '-1000px';
      printFrame.style.width = '1px';
      printFrame.style.height = '1px';
      printFrame.style.border = 'none';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(html.replace('window.close();', ''));
      frameDoc.close();

      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 15000);
    } else {
      const printWindow = window.open('', '_blank', 'width=1150,height=900');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.top = '-1000px';
        printFrame.style.left = '-1000px';
        printFrame.style.width = '1px';
        printFrame.style.height = '1px';
        printFrame.style.border = 'none';
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(html.replace('window.close();', ''));
        frameDoc.close();

        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 15000);
      }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="cyber-dashboard"
    >
      <DashboardBento kpis={kpis} tasks={tasks} lang={lang} />
      
      {/* 1. KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
        gap: '1.5rem',
        marginBottom: '2.5rem'
      }}>
      {/* Card 1: Overall progress */}
      <motion.div variants={itemVariants} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: '1rem', border: '1px solid var(--border-soft)', color: 'var(--success)' }}>
            <Award size={20} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>{t('kpiProgressTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--fg)' }}>{kpis.overall_progress_percent}%</span>
        </div>
        <div style={{ height: '6px', width: '100%', background: 'var(--bg-1)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--success)', width: `${kpis.overall_progress_percent}%`, borderRadius: '999px' }} />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontWeight: 500 }}>{t('kpiProgressSubtext')}</span>
      </motion.div>

      {/* Card 2: Marble pieces */}
      <motion.div variants={itemVariants} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: '1rem', border: '1px solid var(--border-soft)', color: 'var(--accent)' }}>
            <Layers size={20} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>{t('kpiMarbleTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--fg)' }}>
            {kpis.applied_marble_pieces.toLocaleString()}
          </span>
        </div>
        <div style={{ height: '6px', width: '100%' }}></div> {/* Spacer to match height */}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontWeight: 500, marginTop: 'auto' }}>{t('kpiMarbleSubtext')}</span>
      </motion.div>

      {/* Card 3: Skylight progress */}
      <motion.div variants={itemVariants} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: '1rem', border: '1px solid var(--border-soft)', color: 'var(--success)' }}>
            <CheckCircle2 size={20} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>{t('kpiSkylightTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--fg)' }}>{kpis.skylight_progress_percent}%</span>
        </div>
        <div style={{ height: '6px', width: '100%', background: 'var(--bg-1)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--success)', width: `100%`, borderRadius: '999px' }} />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontWeight: 500 }}>{t('kpiSkylightSubtext')}</span>
      </motion.div>

      {/* Card 4: Nazalat progress */}
      <motion.div variants={itemVariants} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: '1rem', border: '1px solid var(--border-soft)', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg-2)' }}>{t('kpiNazalatTitle')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--fg)' }}>{kpis.nazalat_progress_percent}%</span>
        </div>
        <div style={{ height: '6px', width: '100%', background: 'var(--bg-1)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#f59e0b', width: `${kpis.nazalat_progress_percent}%`, borderRadius: '999px' }} />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', fontWeight: 500 }}>
          {t('kpiNazalatSubtext').replace('{completed}', kpis.nazalat_completed).replace('{total}', kpis.nazalat_total)}
        </span>
      </motion.div>
      </div>

      {/* 2. Charts Visual Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
      {/* Chart 1: Progress Comparison */}
      <motion.div variants={itemVariants} style={{
        background: 'var(--surface)',
        borderRadius: '2.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.03)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
          {t('chartProgressTitle')}
        </h3>
        <div style={{ flex: 1, minHeight: 0, width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height={340} minWidth={0}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 15, left: 15, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" horizontal={false} />
              <XAxis 
                type="number"
                domain={[0, 100]}
                stroke="var(--border)"
                tick={{ fontSize: 9.5, fill: 'var(--muted)', fontFamily: lang === 'ar' ? 'var(--font-arabic)' : 'var(--font-english)' }}
                tickLine={false}
              />
              <YAxis 
                type="category"
                dataKey="name" 
                stroke="var(--border)" 
                tick={{ fontSize: 8.5, fontFamily: lang === 'ar' ? 'var(--font-arabic)' : 'var(--font-english)', fill: 'var(--fg-2)' }}
                width={120}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--surface-solid)', 
                  backdropFilter: 'blur(12px)',
                  borderColor: 'var(--border)', 
                  color: 'var(--fg)', 
                  textAlign: lang === 'ar' ? 'right' : 'left', 
                  fontFamily: lang === 'ar' ? 'var(--font-arabic)' : 'var(--font-english)', 
                  borderRadius: 'var(--radius-sm)' 
                }}
              />
              <Bar 
                dataKey={lang === 'ar' ? 'نسبة الإنجاز %' : 'Progress %'} 
                radius={lang === 'ar' ? [4, 0, 0, 4] : [0, 4, 4, 0]}
                barSize={8}
              >
                {chartData.map((entry, index) => {
                  const is100 = entry[lang === 'ar' ? 'نسبة الإنجاز %' : 'Progress %'] === 100;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={is100 ? 'var(--success, #10b981)' : 'var(--accent, #10b981)'} 
                      opacity={is100 ? 1 : 0.7}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Chart 2: Marble Status Distribution */}
      <motion.div variants={itemVariants} style={{
        background: 'var(--surface)',
        borderRadius: '2.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.03)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        height: '420px'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} style={{ color: 'var(--accent)' }} />
          {t('chartMarbleTitle')}
        </h3>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', minHeight: 0 }}>
          <div style={{ width: '160px', height: '160px', minWidth: 0, position: 'relative' }}>
            <PieChart width={160} height={160}>
              <Pie
                data={marbleChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {marbleChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? 'var(--bg-2, #cbd5e1)' : 'var(--accent, #10b981)'} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => `${value.toLocaleString()} ${t('pieces')}`}
                contentStyle={{ 
                  background: 'var(--surface-solid)', 
                  backdropFilter: 'blur(12px)',
                  borderColor: 'var(--border)', 
                  color: 'var(--fg)', 
                  textAlign: lang === 'ar' ? 'right' : 'left', 
                  fontFamily: lang === 'ar' ? 'var(--font-arabic)' : 'var(--font-english)', 
                  borderRadius: 'var(--radius-sm)' 
                }}
              />
            </PieChart>
          </div>
          
          {/* Custom Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', width: '100%', padding: '0 0.5rem' }}>
            {marbleChartData.map((entry, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '10px', 
                    height: '10px', 
                    borderRadius: '3px', 
                    background: index === 0 
                      ? 'var(--bg-2, #cbd5e1)' 
                      : 'var(--accent, #10b981)', 
                    border: '1px solid var(--border)' 
                  }}></div>
                  <span style={{ color: 'var(--muted)' }}>{entry.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{entry.value.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.25rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
              <span>{t('chartTotalApplied')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{kpis.applied_marble_pieces.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </motion.div>
      </div>

      {/* 3. General Project Progress Table */}
      <motion.div variants={itemVariants} style={{
        background: 'var(--surface)',
        borderRadius: '2.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.03)',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', margin: 0, flex: '1 1 250px' }}>
            <Grid size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
            <span style={{ lineHeight: '1.4' }}>{t('tableTitle')}</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {(user.role === 'admin' || user.role === 'super_admin') && (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', textAlign: 'right' }}>
                {t('tableInstruction')}
              </span>
            )}
            <button
              onClick={handlePrintProgressReport}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)', flexShrink: 0 }}
            >
              <Printer size={18} />
              {lang === 'ar' ? 'طباعة / تصدير PDF' : 'Print PDF'}
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="project-table" style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
            <thead>
              <tr>
                <th style={{ width: '18%', ...textDirectionStyle }}>{t('colCategory')}</th>
                <th style={{ width: '22%', ...textDirectionStyle }}>{t('colTask')}</th>
                <th style={{ width: '12%', textAlign: 'center' }}>{t('colTotalQty')}</th>
                <th style={{ width: '12%', textAlign: 'center' }}>{t('colCompleted')}</th>
                <th style={{ width: '12%', textAlign: 'center' }}>{t('colRemaining')}</th>
                <th style={{ width: '12%', textAlign: 'center' }}>{t('colProgress')}</th>
                <th style={{ width: '20%', ...textDirectionStyle }}>{t('colNotes')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const catTasks = groupedTasks[cat.name] || [];
                return (
                  <React.Fragment key={cat.id}>
                    {/* Category Title Header Row */}
                    <tr className="category-header-row">
                      <td colSpan="7" style={{ padding: '0.75rem 1rem', ...textDirectionStyle }}>
                        {translateText(cat.name, lang)}
                      </td>
                    </tr>

                    {/* Tasks belonging to this category */}
                    {catTasks.map((task) => {
                      const isEditing = editingTask === task.id;
                      const progressVal = isEditing ? tempProgress[task.id] : task.progress_percent;
                      const notesVal = isEditing ? tempNotes[task.id] : (task.notes || '');

                      // Calculate displays
                      const hasQty = task.total_quantity !== null && task.total_quantity > 0;
                      const unitTrans = translateText(task.unit, lang);
                      const qtyDisplay = hasQty ? `${task.total_quantity.toLocaleString()} ${unitTrans}` : '-';
                      
                      let compDisplay = '-';
                      let pendDisplay = '-';
                      
                      if (hasQty) {
                        if (task.name === 'تطبيك النزلات (محدث تلقائياً)' && task.is_manual === 0) {
                          compDisplay = `${kpis.nazalat_completed} ${unitTrans}`;
                          pendDisplay = `${kpis.nazalat_total - kpis.nazalat_completed} ${unitTrans}`;
                        } else {
                          compDisplay = `${task.completed_quantity.toLocaleString()} ${unitTrans}`;
                          pendDisplay = `${(task.total_quantity - task.completed_quantity).toLocaleString()} ${unitTrans}`;
                        }
                      }

                      return (
                        <tr 
                          key={task.id} 
                          onClick={() => !isEditing && handleEditClick(task)}
                          style={{ cursor: ((user.role === 'admin' || user.role === 'super_admin') && task.is_manual) ? 'pointer' : 'default' }}
                        >
                          <td style={{ color: 'var(--muted)', fontSize: '0.85rem', ...textDirectionStyle }}>
                            {translateText(cat.name, lang)}
                          </td>
                          <td style={{ fontWeight: '600', ...textDirectionStyle }}>
                            {translateText(task.name, lang)}
                            {!task.is_manual && (
                              <span style={{ 
                                fontSize: '0.7rem', 
                                color: 'var(--accent)', 
                                marginRight: lang === 'ar' ? '5px' : '0', 
                                marginLeft: lang === 'en' ? '5px' : '0', 
                                padding: '1px 5px', 
                                border: '1px solid var(--accent)', 
                                borderRadius: '3px' 
                              }}>
                                {t('badgeAuto')}
                              </span>
                            )}
                          </td>
                          <td className="tabular-nums" style={{ textAlign: 'center' }}>{qtyDisplay}</td>
                          <td className="tabular-nums" style={{ textAlign: 'center' }}>
                            {isEditing && hasQty ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  className="input-number"
                                  value={tempCompleted[task.id] !== undefined ? tempCompleted[task.id] : (task.completed_quantity ?? 0)}
                                  onChange={(e) => handleCompletedChange(task, e.target.value)}
                                  step="any"
                                  min="0"
                                  max={task.total_quantity}
                                  disabled={savingId === task.id}
                                  style={{ width: '85px', padding: '0.2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--fg)' }}
                                />
                              </div>
                            ) : (
                              compDisplay
                            )}
                          </td>
                          <td className="tabular-nums" style={{ textAlign: 'center' }}>
                            {isEditing && hasQty ? (
                              `${(task.total_quantity - (tempCompleted[task.id] !== undefined ? tempCompleted[task.id] : (task.completed_quantity ?? 0))).toLocaleString()} ${unitTrans}`
                            ) : (
                              pendDisplay
                            )}
                          </td>
                          <td className="tabular-nums" style={{ textAlign: 'center' }}>
                            {isEditing ? (
                              hasQty ? (
                                <span className="tabular-nums" style={{ fontWeight: '700' }}>
                                  {(tempProgress[task.id] !== undefined ? tempProgress[task.id] : task.progress_percent).toFixed(2)}%
                                </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number"
                                    className="input-number"
                                    value={progressVal}
                                    onChange={(e) => handleProgressChange(task.id, e.target.value)}
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    disabled={savingId === task.id}
                                    style={{ width: '75px' }}
                                  />
                                  <span style={{ fontSize: '0.9rem' }}>%</span>
                                </div>
                              )
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                <span className="tabular-nums" style={{ fontWeight: '700', color: task.progress_percent === 100 ? 'var(--success)' : 'var(--fg)' }}>
                                  {task.progress_percent.toFixed(2)}%
                                </span>
                                <div className="progress-bar-container" style={{ width: '70px', height: '4px' }}>
                                  <div 
                                    className={`progress-bar-fill ${task.progress_percent === 100 ? 'success' : ''}`}
                                    style={{ width: `${task.progress_percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="notes-cell" style={textDirectionStyle}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  className="notes-input"
                                  value={notesVal}
                                  onChange={(e) => handleNotesChange(task.id, e.target.value)}
                                  placeholder={t('enterNotes')}
                                  disabled={savingId === task.id}
                                  style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', color: 'var(--fg)' }}
                                />
                                <button
                                  onClick={() => handleSaveClick(task.id)}
                                  className="btn btn-primary"
                                  style={{ padding: '0.3rem', borderRadius: '4px' }}
                                  disabled={savingId === task.id}
                                >
                                  <Save size={14} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                <MessageSquare size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                                <span>{translateText(task.notes, lang) || '-'}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{
                background: 'rgba(15, 23, 42, 0.85)',
                borderTop: '2px solid var(--accent, #3b82f6)',
                fontWeight: 'bold',
                color: 'var(--fg)'
              }}>
                <td colSpan="2" style={{ padding: '0.85rem 1rem', fontSize: '0.95rem', ...textDirectionStyle }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: '800' }}>★</span>
                    <span>{isAr ? 'المحصلة الإجمالية لكافة فقرات المشروع' : 'Total Project Summary'}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>
                      ({safeTasks.length} {isAr ? 'فقرة' : 'tasks'} - {safeCategories.length} {isAr ? 'تصنيفات' : 'categories'})
                    </span>
                  </div>
                </td>
                <td style={{ textAlign: 'center', padding: '0.85rem 0.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {safeCategories.length} {isAr ? 'تصنيفات' : 'cats'}
                </td>
                <td style={{ textAlign: 'center', padding: '0.85rem 0.5rem', color: 'var(--success)', fontSize: '0.9rem' }}>
                  {safeTasks.filter(t => (Number(t.progress_percent) || 0) >= 100).length} {isAr ? 'مكتملة' : 'done'}
                </td>
                <td style={{ textAlign: 'center', padding: '0.85rem 0.5rem', color: 'var(--warning, #f59e0b)', fontSize: '0.9rem' }}>
                  {safeTasks.filter(t => (Number(t.progress_percent) || 0) < 100).length} {isAr ? 'قيد العمل' : 'in progress'}
                </td>
                <td style={{ textAlign: 'center', padding: '0.85rem 0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span className="tabular-nums" style={{ fontWeight: '800', color: 'var(--accent)', fontSize: '1.05rem' }}>
                      {(safeKpis.overall_progress_percent !== undefined ? Number(safeKpis.overall_progress_percent) : 0).toFixed(2)}%
                    </span>
                    <div className="progress-bar-container" style={{ width: '80px', height: '6px' }}>
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${Math.min(100, safeKpis.overall_progress_percent || 0)}%`, background: 'var(--accent)' }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', ...textDirectionStyle }}>
                  {isAr ? 'نسبة الإنجاز الكلية للمشروع محسوبة تراكمياً' : 'Cumulative overall project progress'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>

    </motion.div>
  );
}
