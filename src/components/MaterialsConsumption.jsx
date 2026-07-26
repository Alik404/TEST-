import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, Calendar, Clock, User, Save, Trash2, Edit2, Copy, Printer,
  Plus, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, FileText, Sparkles
} from 'lucide-react';

const INITIAL_FORM_STATE = {
  date: new Date().toISOString().split('T')[0],
  day: 'الأحد',
  start_time: '08:00',
  end_time: '17:00',
  prepared_by: 'علي حاتم',
  basics: {
    varnish: { pulled: '', remaining: '' },
    granite_granules: { pulled: '', remaining: '' },
    brown_paint: { pulled: '', remaining: '' },
    gray_base: { pulled: '', remaining: '' },
    putty: { pulled: '', remaining: '' },
    primer: { pulled: '', remaining: '' },
    roller: { pulled: '', remaining: '' }
  },
  basics_notes: '',
  marble: {
    zone_a: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    },
    zone_b: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    },
    zone_c: {
      white: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 },
      brown: { skiliat: '', pieces_per_skilia: '198', loose: '', total: 0 }
    }
  },
  marble_notes: '',
  sealants: {
    beige_paint: { pulled: '', remaining: '' },
    white_paint: { pulled: '', remaining: '' },
    primer: { pulled: '', remaining: '' },
    tape: { pulled: '', remaining: '' },
    sponge_1cm: { pulled: '', remaining: '' },
    sponge_2cm: { pulled: '', remaining: '' },
    sponge_3cm: { pulled: '', remaining: '' }
  },
  sealants_notes: '',
  bulk: {
    cement: '',
    sand: '',
    foam: { pulled: '', remaining: '' }
  },
  bulk_notes: '',
  notes: ''
};

const DAYS_OF_WEEK = {
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

export default function MaterialsConsumption({ user, t, lang }) {
  const [viewMode, setViewMode] = useState('history'); // 'history' or 'form'
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isEditingId, setIsEditingId] = useState(null);
  const [isCloned, setIsCloned] = useState(false);
  const [showAutoSaveIndicator, setShowAutoSaveIndicator] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [originalDataForEdit, setOriginalDataForEdit] = useState(null);

  // 1. Fetch submitted reports on mount
  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/materials-consumption');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Error fetching materials reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // ── Helper: Calculate differences between two reports ──
  const getDifferencesList = (report, prevReport) => {
    let list = [];
    if (!prevReport) return list;
    
    // Basics
    const basicsLabels = {
      varnish: 'وارنيش', granite_granules: 'حبيبات كرانيت',
      brown_paint: 'صبغ لون جوزي', gray_base: 'أساس رصاصي',
      putty: 'معجون', primer: 'برايمر', roller: 'رولة'
    };
    Object.keys(report.basics || {}).forEach(k => {
      const oldP = prevReport.basics?.[k]?.pulled || '-';
      const newP = report.basics?.[k]?.pulled || '-';
      const oldR = prevReport.basics?.[k]?.remaining || '-';
      const newR = report.basics?.[k]?.remaining || '-';
      if (oldP !== newP || oldR !== newR) {
        list.push(`<li><strong>${basicsLabels[k] || k}:</strong> مسحوب (${oldP} &rarr; ${newP}) | متبقي (${oldR} &rarr; ${newR})</li>`);
      }
    });

    // Sealants
    const sealantsLabels = {
      beige_paint: 'صوصج بيجي', white_paint: 'صوصج أبيض',
      primer: 'برايمر', tape: 'تيب لاصق',
      sponge_1cm: 'حبل اسفنجي 1 سم', sponge_2cm: 'حبل اسفنجي 2 سم', sponge_3cm: 'حبل اسفنجي 3 سم'
    };
    Object.keys(report.sealants || {}).forEach(k => {
      const oldP = prevReport.sealants?.[k]?.pulled || '-';
      const newP = report.sealants?.[k]?.pulled || '-';
      const oldR = prevReport.sealants?.[k]?.remaining || '-';
      const newR = report.sealants?.[k]?.remaining || '-';
      if (oldP !== newP || oldR !== newR) {
        list.push(`<li><strong>${sealantsLabels[k] || k}:</strong> مسحوب (${oldP} &rarr; ${newP}) | متبقي (${oldR} &rarr; ${newR})</li>`);
      }
    });

    // Bulk
    const oldC = prevReport.bulk?.cement || '-';
    const newC = report.bulk?.cement || '-';
    if (oldC !== newC) list.push(`<li><strong>الأسمنت:</strong> (${oldC} &rarr; ${newC})</li>`);

    const oldS = prevReport.bulk?.sand || '-';
    const newS = report.bulk?.sand || '-';
    if (oldS !== newS) list.push(`<li><strong>الرمل:</strong> (${oldS} &rarr; ${newS})</li>`);

    const oldFoam = prevReport.bulk?.foam?.pulled || '-';
    const newFoam = report.bulk?.foam?.pulled || '-';
    if (oldFoam !== newFoam) list.push(`<li><strong>الفوم:</strong> (${oldFoam} &rarr; ${newFoam})</li>`);

    // Marble
    const zones = ['zone_a', 'zone_b', 'zone_c'];
    const zoneNames = { zone_a: 'زون A', zone_b: 'زون B', zone_c: 'زون C' };
    zones.forEach(zone => {
      ['white', 'brown'].forEach(c => {
        const oldTotal = prevReport.marble?.[zone]?.[c]?.total || 0;
        const newTotal = report.marble?.[zone]?.[c]?.total || 0;
        if (oldTotal !== newTotal) {
          const colorName = c === 'white' ? 'أبيض' : 'جوزي';
          list.push(`<li><strong>مرمر ${colorName} (${zoneNames[zone]}):</strong> السابق (${oldTotal}) &rarr; المحدث (${newTotal})</li>`);
        }
      });
    });

    return list;
  };

  // ── Generate and print PDF report (Supports All sections OR Section-specific) ──
  const handlePrintReport = (report, targetSection = null) => {
    const dayLabel = report.day || '';
    const zones = ['zone_a', 'zone_b', 'zone_c'];
    const zoneNames = { zone_a: 'زون A', zone_b: 'زون B', zone_c: 'زون C' };

    // Section 1: Basics
    let basicsRows = '';
    const basicsLabels = {
      varnish: 'وارنيش', granite_granules: 'حبيبات كرانيت',
      brown_paint: 'صبغ لون جوزي', gray_base: 'أساس رصاصي',
      putty: 'معجون', primer: 'برايمر', roller: 'رولة'
    };
    Object.entries(report.basics || {}).forEach(([key, item]) => {
      basicsRows += `<tr><td>${basicsLabels[key] || key}</td><td style="text-align:center">${item.pulled || '-'}</td><td style="text-align:center">${item.remaining || '-'}</td></tr>`;
    });

    // Section 2: Marble
    let marbleRows = '';
    let totalWhiteSkiliat = 0, totalBrownSkiliat = 0;
    let totalWhiteLoose = 0, totalBrownLoose = 0;
    let netWhite = 0, netBrown = 0;

    zones.forEach(zone => {
      const w = report.marble?.[zone]?.white || {};
      const b = report.marble?.[zone]?.brown || {};
      
      const wSkiliat = parseInt(w.skiliat) || 0;
      const wLoose = parseInt(w.loose) || 0;
      const wTotal = parseInt(w.total) || 0;

      const bSkiliat = parseInt(b.skiliat) || 0;
      const bLoose = parseInt(b.loose) || 0;
      const bTotal = parseInt(b.total) || 0;

      totalWhiteSkiliat += wSkiliat;
      totalWhiteLoose += wLoose;
      netWhite += wTotal;

      totalBrownSkiliat += bSkiliat;
      totalBrownLoose += bLoose;
      netBrown += bTotal;

      marbleRows += `
        <tr>
          <td rowspan="2" style="vertical-align:middle;font-weight:700;background:#f8f9fa;">${zoneNames[zone]}</td>
          <td>مرمر أبيض</td>
          <td style="text-align:center">${wSkiliat}</td>
          <td style="text-align:center">${w.pieces_per_skilia || 198}</td>
          <td style="text-align:center">${wLoose}</td>
          <td style="text-align:center;font-weight:700;">${wTotal.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color:#b45309;">مرمر جوزي</td>
          <td style="text-align:center">${bSkiliat}</td>
          <td style="text-align:center">${b.pieces_per_skilia || 198}</td>
          <td style="text-align:center">${bLoose}</td>
          <td style="text-align:center;font-weight:700;color:#b45309;">${bTotal.toLocaleString()}</td>
        </tr>`;
    });

    marbleRows += `
      <tr style="background:#1a1a2e;font-weight:800;border-top:2px solid #1a1a2e;">
        <td colspan="2" style="text-align:left;padding-right:15px;color:#fff;">الإجمالي التراكمي / المجموع الكلي:</td>
        <td style="text-align:center;direction:ltr;color:#fff;">W: ${totalWhiteSkiliat}<br/><span style="color:#f59e0b;">B: ${totalBrownSkiliat}</span></td>
        <td style="text-align:center;color:#888;">-</td>
        <td style="text-align:center;direction:ltr;color:#fff;">W: ${totalWhiteLoose}<br/><span style="color:#f59e0b;">B: ${totalBrownLoose}</span></td>
        <td style="text-align:center;direction:ltr;color:#fff;">W: ${netWhite.toLocaleString()}<br/><span style="color:#f59e0b;">B: ${netBrown.toLocaleString()}</span></td>
      </tr>
    `;

    // Section 3: Sealants
    let sealantsRows = '';
    const sealantsLabels = {
      beige_paint: 'صوصج بيجي', white_paint: 'صوصج أبيض',
      primer: 'برايمر', tape: 'تيب لاصق',
      sponge_1cm: 'حبل اسفنجي 1 سم', sponge_2cm: 'حبل اسفنجي 2 سم', sponge_3cm: 'حبل اسفنجي 3 سم'
    };
    Object.entries(report.sealants || {}).forEach(([key, item]) => {
      sealantsRows += `<tr><td>${sealantsLabels[key] || key}</td><td style="text-align:center">${item.pulled || '-'}</td><td style="text-align:center">${item.remaining || '-'}</td></tr>`;
    });

    // Section titles and filters
    const docTitle = targetSection === 'basics' ? 'جرد الماربلتكس والمواد الأساسية'
      : targetSection === 'marble' ? 'جرد ورصيد المرمر'
      : targetSection === 'sealants' ? 'جرد المواد العازلة والصوصج'
      : targetSection === 'bulk' ? 'جرد المواد السائبة والإسفنج'
      : 'تقرير جرد واستهلاك المواد اليومي (الكامل)';

    const showBasics   = !targetSection || targetSection === 'basics';
    const showMarble   = !targetSection || targetSection === 'marble';
    const showSealants = !targetSection || targetSection === 'sealants';
    const showBulk     = !targetSection || targetSection === 'bulk';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${docTitle} - ${report.date}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Cairo', sans-serif;
      color: #1a1a2e;
      background: #ffffff;
      direction: rtl;
      font-size: 10.5pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 15mm;
      background: #fff;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 3px solid #1a1a2e;
      margin-bottom: 16px;
    }
    .header-org { display: flex; align-items: center; gap: 12px; }
    .org-text h1 { font-size: 14pt; font-weight: 900; color: #1a1a2e; }
    .org-text p { font-size: 9pt; color: #555; margin-top: 2px; }
    .header-meta { text-align: left; font-size: 9pt; color: #444; }
    .header-meta .doc-title { font-size: 12pt; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
    .meta-badge {
      display: inline-block; background: #f59e0b; color: #fff;
      font-weight: 700; padding: 2px 10px; border-radius: 20px; font-size: 8.5pt; margin-bottom: 4px;
    }
    .info-bar {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 0;
      border: 1.5px solid #d0d0d8; border-radius: 8px; overflow: hidden; margin-bottom: 18px;
    }
    .info-cell { padding: 6px 10px; border-left: 1px solid #d0d0d8; text-align: center; }
    .info-cell:last-child { border-left: none; }
    .info-cell .lbl { font-size: 8pt; color: #777; font-weight: 600; }
    .info-cell .val { font-size: 10pt; font-weight: 800; color: #1a1a2e; }
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 11pt; font-weight: 800; color: #fff; background: #1a1a2e;
      padding: 6px 12px; border-radius: 6px 6px 0 0; display: flex; align-items: center; gap: 8px;
    }
    .section-title .num {
      background: #f59e0b; color: #1a1a2e; border-radius: 50%; width: 20px; height: 20px;
      display: inline-flex; align-items: center; justify-content: center; font-size: 9.5pt; font-weight: 900;
    }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1.5px solid #d0d0d8; }
    th { background: #f0f0f5; font-weight: 700; color: #333; padding: 6px 10px; border: 1px solid #d0d0d8; text-align: right; }
    td { padding: 6px 10px; border: 1px solid #e0e0e8; color: #1a1a2e; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .bulk-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1.5px solid #d0d0d8; border-top: none; }
    .bulk-cell { padding: 8px 12px; border-left: 1px solid #d0d0d8; text-align: center; }
    .bulk-cell:last-child { border-left: none; }
    .bulk-cell .bc-lbl { font-size: 8.5pt; color: #777; font-weight: 600; }
    .bulk-cell .bc-val { font-size: 11pt; font-weight: 800; color: #1a1a2e; margin-top: 2px; }
    .notes-box {
      border: 1.5px solid #f59e0b; border-radius: 0 0 6px 6px; padding: 8px 12px;
      background: #fffbeb; border-top: none; margin-top: 4px;
    }
    .notes-box .section-label { font-size: 8.5pt; color: #b45309; font-weight: 800; margin-bottom: 3px; }
    .notes-box p { font-size: 9.5pt; color: #333; line-height: 1.5; font-style: italic; white-space: pre-line; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 25px; padding-top: 15px; border-top: 2px dashed #bbb; }
    .sig-box { border: 1px solid #ccc; border-radius: 8px; padding: 10px; text-align: center; }
    .sig-box .sig-title { font-size: 9.5pt; font-weight: 800; color: #1a1a2e; margin-bottom: 6px; }
    .sig-box .sig-line { border-top: 1px solid #999; margin: 22px 8px 4px; padding-top: 4px; font-size: 8pt; color: #888; }
    .report-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 8pt; color: #aaa; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { width: 100%; padding: 8mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="report-header">
      <div class="header-org">
        <div style="width: 60px; height: 60px;">
          <img src="https://mvco-iq.com/wp-content/uploads/2024/10/cropped-2color_logo.webp" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;"/>
        </div>
        <div class="org-text">
          <h1>متابعة موقع الجندي المجهول</h1>
          <p>شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</p>
        </div>
      </div>
      <div class="header-meta">
        <div class="doc-title">${docTitle}</div>
        <div class="meta-badge">وثيقة رسمية معتمدة</div><br/>
        <span>التاريخ: <strong>${report.date}</strong></span> &nbsp;|&nbsp;
        <span>اليوم: <strong>${dayLabel}</strong></span>
      </div>
    </div>

    <div class="info-bar">
      <div class="info-cell"><div class="lbl">التاريخ</div><div class="val">${report.date}</div></div>
      <div class="info-cell"><div class="lbl">اليوم</div><div class="val">${dayLabel}</div></div>
      <div class="info-cell"><div class="lbl">وقت المباشرة</div><div class="val">${report.start_time || '-'}</div></div>
      <div class="info-cell"><div class="lbl">وقت الانتهاء</div><div class="val">${report.end_time || '-'}</div></div>
      <div class="info-cell"><div class="lbl">معد التقرير</div><div class="val">${report.prepared_by || '-'}</div></div>
    </div>

    ${showBasics ? `
    <div class="section">
      <div class="section-title"><span class="num">1</span> الماربلتكس والمواد الأساسية</div>
      <table>
        <thead><tr><th style="width:50%">المادة</th><th style="width:25%;text-align:center">الكمية المسحوبة</th><th style="width:25%;text-align:center">الكمية المتبقية</th></tr></thead>
        <tbody>${basicsRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;">لا بيانات</td></tr>'}</tbody>
      </table>
      ${report.basics_notes ? `<div class="notes-box"><div class="section-label">ملاحظات وتحديثات قسم المواد الأساسية</div><p>${report.basics_notes}</p></div>` : ''}
    </div>` : ''}

    ${showMarble ? `
    <div class="section">
      <div class="section-title"><span class="num">2</span> جرد المرمر (حسب الزون واللون)</div>
      <table>
        <thead><tr><th>الزون</th><th>النوع</th><th style="text-align:center">عدد السكيبات</th><th style="text-align:center">قطع/سكيبة</th><th style="text-align:center">الفرط</th><th style="text-align:center">المجموع</th></tr></thead>
        <tbody>${marbleRows || '<tr><td colspan="6" style="text-align:center;color:#aaa;">لا بيانات</td></tr>'}</tbody>
      </table>
      ${report.marble_notes ? `<div class="notes-box"><div class="section-label">ملاحظات وتحديثات قسم المرمر</div><p>${report.marble_notes}</p></div>` : ''}
    </div>` : ''}

    ${showSealants ? `
    <div class="section">
      <div class="section-title"><span class="num">3</span> جرد الصوصج والمواد العازلة</div>
      <table>
        <thead><tr><th style="width:50%">المادة</th><th style="width:25%;text-align:center">الكمية المسحوبة</th><th style="width:25%;text-align:center">الكمية المتبقية</th></tr></thead>
        <tbody>${sealantsRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;">لا بيانات</td></tr>'}</tbody>
      </table>
      ${report.sealants_notes ? `<div class="notes-box"><div class="section-label">ملاحظات وتحديثات قسم المواد العازلة</div><p>${report.sealants_notes}</p></div>` : ''}
    </div>` : ''}

    ${showBulk ? `
    <div class="section">
      <div class="section-title"><span class="num">4</span> المواد السائبة (أسمنت ورمل وفوم)</div>
      <div class="bulk-grid">
        <div class="bulk-cell"><div class="bc-lbl">كمية الأسمنت</div><div class="bc-val">${report.bulk?.cement || '-'}</div></div>
        <div class="bulk-cell"><div class="bc-lbl">كمية الرمل</div><div class="bc-val">${report.bulk?.sand || '-'}</div></div>
        <div class="bulk-cell"><div class="bc-lbl">الفوم (مسحوب / متبقي)</div><div class="bc-val">${report.bulk?.foam?.pulled || '-'} / ${report.bulk?.foam?.remaining || '-'}</div></div>
      </div>
      ${report.bulk_notes ? `<div class="notes-box"><div class="section-label">ملاحظات وتحديثات قسم المواد السائبة</div><p>${report.bulk_notes}</p></div>` : ''}
    </div>` : ''}

    ${report.notes ? `
    <div class="notes-box" style="border-color:#1a1a2e;background:#f8f9fa;">
      <div class="section-label" style="color:#1a1a2e;">ملاحظات وتحديثات الاستهلاك العامة:</div>
      <p style="font-style:normal;">${report.notes}</p>
    </div>` : ''}

    <div class="signatures">
      <div class="sig-box"><div class="sig-title">مشرف الموقع</div><div class="sig-line">التوقيع والتاريخ</div></div>
      <div class="sig-box"><div class="sig-title">المعاون الفني</div><div class="sig-line">التوقيع والتاريخ</div></div>
      <div class="sig-box"><div class="sig-title">معد التقرير</div><div class="sig-line">${report.prepared_by || 'علي حاتم'}</div></div>
    </div>

    <div class="report-footer">
      <span>متابعة موقع الجندي المجهول - شركة رؤية الحداثة للخدمات الهندسية</span>
      <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
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
      frameDoc.write(html);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (err) {
          console.error(err);
        }
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 10000);
      }, 500);
    }
  };

  // 2. Load draft from localStorage on switching to Form Mode
  useEffect(() => {
    if (viewMode === 'form' && !isEditingId && !isCloned) {
      const savedDraft = localStorage.getItem('materials_consumption_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // Set draft, keeping date fresh if it was default
          setFormData({
            ...parsed,
            date: parsed.date || new Date().toISOString().split('T')[0]
          });
          setHasRestoredDraft(true);
          setTimeout(() => setHasRestoredDraft(false), 4000);
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    }
  }, [viewMode, isEditingId, isCloned]);

  // 3. Auto-save form changes to localStorage
  useEffect(() => {
    if (viewMode === 'form' && !isEditingId) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('materials_consumption_draft', JSON.stringify(formData));
        setShowAutoSaveIndicator(true);
        setTimeout(() => setShowAutoSaveIndicator(false), 2000);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [formData, viewMode, isEditingId]);

  // 4. Calculate zone and cumulative totals dynamically
  const calculateTotals = (currentData) => {
    const updated = { ...currentData };
    const zones = ['zone_a', 'zone_b', 'zone_c'];
    
    zones.forEach(zone => {
      ['white', 'brown'].forEach(color => {
        const zoneData = updated.marble[zone][color];
        const skiliat = parseInt(zoneData.skiliat) || 0;
        const pcsPerSkilia = parseInt(zoneData.pieces_per_skilia) || 0;
        const loose = parseInt(zoneData.loose) || 0;
        updated.marble[zone][color].total = (skiliat * pcsPerSkilia) + loose;
      });
    });
    
    return updated;
  };

  const handleFieldChange = (section, item, field, value) => {
    setFormData(prev => {
      let nextState = { ...prev };
      if (section === 'basics' || section === 'sealants') {
        nextState[section][item][field] = value;
      } else if (section === 'bulk') {
        if (item === 'foam') {
          nextState.bulk.foam[field] = value;
        } else {
          nextState.bulk[item] = value;
        }
      } else if (section === 'marble') {
        nextState.marble[item][field][value] = arguments[4]; // handles (marble, zone, color, subfield, val)
      } else {
        nextState[section] = value;
      }
      return section === 'marble' ? calculateTotals(nextState) : nextState;
    });
  };

  // Specialized change handler for marble sub-fields
  const handleMarbleChange = (zone, color, subField, val) => {
    setFormData(prev => {
      const nextState = JSON.parse(JSON.stringify(prev)); // Deep copy
      nextState.marble[zone][color][subField] = val;
      return calculateTotals(nextState);
    });
  };

  // 5. Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError('');

    const submitData = JSON.parse(JSON.stringify(formData));

    if (originalDataForEdit) {
      const diffList = getDifferencesList(submitData, originalDataForEdit);
      if (diffList.length > 0) {
        const plainTextDiffs = diffList.map(item => {
           let text = item.replace(/<li>/g, '- ').replace(/<\/li>/g, '');
           text = text.replace(/<strong>(.*?)<\/strong>/g, '$1');
           text = text.replace(/&larr;/g, '->');
           text = text.replace(/<[^>]+>/g, '');
           return text.trim();
        }).join('\n');
        
        const timestamp = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        submitData.notes = (submitData.notes ? submitData.notes + '\n\n' : '') + 
                           `--- تحديثات الاستهلاك / التعديلات (${submitData.date}) ---\n` + plainTextDiffs;
      }
    }

    try {
      const method = isEditingId ? 'PUT' : 'POST';
      const url = isEditingId 
        ? `/api/materials-consumption/${isEditingId}` 
        : '/api/materials-consumption';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (res.ok) {
        if (!isEditingId) {
          // Clear draft on successful creation
          localStorage.removeItem('materials_consumption_draft');
        }
        setFormData(INITIAL_FORM_STATE);
        setOriginalDataForEdit(null);
        setIsEditingId(null);
        setIsCloned(false);
        setViewMode('history');
        fetchReports();
      } else {
        const errorData = await res.json();
        setSubmitError(errorData.error || 'Failed to submit the report');
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Delete Report
  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDeleteReport'))) return;
    try {
      const res = await fetch(`/api/materials-consumption/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 7. Edit Setup
  const handleEdit = (report) => {
    setFormData(report);
    setOriginalDataForEdit(JSON.parse(JSON.stringify(report)));
    setIsEditingId(report.id);
    setIsCloned(false);
    setViewMode('form');
  };

  // 8. Clone/Copy Setup
  const handleClone = (report) => {
    const todayDate = new Date().toISOString().split('T')[0];
    const dayOfWeekIndex = new Date().getDay();
    const todayDayArabic = DAYS_OF_WEEK.ar[dayOfWeekIndex];

    setFormData({
      ...report,
      id: undefined, // Clear ID so it saves as new
      date: todayDate,
      day: todayDayArabic,
      created_at: undefined
    });
    setOriginalDataForEdit(JSON.parse(JSON.stringify(report)));
    setIsEditingId(null);
    setIsCloned(true);
    setViewMode('form');
  };

  // Cumulative Sums computed from current form data
  const getCumulativeTotals = () => {
    const zones = ['zone_a', 'zone_b', 'zone_c'];
    let totalWhiteSkiliat = 0, totalBrownSkiliat = 0;
    let totalWhiteLoose = 0, totalBrownLoose = 0;
    let netWhite = 0, netBrown = 0;

    zones.forEach(zone => {
      const w = formData.marble[zone].white;
      const b = formData.marble[zone].brown;

      totalWhiteSkiliat += parseInt(w.skiliat) || 0;
      totalBrownSkiliat += parseInt(b.skiliat) || 0;
      totalWhiteLoose += parseInt(w.loose) || 0;
      totalBrownLoose += parseInt(b.loose) || 0;
      netWhite += w.total || 0;
      netBrown += b.total || 0;
    });

    return {
      totalWhiteSkiliat,
      totalBrownSkiliat,
      totalWhiteLoose,
      totalBrownLoose,
      netWhite,
      netBrown
    };
  };

  const cumulative = getCumulativeTotals();

  // Helper to translate Arabic days
  const getDayTranslation = (dayName) => {
    const idx = DAYS_OF_WEEK.ar.indexOf(dayName);
    return idx !== -1 ? DAYS_OF_WEEK[lang][idx] : dayName;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', width: '100%' }}>
      <div className="screen-only-view" style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header controls (Bento Card) */}
        <motion.div 
          className="glass-panel"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Sparkles size={24} style={{ color: 'var(--accent)' }} />
              {t('headerMaterialsConsumptionTitle')}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px', marginBottom: 0 }}>
              {t('headerMaterialsConsumptionSubtitle')}
            </p>
          </div>

          <div>
            {viewMode === 'history' ? (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  if (reports && reports.length > 0) {
                    handleClone(reports[0]);
                  } else {
                    setFormData(INITIAL_FORM_STATE);
                    setIsEditingId(null);
                    setIsCloned(false);
                    setViewMode('form');
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <Plus size={18} />
                {t('addNewReport')}
              </button>
            ) : (
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditingId(null);
                  setIsCloned(false);
                  setViewMode('history');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                {lang === 'ar' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                {t('backToHistory')}
              </button>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {viewMode === 'history' ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel"
              style={{ width: '100%', padding: '0', overflow: 'hidden' }}
            >
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                  {t('reportHistory')}
                </h3>
              </div>

            {loading && reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                {t('loading')}
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <FileText size={48} style={{ opacity: 0.4 }} />
                <span>{t('noReportsYet')}</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="project-table" style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>{t('materialsReportDate')}</th>
                      <th style={{ width: '10%' }}>{t('materialsReportDay')}</th>
                      <th style={{ width: '15%' }}>{t('materialsReportStartTime')} - {t('materialsReportEndTime')}</th>
                      <th style={{ width: '15%' }}>{t('materialsReportPreparedBy')}</th>
                      <th style={{ width: '25%' }}>{t('totalPieces')}</th>
                      <th style={{ width: '20%', textAlign: 'center' }}>{t('edit')} / {t('deleteReport')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => {
                      // Sum total marble pieces in report
                      let rWhite = 0, rBrown = 0;
                      ['zone_a', 'zone_b', 'zone_c'].forEach(z => {
                        rWhite += report.marble?.[z]?.white?.total || 0;
                        rBrown += report.marble?.[z]?.brown?.total || 0;
                      });

                      const isExpanded = expandedReportId === report.id;

                      return (
                        <React.Fragment key={report.id}>
                          <tr 
                            onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ fontWeight: '700', fontFamily: 'var(--font-english)' }}>
                              {report.date}
                            </td>
                            <td>{getDayTranslation(report.day)}</td>
                            <td style={{ fontFamily: 'var(--font-english)' }}>
                              {report.start_time} - {report.end_time}
                            </td>
                            <td style={{ fontWeight: '500' }}>{report.prepared_by}</td>
                            <td>
                              <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                {lang === 'ar' ? `المجموع: ${rWhite + rBrown}` : `Total: ${rWhite + rBrown}`}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '4px' }}>
                                {lang === 'ar' 
                                  ? `أبيض: ${rWhite} (سيكبة ${Math.floor(rWhite / 198)} | مفرط ${rWhite % 198})`
                                  : `White: ${rWhite} (Pallets ${Math.floor(rWhite / 198)} | Loose ${rWhite % 198})`}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '2px' }}>
                                {lang === 'ar' 
                                  ? `جوزي: ${rBrown} (سيكبة ${Math.floor(rBrown / 198)} | مفرط ${rBrown % 198})`
                                  : `Brown: ${rBrown} (Pallets ${Math.floor(rBrown / 198)} | Loose ${rBrown % 198})`}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => handlePrintReport(report)}
                                  title={lang === 'ar' ? 'طباعة التقرير PDF' : 'Print report PDF'}
                                  style={{ padding: '6px 10px', minWidth: 'auto', minHeight: 'auto', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}
                                >
                                  <Printer size={14} />
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => handleClone(report)}
                                  title={lang === 'ar' ? 'نسخ كتقرير جديد' : 'Clone as new report'}
                                  style={{ padding: '6px 10px', minWidth: 'auto', minHeight: 'auto', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                                >
                                  <Copy size={14} />
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => handleEdit(report)}
                                  title={lang === 'ar' ? 'تعديل التقرير الحالي' : 'Edit report'}
                                  style={{ padding: '6px 10px', minWidth: 'auto', minHeight: 'auto' }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                {(user.role === 'admin' || user.role === 'super_admin') && (
                                  <button 
                                    className="btn btn-secondary" 
                                    onClick={() => handleDelete(report.id)}
                                    title={lang === 'ar' ? 'حذف' : 'Delete'}
                                    style={{ padding: '6px 10px', minWidth: 'auto', minHeight: 'auto', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
                              <td colSpan="6" style={{ padding: '1.5rem', cursor: 'default' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                  
                                  {/* Basics details */}
                                  <div className="glass-panel" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
                                      <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Layers size={18} />
                                        {t('sectionBasics')}
                                      </h4>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); handlePrintReport(report, 'basics'); }}
                                        title={lang === 'ar' ? 'طباعة قسم الأساسيات' : 'Print Basics'}
                                        style={{ padding: '3px 8px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}
                                      >
                                        <Printer size={12} />
                                        PDF
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                      {Object.entries(report.basics || {}).map(([key, item]) => (
                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                          <span style={{ fontWeight: '500' }}>{t(key)}</span>
                                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(243, 151, 22, 0.08)', color: 'var(--accent)', fontWeight: '600' }}>
                                              {t('materialPulled')}: {item.pulled || 0}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--success)', fontWeight: '600' }}>
                                              {t('materialRemaining')}: {item.remaining || 0}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                      {report.basics_notes && (
                                        <div style={{ marginTop: '0.4rem', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--accent)', fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                                          <strong>ملاحظات الأساسيات:</strong> {report.basics_notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Sealants details */}
                                  <div className="glass-panel" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
                                      <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Sparkles size={18} />
                                        {t('sectionSealants')}
                                      </h4>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); handlePrintReport(report, 'sealants'); }}
                                        title={lang === 'ar' ? 'طباعة قسم العوازل' : 'Print Sealants'}
                                        style={{ padding: '3px 8px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}
                                      >
                                        <Printer size={12} />
                                        PDF
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                      {Object.entries(report.sealants || {}).map(([key, item]) => (
                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                          <span style={{ fontWeight: '500' }}>{t(key)}</span>
                                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(243, 151, 22, 0.08)', color: 'var(--accent)', fontWeight: '600' }}>
                                              {t('materialPulled')}: {item.pulled || 0}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--success)', fontWeight: '600' }}>
                                              {t('materialRemaining')}: {item.remaining || 0}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                      {report.sealants_notes && (
                                        <div style={{ marginTop: '0.4rem', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--accent)', fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                                          <strong>ملاحظات العوازل:</strong> {report.sealants_notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bulk & Notes */}
                                  <div className="glass-panel" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '1rem' }}>
                                      <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={18} />
                                        {lang === 'ar' ? `${t('sectionBulk')} و ${t('notes')}` : `${t('sectionBulk')} & ${t('notes')}`}
                                      </h4>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={(e) => { e.stopPropagation(); handlePrintReport(report, 'bulk'); }}
                                        title={lang === 'ar' ? 'طباعة قسم السائبة' : 'Print Bulk'}
                                        style={{ padding: '3px 8px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}
                                      >
                                        <Printer size={12} />
                                        PDF
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                        <span style={{ fontWeight: '500' }}>{t('cementQty')}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--fg)', fontWeight: '600', fontFamily: 'var(--font-english)' }}>
                                          {report.bulk?.cement || 0}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                        <span style={{ fontWeight: '500' }}>{t('sandQty')}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--fg)', fontWeight: '600', fontFamily: 'var(--font-english)' }}>
                                          {report.bulk?.sand || 0}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                        <span style={{ fontWeight: '500' }}>{t('foam')}</span>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(243, 151, 22, 0.08)', color: 'var(--accent)', fontWeight: '600' }}>
                                            {t('materialPulled')}: {report.bulk?.foam?.pulled || 0}
                                          </span>
                                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--success)', fontWeight: '600' }}>
                                            {t('materialRemaining')}: {report.bulk?.foam?.remaining || 0}
                                          </span>
                                        </div>
                                      </div>
                                      {report.bulk_notes && (
                                        <div style={{ marginTop: '0.4rem', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--accent)', fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                                          <strong>ملاحظات المواد السائبة:</strong> {report.bulk_notes}
                                        </div>
                                      )}
                                      {report.notes && (
                                        <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', borderLeft: lang === 'ar' ? 'none' : '3px solid var(--accent)', borderRight: lang === 'ar' ? '3px solid var(--accent)' : 'none' }}>
                                          <div style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '4px', fontWeight: '800' }}>ملاحظات وتحديثات عامة:</div>
                                          <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--fg-2)', whiteSpace: 'pre-line' }}>{report.notes}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>


                                  {/* Marble details (Full width spanning) */}
                                  <div className="glass-panel" style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.02)', gridColumn: '1 / -1' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <Layers size={18} />
                                      {t('sectionMarble')}
                                    </h4>
                                    <div className="table-responsive" style={{ marginTop: '0', background: 'transparent', border: 'none' }}>
                                      <table className="project-table" style={{ direction: lang === 'ar' ? 'rtl' : 'ltr', fontSize: '0.85rem', background: 'transparent' }}>
                                        <thead>
                                          <tr>
                                            <th style={{ background: 'transparent', padding: '8px 12px', fontSize: '0.8rem' }}>{t('colZoneName')}</th>
                                            <th style={{ background: 'transparent', padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}>{t('skiliatCount')}</th>
                                            <th style={{ background: 'transparent', padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}>{t('piecesPerSkilia')}</th>
                                            <th style={{ background: 'transparent', padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}>{t('loosePieces')}</th>
                                            <th style={{ background: 'transparent', padding: '8px 12px', fontSize: '0.8rem', textAlign: 'center' }}>{t('totalPieces')}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {['zone_a', 'zone_b', 'zone_c'].map((zone) => (
                                            <React.Fragment key={zone}>
                                              {/* White */}
                                              <tr>
                                                <td style={{ padding: '8px 12px', fontWeight: '600' }}>
                                                  {(lang === 'ar' ? zone.replace('zone_', 'زون ').toUpperCase() : zone.replace('zone_', 'Zone ').toUpperCase())} - {t('marbleWhiteTitle')}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.white?.skiliat || 0}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.white?.pieces_per_skilia || 198}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.white?.loose || 0}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: '800', fontFamily: 'var(--font-english)' }}>
                                                  {(report.marble?.[zone]?.white?.total || 0).toLocaleString()}
                                                </td>
                                              </tr>
                                              {/* Brown */}
                                              <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                                                <td style={{ padding: '8px 12px', color: 'var(--accent)', fontWeight: '600' }}>
                                                  {(lang === 'ar' ? zone.replace('zone_', 'زون ').toUpperCase() : zone.replace('zone_', 'Zone ').toUpperCase())} - {t('marbleBrownTitle')}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.brown?.skiliat || 0}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.brown?.pieces_per_skilia || 198}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontFamily: 'var(--font-english)' }}>
                                                  {report.marble?.[zone]?.brown?.loose || 0}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: '800', fontFamily: 'var(--font-english)', color: 'var(--accent)' }}>
                                                  {(report.marble?.[zone]?.brown?.total || 0).toLocaleString()}
                                                </td>
                                              </tr>
                                            </React.Fragment>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.form 
            key="form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            onSubmit={handleSubmit}
            style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}
          >
            {/* Auto-save draft notifications */}
            {hasRestoredDraft && (
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem 1rem' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600' }}>
                  {t('hasDraftLoaded')}
                </span>
              </div>
            )}

            {isCloned && (
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--accent)', background: 'rgba(243, 151, 22, 0.05)', padding: '0.75rem 1rem' }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--fg)', fontWeight: '600' }}>
                  {lang === 'ar' 
                    ? 'تم ملء النموذج تلقائياً ببيانات الجرد السابق. يمكنك التعديل عليها وحفظها كجرد جديد.' 
                    : 'The form has been pre-filled with the previous report data. You can edit and save it as a new report.'}
                </span>
              </div>
            )}

            {submitError && (
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem 1rem' }}>
                <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: '600' }}>
                  {submitError}
                </span>
              </div>
            )}

            {/* Header Form Cards */}
            <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', padding: '1.2rem' }}>
              <div>
                <label className="form-label">{t('materialsReportDate')}</label>
                <input 
                  type="date" 
                  className="form-input"
                  style={{ fontFamily: 'var(--font-english)' }}
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', null, null, e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">{t('materialsReportDay')}</label>
                <select 
                  className="form-input"
                  value={formData.day}
                  onChange={(e) => handleFieldChange('day', null, null, e.target.value)}
                  required
                >
                  {DAYS_OF_WEEK.ar.map((day, idx) => (
                    <option key={day} value={day}>
                      {DAYS_OF_WEEK[lang][idx]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">{t('materialsReportStartTime')}</label>
                <input 
                  type="time" 
                  className="form-input"
                  style={{ fontFamily: 'var(--font-english)' }}
                  value={formData.start_time}
                  onChange={(e) => handleFieldChange('start_time', null, null, e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">{t('materialsReportEndTime')}</label>
                <input 
                  type="time" 
                  className="form-input"
                  style={{ fontFamily: 'var(--font-english)' }}
                  value={formData.end_time}
                  onChange={(e) => handleFieldChange('end_time', null, null, e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">{t('materialsReportPreparedBy')}</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={formData.prepared_by}
                  onChange={(e) => handleFieldChange('prepared_by', null, null, e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Grid for Sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              
              {/* Section 1: Basics */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--accent)' }}>
                    {t('sectionBasics')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handlePrintReport(formData, 'basics')}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Printer size={13} />
                    {lang === 'ar' ? 'طباعة قسم الأساسيات PDF' : 'Print Basics Section PDF'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {Object.keys(formData.basics).map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                      <span style={{ fontWeight: '500', flex: 1 }}>{t(item)}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '180px' }}>
                        <input
                          type="text"
                          placeholder={t('materialPulled')}
                          className="form-input"
                          style={{ padding: '6px', textAlign: 'center', fontFamily: 'var(--font-english)' }}
                          value={formData.basics[item].pulled}
                          onChange={(e) => handleFieldChange('basics', item, 'pulled', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder={t('materialRemaining')}
                          className="form-input"
                          style={{ padding: '6px', textAlign: 'center', fontFamily: 'var(--font-english)' }}
                          value={formData.basics[item].remaining}
                          onChange={(e) => handleFieldChange('basics', item, 'remaining', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '700' }}>
                    {lang === 'ar' ? '📝 ملاحظات وتحديثات قسم المواد الأساسية:' : '📝 Basics Section Notes & Updates:'}
                  </label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder={lang === 'ar' ? 'أكتب ملاحظات أو تحديثات خاصة بالمواد الأساسية...' : 'Notes for basics section...'}
                    value={formData.basics_notes || ''}
                    onChange={(e) => handleFieldChange('basics_notes', null, null, e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Section 2: Marble Inventory */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--accent)' }}>
                    {t('sectionMarble')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handlePrintReport(formData, 'marble')}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Printer size={13} />
                    {lang === 'ar' ? 'طباعة قسم المرمر PDF' : 'Print Marble Section PDF'}
                  </button>
                </div>
                
                <div className="table-responsive">
                  <table className="project-table" style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
                    <thead>
                      <tr>
                        <th>{t('colZoneName')}</th>
                        <th style={{ textAlign: 'center' }}>{t('skiliatCount')}</th>
                        <th style={{ textAlign: 'center' }}>{t('piecesPerSkilia')}</th>
                        <th style={{ textAlign: 'center' }}>{t('loosePieces')}</th>
                        <th style={{ textAlign: 'center' }}>{t('totalPieces')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['zone_a', 'zone_b', 'zone_c'].map((zone) => (
                        <React.Fragment key={zone}>
                          {/* White Marble */}
                          <tr>
                            <td style={{ fontWeight: '700' }}>
                              {(lang === 'ar' ? zone.replace('zone_', 'زون ').toUpperCase() : zone.replace('zone_', 'Zone ').toUpperCase())} - {t('marbleWhiteTitle')}
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].white.skiliat}
                                onChange={(e) => handleMarbleChange(zone, 'white', 'skiliat', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].white.pieces_per_skilia}
                                onChange={(e) => handleMarbleChange(zone, 'white', 'pieces_per_skilia', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].white.loose}
                                onChange={(e) => handleMarbleChange(zone, 'white', 'loose', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontFamily: 'var(--font-english)' }}>
                              {(formData.marble[zone].white.total || 0).toLocaleString()}
                            </td>
                          </tr>
                          
                          {/* Brown Marble */}
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <td style={{ fontWeight: '700', color: 'var(--accent)' }}>
                              {(lang === 'ar' ? zone.replace('zone_', 'زون ').toUpperCase() : zone.replace('zone_', 'Zone ').toUpperCase())} - {t('marbleBrownTitle')}
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].brown.skiliat}
                                onChange={(e) => handleMarbleChange(zone, 'brown', 'skiliat', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].brown.pieces_per_skilia}
                                onChange={(e) => handleMarbleChange(zone, 'brown', 'pieces_per_skilia', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}
                                value={formData.marble[zone].brown.loose}
                                onChange={(e) => handleMarbleChange(zone, 'brown', 'loose', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '800', fontFamily: 'var(--font-english)', color: 'var(--accent)' }}>
                              {(formData.marble[zone].brown.total || 0).toLocaleString()}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}

                      {/* Cumulative sums row */}
                      <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: '800' }}>
                        <td>{lang === 'ar' ? 'الإجمالي التراكمي' : 'Cumulative / Totals'}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}>
                          <div>{lang === 'ar' ? 'أبيض: ' : 'W: '}{cumulative.totalWhiteSkiliat}</div>
                          <div style={{ color: 'var(--accent)' }}>{lang === 'ar' ? 'جوزي: ' : 'B: '}{cumulative.totalBrownSkiliat}</div>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--muted)' }}>-</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}>
                          <div>{lang === 'ar' ? 'أبيض: ' : 'W: '}{cumulative.totalWhiteLoose}</div>
                          <div style={{ color: 'var(--accent)' }}>{lang === 'ar' ? 'جوزي: ' : 'B: '}{cumulative.totalBrownLoose}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-english)' }}>
                          <div style={{ color: '#eef2f7' }}>{t('netWhite')}: {cumulative.netWhite.toLocaleString()}</div>
                          <div style={{ color: 'var(--accent)' }}>{t('netBrown')}: {cumulative.netBrown.toLocaleString()}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '700' }}>
                    {lang === 'ar' ? '📝 ملاحظات وتحديثات قسم المرمر:' : '📝 Marble Section Notes & Updates:'}
                  </label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder={lang === 'ar' ? 'أكتب ملاحظات أو تحديثات خاصة بجرد وتفريغ المرمر...' : 'Notes for marble section...'}
                    value={formData.marble_notes || ''}
                    onChange={(e) => handleFieldChange('marble_notes', null, null, e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Section 3: Sealants & Sponges */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--accent)' }}>
                    {t('sectionSealants')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handlePrintReport(formData, 'sealants')}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Printer size={13} />
                    {lang === 'ar' ? 'طباعة قسم العوازل PDF' : 'Print Sealants Section PDF'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {Object.keys(formData.sealants).map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                      <span style={{ fontWeight: '500', flex: 1 }}>{t(item)}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '180px' }}>
                        <input
                          type="text"
                          placeholder={t('materialPulled')}
                          className="form-input"
                          style={{ padding: '6px', textAlign: 'center', fontFamily: 'var(--font-english)' }}
                          value={formData.sealants[item].pulled}
                          onChange={(e) => handleFieldChange('sealants', item, 'pulled', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder={t('materialRemaining')}
                          className="form-input"
                          style={{ padding: '6px', textAlign: 'center', fontFamily: 'var(--font-english)' }}
                          value={formData.sealants[item].remaining}
                          onChange={(e) => handleFieldChange('sealants', item, 'remaining', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '700' }}>
                    {lang === 'ar' ? '📝 ملاحظات وتحديثات قسم المواد العازلة والصوصج:' : '📝 Sealants Section Notes & Updates:'}
                  </label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder={lang === 'ar' ? 'أكتب ملاحظات أو تحديثات خاصة بـ الصوصج والعوازل والحيال الاسفنجية...' : 'Notes for sealants section...'}
                    value={formData.sealants_notes || ''}
                    onChange={(e) => handleFieldChange('sealants_notes', null, null, e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Section 4: Bulk Materials */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--accent)' }}>
                    {t('sectionBulk')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handlePrintReport(formData, 'bulk')}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Printer size={13} />
                    {lang === 'ar' ? 'طباعة قسم السائبة PDF' : 'Print Bulk Section PDF'}
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>
                  {/* Cement + Sand */}
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.6rem' }}>{t('cement')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('cementQty')}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontFamily: 'var(--font-english)' }}
                          value={formData.bulk.cement}
                          onChange={(e) => handleFieldChange('bulk', 'cement', null, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('sandQty')}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontFamily: 'var(--font-english)' }}
                          value={formData.bulk.sand}
                          onChange={(e) => handleFieldChange('bulk', 'sand', null, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Foam */}
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.6rem' }}>{t('foam')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('materialPulled')}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontFamily: 'var(--font-english)' }}
                          value={formData.bulk.foam.pulled}
                          onChange={(e) => handleFieldChange('bulk', 'foam', 'pulled', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('materialRemaining')}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontFamily: 'var(--font-english)' }}
                          value={formData.bulk.foam.remaining}
                          onChange={(e) => handleFieldChange('bulk', 'foam', 'remaining', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '700' }}>
                    {lang === 'ar' ? '📝 ملاحظات وتحديثات قسم المواد السائبة الإسمنت والرمل والفوم:' : '📝 Bulk Section Notes & Updates:'}
                  </label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder={lang === 'ar' ? 'أكتب ملاحظات أو تحديثات خاصة بالأسمنت والرمل والفوم...' : 'Notes for bulk section...'}
                    value={formData.bulk_notes || ''}
                    onChange={(e) => handleFieldChange('bulk_notes', null, null, e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Section 5: General Notes */}
              <div className="glass-panel">
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', color: 'var(--accent)' }}>
                  {lang === 'ar' ? '📝 ملاحظات وتحديثات استهلاك عامة (شاملة)' : '📝 General Consumption Notes & Updates'}
                </h3>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder={t('materialsReportNotes')}
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', null, null, e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

            </div>


            {/* Form actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
              {showAutoSaveIndicator && !isEditingId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                  {t('autoSaveDraft')}
                </span>
              )}
              
              {!isEditingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من تفريغ النموذج والبدء من جديد؟' : 'Are you sure you want to clear the form and start clean?')) {
                      setFormData(INITIAL_FORM_STATE);
                      setIsCloned(false);
                      localStorage.removeItem('materials_consumption_draft');
                    }
                  }}
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}
                >
                  {lang === 'ar' ? 'البدء بنموذج فارغ' : 'Start with Empty Form'}
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePrintReport(formData)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}
              >
                <Printer size={18} />
                {lang === 'ar' ? 'طباعة / تصدير PDF' : 'Print / Export PDF'}
              </button>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Save size={18} />
                {isEditingId ? t('updateReport') : t('submitReport')}
              </button>
            </div>

          </motion.form>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
