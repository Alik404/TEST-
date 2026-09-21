import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Pencil, Shield, ShieldCheck, Eye, EyeOff, Save, UserCog, Mail } from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../utils/api';
import { toast } from '../utils/toast';
import { roleLabel, initials } from '../navigation';
import { StatCard, Modal, Field, ConfirmDialog, LoadingBlock, EmptyState } from './ui';

const ROLES = [
  { value: 'admin', ar: 'مهندس الموقع', en: 'Site Engineer', hint: { ar: 'تعديل كامل لبيانات الموقع', en: 'Full edit of site data' } },
  { value: 'viewer', ar: 'الإدارة العليا', en: 'Senior Management', hint: { ar: 'قراءة التقارير فقط', en: 'Read-only reports' } },
  { value: 'super_admin', ar: 'المدير العام', en: 'General Director', hint: { ar: 'إدارة الموقع والحسابات', en: 'Site and account management' } },
];

const roleTone = (role) => (role === 'super_admin' ? 'accent' : role === 'admin' ? 'info' : 'outline');

const EMPTY = { id: null, email: '', password: '', name: '', role: 'admin' };

export default function UsersManagement({ currentUser, lang }) {
  const isAr = lang === 'ar';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState(null); // null | 'add' | 'edit'
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر تحميل الحسابات.' : 'Could not load accounts.'));
      setUsers(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load once when the section opens (deferred so no state is set during the effect).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { Promise.resolve().then(load); }, []);

  const count = (role) => users.filter(u => u.role === role).length;
  const superAdmins = count('super_admin');

  const openAdd = () => {
    setForm(EMPTY);
    setFormError('');
    setShowPassword(false);
    setMode('add');
  };

  const openEdit = (u) => {
    setForm({ id: u.id, email: u.email, password: '', name: u.name, role: u.role });
    setFormError('');
    setShowPassword(false);
    setMode('edit');
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.email.trim() || !form.name.trim() || !form.role || (mode === 'add' && !form.password)) {
      setFormError(isAr ? 'املأ الاسم والبريد الإلكتروني وكلمة المرور.' : 'Fill in the name, email and password.');
      return;
    }
    if (form.password && form.password.length < 8) {
      setFormError(isAr ? 'كلمة المرور 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const payload = { email: form.email.trim(), name: form.name.trim(), role: form.role };
      if (form.password) payload.password = form.password;
      const res = await apiFetch(mode === 'edit' ? `/api/users/${form.id}` : '/api/users', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حفظ الحساب.' : 'Could not save the account.'));
      toast.success(mode === 'edit' ? (isAr ? 'تم تحديث الحساب' : 'Account updated') : (isAr ? 'تم إنشاء الحساب' : 'Account created'));
      setMode(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      const res = await apiFetch(`/api/users/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiErrorMessage(res, isAr ? 'تعذر حذف الحساب.' : 'Could not delete the account.'));
      toast.success(isAr ? 'تم حذف الحساب' : 'Account deleted');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && users.length === 0) return <LoadingBlock label={isAr ? 'جارٍ تحميل الحسابات' : 'Loading accounts'} />;

  return (
    <div className="stack">
      <section className="stat-grid" aria-label={isAr ? 'ملخص الحسابات' : 'Accounts summary'}>
        <StatCard label={isAr ? 'كل الحسابات' : 'All accounts'} value={users.length} icon={Users} tone="accent" />
        <StatCard label={isAr ? 'مهندسو الموقع' : 'Site engineers'} value={count('admin')} icon={ShieldCheck} tone="info" meta={isAr ? 'تعديل كامل' : 'Full edit'} />
        <StatCard label={isAr ? 'الإدارة العليا' : 'Senior management'} value={count('viewer')} icon={Eye} meta={isAr ? 'قراءة فقط' : 'Read only'} />
        <StatCard label={isAr ? 'المدراء العامون' : 'General directors'} value={superAdmins} icon={Shield} tone="warn" meta={isAr ? 'إدارة الحسابات' : 'Manage accounts'} />
      </section>

      <section className="card">
        <div className="card-header card-header--divided">
          <div>
            <h2 className="card-title"><UserCog size={20} aria-hidden="true" />{isAr ? 'الحسابات المسجلة' : 'Registered accounts'}</h2>
            <p className="card-subtitle">{isAr ? 'كلمات المرور مشفرة ولا يمكن عرضها. عند التعديل اترك كلمة المرور فارغة للإبقاء عليها.' : 'Passwords are hashed and never shown. Leave the password empty when editing to keep it.'}</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            <Plus size={18} aria-hidden="true" />
            {isAr ? 'حساب جديد' : 'New account'}
          </button>
        </div>

        {users.length === 0 ? (
          <EmptyState icon={Users} title={isAr ? 'لا توجد حسابات' : 'No accounts'} />
        ) : (
          <ul className="list">
            {users.map(u => {
              const isSelf = u.id === currentUser?.id;
              const lastDirector = u.role === 'super_admin' && superAdmins <= 1;
              const deleteBlocked = isSelf || lastDirector;
              return (
                <li key={u.id} className="list-item account-item">
                  <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                  <div className="list-item-main">
                    <div className="list-item-title">
                      {u.name}
                      {isSelf && <span className="badge badge--outline" style={{ marginInlineStart: 'var(--space-2)' }}>{isAr ? 'أنت' : 'You'}</span>}
                    </div>
                    <div className="list-item-sub"><Mail size={12} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> <span className="num">{u.email}</span></div>
                  </div>
                  <span className={`badge badge--${roleTone(u.role)}`}>{roleLabel(u.role, lang)}</span>
                  <div className="btn-row">
                    <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => openEdit(u)} aria-label={`${isAr ? 'تعديل' : 'Edit'} ${u.name}`} title={isAr ? 'تعديل' : 'Edit'}>
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm btn--icon"
                      onClick={() => setToDelete(u)}
                      disabled={deleteBlocked}
                      aria-label={`${isAr ? 'حذف' : 'Delete'} ${u.name}`}
                      title={isSelf ? (isAr ? 'لا يمكنك حذف حسابك' : 'You cannot delete your own account')
                        : lastDirector ? (isAr ? 'المدير العام الوحيد لا يُحذف' : 'The only general director cannot be deleted')
                          : (isAr ? 'حذف' : 'Delete')}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(mode)}
        onClose={saving ? undefined : () => setMode(null)}
        title={mode === 'edit' ? (isAr ? 'تعديل الحساب' : 'Edit account') : (isAr ? 'حساب جديد' : 'New account')}
        closeLabel={isAr ? 'إغلاق' : 'Close'}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setMode(null)} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" form="user-form" className="btn btn--primary" aria-busy={saving}>
              <Save size={18} aria-hidden="true" />
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </>
        }
      >
        <form id="user-form" className="stack-sm" onSubmit={submit} noValidate>
          {formError && <div className="alert alert--danger" role="alert"><div className="alert-body">{formError}</div></div>}
          <Field label={isAr ? 'الاسم الكامل' : 'Full name'} htmlFor="u-name">
            <input id="u-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" data-autofocus />
          </Field>
          <Field label={isAr ? 'البريد الإلكتروني (اسم الدخول)' : 'Email (sign-in name)'} htmlFor="u-email">
            <input id="u-email" className="input" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" inputMode="email" />
          </Field>
          <Field
            label={isAr ? 'كلمة المرور' : 'Password'}
            htmlFor="u-pass"
            hint={mode === 'edit' ? (isAr ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية.' : 'Leave empty to keep the current password.') : (isAr ? '8 أحرف على الأقل.' : 'At least 8 characters.')}
          >
            <div className="input-group">
              <input
                id="u-pass"
                className="input"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                required={mode !== 'edit'}
                placeholder={mode === 'edit' ? (isAr ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : 'Leave blank to keep the current password') : ''}
                style={{ paddingInlineStart: 'var(--space-3)', paddingInlineEnd: '3rem' }}
              />
              <button type="button" className="btn btn--ghost btn--icon btn--sm input-addon" onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}>
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </Field>
          <fieldset className="form-section">
            <legend className="field-label" style={{ marginBlockEnd: 'var(--space-2)' }}>{isAr ? 'الصلاحية' : 'Role'}</legend>
            <div className="role-options">
              {ROLES.map(r => (
                <label key={r.value} className="role-option">
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm({ ...form, role: r.value })} />
                  <span>
                    <strong>{isAr ? r.ar : r.en}</strong>
                    <small>{r.hint[isAr ? 'ar' : 'en']}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        lang={lang}
        title={isAr ? 'حذف الحساب' : 'Delete account'}
        message={isAr ? `سيفقد ${toDelete?.name} الوصول إلى النظام فوراً. لا يمكن التراجع عن ذلك.` : `${toDelete?.name} will lose access immediately. This cannot be undone.`}
        confirmLabel={isAr ? 'حذف الحساب' : 'Delete account'}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
