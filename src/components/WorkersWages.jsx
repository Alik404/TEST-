import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Plus, Search, Calendar, Edit2, Trash2,
  FileSpreadsheet, FileText, X, Check, Calculator, Clock, Users, DollarSign
} from 'lucide-react';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';

const QUICK_TAGS = [
  'تصنيف جوينات',
  'أعمال بياض وجص وسقالة',
  'ترتيب وتبريز الرخام',
  'تفكيك كرات',
  'تصنيف نزلات',
  'تنظيف هراوة المقل',
  'تنزيل المقل المقل',
  'تريبه كورنيش',
  'فرز وتصنيف ألواح المقل',
  'معالجة وشحذ المودول'
];

export default function WorkersWages({ user, t, lang }) {
  const isAr = lang === 'ar';

  const [wages, setWages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    work_item: '',
    worker_name: 'عمال ابو حيدر',
    shifts_count: 2,
    shift_price: 30000,
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch all wages
  const fetchWages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workers-wages');
      if (res.ok) {
        const data = await res.json();
        setWages(data);
      }
    } catch (err) {
      console.error('Failed to fetch wages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWages();
  }, []);

  // Filter wages
  const filteredWages = wages.filter(item => {
    const matchesSearch =
      (item.work_item || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.worker_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const itemDate = item.work_date;
    const matchesStart = !startDate || itemDate >= startDate;
    const matchesEnd = !endDate || itemDate <= endDate;

    return matchesSearch && matchesStart && matchesEnd;
  });

  // Calculate KPIs
  const totalWagesAmount = filteredWages.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
  const totalShiftsCount = filteredWages.reduce((sum, item) => sum + (Number(item.shifts_count) || 0), 0);
  const recordsCount = filteredWages.length;
  const avgShiftPrice = totalShiftsCount > 0 ? Math.round(totalWagesAmount / totalShiftsCount) : 0;

  // Handlers for modal
  const openAddModal = () => {
    setEditingRecord(null);
    setFormData({
      work_date: new Date().toISOString().split('T')[0],
      work_item: 'تصنيف جوينات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 2,
      shift_price: 30000,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      work_date: record.work_date || new Date().toISOString().split('T')[0],
      work_item: record.work_item || '',
      worker_name: record.worker_name || '',
      shifts_count: record.shifts_count || 1,
      shift_price: record.shift_price || 0,
      notes: record.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.work_item || !formData.work_date) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        shifts_count: Number(formData.shifts_count),
        shift_price: Number(formData.shift_price),
        total_amount: Number(formData.shifts_count) * Number(formData.shift_price)
      };

      const url = editingRecord ? `/api/workers-wages/${editingRecord.id}` : '/api/workers-wages';
      const method = editingRecord ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchWages();
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving wage record:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'هل أنت تأكد من رغبتك في حذف هذا السجل؟' : 'Are you sure you want to delete this record?')) return;
    try {
      const res = await fetch(`/api/workers-wages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchWages();
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredWages.map((item, index) => ({
      '#': index + 1,
      'التاريخ': item.work_date,
      'فقرة العمل': item.work_item,
      'العامل / الوجبة': item.worker_name,
      'عدد الشفتات': item.shifts_count,
      'سعر الشفت (د.ع)': item.shift_price?.toLocaleString(),
      'الإجمالي (د.ع)': item.total_amount?.toLocaleString(),
      'ملاحظات': item.notes || ''
    }));
    exportToExcel(exportData, 'سجل_أجور_الشفتات_والعمال');
  };

  const handleExportPDF = () => {
    const todayStr = new Date().toLocaleDateString('ar-EG');
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const tableRows = filteredWages.map((item, index) => `
      <tr>
        <td style="text-align:center;font-weight:bold;">${index + 1}</td>
        <td style="text-align:center;dir:ltr;">${item.work_date}</td>
        <td style="font-weight:bold;color:#1e293b;">${item.work_item}</td>
        <td>${item.worker_name || 'عمال ابو حيدر'}</td>
        <td style="text-align:center;font-weight:bold;color:#059669;">${item.shifts_count} شفت</td>
        <td style="text-align:left;">${Number(item.shift_price)?.toLocaleString()} د.ع</td>
        <td style="text-align:left;font-weight:bold;color:#059669;">${Number(item.total_amount)?.toLocaleString()} د.ع</td>
        <td style="font-size:8pt;color:#555;">${item.notes || '-'}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير أجور وشفتات العمال</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; font-family: 'Cairo', sans-serif; }
    body { margin: 0; padding: 20px; background: #fff; color: #111; font-size: 10pt; line-height: 1.5; }
    .page { width: 100%; max-width: 900px; margin: 0 auto; }
    
    /* Header */
    .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #059669; padding-bottom: 15px; margin-bottom: 20px; }
    .header-org { display: flex; align-items: center; gap: 15px; }
    .header-logo img { height: 65px; width: auto; }
    .org-text h1 { margin: 0; font-size: 15pt; font-weight: 800; color: #059669; }
    .org-text p { margin: 2px 0 0; font-size: 8.5pt; color: #555; }
    .header-meta { text-align: left; }
    .doc-title { font-size: 13pt; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
    .meta-badge { display: inline-block; background: #059669; color: #fff; font-size: 7.5pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; }

    /* Info Bar */
    .info-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f4fbf7; border: 1px solid #d1fae5; border-radius: 8px; padding: 12px; margin-bottom: 20px; text-align: center; }
    .info-cell .lbl { font-size: 8pt; color: #555; margin-bottom: 2px; }
    .info-cell .val { font-size: 11pt; font-weight: 800; color: #059669; }

    /* Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    th { background: #059669; color: #fff; padding: 9px 8px; font-size: 9pt; font-weight: 700; border: 1px solid #047857; text-align: right; }
    td { padding: 8px; border: 1px solid #e2e8f0; font-size: 8.5pt; }
    tr:nth-child(even) { background: #f8fafc; }
    tfoot td { background: #e6f4ed; font-weight: 800; border-top: 2px solid #059669; font-size: 9.5pt; }

    /* Signatures */
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 35px; padding-top: 15px; border-top: 2px dashed #cbd5e1; }
    .sig-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; background: #fafafa; }
    .sig-title { font-size: 9.5pt; font-weight: 800; color: #1e293b; margin-bottom: 6px; }
    .sig-line { border-top: 1px solid #94a3b8; margin: 30px 10px 4px; padding-top: 4px; font-size: 8pt; color: #64748b; }

    /* Footer */
    .report-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7.5pt; color: #94a3b8; }
    
    @media print {
      body { padding: 0; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="report-header">
      <div class="header-org">
        <div class="header-logo">
          <img src="https://mvco-iq.com/wp-content/uploads/2024/10/cropped-2color_logo.webp" alt="Logo" />
        </div>
        <div class="org-text">
          <h1>متابعة موقع الجندي المجهول</h1>
          <p>شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</p>
        </div>
      </div>
      <div class="header-meta">
        <div class="doc-title">تقرير أجور وشفتات العمال التفصيلي</div>
        <div class="meta-badge">وثيقة رسمية معتمدة</div><br/>
        <span style="font-size:8.5pt;color:#555;">تاريخ التصدير: <strong>${todayStr}</strong></span>
      </div>
    </div>

    <div class="info-bar">
      <div class="info-cell"><div class="lbl">إجمالي الأجور الكلية</div><div class="val">${totalWagesAmount.toLocaleString()} د.ع</div></div>
      <div class="info-cell"><div class="lbl">مجموع الشفتات</div><div class="val">${totalShiftsCount} شفت</div></div>
      <div class="info-cell"><div class="lbl">عدد السجلات</div><div class="val">${recordsCount} سجل</div></div>
      <div class="info-cell"><div class="lbl">متوسط سعر الشفت</div><div class="val">${avgShiftPrice.toLocaleString()} د.ع</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:5%;text-align:center;">#</th>
          <th style="width:12%;text-align:center;">التاريخ</th>
          <th style="width:25%;">فقرة العمل</th>
          <th style="width:15%;">العامل / الوجبة</th>
          <th style="width:10%;text-align:center;">الشفتات</th>
          <th style="width:13%;">سعر الشفت</th>
          <th style="width:13%;">الإجمالي</th>
          <th style="width:17%;">ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan="4">المجموع الكلي التراكمي</td>
          <td style="text-align:center;color:#059669;">${totalShiftsCount} شفت</td>
          <td>-</td>
          <td style="color:#059669;font-size:10pt;">${totalWagesAmount.toLocaleString()} د.ع</td>
          <td>-</td>
        </tr>
      </tfoot>
    </table>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-title">دائرة المهندس المقيم</div>
        <div class="sig-line">التوقيع والختم الرسمي</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">مسؤول جرد وأجور الموقع</div>
        <div class="sig-line">التوقيع والختم الرسمي</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">ممثل الجهة المستفيدة</div>
        <div class="sig-line">التوقيع والختم الرسمي</div>
      </div>
    </div>

    <div class="report-footer">
      <span>متابعة موقع الجندي المجهول &mdash; شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</span>
      <span>تاريخ الطباعة: ${todayStr} - ${timeStr}</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=950,height=1100');
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
        document.body.removeChild(printFrame);
      }, 15000);
    }
  };

  const calculatedTotal = (Number(formData.shifts_count) || 0) * (Number(formData.shift_price) || 0);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── Top Header Banner ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--accent-border)'
          }}>
            <Banknote size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--fg)' }}>
              قسم أجور وشفتات العمال
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--fg-2)' }}>
              تسجيل وأرشفة عدد الشفتات وسعر الشفت وتاريخ العمل وفقرة العمل مع إمكانية تصدير PDF و Excel
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={openAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.1rem',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px var(--accent-glow)'
            }}
          >
            <Plus size={18} />
            <span>إضافة سجل جديد</span>
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.95rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--fg)',
              fontWeight: 500,
              fontSize: '0.85rem',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={16} color="#10b981" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 0.95rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--fg)',
              fontWeight: 500,
              fontSize: '0.85rem',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <FileText size={16} color="#ef4444" />
            <span>تصدير PDF</span>
          </button>
        </div>
      </motion.div>

      {/* ── 4 KPI Cards Grid ───────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* Card 1: Total Amount */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'var(--surface)',
            padding: '1.2rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>إجمالي الأجور الكلية</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent)', marginTop: '0.2rem' }}>
              {totalWagesAmount.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>د.ع</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)', marginTop: '0.25rem', display: 'block' }}>دينار عراقي</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
        </motion.div>

        {/* Card 2: Total Shifts */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'var(--surface)',
            padding: '1.2rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>مجموع الشفتات</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--fg)', marginTop: '0.2rem' }}>
              {totalShiftsCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>شفت</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)', marginTop: '0.25rem', display: 'block' }}>شفت عمل</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
        </motion.div>

        {/* Card 3: Records Count */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'var(--surface)',
            padding: '1.2rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>عدد السجلات</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--fg)', marginTop: '0.2rem' }}>
              {recordsCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>سجل</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)', marginTop: '0.25rem', display: 'block' }}>عملية مسجلة</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
        </motion.div>

        {/* Card 4: Avg Shift Price */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'var(--surface)',
            padding: '1.2rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>متوسط سعر الشفت</span>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
              {avgShiftPrice.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>د.ع</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--fg-2)', marginTop: '0.25rem', display: 'block' }}>د.ع / شفت</span>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calculator size={22} />
          </div>
        </motion.div>
      </div>

      {/* ── Filters & Search Section ────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--surface)',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        {/* Search Bar */}
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="بحث (فقرة عمل، اسم عامل...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 2.2rem 0.55rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Date Filter: From */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>من:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* Date Filter: To */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>إلى:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {(searchTerm || startDate || endDate) && (
          <button
            onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            إلغاء الفلترة
          </button>
        )}
      </div>

      {/* ── Table Section ────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Banknote size={18} color="var(--accent)" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>
            سجل أجور العمال التفصيلي
          </h2>
          <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--muted)' }}>
            عرض {filteredWages.length} سجل
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.25)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>#</th>
                <th style={{ padding: '0.85rem 1rem' }}>التاريخ</th>
                <th style={{ padding: '0.85rem 1rem' }}>فقرة العمل</th>
                <th style={{ padding: '0.85rem 1rem' }}>العامل / الوجبة</th>
                <th style={{ padding: '0.85rem 1rem' }}>الشفتات</th>
                <th style={{ padding: '0.85rem 1rem' }}>سعر الشفت</th>
                <th style={{ padding: '0.85rem 1rem' }}>الإجمالي</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                    جاري تحميل سجل الأجور...
                  </td>
                </tr>
              ) : filteredWages.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                    لا توجد سجلات أجور مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredWages.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-soft)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, dir: 'ltr', textAlign: 'right' }}>{item.work_date}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--fg)' }}>
                      {item.work_item}
                      {item.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', fontWeight: 400 }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#60a5fa',
                        fontSize: '0.8rem',
                        fontWeight: 500
                      }}>
                        {item.worker_name || 'عمال ابو حيدر'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '20px',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        fontSize: '0.82rem'
                      }}>
                        {item.shifts_count} شفت
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                      {Number(item.shift_price)?.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>د.ع</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {Number(item.total_amount)?.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>د.ع</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          title="تعديل"
                          style={{
                            padding: '0.4rem',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="حذف"
                          style={{
                            padding: '0.4rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(0, 0, 0, 0.4)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} style={{ padding: '0.9rem 1rem', color: 'var(--fg)' }}>المجموع الكلي</td>
                <td style={{ padding: '0.9rem 1rem', color: 'var(--accent)' }}>{totalShiftsCount} شفت</td>
                <td style={{ padding: '0.9rem 1rem' }}>-</td>
                <td style={{ padding: '0.9rem 1rem', color: 'var(--accent)', fontSize: '1.05rem', fontWeight: 800 }}>
                  {totalWagesAmount.toLocaleString()} د.ع
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Wage Record Modal ──────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--surface-solid, #18181b)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '1.1rem 1.4rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Banknote size={20} color="var(--accent)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--fg)' }}>
                    {editingRecord ? 'تعديل سجل أجور' : 'إضافة سجل أجور جديد'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: '0.3rem'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Form Body */}
              <form onSubmit={handleSubmitForm} style={{ padding: '1.3rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                
                {/* 1. Work Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                    📅 تاريخ العمل <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.work_date}
                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* 2. Work Item & Quick Tag Pills */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                    🛠️ فقرة العمل <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اكتب فقرة العمل أو اختر من النماذج ادناه..."
                    value={formData.work_item}
                    onChange={(e) => setFormData({ ...formData, work_item: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg)',
                      fontSize: '0.9rem',
                      marginBottom: '0.5rem'
                    }}
                  />
                  {/* Quick Tag Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setFormData({ ...formData, work_item: tag })}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          background: formData.work_item === tag ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)',
                          color: formData.work_item === tag ? '#ffffff' : 'var(--fg-2)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Shifts Count & Shift Price */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                      ⏱️ عدد الشفتات <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={formData.shifts_count}
                      onChange={(e) => setFormData({ ...formData, shifts_count: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border)',
                        color: 'var(--fg)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                      💰 سعر الشفت د.ع <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      required
                      value={formData.shift_price}
                      onChange={(e) => setFormData({ ...formData, shift_price: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border)',
                        color: 'var(--fg)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>

                {/* 4. Calculated Total Display */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)' }}>
                    💵 الإجمالي المحسوب تلقائياً:
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent)' }}>
                    {calculatedTotal.toLocaleString()} د.ع
                  </span>
                </div>

                {/* 5. Worker Name / Group */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                    👷 اسم العامل / الوجبة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: عمال ابو حيدر"
                    value={formData.worker_name}
                    onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* 6. Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--fg)' }}>
                    📝 ملاحظات (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="أي ملاحظات إضافية عن موقع العمل أو التفاصيل..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border)',
                      color: 'var(--fg)',
                      fontSize: '0.9rem',
                      resize: 'none'
                    }}
                  />
                </div>

                {/* Modal Footer Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '0.6rem 1.1rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--fg)',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 1.25rem',
                      borderRadius: '8px',
                      background: 'var(--accent)',
                      color: '#ffffff',
                      fontWeight: 600,
                      border: 'none',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px var(--accent-glow)'
                    }}
                  >
                    <Check size={16} />
                    <span>{submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
