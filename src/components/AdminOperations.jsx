import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, History, RefreshCw, Database } from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { toast } from '../utils/toast';
import { EmptyState, LoadingBlock } from './ui';
import { roleLabel } from '../navigation';
import '../styles/operations.css';

const ENTITIES = {
  users: ['الحسابات', 'Accounts'], tasks: ['فقرات العمل', 'Tasks'], sub_units: ['النزلات', 'Downspouts'],
  marble_distribution: ['المرمر', 'Marble'], materials_consumption: ['المواد', 'Materials'],
  workers_wages: ['الأجور', 'Wages'], weekly_advance: ['السلف', 'Advances'], marblex_progress: ['الماربلكس', 'Marblex'],
  joints_daily: ['الجوينات', 'Joints'], daily_updates: ['التحديث اليومي', 'Daily log'], categories: ['أصناف العمل', 'Categories'],
  handover_notes: ['ملاحظات الاستلام', 'Handover notes'], handover_receipts: ['سجل الاستلام', 'Handover receipts'],
  handover_settings: ['إعدادات الاستلام', 'Handover settings'], handover_counters: ['ترقيم الملاحظات', 'Note numbering'],
};
const ACTIONS = { insert: ['إضافة', 'Created'], update: ['تعديل', 'Updated'], delete: ['حذف', 'Deleted'] };
const FIELDS = { password: ['كلمة المرور', 'Password'], name: ['الاسم', 'Name'], role: ['الصلاحية', 'Role'],
  notes: ['الملاحظات', 'Notes'], status: ['الحالة', 'Status'], email: ['البريد', 'Email'],
  site_images: ['الصور', 'Photos'], data: ['بيانات التقرير', 'Report data'],
  total_amount: ['الإجمالي', 'Total'], shift_price: ['سعر الشفت', 'Shift price'], shifts_count: ['عدد الشفتات', 'Shifts'],
  progress_percent: ['نسبة الإنجاز', 'Progress'], completed_quantity: ['الكمية المنجزة', 'Completed quantity'] };

export default function AdminOperations({ lang }) {
  const isAr = lang === 'ar';
  const language = isAr ? 0 : 1;
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const requestVersion = useRef(0);
  const downloadLock = useRef(false);
  const text = (ar, en) => isAr ? ar : en;
  const load = useCallback(async (next = null) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '25' });
      if (entity) query.set('entity', entity);
      if (action) query.set('action', action);
      if (next) query.set('cursor', next);
      const response = await apiFetch(`/api/audit-events?${query}`);
      if (!response.ok) throw new Error(await apiErrorMessage(response, isAr ? 'تعذّر تحميل سجل التدقيق.' : 'Could not load the audit log.'));
      const data = await response.json();
      if (version !== requestVersion.current) return;
      setItems(previous => next ? [...previous, ...data.items.filter(row => !previous.some(old => old.id === row.id))] : data.items);
      setCursor(data.next_cursor);
    } catch (err) { if (version === requestVersion.current) setError(err.message); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [entity, action, isAr]);
  useEffect(() => {
    const tracker = requestVersion;
    Promise.resolve().then(() => load());
    return () => { tracker.current++; };
  }, [load]);

  const download = async () => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    try {
      const response = await apiFetch('/api/backups/export', { method: 'POST' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'site-backup.json.gz';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success(text('تم تجهيز النسخة للتنزيل. احتفظ بها في مكان آمن.', 'Backup is ready to download. Store it securely.'));
    } catch (err) { toast.error(err.message); }
    finally { downloadLock.current = false; setDownloading(false); }
  };
  const valueText = (value, field) => {
    if (field === 'password') return text('محجوبة', 'Hidden');
    if (value == null) return text('لا توجد قيمة', 'No value');
    if (field === 'site_images') return String(value.count ?? 0);
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return <div className="stack">
    <section className="card" aria-labelledby="backup-title">
      <div className="card-header card-header--divided">
        <div>
          <h2 className="card-title" id="backup-title"><Database className="operations-icon" aria-hidden="true" />{text('نسخة احتياطية للمشروع', 'Project backup')}</h2>
          <p className="card-subtitle">{text('السجلات والصور والمرفقات في ملف واحد، قابل للفحص والاستعادة.', 'Records, photos and attachments in one verifiable, restorable file.')}</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={download} disabled={downloading} aria-busy={downloading}>
          <Download className="operations-icon" aria-hidden="true" />{downloading ? text('جارٍ تجهيز النسخة', 'Preparing backup') : text('تنزيل نسخة كاملة', 'Download full backup')}
        </button>
      </div>
      <div className="card-body"><p className="card-subtitle">{text('النسخة تحتوي بيانات مالية وبيانات الحسابات. احفظها لدى الإدارة، واطلب من مسؤول النظام فحص الاستعادة في مجلد جديد.', 'The backup includes financial and account data. Keep it with management and ask your system administrator to verify restoration in a new directory.')}</p></div>
    </section>
    <section className="card" aria-labelledby="audit-title" aria-busy={loading}>
      <div className="card-header card-header--divided">
        <div><h2 className="card-title" id="audit-title"><History className="operations-icon" aria-hidden="true" />{text('سجل التدقيق', 'Audit log')}</h2>
          <p className="card-subtitle">{text('من غيّر السجل ومتى، مع القيم قبل التعديل وبعده. يبدأ التسجيل بعد تفعيل هذه النسخة.', 'Who changed each record and when, with values before and after. Recording starts when this version is enabled.')}</p></div>
        <button type="button" className="btn btn--secondary" onClick={() => load()} disabled={loading}><RefreshCw className="operations-icon" aria-hidden="true" />{text('تحديث السجل', 'Refresh log')}</button>
      </div>
      <div className="card-body stack">
        <div className="form-grid">
          <div className="field"><label className="field-label" htmlFor="audit-filter-entity">{text('القسم', 'Section')}</label><select id="audit-filter-entity" className="input" value={entity} onChange={event => setEntity(event.target.value)}>
            <option value="">{text('كل الأقسام', 'All sections')}</option>{Object.entries(ENTITIES).map(([key, names]) => <option key={key} value={key}>{names[language]}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="audit-filter-action">{text('الإجراء', 'Action')}</label><select id="audit-filter-action" className="input" value={action} onChange={event => setAction(event.target.value)}>
            <option value="">{text('كل الإجراءات', 'All actions')}</option>{Object.entries(ACTIONS).map(([key, names]) => <option key={key} value={key}>{names[language]}</option>)}</select></div>
        </div>
        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        {loading && items.length === 0 ? <LoadingBlock label={text('جارٍ تحميل السجل', 'Loading audit log')} />
          : items.length === 0 && !error ? <EmptyState icon={History} title={text('لا توجد تغييرات مسجلة', 'No recorded changes')} description={text('التغييرات الجديدة تظهر هنا عند حفظها. جرّب تغيير المرشحات إذا كنت تبحث عن سجل محدد.', 'New changes appear here after they are saved. Adjust the filters to find a specific record.')} />
          : <ol className="operations-events">{items.map(row => <li key={row.id} className="operations-event">
            <div className="operations-event-heading"><strong>{row.actor_name}</strong><span className={`badge badge--${row.action === 'delete' ? 'danger' : 'outline'}`}>{(ACTIONS[row.action] || [row.action,row.action])[language]}</span>
              <time dateTime={row.created_at}>{new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at))}</time></div>
            <p className="card-subtitle">{ENTITIES[row.entity_table]?.[language] || row.entity_table} · {row.actor_role === 'system' ? text('النظام', 'System') : roleLabel(row.actor_role, lang)}</p>
            <details className="operations-details"><summary>{text('عرض تفاصيل التغيير', 'View change details')}</summary>
              <p className="field-hint">{text('معرّف السجل:', 'Record ID:')} <bdi>{row.record_id}</bdi></p>
              <dl className="operations-changes">{(row.changed_fields || []).map(field => <div key={field}>
                <dt>{FIELDS[field]?.[language] || field}</dt><dd><span>{text('قبل:', 'Before:')}</span><pre>{valueText(row.before_data?.[field], field)}</pre></dd>
                <dd><span>{text('بعد:', 'After:')}</span><pre>{valueText(row.after_data?.[field], field)}</pre></dd>
              </div>)}</dl>
            </details>
          </li>)}</ol>}
        {cursor && <button type="button" className="btn btn--secondary" onClick={() => load(cursor)} disabled={loading}>{loading ? text('جارٍ التحميل', 'Loading') : text('عرض تغييرات أقدم', 'Load older changes')}</button>}
      </div>
    </section>
  </div>;
}
