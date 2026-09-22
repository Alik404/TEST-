/**
 * Printed daily joints reports. The tables follow the site's paper sheet:
 * a yellow title row, a blue band per joint type, the five columns
 * (item, downspouts, meters per downspout, total, unit) and a yellow
 * grand-total row, with the joints elevation drawn beside them.
 * Colors here are print colors on white paper, not screen theme colors.
 */
import { buildReport, h, esc, docCode } from './report';
import { num, date as fmtDate } from './format';
import { JOINT_TYPES, rowTotal, recordRows, rowsByType, dayTotals, cumulative, byDateAsc, zoneLabel } from './joints';

const STYLE = `
  <style>
    .jt-layout { display: grid; grid-template-columns: minmax(0, 1fr) 50mm; gap: 6mm; align-items: start; }
    .jt-stack { display: flex; flex-direction: column; gap: 5mm; min-width: 0; }
    .jt-block { break-inside: avoid; }
    .jt { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .jt th, .jt td { border: 1px solid #18181b; padding: 1.5mm 2mm; text-align: center; vertical-align: middle; }
    .jt .jt-title th { background: #fde047; font-size: 10pt; font-weight: 800; }
    .jt .jt-type th { background: #bfdbfe; font-weight: 800; }
    .jt .jt-cols th { background: #ffffff; font-weight: 700; font-size: 8pt; }
    .jt td { font-variant-numeric: tabular-nums; }
    .jt td.jt-item { text-align: start; font-weight: 600; }
    .jt .jt-zone { display: block; font-size: 7pt; font-weight: 500; color: #52525b; }
    .jt .jt-total td { background: #fde047; font-weight: 800; font-size: 9.5pt; }
    .jt-facts { display: flex; flex-wrap: wrap; gap: 2mm 8mm; margin-top: 2mm; font-size: 9pt; }
    .jt-facts strong { font-variant-numeric: tabular-nums; }
    .jt-note { margin-top: 1.5mm; font-size: 8.5pt; color: #3f3f46; white-space: pre-wrap; }
    .jt-drawing { width: 50mm; margin: 0; }
    .jt-drawing svg { width: 100%; height: auto; display: block; }
    .jt-drawing figcaption { margin-top: 1mm; font-size: 7pt; color: #52525b; text-align: center; }
  </style>`;

/** 2026-05-14 -> 2026/5/14, as written on the paper sheets. */
const paperDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${y}/${Number(m)}/${Number(d)}` : String(iso || '');
};

const meterUnit = (isAr) => (isAr ? 'متر' : 'm');

/** One table in the paper layout: title, a band per type, grand total. */
const jointsTable = ({ title, groups, total, totalLabel, isAr, showZone = false }) => {
  const cols = isAr
    ? ['الفقرة المنجزة', 'عدد النزلات', 'أمتار الطول للنزلة الواحدة', 'المجموع', 'الوحدة']
    : ['Completed item', 'Downspouts', 'Meters per downspout', 'Total', 'Unit'];
  const body = groups.map(({ type, rows }) => `
    <tr class="jt-type"><th colspan="5">${esc(type.label[isAr ? 'ar' : 'en'])}</th></tr>
    <tr class="jt-cols">${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
    ${rows.map(r => `
      <tr>
        <td class="jt-item">${esc(r.item)}${showZone ? `<span class="jt-zone">${esc(zoneLabel(r.zone, isAr))}</span>` : ''}</td>
        <td>${esc(num(r.count))}</td>
        <td>${esc(num(r.length))}</td>
        <td><strong>${esc(num(r.total ?? rowTotal(r)))}</strong></td>
        <td>${esc(meterUnit(isAr))}</td>
      </tr>`).join('')}`).join('');
  return `
    <table class="jt">
      <thead><tr class="jt-title"><th colspan="5">${esc(title)}</th></tr></thead>
      <tbody>${body || `<tr><td colspan="5">-</td></tr>`}</tbody>
      <tfoot><tr class="jt-total">
        <td colspan="2">${esc(totalLabel)}</td>
        <td colspan="3">${esc(num(total))} ${esc(isAr ? 'متر طول' : 'linear m')}</td>
      </tr></tfoot>
    </table>`;
};

/** A day's block: its table, workers count, sealant rate and notes. */
const dayBlock = (record, isAr) => {
  const rows = recordRows(record);
  const totals = dayTotals(record);
  const facts = [];
  if (Number(record.workers_count) > 0) facts.push(`${isAr ? 'عدد العمال' : 'Workers'}: <strong>${esc(num(record.workers_count))}</strong>`);
  if (record.data?.sealant_rate) facts.push(`${isAr ? 'استهلاك الصوصج' : 'Sealant use'} = <strong><bdi dir="ltr">${esc(record.data.sealant_rate)}</bdi></strong>`);
  return `
    <div class="jt-block">
      ${jointsTable({
        title: isAr ? `جرد أعمال الجوينات لهذا اليوم ( ${paperDate(record.report_date)} )` : `Joints works count for ( ${paperDate(record.report_date)} )`,
        groups: rowsByType(rows),
        total: totals.total,
        totalLabel: isAr ? 'المجموع الكلي' : 'Grand total',
        isAr,
        showZone: true,
      })}
      ${facts.length ? `<div class="jt-facts">${facts.map(f => `<span>${f}</span>`).join('')}</div>` : ''}
      ${record.notes ? `<div class="jt-note">${esc(record.notes)}</div>` : ''}
    </div>`;
};

const cumulativeBlock = (records, upto, isAr) => {
  const cum = cumulative(records, upto);
  return `
    <div class="jt-block">
      ${jointsTable({
        title: isAr ? `جرد أعمال الجوينات التراكمي${upto ? ` لغاية ( ${paperDate(upto)} )` : ''}` : `Cumulative joints count${upto ? ` up to ( ${paperDate(upto)} )` : ''}`,
        groups: cum.groups,
        total: cum.totals.total,
        totalLabel: isAr ? 'المجموع الكلي (التراكمي)' : 'Cumulative grand total',
        isAr,
      })}
    </div>`;
};

/**
 * Elevation of the joints: a stack of chevrons with each course's width,
 * between two 14.5 m height dimension lines.
 */
const COURSES = [3.3, 3.7, 4.2, 4.6, 5.1, 5.3, 5.4, 5.6, 5.8, 3.7, 3.7, 2.6];

export const jointsDrawing = (isAr = true) => {
  const cx = 50;
  const top = 8;
  const step = 12.5;
  const scale = 9;
  const m = isAr ? 'م' : 'm';
  const courses = COURSES.map((w, i) => {
    const half = (w * scale) / 2;
    const y = top + i * step;
    const rise = Math.min(half * 0.55, 11);
    return { w, half, y, rise, dimY: y + rise + 2.4 };
  });
  // Shapes first, then every label on top so no course hides another's width.
  const chevrons = courses.map(({ half, y, rise, dimY }) => {
    const pts = `${cx - half},${y + rise} ${cx},${y} ${cx + half},${y + rise}`;
    return `
      <polyline points="${pts}" fill="none" stroke="#52525b" stroke-width="3.6" stroke-linejoin="miter"/>
      <polyline points="${pts}" fill="none" stroke="#e4e4e7" stroke-width="1.8" stroke-linejoin="miter"/>
      <line x1="${cx - half}" y1="${dimY}" x2="${cx + half}" y2="${dimY}" stroke="#71717a" stroke-width="0.35"/>`;
  }).join('') + courses.map(({ w, dimY }) => `
      <text x="${cx}" y="${dimY + 3.4}" font-size="3.4" font-weight="700" text-anchor="middle" fill="#27272a" stroke="#ffffff" stroke-width="1.2" paint-order="stroke">${num(w)} ${m}</text>`).join('');
  const bottom = top + (COURSES.length - 1) * step + 18;
  const dim = (x) => `
    <line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#1e3a8a" stroke-width="0.5"/>
    <polygon points="${x - 1.6},${top + 3.5} ${x},${top} ${x + 1.6},${top + 3.5}" fill="#1e3a8a"/>
    <polygon points="${x - 1.6},${bottom - 3.5} ${x},${bottom} ${x + 1.6},${bottom - 3.5}" fill="#1e3a8a"/>
    <text x="${x - 1.8}" y="${(top + bottom) / 2}" font-size="3.6" font-weight="700" text-anchor="middle" fill="#1e3a8a" transform="rotate(-90 ${x - 1.8} ${(top + bottom) / 2})">14.5 ${m}</text>`;
  return `
    <figure class="jt-drawing">
      <svg viewBox="0 0 100 ${bottom + 4}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(isAr ? 'مخطط الجوينات' : 'Joints drawing')}">
        ${dim(7)}${dim(93)}
        ${chevrons}
      </svg>
      <figcaption>${esc(isAr ? 'مخطط الجوينات (الارتفاع 14.5 م)' : 'Joints elevation (height 14.5 m)')}</figcaption>
    </figure>`;
};

const SIGNATURES = [
  { ar: 'دائرة المهندس المقيم', en: 'Resident Engineer Office' },
  { ar: 'مهندس الموقع', en: 'Site Engineer' },
  { ar: 'ممثل الجهة المستفيدة', en: 'Client Representative' },
];

/** One day's sheet, with the cumulative count up to that day. */
export function buildJointsDayReport({ record, records, lang }) {
  const isAr = lang === 'ar';
  const totals = dayTotals(record);
  const body = `
    ${STYLE}
    <div class="jt-layout">
      <div class="jt-stack">
        ${dayBlock(record, isAr)}
        ${cumulativeBlock(records, record.report_date, isAr)}
      </div>
      ${jointsDrawing(isAr)}
    </div>`;
  return buildReport({
    lang,
    title: isAr ? 'تقدم أعمال الجوينات اليومي' : 'Daily Joints Progress',
    subtitle: fmtDate(record.report_date, lang, 'long'),
    code: docCode('JNT'),
    meta: [
      { label: isAr ? 'تاريخ الجرد' : 'Date', value: paperDate(record.report_date) },
      { label: isAr ? 'الأفقية' : 'Horizontal', value: `${num(totals.horizontal)} ${meterUnit(isAr)}` },
      { label: isAr ? 'العمودية' : 'Vertical', value: `${num(totals.vertical)} ${meterUnit(isAr)}` },
      { label: isAr ? 'مجموع اليوم' : 'Day total', value: `${num(totals.total)} ${meterUnit(isAr)}` },
    ],
    body: h.raw(body),
    signatures: SIGNATURES,
  });
}

/** Every day in a period, then the cumulative count up to the period end. */
export function buildJointsRangeReport({ list, records, from, to, lang }) {
  const isAr = lang === 'ar';
  const days = byDateAsc(list);
  const period = days.reduce((acc, r) => {
    const t = dayTotals(r);
    acc.horizontal += t.horizontal; acc.vertical += t.vertical; acc.total += t.total;
    acc.workers += Number(r.workers_count) || 0;
    return acc;
  }, { horizontal: 0, vertical: 0, total: 0, workers: 0 });
  const upto = to || (days.length ? days[days.length - 1].report_date : undefined);
  const range = from || to
    ? `${from ? fmtDate(from, lang) : '...'} - ${to ? fmtDate(to, lang) : '...'}`
    : (isAr ? 'كل الأيام' : 'All days');
  const perType = JOINT_TYPES.map(t => ({
    label: t.label[isAr ? 'ar' : 'en'],
    value: `${num(period[t.id])} ${meterUnit(isAr)}`,
  }));

  const body = `
    ${STYLE}
    ${h.kpis([
      ...perType,
      { label: isAr ? 'مجموع الفترة' : 'Period total', value: `${num(period.total)} ${meterUnit(isAr)}`, tone: 'success' },
      { label: isAr ? 'أيام العمل' : 'Work days', value: num(days.length) },
    ]).html}
    ${h.section(isAr ? 'الجرد التراكمي' : 'Cumulative count', h.raw(`
      <div class="jt-layout">
        <div class="jt-stack">${cumulativeBlock(records, upto, isAr)}</div>
        ${jointsDrawing(isAr)}
      </div>`), { index: 1 }).html}
    ${h.section(isAr ? 'الجرد اليومي' : 'Daily counts', h.raw(`
      <div class="jt-stack">${days.map(r => dayBlock(r, isAr)).join('')}</div>`), { index: 2 }).html}`;

  return buildReport({
    lang,
    title: isAr ? 'تقرير تقدم أعمال الجوينات' : 'Joints Progress Report',
    subtitle: range,
    code: docCode('JNT'),
    meta: [
      { label: isAr ? 'الفترة' : 'Period', value: range },
      { label: isAr ? 'أيام العمل' : 'Work days', value: num(days.length) },
      { label: isAr ? 'مجموع الفترة' : 'Period total', value: `${num(period.total)} ${meterUnit(isAr)}` },
    ],
    body: h.raw(body),
    signatures: SIGNATURES,
  });
}
