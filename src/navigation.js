import {
  BarChart3, LayoutDashboard, ClipboardList, Boxes, Layers,
  FileText, Banknote, Receipt, MessageSquare, Users
} from 'lucide-react';

/**
 * The one list of sections. The sidebar, the bottom bar, the "more" sheet
 * and the top-bar title all read from here, so a section is added, renamed
 * or restricted in exactly one place.
 *
 * roles: who may see the section (omitted = everyone signed in).
 * bottom: shown directly in the phone bottom bar (max 4; the 5th slot is "More").
 */
export const SECTIONS = [
  {
    id: 'dashboard',
    group: 'site',
    icon: LayoutDashboard,
    label: { ar: 'اللوحة الرئيسية', en: 'Dashboard' },
    short: { ar: 'الرئيسية', en: 'Home' },
    titleKey: 'headerDashboardTitle',
    subtitleKey: 'headerDashboardSubtitle',
    bottom: true,
  },
  {
    id: 'tracking',
    group: 'site',
    icon: ClipboardList,
    label: { ar: 'سجل النزلات التفصيلي', en: 'Downspouts Log' },
    short: { ar: 'النزلات', en: 'Downspouts' },
    titleKey: 'headerTrackingTitle',
    subtitleKey: 'headerTrackingSubtitle',
    bottom: true,
  },
  {
    id: 'marblex',
    group: 'site',
    icon: Boxes,
    label: { ar: 'تقدم أعمال الماربلكس', en: 'Marblex Progress' },
    short: { ar: 'الماربلكس', en: 'Marblex' },
    titleKey: 'headerMarblexTitle',
    subtitleKey: 'headerMarblexSubtitle',
    bottom: true,
  },
  {
    id: 'marble',
    group: 'site',
    icon: Layers,
    label: { ar: 'توزيع المرمر والزونات', en: 'Marble Distribution' },
    short: { ar: 'المرمر', en: 'Marble' },
    titleKey: 'headerMarbleTitle',
    subtitleKey: 'headerMarbleSubtitle',
    bottom: true,
  },
  {
    id: 'materials-consumption',
    group: 'reports',
    icon: FileText,
    label: { ar: 'استهلاك المواد اليومي', en: 'Daily Materials' },
    short: { ar: 'المواد', en: 'Materials' },
    titleKey: 'headerMaterialsConsumptionTitle',
    subtitleKey: 'headerMaterialsConsumptionSubtitle',
    bottom: false,
  },
  {
    id: 'daily-updates',
    group: 'reports',
    icon: MessageSquare,
    label: { ar: 'التحديث اليومي', en: 'Daily Log' },
    short: { ar: 'التحديثات', en: 'Log' },
    titleKey: 'headerDailyUpdatesTitle',
    subtitleKey: 'headerDailyUpdatesSubtitle',
    bottom: false,
  },
  {
    id: 'executive-summary',
    group: 'reports',
    icon: BarChart3,
    label: { ar: 'التقرير التنفيذي الشامل', en: 'Executive Summary' },
    short: { ar: 'التنفيذي', en: 'Executive' },
    titleKey: 'headerExecutiveTitle',
    subtitleKey: 'headerExecutiveSubtitle',
    bottom: false,
  },
  {
    id: 'workers-wages',
    group: 'finance',
    icon: Banknote,
    label: { ar: 'أجور العمال', en: 'Workers Wages' },
    short: { ar: 'الأجور', en: 'Wages' },
    titleKey: 'headerWorkersWagesTitle',
    subtitleKey: 'headerWorkersWagesSubtitle',
    bottom: false,
  },
  {
    id: 'weekly-advance',
    group: 'finance',
    icon: Receipt,
    label: { ar: 'السلفة المقدمة', en: 'Advance Payments' },
    short: { ar: 'السلف', en: 'Advances' },
    titleKey: 'headerWeeklyAdvanceTitle',
    subtitleKey: 'headerWeeklyAdvanceSubtitle',
    bottom: false,
  },
  {
    id: 'users-management',
    group: 'admin',
    icon: Users,
    label: { ar: 'إدارة الحسابات', en: 'Accounts' },
    short: { ar: 'الحسابات', en: 'Accounts' },
    titleKey: 'headerUsersTitle',
    subtitleKey: 'headerUsersSubtitle',
    roles: ['super_admin'],
    bottom: false,
  },
];

export const GROUPS = [
  { id: 'site',    label: { ar: 'المتابعة الميدانية', en: 'Site' } },
  { id: 'reports', label: { ar: 'التقارير والسجلات', en: 'Reports' } },
  { id: 'finance', label: { ar: 'المالية', en: 'Finance' } },
  { id: 'admin',   label: { ar: 'الإدارة', en: 'Administration' } },
];

export const ROLE_LABELS = {
  super_admin: { ar: 'المدير العام', en: 'General Director' },
  admin:       { ar: 'مهندس الموقع', en: 'Site Engineer' },
  viewer:      { ar: 'الإدارة العليا', en: 'Senior Management' },
};

export const canEdit = (user) => user?.role === 'admin' || user?.role === 'super_admin';

export const sectionsFor = (user) =>
  SECTIONS.filter(s => !s.roles || s.roles.includes(user?.role));

export const findSection = (id) => SECTIONS.find(s => s.id === id);

export const roleLabel = (role, lang) =>
  (ROLE_LABELS[role] || ROLE_LABELS.viewer)[lang === 'ar' ? 'ar' : 'en'];

export const initials = (name = '') => {
  const words = String(name).replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean);
  const skip = new Set(['المهندس', 'المدير', 'م.', 'eng.', 'mr.']);
  const meaningful = words.filter(w => !skip.has(w.toLowerCase()));
  const first = (meaningful[0] || words[0] || '?')[0];
  return first.toUpperCase();
};
