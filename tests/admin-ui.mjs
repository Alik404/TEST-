import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { startApp, material } from './helpers.mjs';
import { unpackBackup } from '../server/backup-format.js';

const cleanups = [];
const t = { after: cleanup => cleanups.push(cleanup) };
const out = path.resolve('.qa/operations');
await fs.mkdir(out, { recursive: true });
let browser;
try {
  const app = await startApp(t);
  const token = await app.login();
  const me = await app.api('/api/me', { token });
  for (let index = 0; index < 27; index++) await app.api('/api/materials-consumption', { token, method: 'POST', body: { ...material, prepared_by: `Test engineer ${index}` } });
  browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('project_token', token);
    localStorage.setItem('project_user', JSON.stringify(user));
    localStorage.setItem('project_lang', 'ar');
    localStorage.setItem('project_theme', 'light');
  }, { token, user: me.data.user });
  await page.goto(`${app.url}/#admin-operations`);
  await page.locator('.operations-event').first().waitFor();
  assert.equal(await page.locator('.operations-event').count(), 25);
  await page.getByRole('button', { name: 'عرض تغييرات أقدم' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.operations-event').length === 27);
  const detail = page.locator('.operations-details').first();
  await detail.locator('summary').click();
  assert.equal(await detail.getAttribute('open'), '');
  await detail.locator('summary').press('Space');
  assert.equal(await detail.getAttribute('open'), null);
  await page.getByLabel('الإجراء', { exact: true }).selectOption('update');
  await page.getByText('لا توجد تغييرات مسجلة', { exact: true }).waitFor();
  await page.getByLabel('الإجراء', { exact: true }).selectOption('');
  await page.locator('.operations-event').first().waitFor();
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تنزيل نسخة كاملة' }).click();
  const backup = await downloadReady;
  assert.equal(unpackBackup(await fs.readFile(await backup.path())).tables.materials_consumption.length, 27);
  await page.route('**/api/audit-events?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test connection failure' }) }));
  await page.getByRole('button', { name: 'تحديث السجل', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Test connection failure' }).waitFor();
  await page.unroute('**/api/audit-events?**');
  await page.getByRole('button', { name: 'تحديث السجل', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('section[aria-labelledby="audit-title"]').getAttribute('aria-busy') || document.querySelector('section[aria-labelledby="audit-title"]').getAttribute('aria-busy') === 'false');
  await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
  const a11y = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    for (const width of [280, 320, 414, 1365]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${theme} overflow at ${width}: ${overflow}`);
    }
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.addScriptTag({ path: path.resolve('node_modules/axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } });
      return result.violations.map(row => ({ id: row.id, impact: row.impact, nodes: row.nodes.map(node => node.target) }));
    });
    a11y.push({ theme, violations });
    assert.deepEqual(violations, [], JSON.stringify({ theme, violations }));
    await page.screenshot({ path: path.join(out, `${theme}-desktop.png`) });
    // Standalone rendered harness with the actual built CSS, no app scripts,
    // credentials or network links. Used by the existing contrast/state gates.
    let html = await page.content();
    const sheets = await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.href));
    let css = '';
    for (const href of sheets) css += await (await fetch(href)).text();
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link[^>]+>/gi, '').replace('</head>', `<style>${css}</style></head>`);
    await fs.writeFile(path.join(out, `${theme}.html`), html);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.screenshot({ path: path.join(out, `${theme}-mobile.png`) });
  }
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; document.documentElement.lang = 'en'; });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ interactions: 'pass', download: 'pass', pagination: 'pass', errorRecovery: 'pass',
    widths: [280,320,414,1365], themes: a11y, pageErrors: errors }, null, 2));
  console.log('Admin UI: interactions, pagination, backup download, empty/error states, light/dark, narrow widths and axe passed.');
  console.log(`Artifacts: ${out}`);
} finally {
  await browser?.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
}
