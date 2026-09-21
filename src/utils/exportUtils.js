/**
 * exportUtils.js
 * ============================================================
 * نظام تصدير مركزي ومنظّم للمشروع.
 *
 * يحتوي هذا الملف على:
 *  - CONFIG_EXCEL: إعدادات شيتات Excel (الأعمدة، عرضها، ألوان الترويسات)
 *  - exportToExcel(): دالة تصدير Excel
 *  - exportRowsToExcel(): تصدير أي قائمة سجلات إلى شيت واحد
 *  (تقارير PDF تُبنى في utils/report.js)
 *
 * لإضافة عمود جديد: أضف مدخلاً في الـ columns الخاصة بالشيت المطلوب.
 * لتغيير لون الترويسة: عدّل headerStyle في الشيت المطلوب.
 * ============================================================
 */

import { toast } from './toast';
// The Excel library is large; it is loaded only when an export is requested.
const loadXLSX = () => import('xlsx');

// ─────────────────────────────────────────────────────────────
// ١. إعدادات تصدير Excel
// ─────────────────────────────────────────────────────────────

/**
 * CONFIG_EXCEL
 *
 * كل شيت يملك:
 *  - sheetName  : اسم الشيت داخل ملف Excel
 *  - headerStyle: أنماط ترويسة هذا الشيت (لون خلفية ARGB، خط، لون نص)
 *  - colWidths  : عرض كل عمود بالحرف (ch unit)
 *  - columns    : مصفوفة الأعمدة — كل عمود يملك:
 *                   • label : عنوان الترويسة المعروض في Excel
 *                   • get   : دالة تأخذ الصف وترجع قيمة الخلية
 */
export const CONFIG_EXCEL = {

  // ── الشيت الأول: الخلاصة العامة لجدول التقدم ──────────────
  summary: {
    sheetName: 'الخلاصة واللوحة التفاعلية',
    headerStyle: {
      fill: { fgColor: { rgb: 'F79012' } }, // ذهبي
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
    },
    colWidths: [20, 32, 15, 15, 15, 18, 12, 30],
    columns: [
      { label: 'القسم الأساسي',           get: (t) => t.category_name },
      { label: 'تفاصيل الفقرة التنفيذية', get: (t) => t.name },
      { label: 'الكمية الكلية',            get: (t) => t.total_quantity ?? '-' },
      { label: 'المنجز',                   get: (t) => t.completed_quantity ?? '-' },
      {
        label: 'المتبقي',
        get: (t) =>
          t.total_quantity
            ? parseFloat((t.total_quantity - t.completed_quantity).toFixed(2))
            : '-',
      },
      { label: 'نسبة الإنجاز (%)',         get: (t) => parseFloat(t.progress_percent.toFixed(2)) },
      { label: 'الوحدة',                   get: (t) => t.unit ?? '-' },
      { label: 'الملاحظات الموقعية',       get: (t) => t.notes ?? '' },
    ],
  },

  // ── الشيت الثاني: سجل النزلات التفصيلي ───────────────────
  nazalat: {
    sheetName: 'سجل النزلات التفصيلي',
    headerStyle: {
      fill: { fgColor: { rgb: '1D4ED8' } }, // أزرق احترافي
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
    },
    colWidths: [12, 18, 16, 18, 16, 30],
    columns: [
      { label: 'التسلسلي',          get: (n) => n.serial_number },
      { label: 'المنطقة (Zone)',     get: (n) => n.zone },
      { label: 'رمز النزلة',        get: (n) => n.code },
      { label: 'الحالة الموقعية',   get: (n) => n.status },
      { label: 'الكمية الكلية',     get: (n) => n.total_quantity },
      { label: 'الملاحظات الموقعية', get: (n) => n.notes ?? '' },
    ],
  },

  // ── الشيت الثالث: توزيع المرمر ────────────────────────────
  marble: {
    sheetName: 'توزيع المرمر والزونات',
    headerStyle: {
      fill: { fgColor: { rgb: '16A34A' } }, // أخضر
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', readingOrder: 2 },
    },
    colWidths: [18, 28, 16, 16, 14, 28],
    columns: [
      { label: 'المنطقة (Zone)',           get: (m) => m.zone },
      { label: 'طبيعة وفقرة العمل',        get: (m) => m.task_name },
      { label: 'أبيض (قطعة)',              get: (m) => m.white_qty ?? '-' },
      { label: 'جوزي (قطعة)',             get: (m) => m.brown_qty ?? '-' },
      {
        label: 'الإجمالي',
        get: (m) => (m.white_qty || 0) + (m.brown_qty || 0) || '-',
      },
      { label: 'موقف التحديث الميداني',   get: (m) => m.status ?? '' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// ٣. مساعدات داخلية
// ─────────────────────────────────────────────────────────────

/** بناء شيت واحد من إعداد CONFIG_EXCEL + مصفوفة البيانات */
function buildSheet(XLSX, config, rows) {
  // بناء مصفوفة البيانات كـ AOA (Array of Arrays)
  const header = config.columns.map((c) => c.label);
  const data = rows.map((row) => config.columns.map((c) => c.get(row)));

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  // عرض الأعمدة
  ws['!cols'] = config.colWidths.map((w) => ({ wch: w }));

  // ارتفاع صف الترويسة
  ws['!rows'] = [{ hpt: 22 }];

  // تطبيق النمط على خلايا الترويسة
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = config.headerStyle;
  }

  return ws;
}

/** اسم ملف التصدير بتاريخ اليوم */
function buildFileName(prefix) {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}_${date}.xlsx`;
}

// ─────────────────────────────────────────────────────────────
// ٤. دالة التصدير الرئيسية — Excel
// ─────────────────────────────────────────────────────────────

/**
 * exportToExcel
 * @param {{ tasks: Array, nazalat: Array, marble: Array }} data
 */
export async function exportToExcel({ tasks, nazalat, marble }) {
  try {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();

    // ── الشيت الأول ──
    const wsSummary = buildSheet(XLSX, CONFIG_EXCEL.summary, tasks);
    XLSX.utils.book_append_sheet(wb, wsSummary, CONFIG_EXCEL.summary.sheetName);

    // ── الشيت الثاني ──
    const wsNazalat = buildSheet(XLSX, CONFIG_EXCEL.nazalat, nazalat);
    XLSX.utils.book_append_sheet(wb, wsNazalat, CONFIG_EXCEL.nazalat.sheetName);

    // ── الشيت الثالث ──
    const wsMarble = buildSheet(XLSX, CONFIG_EXCEL.marble, marble);
    XLSX.utils.book_append_sheet(wb, wsMarble, CONFIG_EXCEL.marble.sheetName);

    // حفظ الملف
    XLSX.writeFile(wb, buildFileName('تقرير_انجاز_المشروع'), {
      bookType: 'xlsx',
      type: 'binary',
    });
  } catch (err) {
    console.error('[exportToExcel] فشل التصدير:', err);
    toast.error('تعذر تصدير ملف Excel.');
  }
}

/**
 * exportRowsToExcel
 * Exports a flat list of objects (keys become the header row) to one sheet.
 * @param {Array<Object>} rows
 * @param {string} prefix     file name prefix
 * @param {string} sheetName
 */
export async function exportRowsToExcel(rows, prefix, sheetName = 'Sheet1') {
  try {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    ws['!cols'] = headers.map(hd => ({
      wch: Math.min(40, Math.max(10, hd.length + 2, ...rows.map(r => String(r[hd] ?? '').length + 2))),
    }));
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, buildFileName(prefix), { bookType: 'xlsx', type: 'binary' });
    return true;
  } catch (err) {
    console.error('[exportRowsToExcel] export failed:', err);
    toast.error('تعذر تصدير ملف Excel.');
    return false;
  }
}
