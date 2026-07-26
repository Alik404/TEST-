import React, { useState, useEffect } from 'react';
import { Plus, FileText, Printer, Eye, Pencil, Trash2, Search, Calendar, ChevronRight } from 'lucide-react';

const EMPTY_FORM = {
  // Right Column fields
  site_name: 'موقع الجندي المجهول',
  tech_name: '',
  receipt_date: new Date().toISOString().split('T')[0],
  receipt_voucher: '',
  receipt_type: 'جزئي',
  measuring_unit: '',
  start_date: '',

  // Middle Column fields
  supervisor: '',
  has_contract: 'لا',
  work_type: '',
  has_blueprints: 'نعم',
  daily_staff_rate: '',
  unit_price: '',
  expected_end_date: '',

  // Section 1: Performance Criteria (9 exact items from the paper)
  performance: [
    { criteria: 'الالتزام بالتشغيل أثناء وبعد العمل', rating: 'جيد', notes: '' },
    { criteria: 'الالتزام بالعمل ضمن المخططات',       rating: 'جيد', notes: '' },
    { criteria: 'المحافظة على المواد المستلمة',       rating: 'جيد', notes: '' },
    { criteria: 'حالة المخزن',                         rating: 'جيد', notes: '' },
    { criteria: 'مدى التفاهم بين الفني وفريق الإشراف', rating: 'جيد', notes: '' },
    { criteria: 'عدد الكوادر مقارنة بحجم العمل',      rating: 'جيد', notes: '' },
    { criteria: 'الالتزام بشروط السلامة',              rating: 'جيد', notes: '' },
    { criteria: 'وقت طلب المواد',                      rating: 'جيد', notes: '' },
    { criteria: 'سرعة سير العمل',                     rating: 'جيد', notes: '' },
  ],
  materials: [
    { name: 'مرمر',  received: '', prepared: '', consumed: '', notes: '' },
    { name: 'رمل',   received: '', prepared: '', consumed: '', notes: '' },
    { name: 'اسمنت', received: '', prepared: '', consumed: '', notes: '' },
    { name: '',      received: '', prepared: '', consumed: '', notes: '' },
  ],
  quantities: [
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
    { paragraph: '', zone: '', unit: '', price: '', qty: '', notes: '' },
  ],
  total_notes: '',
  resolved_notes: '',
  unresolved_notes: '',
  last_memo_date: '',
  partial_or_final: 'جزئي',
  previous_advances: '',
  remaining_balance: '',
};

const RC = { 'جيد': '#059669', 'متوسط': '#d97706', 'ضعيف': '#dc2626' };

function RatingBadge({ value, onChange, readOnly }) {
  if (readOnly)
    return <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: (RC[value]||'#333')+'22', color: RC[value]||'#333', border: `1px solid ${(RC[value]||'#333')}44` }}>{value}</span>;
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ border: `1.5px solid ${RC[value]}`, borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: RC[value], background: RC[value]+'11', cursor: 'pointer' }}>
      {['جيد','متوسط','ضعيف'].map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

function SecHead({ label, color = '#1d4ed8' }) {
  return <div style={{ fontWeight: 800, fontSize: '0.98rem', padding: '0.5rem 0.9rem', borderRadius: 6, margin: '1.2rem 0 0.65rem', borderRight: `4px solid ${color}`, background: color+'11', color }}>{label}</div>;
}

function FRow({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--muted)' }}>{label}</label>{children}</div>;
}

const IS = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.42rem 0.6rem', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.84rem' };
const SS = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, padding: '0.32rem 0.45rem', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.8rem' };

export default function WeeklyAdvance({ user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetch_ = async () => {
    setLoading(true);
    try { const r = await fetch('/api/weekly-advance'); if (r.ok) setRecords(await r.json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetch_(); }, []);

  const setField = (path, val) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let ref = next;
      for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
      ref[parts[parts.length - 1]] = val;
      return next;
    });
  };

  const cumTotal = (f = form) => (f.quantities||[]).reduce((s, r) => s + (parseFloat(r.price)||0)*(parseFloat(r.qty)||0), 0);
  const pct70   = (f = form) => Math.round(cumTotal(f) * 0.7);
  const curAdv  = (f = form) => Math.max(0, pct70(f) - (parseFloat(f.previous_advances)||0));

  const openNew  = () => { setForm(EMPTY_FORM); setEditingId(null); setViewMode('form'); };
  const openEdit = r => { const d = typeof r.data==='string'?JSON.parse(r.data):(r.data||{}); setForm({...EMPTY_FORM,...d}); setEditingId(r.id); setViewMode('form'); };
  const openView = r => { const d = typeof r.data==='string'?JSON.parse(r.data):(r.data||{}); setForm({...EMPTY_FORM,...d}); setViewingId(r.id); setViewMode('view'); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { receipt_date: form.receipt_date, team_leader: form.team_leader, site_name: form.site_name, team_number: form.team_number, data: JSON.stringify(form) };
      const res = await fetch(editingId?`/api/weekly-advance/${editingId}`:'/api/weekly-advance', { method: editingId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('فشل الحفظ');
      await fetch_(); setViewMode('list');
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async id => {
    try { await fetch(`/api/weekly-advance/${id}`,{method:'DELETE'}); await fetch_(); setDeleteConfirm(null); }
    catch { alert('فشل الحذف'); }
  };

  const handlePDF = (rec) => {
    const raw = rec ? (typeof rec.data === 'string' ? JSON.parse(rec.data) : (rec.data || {})) : form;
    const f = { ...EMPTY_FORM, ...raw };
    const ct = cumTotal(f), p70 = pct70(f), ca = curAdv(f);

    const perfR = f.performance.map((p, i) => `<tr>
      <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${i + 1}</td>
      <td style="font-weight:600;border:1px solid #1a1a2e;text-align:right;">${p.criteria}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;font-weight:700;">${p.rating === 'جيد' ? '✓' : ''}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;font-weight:700;">${p.rating === 'متوسط' ? '✓' : ''}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;font-weight:700;">${p.rating === 'ضعيف' ? '✓' : ''}</td>
      <td style="font-size:8pt;border:1px solid #1a1a2e;">${p.notes || ''}</td>
    </tr>`).join('');

    const matR = f.materials.map((m, i) => `<tr>
      <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${i + 1}</td>
      <td style="font-weight:700;border:1px solid #1a1a2e;text-align:right;">${m.name || ''}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;">${m.consumed || ''}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;">${m.prepared || ''}</td>
      <td style="text-align:center;border:1px solid #1a1a2e;">${m.received || ''}</td>
      <td style="font-size:8pt;border:1px solid #1a1a2e;">${m.notes || ''}</td>
    </tr>`).join('');

    const qtyR = f.quantities.map((q, i) => {
      const amt = (parseFloat(q.price) || 0) * (parseFloat(q.qty) || 0);
      return `<tr>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${i + 1}</td>
        <td style="font-weight:700;border:1px solid #1a1a2e;text-align:right;">${q.paragraph || ''}</td>
        <td style="text-align:center;border:1px solid #1a1a2e;">${q.zone || ''}</td>
        <td style="text-align:center;border:1px solid #1a1a2e;">${q.unit || ''}</td>
        <td style="text-align:center;border:1px solid #1a1a2e;direction:ltr;">${q.price ? Number(q.price).toLocaleString() : ''}</td>
        <td style="text-align:center;border:1px solid #1a1a2e;">${q.qty || ''}</td>
        <td style="font-weight:700;border:1px solid #1a1a2e;text-align:center;direction:ltr;">${amt ? amt.toLocaleString() : ''}</td>
        <td style="font-size:8pt;border:1px solid #1a1a2e;">${q.notes || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>قائمة استلام الأعمال وإطلاق المبالغ</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif;}
body{background:#fff;color:#000;font-size:8.5pt;direction:rtl;}
.page{width:210mm;height:297mm;margin:0 auto;padding:4mm 6mm;background:#fff;display:flex;flex-direction:column;justify-between;}

/* Header Box */
.header-box{background:#4a90e2;color:#000;border:1.5px solid #1a1a2e;text-align:center;padding:4px;margin-bottom:0;}
.header-title{font-size:11pt;font-weight:800;}
.header-sub{font-size:8.5pt;font-weight:700;}

/* Top Info Grid */
.info-table{width:100%;border-collapse:collapse;border:1.5px solid #1a1a2e;margin-bottom:4px;}
.info-table td{border:1px solid #1a1a2e;padding:3px 6px;font-size:8pt;}
.info-lbl{background:#e8f0fe;font-weight:700;width:15%;color:#000;}
.info-val{width:35%;font-weight:700;color:#000;}

/* Section Headers */
.sec-hdr{border:1.5px solid #1a1a2e;border-bottom:none;text-align:center;font-weight:800;font-size:9.5pt;padding:3px;color:#000;}
.sec-hdr.blue{background:#7db3e4;}
.sec-hdr.yellow{background:#e6c666;}
.sec-hdr.gold{background:#d6b656;}
.sec-hdr.green{background:#81c784;}

/* Data Tables */
table.data-tbl{width:100%;border-collapse:collapse;border:1.5px solid #1a1a2e;margin-bottom:4px;font-size:8pt;}
table.data-tbl th{background:#fff;border:1px solid #1a1a2e;padding:3px;font-size:7.5pt;font-weight:800;text-align:center;color:#000;}
table.data-tbl td{border:1px solid #1a1a2e;padding:3px;vertical-align:middle;color:#000;}
table.data-tbl tfoot td{font-weight:800;background:#fff;}

/* Financial Summary & Bottom */
.bottom-container{display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px;}
.fin-box{width:42%;border:1.5px solid #1a1a2e;border-collapse:collapse;margin-right:auto;}
.fin-box td{border:1px solid #1a1a2e;padding:3px 6px;font-size:8.5pt;}
.fin-lbl{background:#fff;font-weight:700;width:60%;}
.fin-val{font-weight:800;text-align:center;width:40%;}

.sigs-row{display:flex;justify-content:space-between;width:100%;margin-top:18px;padding:0 20px;}
.sig-item{font-size:9.5pt;font-weight:800;text-align:center;width:28%;}

@media print{
  body{margin:0;}
  .page{width:100%;height:100vh;padding:4mm 6mm;}
  @page{size:A4;margin:0;}
}
</style>
</head>
<body>
<div class="page">

  <!-- Header Title -->
  <div class="header-box">
    <div class="header-title">قائمة استلام الأعمال وإطلاق المبالغ</div>
    <div class="header-sub">( ترسل قبل 24 ساعة للحسابات بعد توقيع رئيس الفريق )</div>
  </div>

  <!-- Top Info Table -->
  <table class="info-table">
    <tr>
      <td class="info-lbl">اسم الموقع</td>
      <td class="info-val">${f.site_name || ''}</td>
      <td class="info-lbl">مشرف الموقع</td>
      <td class="info-val">${f.supervisor || ''}</td>
    </tr>
    <tr>
      <td class="info-lbl">اسم الفني</td>
      <td class="info-val">${f.tech_name || ''}</td>
      <td class="info-lbl">هل يوجد عقد عمل ؟</td>
      <td class="info-val">${f.has_contract || 'لا'}</td>
    </tr>
    <tr>
      <td class="info-lbl">التاريخ</td>
      <td class="info-val">${f.receipt_date || ''}</td>
      <td class="info-lbl">نوع العمل</td>
      <td class="info-val">${f.work_type || ''}</td>
    </tr>
    <tr>
      <td class="info-lbl">رقم وصل الاستلام (الحسابات)</td>
      <td class="info-val">${f.receipt_voucher || ''}</td>
      <td class="info-lbl">هل توجد مخططات</td>
      <td class="info-val">${f.has_blueprints || 'نعم'}</td>
    </tr>
    <tr>
      <td class="info-lbl">نوع الاستلام</td>
      <td class="info-val">
        جزئي [ ${f.receipt_type === 'جزئي' ? '✓' : '&nbsp;&nbsp;'} ] &nbsp;&nbsp;&nbsp;&nbsp;
        نهائي [ ${f.receipt_type === 'نهائي' ? '✓' : '&nbsp;&nbsp;'} ]
      </td>
      <td class="info-lbl">معدل الكوادر اليومي</td>
      <td class="info-val">${f.daily_staff_rate || ''}</td>
    </tr>
    <tr>
      <td class="info-lbl">وحدة القياس</td>
      <td class="info-val">${f.measuring_unit || ''}</td>
      <td class="info-lbl">سعر الوحدة</td>
      <td class="info-val">${f.unit_price || ''}</td>
    </tr>
    <tr>
      <td class="info-lbl">تاريخ البدء بالعمل</td>
      <td class="info-val">${f.start_date || ''}</td>
      <td class="info-lbl">تاريخ الانتهاء المتوقع</td>
      <td class="info-val">${f.expected_end_date || ''}</td>
    </tr>
  </table>

  <!-- Section 1: Performance -->
  <div class="sec-hdr blue">تقييم الأداء</div>
  <table class="data-tbl">
    <thead>
      <tr>
        <th style="width:4%;">ت</th>
        <th style="width:45%;">المعايير</th>
        <th style="width:12%;">جيد</th>
        <th style="width:12%;">متوسط</th>
        <th style="width:12%;">ضعيف</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>${perfR}</tbody>
  </table>

  <!-- Section 2: Materials -->
  <div class="sec-hdr yellow">كمية المواد المستهلكة</div>
  <table class="data-tbl">
    <thead>
      <tr>
        <th style="width:4%;">ت</th>
        <th style="width:35%;">الفقرة</th>
        <th style="width:15%;">الكمية المنفذة</th>
        <th style="width:15%;">الكمية المجهزة</th>
        <th style="width:15%;">الكمية المتبقية</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>${matR}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:left;font-weight:700;border:1px solid #1a1a2e;padding-left:15px;">توقيع المعاون الإداري</td>
        <td colspan="2" style="border:1px solid #1a1a2e;"></td>
      </tr>
    </tfoot>
  </table>

  <!-- Section 3: Completed Quantities -->
  <div class="sec-hdr gold">الكمية المنجزة التراكمية الكلية من بداية العمل</div>
  <table class="data-tbl">
    <thead>
      <tr>
        <th style="width:4%;">ت</th>
        <th style="width:30%;">الفقرة</th>
        <th style="width:12%;">رقم التطبيق</th>
        <th style="width:12%;">وحدة القياس</th>
        <th style="width:12%;">السعر</th>
        <th style="width:8%;">العدد</th>
        <th style="width:14%;">مجموع المبلغ الكلي<br/>(بدون خصم الـ 70% )</th>
        <th>الملاحظات</th>
      </tr>
    </thead>
    <tbody>${qtyR}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-align:right;font-weight:800;border:1px solid #1a1a2e;">المجموع التراكمي الكلي (بدون خصم الـ 70% )</td>
        <td style="text-align:center;font-weight:800;direction:ltr;border:1px solid #1a1a2e;">${ct ? ct.toLocaleString() : ''}</td>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">توقيع المعاون الفني</td>
      </tr>
    </tfoot>
  </table>

  <!-- Section 4: Site Notes -->
  <div class="sec-hdr green">ملاحظات الموقع</div>
  <table class="data-tbl">
    <thead>
      <tr>
        <th style="width:20%;">عدد الملاحظات التراكمي</th>
        <th style="width:20%;">عدد الملاحظات المنجزة</th>
        <th style="width:20%;">عدد الملاحظات غير المنجزة</th>
        <th style="width:20%;">تاريخ آخر استلام</th>
        <th>نوعه</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${f.total_notes || ''}</td>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${f.resolved_notes || ''}</td>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">${f.unresolved_notes || ''}</td>
        <td style="text-align:center;border:1px solid #1a1a2e;">${f.last_memo_date || ''}</td>
        <td style="text-align:center;font-weight:700;border:1px solid #1a1a2e;">
          جزئي [ ${f.partial_or_final === 'جزئي' ? '✓' : '&nbsp;&nbsp;'} ] &nbsp;&nbsp;
          نهائي [ ${f.partial_or_final === 'نهائي' ? '✓' : '&nbsp;&nbsp;'} ]
        </td>
      </tr>
      <tr>
        <td colspan="2" style="font-size:7.5pt;font-weight:700;text-align:center;border:1px solid #1a1a2e;">(تملى من قبل PMO)</td>
        <td style="font-size:7.5pt;font-weight:700;text-align:center;border:1px solid #1a1a2e;">توقيع مسؤول المتابعة</td>
        <td colspan="2" style="border:1px solid #1a1a2e;"></td>
      </tr>
    </tbody>
  </table>

  <!-- Financial Box (Bottom Left Table) -->
  <div style="display:flex;justify-content:flex-end;margin-top:4px;">
    <table class="fin-box">
      <tr>
        <td class="fin-lbl">70% من المجموع الكلي التراكمي</td>
        <td class="fin-val" style="direction:ltr;">${p70 ? p70.toLocaleString() : ''}</td>
      </tr>
      <tr>
        <td class="fin-lbl">مجموع المبالغ المستلمة سابقاً</td>
        <td class="fin-val" style="direction:ltr;">${f.previous_advances ? Number(f.previous_advances).toLocaleString() : ''}</td>
      </tr>
      <tr>
        <td class="fin-lbl">مبلغ السلفة المستحق</td>
        <td class="fin-val" style="direction:ltr;font-weight:800;">${ca ? ca.toLocaleString() : ''}</td>
      </tr>
      <tr>
        <td class="fin-lbl">المبلغ المتبقي</td>
        <td class="fin-val" style="direction:ltr;">${f.remaining_balance ? Number(f.remaining_balance).toLocaleString() : ''}</td>
      </tr>
    </table>
  </div>

  <!-- Signatures -->
  <div class="sigs-row">
    <div class="sig-item">مشرف الموقع</div>
    <div class="sig-item">المعاون الفني</div>
    <div class="sig-item">رئيس الفريق</div>
  </div>

</div>
<script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=1150');
    if (win) { win.document.open(); win.document.write(html); win.document.close(); }
  };

  const filtered = records.filter(r => !search || (r.tech_name||'').includes(search)||(r.site_name||'').includes(search)||(r.receipt_date||'').includes(search)||(r.work_type||'').includes(search));

  if (viewMode === 'list') return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', gap:'1rem', flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--text)', margin:0 }}>📋 تسمية السلفة الأسبوعية</h1>
          <p style={{ color:'var(--muted)', fontSize:'0.84rem', marginTop:4 }}>قائمة استلام الأعمال وإطلاق المبالغ (ترسل قبل 24 ساعة للحسابات)</p>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث..." style={{ ...IS, paddingRight:'2rem', width:200 }} />
          </div>
          {isAdmin && <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:8, padding:'0.6rem 1.2rem', background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:'0.9rem', fontWeight:700, cursor:'pointer' }}><Plus size={17}/> إضافة قائمة جديدة</button>}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[{label:'إجمالي القوائم',value:records.length,color:'#1d4ed8'},{label:'هذا الشهر',value:records.filter(r=>r.receipt_date?.startsWith(new Date().toISOString().slice(0,7))).length,color:'#059669'}].map((k,i)=>(
          <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.25rem' }}>
            <div style={{ fontSize:'0.8rem', color:'var(--muted)', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:'1.8rem', fontWeight:800, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>
      {loading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>جارٍ التحميل...</div>
        : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'4rem', color:'var(--muted)', background:'var(--surface)', borderRadius:12 }}>
            <FileText size={40} style={{ marginBottom:12, opacity:0.4 }}/><p>لا توجد قوائم مسجلة بعد</p>
            {isAdmin && <button onClick={openNew} style={{ marginTop:12, padding:'0.5rem 1rem', background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>+ إضافة أولى قائمة</button>}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {filtered.map(rec=>(
              <div key={rec.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>الفني: {rec.tech_name || '—'}</span>
                    <span style={{ background:'#1d4ed822', color:'#1d4ed8', borderRadius:4, padding:'1px 8px', fontSize:'0.78rem', fontWeight:700 }}>{rec.work_type || 'عمل ميداني'}</span>
                  </div>
                  <div style={{ display:'flex', gap:14, color:'var(--muted)', fontSize:'0.82rem', alignItems:'center' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}><Calendar size={12}/> {rec.receipt_date}</span>
                    <span>{rec.site_name}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  {[
                    {label:'عرض',icon:Eye,color:'#1d4ed8',action:()=>openView(rec)},
                    {label:'PDF',icon:Printer,color:'#059669',action:()=>handlePDF(rec)},
                    ...(isAdmin?[{label:'تعديل',icon:Pencil,color:'#d97706',action:()=>openEdit(rec)},{label:'',icon:Trash2,color:'#dc2626',action:()=>setDeleteConfirm(rec.id)}]:[])
                  ].map((btn,i)=>(
                    <button key={i} onClick={btn.action} style={{ background:btn.color+'11', color:btn.color, border:'none', borderRadius:8, padding:'0.45rem 0.7rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'inherit', fontWeight:700, fontSize:'0.82rem' }}>
                      <btn.icon size={14}/> {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--surface)', borderRadius:16, padding:'2rem', maxWidth:340, width:'90%', textAlign:'center' }}>
            <Trash2 size={36} style={{ color:'#dc2626', marginBottom:12 }}/><h3 style={{ margin:'0 0 8px', color:'var(--text)' }}>تأكيد الحذف</h3>
            <p style={{ color:'var(--muted)', marginBottom:20 }}>هل أنت متأكد من حذف هذه القائمة؟</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setDeleteConfirm(null)} style={{ padding:'0.5rem 1.5rem', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontFamily:'inherit' }}>إلغاء</button>
              <button onClick={()=>handleDelete(deleteConfirm)} style={{ padding:'0.5rem 1.5rem', borderRadius:8, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══ FORM / VIEW ══════════════════════════════════════════════════════════
  const readOnly = viewMode === 'view';
  const ct = cumTotal(), p70v = pct70(), cav = curAdv();

  const renderInput = (path, placeholder = '', type = 'text') => {
    const val = path.split('.').reduce((o, k) => o?.[k], form) ?? '';
    return readOnly ? (
      <span style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--text)' }}>{val || '—'}</span>
    ) : (
      <input
        type={type}
        placeholder={placeholder}
        value={val}
        onChange={(e) => setField(path, e.target.value)}
        style={IS}
      />
    );
  };

  const renderSelect = (path, options) => {
    const val = path.split('.').reduce((o, k) => o?.[k], form) ?? '';
    return readOnly ? (
      <span style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--text)' }}>{val || '—'}</span>
    ) : (
      <select value={val} onChange={(e) => setField(path, e.target.value)} style={IS}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div style={{ padding:'1.5rem', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.2rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={()=>setViewMode('list')} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'inherit', fontSize:'0.85rem' }}>القوائم <ChevronRight size={14}/></button>
          <h2 style={{ margin:0, fontSize:'1.15rem', fontWeight:800, color:'var(--text)' }}>{readOnly?'📄 عرض القائمة':(editingId?'✏️ تعديل':'+  إنشاء قائمة جديدة')}</h2>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={()=>handlePDF(null)} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.5rem 1.1rem', background:'#05966911', color:'#059669', border:'1px solid #05966933', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:'0.85rem' }}><Printer size={15}/> طباعة PDF (A4)</button>
          {!readOnly && <button onClick={handleSave} disabled={saving} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.5rem 1.25rem', background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', fontWeight:700, fontSize:'0.9rem', opacity:saving?0.7:1 }}>{saving?'...':'💾 حفظ'}</button>}
          {readOnly && isAdmin && <button onClick={()=>{setViewMode('form');setEditingId(viewingId);}} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.5rem 1.1rem', background:'#d9770611', color:'#d97706', border:'1px solid #d9770633', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:'0.85rem' }}><Pencil size={15}/> تعديل</button>}
        </div>
      </div>

      {/* Header Info */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <SecHead label="بيانات قائمة استلام الأعمال وإطلاق المبالغ" color="#1a1a2e"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0.7rem' }}>
          <FRow label="اسم الموقع">{renderInput('site_name', 'اسم الموقع')}</FRow>
          <FRow label="اسم الفني">{renderInput('tech_name', 'اسم الفني / ولد موسى / ابو حيدر')}</FRow>
          <FRow label="التاريخ">{renderInput('receipt_date', '', 'date')}</FRow>
          <FRow label="رقم وصل الاستلام (الحسابات)">{renderInput('receipt_voucher', 'رقم الوصل')}</FRow>
          <FRow label="نوع الاستلام">{renderSelect('receipt_type', ['جزئي', 'نهائي'])}</FRow>
          <FRow label="وحدة القياس">{renderInput('measuring_unit', 'مثال: قطعة / م2')}</FRow>
          <FRow label="تاريخ البدء بالعمل">{renderInput('start_date', '', 'date')}</FRow>

          <FRow label="مشرف الموقع">{renderInput('supervisor', 'اسم المشرف / م. علي مناف')}</FRow>
          <FRow label="هل يوجد عقد عمل ؟">{renderSelect('has_contract', ['نعم', 'لا'])}</FRow>
          <FRow label="نوع العمل">{renderInput('work_type', 'مثال: تطبيق أرضيات -B-')}</FRow>
          <FRow label="هل توجد مخططات">{renderSelect('has_blueprints', ['نعم', 'لا', 'لا حاجة للمخططات'])}</FRow>
          <FRow label="معدل الكوادر اليومي">{renderInput('daily_staff_rate', 'معدل الكوادر')}</FRow>
          <FRow label="سعر الوحدة">{renderInput('unit_price', 'سعر الوحدة')}</FRow>
          <FRow label="تاريخ الانتهاء المتوقع">{renderInput('expected_end_date', '', 'date')}</FRow>
        </div>
      </div>

      {/* Performance */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <SecHead label="تقييم الأداء الميداني" color="#1d4ed8"/>
        <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
          <thead><tr style={{ background:'var(--bg-2)' }}>
            {['#','المعيار','التقييم','ملاحظات'].map(h=><th key={h} style={{ padding:'0.55rem 0.5rem', borderBottom:'2px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--muted)', fontSize:'0.8rem' }}>{h}</th>)}
          </tr></thead>
          <tbody>{form.performance.map((p,i)=>(
            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'0.5rem', color:'var(--muted)', fontWeight:700, width:28 }}>{i+1}</td>
              <td style={{ padding:'0.5rem', fontWeight:600, color:'var(--text)' }}>{p.criteria}</td>
              <td style={{ padding:'0.45rem 0.5rem', width:120 }}><RatingBadge value={p.rating} readOnly={readOnly} onChange={v=>setField(`performance.${i}.rating`,v)}/></td>
              <td style={{ padding:'0.4rem 0.5rem' }}>{readOnly?<span style={{ color:'var(--muted)', fontSize:'0.82rem' }}>{p.notes||'—'}</span>:<input value={p.notes||''} onChange={e=>setField(`performance.${i}.notes`,e.target.value)} placeholder="ملاحظة..." style={SS}/>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {/* Materials */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <SecHead label="كمية المواد المستهلكة" color="#059669"/>
        <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
          <thead><tr style={{ background:'var(--bg-2)' }}>
            {['#','المادة','المستلمة','المجهزة','المنتهية','ملاحظات'].map(h=><th key={h} style={{ padding:'0.55rem 0.5rem', borderBottom:'2px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--muted)', fontSize:'0.8rem' }}>{h}</th>)}
          </tr></thead>
          <tbody>{form.materials.map((m,i)=>(
            <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'0.45rem', color:'var(--muted)', fontWeight:700, width:28 }}>{i+1}</td>
              {['name','received','prepared','consumed','notes'].map(field=>(
                <td key={field} style={{ padding:'0.35rem 0.45rem' }}>
                  {readOnly?<span style={{ color:'var(--text)', fontWeight:field==='name'?700:400 }}>{m[field]||'—'}</span>
                    :<input value={m[field]||''} onChange={e=>setField(`materials.${i}.${field}`,e.target.value)} placeholder={field==='name'?'اسم المادة':''} style={SS}/>}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table></div>
      </div>

      {/* Quantities */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <SecHead label="الكمية المنجزة التراكمية الكلية من بداية العمل" color="#d97706"/>
        <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
          <thead><tr style={{ background:'var(--bg-2)' }}>
            {['#','فقرة العمل','رقم التطبيق','وحدة القياس','السعر','الكمية','الإجمالي','ملاحظات'].map(h=>(
              <th key={h} style={{ padding:'0.55rem 0.45rem', borderBottom:'2px solid var(--border)', textAlign:'right', fontWeight:700, color:'var(--muted)', fontSize:'0.78rem' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{form.quantities.map((q,i)=>{
            const amt=(parseFloat(q.price)||0)*(parseFloat(q.qty)||0);
            return (
              <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                <td style={{ padding:'0.45rem', color:'var(--muted)', fontWeight:700, width:28 }}>{i+1}</td>
                {['paragraph','zone','unit','price','qty'].map(field=>(
                  <td key={field} style={{ padding:'0.32rem 0.4rem' }}>
                    {readOnly?<span style={{ color:'var(--text)', fontWeight:field==='paragraph'?700:400 }}>{q[field]||'—'}</span>
                      :<input value={q[field]||''} onChange={e=>setField(`quantities.${i}.${field}`,e.target.value)} type={['price','qty'].includes(field)?'number':'text'} style={SS}/>}
                  </td>
                ))}
                <td style={{ padding:'0.45rem', fontWeight:800, color:amt?'#059669':'var(--muted)', fontSize:'0.85rem' }}>{amt?amt.toLocaleString():'—'}</td>
                <td style={{ padding:'0.32rem 0.4rem' }}>
                  {readOnly?<span style={{ color:'var(--muted)', fontSize:'0.8rem' }}>{q.notes||'—'}</span>
                    :<input value={q.notes||''} onChange={e=>setField(`quantities.${i}.notes`,e.target.value)} placeholder="ملاحظة" style={SS}/>}
                </td>
              </tr>
            );
          })}</tbody>
          <tfoot><tr style={{ background:'var(--bg-2)' }}>
            <td colSpan={6} style={{ padding:'0.6rem 0.5rem', fontWeight:800, color:'var(--text)' }}>المجموع الكلي التراكمي</td>
            <td style={{ padding:'0.6rem 0.5rem', fontWeight:800, fontSize:'1rem', color:'#059669' }}>{ct.toLocaleString()}</td>
            <td/>
          </tr></tfoot>
        </table></div>
      </div>

      {/* Site Notes */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1rem' }}>
        <SecHead label="ملاحظات الموقع ومتابعة المذكرات" color="#dc2626"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'0.7rem' }}>
          <FRow label="عدد الملاحظات التراكمي">{renderInput("total_notes", "0", "number")}</FRow>
          <FRow label="عدد الملاحظات المحلولة">{renderInput("resolved_notes", "0", "number")}</FRow>
          <FRow label="عدد غير المحلولة">{renderInput("unresolved_notes", "0", "number")}</FRow>
          <FRow label="تاريخ آخر استلام للمذكرة">{renderInput("last_memo_date", "", "date")}</FRow>
          <FRow label="نهائي / جزئي">{renderSelect("partial_or_final", ['جزئي','نهائي'])}</FRow>
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem' }}>
        <SecHead label="الملخص المالي — تسمية السلفة الأسبوعية" color="#059669"/>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'0.75rem' }}>
          {[
            {label:'70% من المجموع الكلي التراكمي',  value:p70v.toLocaleString(), color:'#1d4ed8', auto:true},
            {label:'مجموع المبالغ المقدمة سابقاً',   path:'previous_advances',    color:'#dc2626'},
            {label:'مبلغ السلفة المستحق',             value:cav.toLocaleString(),  color:'#059669', big:true, auto:true},
            {label:'المبلغ المتبقي',                  path:'remaining_balance',    color:'#1d4ed8'},
          ].map((item,i)=>(
            <div key={i} style={{ background:'var(--bg-2)', border:`1.5px solid ${item.color}33`, borderRadius:10, padding:'0.9rem 1rem' }}>
              <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginBottom:6 }}>{item.label}</div>
              {item.auto||readOnly
                ? <div style={{ fontSize:item.big?'1.5rem':'1.2rem', fontWeight:800, color:item.color }}>{item.auto?item.value+' د.ع':(parseFloat(form[item.path]||0).toLocaleString()+' د.ع')}</div>
                : <input type="number" value={form[item.path]||''} onChange={e=>setField(item.path,e.target.value)} placeholder="0" style={{ width:'100%', background:'transparent', border:'none', borderBottom:`2px solid ${item.color}`, padding:'0.3rem 0', fontSize:'1.2rem', fontWeight:800, color:item.color, fontFamily:'inherit', outline:'none' }}/>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

