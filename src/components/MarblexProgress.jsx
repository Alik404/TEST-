import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, Plus, Printer, Search, Edit3, Trash2, CheckCircle2, 
  Clock, AlertCircle, X, Save, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react';

export default function MarblexProgress({ user, lang, t }) {
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [selectedZone, setSelectedZone] = useState('ALL'); // 'ALL' | 'Zone A' | 'Zone B1' | 'Zone B2' | 'Zone C'
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'منجز' | 'قيد التنفيذ' | 'غير مطبق'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    zone: 'Zone A',
    item_name: '',
    total_pieces: '',
    applied_pieces: '',
    total_steel: '',
    applied_steel: '',
    notes: '',
    status: 'auto'
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const zonesList = [
    { id: 'ALL', label: isAr ? 'جميع الزونات' : 'All Zones' },
    { id: 'Zone A', label: 'Zone A' },
    { id: 'Zone B1', label: 'Zone B1' },
    { id: 'Zone B2', label: 'Zone B2' },
    { id: 'Zone C', label: 'Zone C' },
  ];

  const statusList = [
    { id: 'ALL', label: isAr ? 'جميع الحالات' : 'All Statuses' },
    { id: 'منجز', label: isAr ? 'مطبق بالكامل (منجز)' : 'Completed', color: 'var(--success)' },
    { id: 'قيد التنفيذ', label: isAr ? 'قيد التنفيذ' : 'In Progress', color: 'var(--warning)' },
    { id: 'غير مطبق', label: isAr ? 'غير مطبق (متبقي)' : 'Remaining', color: 'var(--danger)' },
  ];

  // Fetch data
  const fetchMarblex = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/marblex');
      if (!res.ok) throw new Error(isAr ? 'فشل جلب بيانات الماربلكس.' : 'Failed to fetch marblex data.');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError(err.message || (isAr ? 'حدث خطأ في جلب البيانات.' : 'Error loading data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarblex();
  }, []);

  // Filtered list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesZone = selectedZone === 'ALL' || item.zone === selectedZone;
      const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        (item.item_name || '').toLowerCase().includes(q) || 
        (item.notes || '').toLowerCase().includes(q);
      return matchesZone && matchesStatus && matchesSearch;
    });
  }, [items, selectedZone, selectedStatus, searchQuery]);

  // Totals & KPI Metrics (computed dynamically from filtered items)
  const stats = useMemo(() => {
    const list = filteredItems;
    let totPieces = 0, appPieces = 0;
    let totSteel = 0, appSteel = 0;

    list.forEach(i => {
      totPieces += Number(i.total_pieces) || 0;
      appPieces += Number(i.applied_pieces) || 0;
      totSteel += Number(i.total_steel) || 0;
      appSteel += Number(i.applied_steel) || 0;
    });

    const piecesProg = totPieces > 0 ? parseFloat(((appPieces / totPieces) * 100).toFixed(2)) : 0;
    const steelProg = totSteel > 0 ? parseFloat(((appSteel / totSteel) * 100).toFixed(2)) : 0;
    const overallProg = parseFloat(((piecesProg + steelProg) / 2).toFixed(2));

    const completedCount = list.filter(i => i.status === 'منجز').length;
    const inProgressCount = list.filter(i => i.status === 'قيد التنفيذ').length;
    const remainingCount = list.filter(i => i.status === 'غير مطبق' || i.status === 'متبقي').length;

    return {
      count: list.length,
      totPieces,
      appPieces,
      remPieces: totPieces - appPieces,
      piecesProg,
      totSteel,
      appSteel,
      remSteel: totSteel - appSteel,
      steelProg,
      overallProg,
      completedCount,
      inProgressCount,
      remainingCount
    };
  }, [filteredItems]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      zone: selectedZone !== 'ALL' ? selectedZone : 'Zone A',
      item_name: '',
      total_pieces: '',
      applied_pieces: '',
      total_steel: '',
      applied_steel: '',
      notes: '',
      status: 'auto'
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      zone: item.zone,
      item_name: item.item_name,
      total_pieces: item.total_pieces,
      applied_pieces: item.applied_pieces,
      total_steel: item.total_steel,
      applied_steel: item.applied_steel,
      notes: item.notes || '',
      status: item.status || 'auto'
    });
    setIsModalOpen(true);
  };

  // Save (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        zone: formData.zone,
        item_name: formData.item_name.trim(),
        total_pieces: parseInt(formData.total_pieces, 10) || 0,
        applied_pieces: parseInt(formData.applied_pieces, 10) || 0,
        total_steel: parseInt(formData.total_steel, 10) || 0,
        applied_steel: parseInt(formData.applied_steel, 10) || 0,
        notes: formData.notes.trim(),
        status: formData.status === 'auto' ? undefined : formData.status,
        userName: user?.name || 'المهندس المقيم'
      };

      if (editingItem) {
        // PUT
        const res = await fetch(`/api/marblex/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(isAr ? 'فشل تعديل السجل.' : 'Failed to update record.');
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      } else {
        // POST
        const res = await fetch('/api/marblex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(isAr ? 'فشل إضافة السجل.' : 'Failed to create record.');
        const created = await res.json();
        setItems(prev => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id, name) => {
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف مقطع "${name}"؟` : `Are you sure you want to delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/marblex/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(isAr ? 'فشل حذف السجل.' : 'Failed to delete record.');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Printable PDF Generator
  const handleExportPDF = () => {
    const activeZoneLabel = zonesList.find(z => z.id === selectedZone)?.label || selectedZone;
    const activeStatusLabel = statusList.find(s => s.id === selectedStatus)?.label || selectedStatus;

    const rowsHTML = filteredItems.map((item, idx) => {
      const statusBg = item.status === 'منجز' ? '#dcfce7' : item.status === 'قيد التنفيذ' ? '#fef3c7' : '#fee2e2';
      const statusColor = item.status === 'منجز' ? '#166534' : item.status === 'قيد التنفيذ' ? '#92400e' : '#991b1b';

      return `
        <tr>
          <td style="text-align:center;font-weight:bold;">${idx + 1}</td>
          <td style="font-weight:bold;color:#0f172a;">${item.item_name}</td>
          <td style="text-align:center;"><span class="zone-badge">${item.zone}</span></td>
          <td style="text-align:center;">${item.total_pieces}</td>
          <td style="text-align:center;font-weight:bold;color:#059669;">${item.applied_pieces}</td>
          <td style="text-align:center;font-weight:bold;direction:ltr;">${item.pieces_progress || 0}%</td>
          <td style="text-align:center;">${item.total_steel}</td>
          <td style="text-align:center;font-weight:bold;color:#d97706;">${item.applied_steel}</td>
          <td style="text-align:center;font-weight:bold;direction:ltr;">${item.steel_progress || 0}%</td>
          <td style="text-align:center;font-weight:800;direction:ltr;background:#f8fafc;">${item.overall_progress || 0}%</td>
          <td style="text-align:center;">
            <span style="background:${statusBg};color:${statusColor};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">
              ${item.status}
            </span>
          </td>
          <td style="font-size:12px;color:#475569;">${item.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير تقدم أعمال الماربلكس - ${activeZoneLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 15mm 12mm 15mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; margin: 0; padding: 15px; color: #0f172a; background: #fff; font-size: 13px; }
    
    .report-header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
    .header-title h1 { margin: 0 0 4px 0; font-size: 20px; color: #0f172a; font-weight: 800; }
    .header-title h2 { margin: 0; font-size: 14px; color: #059669; font-weight: 700; }
    .header-meta { text-align: left; font-size: 11px; color: #475569; }
    
    .filter-tags { display: flex; gap: 10px; margin-bottom: 15px; }
    .filter-tag { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 600; }
    .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; }
    .kpi-sub { font-size: 11px; color: #059669; font-weight: 700; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: right; vertical-align: middle; }
    th { background-color: #0f172a; color: #ffffff; font-weight: 700; text-align: center; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .zone-badge { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }

    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; page-break-inside: avoid; }
    .sig-box { border-top: 1px dashed #94a3b8; padding-top: 10px; text-align: center; }
    .sig-title { font-weight: 700; color: #0f172a; margin-bottom: 25px; }
    .sig-line { font-size: 11px; color: #64748b; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="header-title">
      <h1>مشروع النصب التذكاري للجندي المجهول</h1>
      <h2>تقرير تقدم أعمال الماربلكس وستيلات التثبيت (Marblex Progress)</h2>
    </div>
    <div class="header-meta">
      <div><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-IQ')} ${new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</div>
      <div><strong>المهندس المسؤول:</strong> ${user?.name || 'المهندس المقيم'}</div>
    </div>
  </div>

  <div class="filter-tags">
    <div class="filter-tag"><strong>الزون:</strong> ${activeZoneLabel}</div>
    <div class="filter-tag"><strong>الحالة:</strong> ${activeStatusLabel}</div>
    <div class="filter-tag"><strong>عدد المقاطع:</strong> ${filteredItems.length} مقطع</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">إجمالي القطع المطبقة</div>
      <div class="kpi-value">${stats.appPieces} <span style="font-size:12px;font-weight:normal;color:#64748b;">/ ${stats.totPieces}</span></div>
      <div class="kpi-sub">نسبة إنجاز القطع: ${stats.piecesProg}%</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">إجمالي الستيلات المطبقة</div>
      <div class="kpi-value">${stats.appSteel} <span style="font-size:12px;font-weight:normal;color:#64748b;">/ ${stats.totSteel}</span></div>
      <div class="kpi-sub" style="color:#d97706;">نسبة إنجاز الستيلات: ${stats.steelProg}%</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">النسبة الكلية للماربلكس</div>
      <div class="kpi-value" style="color:#2563eb;">${stats.overallProg}%</div>
      <div class="kpi-sub" style="color:#475569;">المتوسط التراكمي للزون</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">حالة المقاطع</div>
      <div class="kpi-value" style="font-size:15px;">منجز: ${stats.completedCount} | قيد العمل: ${stats.inProgressCount}</div>
      <div class="kpi-sub" style="color:#dc2626;">المتبقي / غير مطبق: ${stats.remainingCount}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>المقطع / الجدار</th>
        <th style="width: 75px;">الزون</th>
        <th style="width: 75px;">القطع الكلية</th>
        <th style="width: 75px;">القطع المطبقة</th>
        <th style="width: 75px;">إنجاز القطع</th>
        <th style="width: 75px;">الستيل الكلي</th>
        <th style="width: 75px;">الستيل المطبق</th>
        <th style="width: 75px;">إنجاز الستيل</th>
        <th style="width: 80px;">النسبة الكلية</th>
        <th style="width: 95px;">الحالة</th>
        <th>الملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML || '<tr><td colspan="12" style="text-align:center;padding:20px;color:#94a3b8;">لا توجد سجلات تطابق الفلتر المختار</td></tr>'}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-title">مهندس الموقع الميداني</div>
      <div class="sig-line">التوقيع: .......................................</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">المهندس المقيم</div>
      <div class="sig-line">التوقيع: .......................................</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">دائرة المهندس المقيم / الإشراف</div>
      <div class="sig-line">التوقيع: .......................................</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=1100,height=850');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
    } else {
      alert(isAr ? 'يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.' : 'Please allow popups to print report.');
    }
  };

  return (
    <div className="tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Top Header & Actions ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Layers style={{ color: 'var(--accent)' }} size={28} />
            {isAr ? 'تقدم أعمال الماربلكس وستيلات التثبيت' : 'Marblex & Steel Work Progress'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isAr ? 'متابعة وإدخال كميات ونسب إنجاز قطع الماربلكس وبروفايلات الستيل حسب الزونات (A, B1, B2, C)' : 'Track and record quantities & progress of marblex and steel profiles across zones.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchMarblex} 
            className="btn btn-secondary" 
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
            style={{ padding: '0.6rem 0.85rem' }}
          >
            <RefreshCw size={17} className={loading ? 'spin-animation' : ''} />
          </button>

          <button 
            onClick={handleExportPDF} 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', fontWeight: '600' }}
          >
            <Printer size={18} />
            <span>{isAr ? 'استخراج PDF' : 'Export PDF'}</span>
          </button>

          {isAdmin && (
            <button 
              onClick={handleOpenCreate} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', fontWeight: '700' }}
            >
              <Plus size={18} />
              <span>{isAr ? 'إضافة مقطع جديد' : 'Add Section'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Bento KPI Summary Cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Marblex Pieces */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                {isAr ? 'القطع المطبقة / الكلية' : 'Applied / Total Pieces'}
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--fg)', marginTop: '0.35rem' }}>
                {stats.appPieces.toLocaleString()}
                <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: '500', marginRight: '0.4rem', marginLeft: '0.4rem' }}>
                  / {stats.totPieces.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'rgba(5, 150, 105, 0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
          </div>
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
              <span style={{ color: 'var(--accent)' }}>{stats.piecesProg}% {isAr ? 'منجز' : 'Done'}</span>
              <span style={{ color: 'var(--muted)' }}>{isAr ? 'متبقي:' : 'Rem:'} {stats.remPieces}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, stats.piecesProg)}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Steel Profiles */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                {isAr ? 'الستيلات المطبقة / الكلية' : 'Applied / Total Steel'}
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--fg)', marginTop: '0.35rem' }}>
                {stats.appSteel.toLocaleString()}
                <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: '500', marginRight: '0.4rem', marginLeft: '0.4rem' }}>
                  / {stats.totSteel.toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'rgba(217, 119, 6, 0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={22} />
            </div>
          </div>
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
              <span style={{ color: 'var(--warning)' }}>{stats.steelProg}% {isAr ? 'منجز' : 'Done'}</span>
              <span style={{ color: 'var(--muted)' }}>{isAr ? 'متبقي:' : 'Rem:'} {stats.remSteel}</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, stats.steelProg)}%`, height: '100%', background: 'var(--warning)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Overall Combined Progress */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(37,99,235,0.06) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                {isAr ? 'نسبة الإنجاز الكلية لأعمال الماربلكس' : 'Overall Marblex Progress'}
              </span>
              <div style={{ fontSize: '2.1rem', fontWeight: '900', color: 'var(--accent)', marginTop: '0.25rem', letterSpacing: '-0.5px' }}>
                {stats.overallProg}%
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
              <span className="badge badge-success" style={{ padding: '0.3rem 0.65rem' }}>
                {stats.completedCount} {isAr ? 'مقطع مكتمل' : 'Completed'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {isAr ? 'من أصل' : 'out of'} {stats.count} {isAr ? 'مقاطع' : 'sections'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, stats.overallProg)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #2563eb 100%)', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ─────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Row 1: Zone Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--muted)', marginLeft: isAr ? '0.5rem' : '0', marginRight: isAr ? '0' : '0.5rem' }}>
            {isAr ? 'الزونات:' : 'Zones:'}
          </span>
          {zonesList.map(z => (
            <button
              key={z.id}
              onClick={() => setSelectedZone(z.id)}
              className={`filter-btn ${selectedZone === z.id ? 'active' : ''}`}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid var(--border)',
                background: selectedZone === z.id ? 'var(--accent)' : 'var(--surface-warm)',
                color: selectedZone === z.id ? '#ffffff' : 'var(--fg)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Row 2: Status Pills + Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--muted)', marginLeft: isAr ? '0.5rem' : '0', marginRight: isAr ? '0' : '0.5rem' }}>
              {isAr ? 'الحالة:' : 'Status:'}
            </span>
            {statusList.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStatus(s.id)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  border: '1px solid var(--border)',
                  background: selectedStatus === s.id ? 'var(--fg)' : 'var(--surface-warm)',
                  color: selectedStatus === s.id ? 'var(--bg-1)' : 'var(--fg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: isAr ? '12px' : 'auto', left: isAr ? 'auto' : '12px', color: 'var(--muted)' }} />
            <input 
              type="text"
              placeholder={isAr ? 'بحث باسم المقطع أو الملاحظات...' : 'Search by section or notes...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{
                width: '100%',
                paddingRight: isAr ? '2.2rem' : '0.85rem',
                paddingLeft: isAr ? '0.85rem' : '2.2rem',
                paddingTop: '0.45rem',
                paddingBottom: '0.45rem',
                fontSize: '0.85rem',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Main Data Table ──────────────────────────────────────── */}
      <div className="table-responsive glass-panel" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-warm)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>#</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>{isAr ? 'المقطع / الجدار' : 'Section Name'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>{isAr ? 'الزون' : 'Zone'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'القطع المطبقة' : 'Pieces'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'إنجاز القطع' : 'Pieces %'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'الستيل المطبق' : 'Steel'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'إنجاز الستيل' : 'Steel %'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'النسبة الكلية' : 'Overall'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'الحالة' : 'Status'}</th>
              <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>{isAr ? 'الملاحظات' : 'Notes'}</th>
              {isAdmin && <th style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', padding: '3rem' }}>
                  <RefreshCw className="spin-animation" size={24} style={{ color: 'var(--accent)', margin: '0 auto 0.5rem auto' }} />
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{isAr ? 'جاري تحميل سجلات الماربلكس...' : 'Loading...'}</p>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                  <Layers size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>{isAr ? 'لا توجد سجلات تطابق الفلتر المختار' : 'No records found'}</p>
                  {isAdmin && (
                    <button onClick={handleOpenCreate} className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                      <Plus size={15} style={{ marginLeft: '0.35rem' }} />
                      {isAr ? 'إضافة مقطع جديد' : 'Add Section'}
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const statusColor = item.status === 'منجز' ? 'badge-success' : item.status === 'قيد التنفيذ' ? 'badge-warning' : 'badge-danger';
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: '600' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: '700', color: 'var(--fg)' }}>
                      {item.item_name}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', fontWeight: '700' }}>
                        {item.zone}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: '800', color: 'var(--accent)' }}>{item.applied_pieces}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}> / {item.total_pieces}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', width: '110px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--fg)', direction: 'ltr' }}>
                          {item.pieces_progress || 0}%
                        </span>
                        <div style={{ width: '100%', height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, item.pieces_progress || 0)}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: '800', color: 'var(--warning)' }}>{item.applied_steel}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}> / {item.total_steel}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', width: '110px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--fg)', direction: 'ltr' }}>
                          {item.steel_progress || 0}%
                        </span>
                        <div style={{ width: '100%', height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, item.steel_progress || 0)}%`, height: '100%', background: 'var(--warning)' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: '900', fontSize: '0.95rem', color: (item.overall_progress || 0) >= 100 ? 'var(--accent)' : 'var(--fg)', direction: 'ltr', display: 'inline-block' }}>
                        {item.overall_progress || 0}%
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span className={`badge ${statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '200px' }}>
                      {item.notes || '-'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.6rem', color: 'var(--accent)' }}
                            title={isAr ? 'تعديل' : 'Edit'}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.item_name)}
                            className="btn btn-secondary"
                            disabled={deletingId === item.id}
                            style={{ padding: '0.35rem 0.6rem', color: 'var(--danger)' }}
                            title={isAr ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(5px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
            onClick={() => !saving && setIsModalOpen(false)}
          >
            <motion.div
              className="glass-panel"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              style={{
                background: 'var(--surface-solid)',
                borderRadius: 'var(--radius-xl)',
                width: '100%',
                maxWidth: '560px',
                padding: '1.75rem',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers style={{ color: 'var(--accent)' }} size={22} />
                  {editingItem 
                    ? (isAr ? 'تعديل مقطع ماربلكس' : 'Edit Marblex Section')
                    : (isAr ? 'إضافة مقطع ماربلكس جديد' : 'New Marblex Section')
                  }
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={saving}
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Zone & Section Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                      {isAr ? 'الزون *' : 'Zone *'}
                    </label>
                    <select
                      className="input-field"
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                    >
                      <option value="Zone A">Zone A</option>
                      <option value="Zone B1">Zone B1</option>
                      <option value="Zone B2">Zone B2</option>
                      <option value="Zone C">Zone C</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                      {isAr ? 'اسم المقطع / الجدار *' : 'Section Name *'}
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={isAr ? 'مثال: جدار الواجهة A-1' : 'e.g. Front Wall A-1'}
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                {/* Marble Pieces (Total & Applied) */}
                <div style={{ background: 'var(--surface-warm)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--accent)', display: 'block', marginBottom: '0.5rem' }}>
                    {isAr ? 'أعمال قطع الماربلكس' : 'Marblex Pieces'}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                        {isAr ? 'مجموع القطع المراد تطبيقها' : 'Total Pieces'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.total_pieces}
                        onChange={(e) => setFormData({ ...formData, total_pieces: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                        {isAr ? 'عدد القطع المطبقة فعلياً' : 'Applied Pieces'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.applied_pieces}
                        onChange={(e) => setFormData({ ...formData, applied_pieces: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Steel Profiles (Total & Applied) */}
                <div style={{ background: 'var(--surface-warm)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--warning)', display: 'block', marginBottom: '0.5rem' }}>
                    {isAr ? 'أعمال بروفايلات الستيل' : 'Steel Profiles'}
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                        {isAr ? 'مجموع الستيلات المراد تطبيقها' : 'Total Steel'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.total_steel}
                        onChange={(e) => setFormData({ ...formData, total_steel: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                        {isAr ? 'عدد الستيلات المطبقة فعلياً' : 'Applied Steel'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.applied_steel}
                        onChange={(e) => setFormData({ ...formData, applied_steel: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Status selection override (optional) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                    {isAr ? 'حالة المقطع' : 'Status'}
                  </label>
                  <select
                    className="input-field"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                  >
                    <option value="auto">{isAr ? 'تحديد تلقائي (حسب النسبة المئوية)' : 'Auto calculate'}</option>
                    <option value="منجز">{isAr ? 'منجز بالكامل' : 'Completed'}</option>
                    <option value="قيد التنفيذ">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
                    <option value="غير مطبق">{isAr ? 'غير مطبق / متبقي' : 'Remaining'}</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--muted)', marginBottom: '0.35rem' }}>
                    {isAr ? 'ملاحظات هندسية' : 'Notes'}
                  </label>
                  <textarea
                    rows={2}
                    className="input-field"
                    placeholder={isAr ? 'ملاحظات فنية أو موضعية...' : 'Site technical notes...'}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-md)', resize: 'vertical' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                    className="btn btn-secondary"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}
                  >
                    <Save size={16} />
                    <span>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ السجل' : 'Save Record')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
