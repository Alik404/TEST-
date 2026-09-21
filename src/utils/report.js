/**
 * Report engine: every printable report in the app is built here, so all
 * PDFs share one letterhead, one type scale, one colour language and the
 * same pagination rules.
 *
 *   const html = buildReport({ lang, title, meta, body: h.section(...) + h.table(...) });
 *   openReport(html, { title });   // shows the in-app preview with Print / Save PDF
 *
 * Every value interpolated through the helpers is HTML-escaped. Use h.raw()
 * only for markup produced by another helper.
 */
import logoUrl from '../assets/company-logo.webp';
import { ORG, DEFAULT_SIGNATURES } from '../config/org';
import { date as fmtDate, time as fmtTime } from './format';

export const REPORT_EVENT = 'app:report';

// ── Escaping ─────────────────────────────────────────────────────────────

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) =>
  value === null || value === undefined ? '' : String(value).replace(/[&<>"']/g, ch => ESC[ch]);

class Raw {
  constructor(html) { this.html = html; }
  toString() { return this.html; }
}

const render = (value) => (value instanceof Raw ? value.html : esc(value));

// ── Formatting ───────────────────────────────────────────────────────────

const today = (lang) => fmtDate(new Date(), lang, 'long');
const nowTime = (lang) => fmtTime(new Date(), lang);

// ── Building blocks ──────────────────────────────────────────────────────

const toneClass = (tone) => (tone ? ` t-${tone}` : '');

/** A value as a CSS string literal (for generated content). */
const cssString = (value) => `"${String(value).replace(/[\\"]/g, ch => `\\${ch}`).replace(/[\n\r]/g, ' ')}"`;

export const h = {
  raw: (html) => new Raw(html),

  text: (value) => new Raw(esc(value)),

  /** Numbered section with a title bar. */
  section: (title, content, { index, note } = {}) => new Raw(`
    <section class="r-section">
      <h2 class="r-section-title">${index ? `<span class="r-index">${esc(index)}</span>` : ''}<span>${esc(title)}</span>${note ? `<span class="r-section-note">${esc(note)}</span>` : ''}</h2>
      ${render(content)}
    </section>`),

  /** Summary figures row. items: [{ label, value, sub, tone }] */
  kpis: (items) => new Raw(`
    <div class="r-kpis r-kpis-${Math.min(items.length, 4)}">
      ${items.map(k => `
        <div class="r-kpi">
          <div class="r-kpi-label">${esc(k.label)}</div>
          <div class="r-kpi-value${toneClass(k.tone)}">${render(k.value)}</div>
          ${k.sub ? `<div class="r-kpi-sub">${render(k.sub)}</div>` : ''}
        </div>`).join('')}
    </div>`),

  /** Label / value grid. items: [{ label, value }] */
  kv: (items, cols = 4) => new Raw(`
    <div class="r-kv r-kv-${cols}">
      ${items.map(i => `<div class="r-kv-item"><span>${esc(i.label)}</span><strong>${render(i.value)}</strong></div>`).join('')}
    </div>`),

  /**
   * Table.
   * columns: [{ label, align: 'start'|'center'|'end', width }]
   * rows:    array of arrays of cells, or { group: 'Title', note } for a group banner,
   *          or { cells: [...], cls: 'done' } for a styled row.
   * cell:    plain value, h.raw(html), or { v, align, cls, colspan, strong, tone }
   * foot:    optional row of cells shown as a totals row.
   * groups:  optional header row above the columns: [{ label, span }]
   */
  table: ({ columns, rows, foot, groups, compact = false }) => {
    const cellHtml = (cell, col = {}, tag = 'td') => {
      const isObj = cell && typeof cell === 'object' && !(cell instanceof Raw);
      const value = isObj ? cell.v : cell;
      const align = (isObj && cell.align) || col.align || 'start';
      const classes = [`a-${align}`];
      if (isObj && cell.cls) classes.push(cell.cls);
      if (isObj && cell.strong) classes.push('strong');
      if (isObj && cell.tone) classes.push(`t-${cell.tone}`);
      const span = isObj && cell.colspan ? ` colspan="${cell.colspan}"` : '';
      return `<${tag} class="${classes.join(' ')}"${span}>${render(value === undefined || value === '' ? '-' : value)}</${tag}>`;
    };
    const head = columns.map(c =>
      `<th class="a-${c.align || 'start'}"${c.width ? ` style="width:${esc(c.width)}"` : ''}>${esc(c.label)}</th>`).join('');
    const body = rows.map(row => {
      if (row && row.group !== undefined) {
        return `<tr class="r-group"><td colspan="${columns.length}"><span>${esc(row.group)}</span>${row.note ? `<em>${esc(row.note)}</em>` : ''}</td></tr>`;
      }
      const cells = Array.isArray(row) ? row : row.cells;
      const cls = !Array.isArray(row) && row.cls ? ` class="${esc(row.cls)}"` : '';
      let colIndex = 0;
      const tds = cells.map(cell => {
        const html = cellHtml(cell, columns[colIndex]);
        colIndex += (cell && typeof cell === 'object' && !(cell instanceof Raw) && cell.colspan) || 1;
        return html;
      }).join('');
      return `<tr${cls}>${tds}</tr>`;
    }).join('');
    let footHtml = '';
    if (foot) {
      let colIndex = 0;
      footHtml = `<tfoot><tr>${foot.map(cell => {
        const html = cellHtml(cell, columns[colIndex]);
        colIndex += (cell && typeof cell === 'object' && !(cell instanceof Raw) && cell.colspan) || 1;
        return html;
      }).join('')}</tr></tfoot>`;
    }
    const groupRow = groups
      ? `<tr class="r-head-groups">${groups.map(g => `<th colspan="${g.span || 1}" class="a-center">${esc(g.label || '')}</th>`).join('')}</tr>`
      : '';
    return new Raw(`
      <table class="r-table${compact ? ' r-compact' : ''}">
        <thead>${groupRow}<tr>${head}</tr></thead>
        <tbody>${body || `<tr><td class="a-center r-empty" colspan="${columns.length}">-</td></tr>`}</tbody>
        ${footHtml}
      </table>`);
  },

  /** Small inline progress indicator for table cells. */
  progress: (pct) => {
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    const tone = v >= 100 ? 'done' : v >= 50 ? 'mid' : v > 0 ? 'low' : 'none';
    return new Raw(`<div class="r-prog"><b>${v.toFixed(1)}%</b><i class="r-bar r-${tone}"><s style="width:${v}%"></s></i></div>`);
  },

  badge: (text, tone) => new Raw(`<span class="r-badge${toneClass(tone)}">${esc(text)}</span>`),

  /** Paper-form checkbox, drawn in CSS (no glyph needed). */
  check: (on, label) => new Raw(`<span class="r-check${on ? ' on' : ''}"><i></i>${label ? esc(label) : ''}</span>`),

  notes: (title, text) => new Raw(text ? `
    <div class="r-notes">
      <div class="r-notes-title">${esc(title)}</div>
      <div class="r-notes-body">${esc(text)}</div>
    </div>` : ''),

  /** Keeps a block (e.g. a summary + table start) on one page when it fits. */
  keep: (content) => new Raw(`<div class="r-keep">${render(content)}</div>`),

  pageBreak: () => new Raw('<div class="r-page-break"></div>'),
};

// ── Document ─────────────────────────────────────────────────────────────

const STYLES = `
  @page {
    size: A4 __ORIENT__;
    margin: 11mm 11mm 15mm;
    __MARGIN_BOXES__
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; background: #ffffff; color: #18181b;
    font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 10.5pt; line-height: 1.5;
  }
  .r-doc { padding: 0; }

  /* Letterhead */
  .r-head { padding-bottom: 3.5mm; border-bottom: 2px solid #18181b; }
  .r-head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
  .r-org { display: flex; align-items: center; gap: 3mm; }
  .r-org img { width: 15mm; height: 15mm; object-fit: contain; }
  .r-org-text { display: flex; flex-direction: column; line-height: 1.35; }
  .r-org-text strong { font-size: 10pt; font-weight: 800; }
  .r-org-text span { font-size: 8pt; color: #52525b; }
  .r-title { text-align: center; margin-top: 3mm; }
  .r-title .r-project { font-size: 9pt; color: #52525b; font-weight: 600; }
  .r-title h1 { margin: 0.5mm 0 0; font-size: 16pt; font-weight: 800; line-height: 1.3; }
  .r-title p { margin: 1mm 0 0; font-size: 9.5pt; color: #047857; font-weight: 700; }
  .r-ref { display: flex; flex-direction: column; align-items: flex-end; gap: 0.6mm; font-size: 8pt; color: #52525b; line-height: 1.4; }
  .r-ref strong { color: #18181b; font-weight: 700; }
  .r-ref .r-code { font-family: 'JetBrains Mono', ui-monospace, monospace; direction: ltr; unicode-bidi: isolate; }

  /* Meta */
  .r-kv { display: grid; gap: 2mm 5mm; margin-top: 4mm; padding: 3mm 4mm; background: #f4f4f5; border-radius: 2mm; }
  .r-kv-2 { grid-template-columns: repeat(2, 1fr); } .r-kv-3 { grid-template-columns: repeat(3, 1fr); }
  .r-kv-4 { grid-template-columns: repeat(4, 1fr); } .r-kv-5 { grid-template-columns: repeat(5, 1fr); }
  .r-kv-item { display: flex; flex-direction: column; min-width: 0; }
  .r-kv-item span { font-size: 7.5pt; color: #52525b; font-weight: 600; }
  .r-kv-item strong { font-size: 9.5pt; font-weight: 800; }

  /* KPIs */
  .r-kpis { display: grid; gap: 3mm; margin-top: 4mm; }
  .r-kpis-1 { grid-template-columns: 1fr; } .r-kpis-2 { grid-template-columns: repeat(2, 1fr); }
  .r-kpis-3 { grid-template-columns: repeat(3, 1fr); } .r-kpis-4 { grid-template-columns: repeat(4, 1fr); }
  .r-kpi { border: 1px solid #d4d4d8; border-radius: 2mm; padding: 2.5mm 3.5mm; break-inside: avoid; }
  .r-kpi-label { font-size: 7.5pt; color: #52525b; font-weight: 700; }
  .r-kpi-value { font-size: 14pt; font-weight: 800; line-height: 1.25; font-variant-numeric: tabular-nums; }
  .r-kpi-sub { font-size: 7.5pt; color: #52525b; margin-top: 0.5mm; }

  /* Sections */
  .r-section { margin-top: 6mm; }
  .r-section-title { display: flex; align-items: center; gap: 2mm; margin: 0 0 2.5mm; font-size: 11pt; font-weight: 800;
    break-after: avoid; }
  .r-index { display: inline-grid; place-items: center; width: 5.5mm; height: 5.5mm; border-radius: 50%;
    background: #18181b; color: #ffffff; font-size: 8pt; }
  .r-section-note { margin-inline-start: auto; font-size: 8pt; font-weight: 600; color: #52525b; }

  /* Tables */
  .r-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .r-table thead { display: table-header-group; }
  .r-table tfoot { display: table-row-group; }
  .r-table th { background: #18181b; color: #ffffff; font-weight: 700; font-size: 8pt; padding: 2mm 2mm;
    border: 1px solid #18181b; }
  .r-table .r-head-groups th { background: #3f3f46; border-color: #3f3f46; padding: 1.2mm 2mm; }
  .r-table td { padding: 1.8mm 2mm; border: 1px solid #d4d4d8; vertical-align: middle; }
  .r-table tbody tr:nth-child(even) td { background: #fafafa; }
  .r-table tr { break-inside: avoid; }
  .r-table.r-compact td { padding: 1.2mm 1.6mm; font-size: 8.5pt; }
  .r-table .a-start { text-align: start; } .r-table .a-center { text-align: center; } .r-table .a-end { text-align: end; }
  .r-table .strong { font-weight: 800; }
  .r-table .num, .r-table td.a-center, .r-table td.a-end { font-variant-numeric: tabular-nums; }
  .r-table tr.done td { background: #f0faf5 !important; }
  .r-table tfoot td { background: #f4f4f5; font-weight: 800; border-top: 2px solid #18181b; }
  .r-group td { background: #e4e4e7 !important; font-weight: 800; font-size: 8.5pt; padding: 1.5mm 2mm; }
  .r-group td span { margin-inline-end: 3mm; }
  .r-group td em { font-style: normal; font-weight: 600; color: #3f3f46; }
  .r-empty { color: #71717a; }

  /* Tones (text) */
  .t-success { color: #047857; } .t-warn { color: #b45309; } .t-danger { color: #b91c1c; }
  .t-info { color: #0369a1; } .t-muted { color: #71717a; }

  .r-prog { display: flex; flex-direction: column; align-items: center; gap: 0.8mm; }
  .r-prog b { font-size: 8.5pt; direction: ltr; unicode-bidi: isolate; }
  .r-bar { display: block; width: 16mm; height: 1.4mm; background: #e4e4e7; border-radius: 1mm; overflow: hidden; }
  .r-bar s { display: block; height: 100%; text-decoration: none; }
  .r-done s { background: #047857; } .r-mid s { background: #10b981; } .r-low s { background: #d97706; } .r-none s { background: #a1a1aa; }

  .r-badge { display: inline-block; padding: 0.2mm 1.8mm; border-radius: 3mm; font-size: 7pt; font-weight: 700;
    background: #f4f4f5; color: #3f3f46; border: 1px solid #d4d4d8; margin-inline-start: 1.5mm; vertical-align: middle; }
  .r-badge.t-success { background: #e6f4ee; border-color: #b7e0cc; }
  .r-badge.t-warn { background: #fdf6ea; border-color: #f2d7a8; }
  .r-badge.t-danger { background: #fbeaea; border-color: #f0bcbc; }

  .r-check { display: inline-flex; align-items: center; gap: 1.2mm; margin-inline-end: 3mm; }
  .r-check i { display: inline-block; width: 3.2mm; height: 3.2mm; border: 1px solid #18181b; border-radius: 0.6mm; position: relative; }
  .r-check.on i::after { content: ''; position: absolute; inset: 0.6mm; background: #18181b; border-radius: 0.3mm; }
  .r-notes { margin-top: 4mm; padding: 3mm 4mm; border: 1px solid #d4d4d8; border-radius: 2mm; break-inside: avoid; }
  .r-notes-title { font-size: 8.5pt; font-weight: 800; margin-bottom: 1mm; }
  .r-notes-body { font-size: 9pt; white-space: pre-wrap; color: #3f3f46; }

  .r-keep { break-inside: avoid; }
  .r-page-break { break-after: page; }

  /* Sign-off */
  .r-signs { display: grid; gap: 5mm; margin-top: 9mm; break-inside: avoid; }
  .r-signs-2 { grid-template-columns: repeat(2, 1fr); } .r-signs-3 { grid-template-columns: repeat(3, 1fr); }
  .r-signs-4 { grid-template-columns: repeat(4, 1fr); }
  .r-sign { text-align: center; font-size: 8.5pt; }
  .r-sign strong { display: block; font-weight: 800; font-size: 9pt; }
  .r-sign em { display: block; font-style: normal; color: #52525b; font-size: 8pt; min-height: 4mm; }
  .r-sign-line { margin-top: 13mm; border-top: 1px solid #71717a; padding-top: 1mm; color: #71717a; font-size: 7.5pt; }

  /* Running footer (repeats on every printed page) */
  .r-foot { display: none; }

  @media screen {
    html { background: #ffffff; }
    body { padding: 11mm; }
    .r-foot { display: flex; justify-content: space-between; gap: 5mm; margin-top: 8mm; padding-top: 1.5mm;
      border-top: 1px solid #d4d4d8; font-size: 7pt; color: #71717a; }
  }
`;

const signaturesHtml = (signatures, lang) => {
  if (!signatures || signatures.length === 0) return '';
  const cols = Math.min(signatures.length, 4);
  const line = lang === 'ar' ? 'التوقيع والتاريخ' : 'Signature & date';
  return `
    <div class="r-signs r-signs-${cols}">
      ${signatures.map(s => {
        const role = typeof s === 'string' ? s : (s[lang] || s.ar || s.role || '');
        const name = typeof s === 'object' && s.name ? s.name : '';
        return `<div class="r-sign"><strong>${esc(role)}</strong><em>${esc(name)}</em><div class="r-sign-line">${line}</div></div>`;
      }).join('')}
    </div>`;
};

const absoluteLogo = () => {
  try { return new URL(logoUrl, window.location.origin).href; } catch { return logoUrl; }
};

/**
 * Builds a complete, self-contained HTML document for printing.
 *
 * title       report title (h1)
 * subtitle    optional line under the title
 * code        document reference, e.g. 'PRG-2026-09'
 * meta        [{ label, value }] shown under the letterhead
 * body        HTML (use the h.* helpers)
 * signatures  [{ ar, en, name }] or strings; [] to omit
 * orientation 'portrait' | 'landscape'
 */
export function buildReport({
  lang = 'ar',
  title,
  subtitle,
  code,
  meta = [],
  body = '',
  signatures = DEFAULT_SIGNATURES,
  orientation = 'portrait',
  fileName,
}) {
  const isAr = lang === 'ar';
  const L = (o) => (typeof o === 'string' ? o : o[isAr ? 'ar' : 'en']);
  const docTitle = fileName || `${title} - ${new Date().toISOString().slice(0, 10)}`;
  const metaCols = Math.min(Math.max(meta.length, 2), 5);
  // Running footer and page numbers on every printed page (Chromium page margin boxes).
  const footText = cssString(`${ORG.company} · ${title}`);
  const pageText = isAr ? '"صفحة " counter(page) " من " counter(pages)' : '"Page " counter(page) " of " counter(pages)';
  const boxStyle = "font-family: 'Cairo', sans-serif; font-size: 7pt; color: #71717a;";
  const startBox = isAr ? '@bottom-right' : '@bottom-left';
  const endBox = isAr ? '@bottom-left' : '@bottom-right';
  const marginBoxes = `${startBox} { content: ${footText}; ${boxStyle} } ${endBox} { content: ${pageText}; ${boxStyle} }`;

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>${STYLES.replace('__ORIENT__', orientation === 'landscape' ? 'landscape' : 'portrait').replace('__MARGIN_BOXES__', marginBoxes)}</style>
</head>
<body>
<div class="r-doc">
  <header class="r-head">
    <div class="r-head-top">
      <div class="r-org">
        <img src="${esc(absoluteLogo())}" alt="">
        <div class="r-org-text">
          <strong>${esc(ORG.company)}</strong>
          <span>${esc(L(ORG.siteName))}</span>
        </div>
      </div>
      <div class="r-ref">
        <span>${esc(L(ORG.country))} · ${esc(L(ORG.client))}</span>
        ${code ? `<span>${isAr ? 'رقم الوثيقة' : 'Ref'}: <strong class="r-code">${esc(code)}</strong></span>` : ''}
        <span>${isAr ? 'تاريخ الإصدار' : 'Issued'}: <strong>${esc(today(lang))}</strong></span>
      </div>
    </div>
    <div class="r-title">
      <div class="r-project">${esc(L(ORG.project))}</div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
    </div>
  </header>
  ${meta.length ? h.kv(meta, metaCols).html : ''}
  ${body instanceof Raw ? body.html : String(body)}
  ${signaturesHtml(signatures, lang)}
  <footer class="r-foot">
    <span>${esc(ORG.company)} · ${esc(title)}</span>
    <span>${isAr ? 'طُبع في' : 'Printed'} ${esc(today(lang))} ${esc(nowTime(lang))}</span>
  </footer>
</div>
</body>
</html>`;
}

/** Month-based reference code, e.g. PRG-2026-09. */
export const docCode = (prefix) => {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Opens the in-app preview; the user prints or saves as PDF from there. */
export function openReport(html, { title, orientation } = {}) {
  window.dispatchEvent(new CustomEvent(REPORT_EVENT, { detail: { html, title, orientation } }));
}
