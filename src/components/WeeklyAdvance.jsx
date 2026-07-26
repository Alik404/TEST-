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
    const raw = rec ? (typeof rec.data==='string'?JSON.parse(rec.data):(rec.data||{})) : form;
    const f = {...EMPTY_FORM,...raw};
    const ct = cumTotal(f), p70 = pct70(f), ca = curAdv(f);
    const today = new Date().toLocaleDateString('ar-EG');
    const time  = new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});

    const perfR = f.performance.map((p,i) => `<tr>
      <td style="text-align:center;color:#64748b;font-weight:700;">${i+1}</td>
      <td style="font-weight:600;">${p.criteria}</td>
      <td style="text-align:center;"><span style="background:${RC[p.rating]||'#333'}22;color:${RC[p.rating]||'#333'};border:1px solid ${RC[p.rating]||'#333'}55;border-radius:4px;padding:2px 9px;font-size:9pt;font-weight:700;">${p.rating}</span></td>
      <td style="text-align:center;font-weight:700;color:${p.rating==='جيد'?'#059669':'#ccc'};">${p.rating==='جيد'?'✓':''}</td>
      <td style="text-align:center;font-weight:700;color:${p.rating==='متوسط'?'#d97706':'#ccc'};">${p.rating==='متوسط'?'✓':''}</td>
      <td style="text-align:center;font-weight:700;color:${p.rating==='ضعيف'?'#dc2626':'#ccc'};">${p.rating==='ضعيف'?'✓':''}</td>
      <td style="font-size:8pt;color:#666;">${p.notes||''}</td>
    </tr>`).join('');

    const matR = f.materials.map((m,i) => `<tr>
      <td style="text-align:center;color:#64748b;font-weight:700;">${i+1}</td>
      <td style="font-weight:700;">${m.name||''}</td>
      <td style="text-align:center;">${m.received||''}</td>
      <td style="text-align:center;">${m.prepared||''}</td>
      <td style="text-align:center;">${m.consumed||''}</td>
      <td style="font-size:8pt;color:#666;">${m.notes||''}</td>
    </tr>`).join('');

    const qtyR = f.quantities.map((q,i) => {
      const amt=(parseFloat(q.price)||0)*(parseFloat(q.qty)||0), a70=Math.round(amt*0.7);
      return `<tr>
        <td style="text-align:center;color:#64748b;font-weight:700;">${i+1}</td>
        <td style="font-weight:700;">${q.paragraph||''}</td>
        <td style="text-align:center;">${q.zone||''}</td>
        <td style="text-align:center;">${q.unit||''}</td>
        <td style="direction:ltr;">${q.price?Number(q.price).toLocaleString():''}</td>
        <td style="text-align:center;">${q.qty||''}</td>
        <td style="font-weight:700;color:#059669;direction:ltr;">${amt?amt.toLocaleString():''}</td>
        <td style="font-weight:700;color:#1d4ed8;direction:ltr;">${a70?a70.toLocaleString():''}</td>
        <td style="font-size:8pt;color:#666;">${q.notes||''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>قائمة استلام الأعمال وإخلاء المبالغ</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;font-family:'Cairo',sans-serif;}
body{background:#fff;color:#111;font-size:9pt;direction:rtl;}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:7mm 9mm;background:#fff;}
.rh{display:flex;justify-content:space-between;align-items:center;padding-bottom:7px;margin-bottom:7px;border-bottom:3px double #1a1a2e;}
.rh-org{display:flex;align-items:center;gap:10px;}
.rh-org img{height:52px;width:auto;}
.rh-org h1{font-size:13pt;font-weight:800;color:#1a1a2e;margin:0;}
.rh-org p{font-size:7.5pt;color:#555;margin:0;}
.rh-meta{text-align:left;font-size:8pt;color:#555;}
.badge{display:inline-block;background:#1a1a2e;color:#fff;font-size:7.5pt;font-weight:700;padding:2px 8px;border-radius:4px;}
.dt{text-align:center;background:#1a1a2e;color:#fff;font-size:12.5pt;font-weight:800;padding:6px 10px;border-radius:5px 5px 0 0;margin-top:6px;}
.ds{text-align:center;background:#f0f4ff;border:1px solid #c7d2fe;color:#3730a3;font-size:8.5pt;padding:3px;margin-bottom:7px;font-weight:600;}
.hg{display:grid;grid-template-columns:repeat(3,1fr);border:1.5px solid #1a1a2e;border-radius:4px;overflow:hidden;margin-bottom:8px;}
.hc{border-left:1.5px solid #1a1a2e;} .hc:last-child{border-left:none;}
.hr{display:flex;border-bottom:1px solid #c7c7c7;} .hr:last-child{border-bottom:none;}
.hl{background:#e8eaf6;font-weight:700;font-size:7.5pt;padding:4px 5px;min-width:88px;border-left:1px solid #c7c7c7;display:flex;align-items:center;}
.hv{padding:4px 7px;font-size:8pt;color:#1a1a2e;font-weight:600;flex:1;display:flex;align-items:center;}
.sc{font-weight:800;font-size:9.5pt;padding:4px 8px;border-radius:4px;margin:7px 0 4px;border-right:4px solid;}
.sc.b{background:#eff6ff;color:#1d4ed8;border-color:#1d4ed8;}
.sc.g{background:#f0fdf4;color:#059669;border-color:#059669;}
.sc.a{background:#fffbeb;color:#d97706;border-color:#d97706;}
.sc.r{background:#fef2f2;color:#dc2626;border-color:#dc2626;}
table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:8pt;}
th{background:#1a1a2e;color:#fff;padding:5px 4px;text-align:right;font-weight:700;border:1px solid #374151;font-size:7.5pt;}
td{padding:4px;border:1px solid #d1d5db;vertical-align:middle;}
tr:nth-child(even) td{background:#f9fafb;}
tfoot td{background:#e6f4ed!important;font-weight:800;border-top:2px solid #059669;font-size:9pt;}
.ft{width:100%;border-collapse:collapse;margin-top:5px;}
.ft td,.ft th{border:1.5px solid #1a1a2e;padding:5px 8px;font-size:9pt;}
.ft th{background:#1a1a2e;color:#fff;font-weight:800;}
.fl{background:#f1f5f9;font-weight:700;width:55%;color:#1e293b;}
.fv{text-align:center;font-weight:800;font-size:11pt;color:#059669;width:45%;}
.fv.blue{color:#1d4ed8;} .fv.red{color:#dc2626;} .fv.big{font-size:14pt;background:#f0fdf4;}
.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px;padding-top:10px;border-top:2px dashed #94a3b8;}
.sig{border:1.5px solid #94a3b8;border-radius:5px;padding:8px;text-align:center;background:#fafafa;}
.st{font-size:9pt;font-weight:800;color:#1e293b;}
.sl{border-top:1px solid #94a3b8;margin:26px 8px 4px;padding-top:3px;font-size:7.5pt;color:#64748b;}
.footer{display:flex;justify-content:space-between;font-size:7.5pt;color:#94a3b8;margin-top:12px;padding-top:7px;border-top:1px solid #e2e8f0;}
@media print{body{margin:0;}.page{width:100%;padding:5mm 7mm;min-height:unset;}@page{size:A4;margin:0;}}
</style></head><body><div class="page">
<div class="rh">
  <div class="rh-org"><img src="https://mvco-iq.com/wp-content/uploads/2024/10/cropped-2color_logo.webp" alt="Logo"/><div><h1>متابعة موقع الجندي المجهول</h1><p>شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</p></div></div>
  <div class="rh-meta"><div class="badge">وثيقة رسمية معتمدة</div><br/><br/><span>تاريخ الطباعة: <strong>${today}</strong> &nbsp;|&nbsp; ${time}</span></div>
</div>
<div class="dt">قائمة استلام الأعمال وإخلاء المبالغ</div>
<div class="ds">ترتيب كل 24 ساعة للمتابعة والمحاسبات بعد توقيع رئيس الفريق — تسمية السلفة الأسبوعية</div>
<div class="hg">
  <div class="hc">
    <div class="hr"><div class="hl">اسم الموقع</div><div class="hv">${f.site_name||''}</div></div>
    <div class="hr"><div class="hl">اسم الفني</div><div class="hv" style="font-weight:800;color:#059669;">${f.tech_name||''}</div></div>
    <div class="hr"><div class="hl">التاريخ</div><div class="hv">${f.receipt_date||''}</div></div>
    <div class="hr"><div class="hl">رقم وصل الاستلام</div><div class="hv">${f.receipt_voucher||''}</div></div>
    <div class="hr"><div class="hl">نوع الاستلام</div><div class="hv">${f.receipt_type||''}</div></div>
    <div class="hr"><div class="hl">وحدة القياس</div><div class="hv">${f.measuring_unit||''}</div></div>
    <div class="hr"><div class="hl">تاريخ البدء بالعمل</div><div class="hv">${f.start_date||''}</div></div>
  </div>
  <div class="hc">
    <div class="hr"><div class="hl">مشرف الموقع</div><div class="hv">${f.supervisor||''}</div></div>
    <div class="hr"><div class="hl">هل يوجد عقد عمل ؟</div><div class="hv">${f.has_contract||''}</div></div>
    <div class="hr"><div class="hl">نوع العمل</div><div class="hv">${f.work_type||''}</div></div>
    <div class="hr"><div class="hl">هل توجد مخططات</div><div class="hv">${f.has_blueprints||''}</div></div>
    <div class="hr"><div class="hl">معدل الكوادر اليومي</div><div class="hv">${f.daily_staff_rate||''}</div></div>
    <div class="hr"><div class="hl">سعر الوحدة</div><div class="hv">${f.unit_price||''}</div></div>
    <div class="hr"><div class="hl">تاريخ الانتهاء المتوقع</div><div class="hv">${f.expected_end_date||''}</div></div>
  </div>
</div>
<div class="sc b">تقييم الأداء الميداني</div>
<table><thead><tr>
  <th style="width:4%;text-align:center;">#</th><th style="width:32%;">العنصر / المعيار</th>
  <th style="width:13%;text-align:center;">التقييم</th><th style="width:8%;text-align:center;">جيد</th>
  <th style="width:8%;text-align:center;">متوسط</th><th style="width:8%;text-align:center;">ضعيف</th><th>الملاحظات</th>
</tr></thead><tbody>${perfR}</tbody></table>
<div class="sc g">كمية المواد المستهلكة</div>
<table><thead><tr>
  <th style="width:4%;text-align:center;">#</th><th style="width:20%;">المادة / الفقرة</th>
  <th style="width:16%;text-align:center;">الكمية المنفذة</th><th style="width:16%;text-align:center;">الكمية المجهزة</th>
  <th style="width:16%;text-align:center;">الكمية المتبقية</th><th>الملاحظات</th>
</tr></thead><tbody>${matR}</tbody>
<tfoot><tr><td colspan="5">توقيع المعاون الإداري: ..................................................</td><td></td></tr></tfoot></table>
<div class="sc a">الكمية المنجزة التراكمية الكلية من بداية العمل</div>
<table><thead><tr>
  <th style="width:4%;text-align:center;">#</th><th style="width:22%;">فقرة العمل</th>
  <th style="width:9%;text-align:center;">رقم التطبيق</th><th style="width:10%;text-align:center;">وحدة القياس</th>
  <th style="width:11%;">السعر</th><th style="width:8%;text-align:center;">العدد / الكمية</th>
  <th style="width:12%;">مجموع المبلغ الكلي</th><th style="width:12%;">بدون خصم (70%)</th><th>الملاحظات</th>
</tr></thead><tbody>${qtyR}</tbody>
<tfoot><tr>
  <td colspan="6" style="font-weight:800;">المجموع الكلي التراكمي (بدون خصم الـ 70%)</td>
  <td style="color:#059669;font-size:10pt;direction:ltr;">${ct?ct.toLocaleString():'-'}</td>
  <td style="color:#1d4ed8;font-size:10pt;direction:ltr;">${p70?p70.toLocaleString():'-'}</td><td>توقيع المعاون الفني</td>
</tr></tfoot></table>
<div class="sc r">ملاحظات الموقع ومتابعة المذكرات</div>
<table><thead><tr>
  <th style="width:20%;text-align:center;">عدد الملاحظات التراكمي</th><th style="width:20%;text-align:center;">عدد الملاحظات المنجزة</th>
  <th style="width:20%;text-align:center;">غير المنجزة</th><th style="width:20%;text-align:center;">تاريخ آخر استلام للمذكرة</th>
  <th style="text-align:center;">نوعه (جزئي / نهائي)</th>
</tr></thead><tbody>
<tr>
  <td style="text-align:center;font-weight:700;">${f.total_notes||'-'}</td>
  <td style="text-align:center;font-weight:700;color:#059669;">${f.resolved_notes||'-'}</td>
  <td style="text-align:center;font-weight:700;color:#dc2626;">${f.unresolved_notes||'-'}</td>
  <td style="text-align:center;">${f.last_memo_date||'-'}</td>
  <td style="text-align:center;"><span style="background:${f.partial_or_final==='نهائي'?'#dcfce7':'#fef3c7'};color:${f.partial_or_final==='نهائي'?'#059669':'#d97706'};border-radius:4px;padding:2px 10px;font-weight:700;font-size:9pt;">${f.partial_or_final||'جزئي'}</span></td>
</tr>
<tr><td colspan="4" style="font-size:8pt;color:#555;">(تملى من قبل PMO) &nbsp;|&nbsp; توقيع مسؤول المتابعة: ................................................................</td><td></td></tr>
</tbody></table>
<div class="sc g">الملخص المالي — تسمية السلفة الأسبوعية</div>
<table class="ft"><tbody>
  <tr><td class="fl">70% من المجموع الكلي التراكمي</td><td class="fv blue">${p70?p70.toLocaleString()+' د.ع':'—'}</td></tr>
  <tr><td class="fl">مجموع المبالغ المستلمة سابقاً</td><td class="fv red">${f.previous_advances?Number(f.previous_advances).toLocaleString()+' د.ع':'—'}</td></tr>
  <tr><td class="fl" style="font-size:11pt;">مبلغ السلفة المستحق</td><td class="fv big">${ca?ca.toLocaleString()+' د.ع':'—'}</td></tr>
  <tr><td class="fl">المبلغ المتبقي</td><td class="fv">${f.remaining_balance?Number(f.remaining_balance).toLocaleString()+' د.ع':'—'}</td></tr>
</tbody></table>
<div class="sigs">
  <div class="sig"><div class="st">مشرف الموقع</div><div class="sl">التوقيع والختم الرسمي</div></div>
  <div class="sig"><div class="st">المعاون الفني</div><div class="sl">التوقيع والختم الرسمي</div></div>
  <div class="sig"><div class="st">رئيس الفريق / الفني</div><div class="sl">التوقيع والختم الرسمي</div></div>
</div>
<div class="footer">
  <span>متابعة موقع الجندي المجهول &mdash; شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري</span>
  <span>طُبع في: ${today} - ${time}</span>
</div>
</div><script>window.onload=function(){setTimeout(function(){window.print();},700);};<\/script></body></html>`;

    const win = window.open('','_blank','width=960,height=1150');
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

