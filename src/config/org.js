/**
 * Organisation details printed on every report letterhead.
 * Edit here once; every PDF in the app picks it up.
 */
export const ORG = {
  country: { ar: 'جمهورية العراق', en: 'Republic of Iraq' },
  client: { ar: 'أمانة بغداد - دائرة المشاريع', en: 'Mayoralty of Baghdad - Projects Department' },
  company: 'شركة رؤية الحداثة للخدمات الهندسية والاستثمار العقاري',
  project: {
    ar: 'مشروع تأهيل وصيانة النصب التذكاري للجندي المجهول',
    en: 'Unknown Soldier Monument Rehabilitation Project',
  },
  siteName: { ar: 'متابعة موقع الجندي المجهول', en: 'Unknown Soldier Site Monitoring' },
  supervision: { ar: 'دائرة المهندس المقيم', en: 'Resident Engineer Office' },
};

/** Default sign-off block used by reports that do not define their own. */
export const DEFAULT_SIGNATURES = [
  { ar: 'مهندس الموقع', en: 'Site Engineer' },
  { ar: 'المهندس المقيم', en: 'Resident Engineer' },
  { ar: 'مدير المشروع', en: 'Project Director' },
];
