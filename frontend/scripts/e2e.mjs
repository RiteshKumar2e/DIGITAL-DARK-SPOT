/**
 * End-to-end browser check of the full research journey and responsive layout.
 * Requires both apps running (backend :4000, frontend :5173) and a local
 * Chrome or Edge. Usage:
 *   CHROME_PATH="/path/to/chrome" npm run test:e2e
 * Screenshots are written to frontend/e2e-output/ (git-ignored).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makePdf } from '../../backend/test/helpers.js';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const out = path.resolve('e2e-output');
fs.mkdirSync(out, { recursive: true });
const PDF = path.join(os.tmpdir(), 'dds-e2e-notice.pdf');
fs.writeFileSync(PDF, makePdf([
  `Fulbright-Nehru Master Fellowships notice
Eligibility: applicants must hold a bachelor degree and have three years of work experience.
The last date to apply is 15 May 2026.`,
  `Required documents: transcripts, three recommendation letters and a passport.
Selection is based on an interview with shortlisted candidates.`,
], { title: 'Fellowship notice (test document)' }));
const executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  console.error('Set CHROME_PATH to a local Chrome or Edge executable.');
  process.exit(2);
}
const browser = await chromium.launch({ executablePath });
const issues = [];
const log = (...a) => console.log(...a);

async function newPage(width, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && issues.push(`[${width}] console: ${m.text()}`));
  page.on('pageerror', (e) => issues.push(`[${width}] PAGEERROR: ${e.message}`));
  return page;
}
async function overflow(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
  if (o.sw > o.w) issues.push(`${label}: horizontal overflow ${o.sw} > ${o.w}`);
}

// 1. Landing → demo page → guided investigation
let page = await newPage(1280);
await page.goto(BASE);
log('h1:', await page.locator('h1').innerText());
await page.getByRole('link', { name: 'Explore a sample investigation' }).click();
await page.waitForURL(/\/demo$/);
log('demo title:', await page.title());
await page.getByRole('button', { name: 'Start the sample investigation' }).click();
await page.waitForURL(/research\/.+/);
await page.locator('.demo-guide').getByRole('button', { name: 'Run analysis' }).click();
await page.locator('.scope-summary').waitFor({ timeout: 60000 });
await page.locator('.demo-guide').getByRole('button', { name: 'Show gap' }).click();
log('gap focused:', (await page.evaluate(() => document.activeElement?.querySelector?.('.finding-title')?.textContent || document.activeElement?.className)));
await page.locator('.demo-guide').getByRole('button', { name: 'Show conflict' }).click();
log('conflict tab selected:', await page.getByRole('tab', { name: /Conflicts/ }).getAttribute('aria-selected'));
await page.locator('.demo-guide').getByRole('button', { name: 'Show freshness' }).click();
log('timeline events:', await page.locator('.timeline li').count(), '| today marker:', await page.locator('.timeline-today').count());
await page.screenshot({ path: `${out}/v2-freshness.png`, fullPage: true });
await page.locator('.demo-guide').getByRole('button', { name: 'Open evidence' }).click();
await page.locator('dialog[open] mark').waitFor();
log('evidence mark:', (await page.locator('dialog[open] mark').innerText()).slice(0, 70));
await page.keyboard.press('Escape');
await page.locator('.demo-guide').getByRole('button', { name: 'Open checklist' }).click();
const firstId = await page.locator('.check-item input[type=checkbox]').first().getAttribute('id');
await page.locator('#' + firstId).click();
await page.getByText(/^Done \(/).click();
log('done tag:', await page.locator('.check-item.is-done .tag-ok').first().innerText());
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download report (.md)' }).click()]);
const md = fs.readFileSync(await download.path(), 'utf8');
log('report: has SAMPLE banner', md.includes('SAMPLE DATA'), '| has done note', md.includes('marked done by the user'), '| lines', md.split('\n').length);
await page.getByRole('tab', { name: 'Overview' }).click();
log('quality factors:', await page.locator('.quality-list > div').count(), '| coverage status col:', await page.locator('.coverage thead th').last().innerText());
await page.locator('.coverage .cell-button').first().click();
await page.locator('dialog[open] mark').waitFor();
log('coverage cell opens evidence: yes');
await page.keyboard.press('Escape');
await page.screenshot({ path: `${out}/v2-overview.png`, fullPage: true });
const printable = await page.getByRole('link', { name: /Printable report/ }).getAttribute('href');
const resp = await page.request.get(printable);
log('printable report:', resp.status(), resp.headers()['content-type']);
await overflow(page, 'demo desktop');

// 2. Own session: scope, PDF upload, second source, search state, analysis
await page.goto(BASE + '/research');
await page.getByLabel('What are you trying to find out?').fill('What should I verify before applying for the Fulbright-Nehru Master Fellowship for 2027?');
await page.getByText('Add scope (optional)').click();
await page.getByLabel('Country or region').fill('India');
await page.getByRole('button', { name: 'Start a research session' }).click();
await page.waitForURL(/research\/.+/);
log('scope line:', await page.locator('.scope-line').innerText());
await page.getByText('Search', { exact: true }).click();
log('search state:', (await page.locator('.add-source .alert').first().innerText()).split('\n')[0]);
await page.getByText('Upload PDF', { exact: true }).click();
await page.getByLabel('PDF document').setInputFiles(PDF);
await page.getByRole('button', { name: 'Upload PDF' }).click();
await page.locator('.add-source .alert').waitFor({ timeout: 30000 });
log('pdf:', await page.locator('.add-source .alert').innerText());
await page.getByText('Web page', { exact: true }).click();
await page.getByLabel('Page address').fill('https://en.wikipedia.org/wiki/Fulbright_Program');
await page.getByRole('button', { name: 'Add source' }).click();
await page.locator('.add-source .alert-success, .add-source .alert-warning, .add-source .alert-error').waitFor({ timeout: 30000 });
log('url:', await page.locator('.add-source .alert').innerText());
await page.getByRole('button', { name: 'Run analysis' }).click();
await page.locator('.scope-summary').waitFor({ timeout: 90000 });
await page.getByRole('tab', { name: /Gaps/ }).click();
log('gaps:', (await page.locator('.finding-title').allInnerTexts()).slice(0, 6));
await page.getByRole('tab', { name: /Conflicts/ }).click();
log('conflicts:', await page.locator('.finding-title').allInnerTexts());
log('pdf page cite:', (await page.locator('.source-ref-name', { hasText: 'p.' }).allInnerTexts()).slice(0, 2));
await page.screenshot({ path: `${out}/v2-own.png`, fullPage: true });

// 3. Responsive checks
for (const w of [320, 375, 390, 768, 1024, 1440]) {
  const m = await newPage(w, 800);
  for (const p of ['/', '/research', '/demo', '/method', '/privacy', '/terms', '/missing']) {
    await m.goto(BASE + p);
    await m.waitForLoadState('networkidle');
    await overflow(m, `${w} ${p}`);
  }
  await m.goto(page.url());
  await m.locator('.scope-summary').waitFor();
  for (const tab of ['Overview', 'Gaps', 'Conflicts', 'Freshness', 'Checklist']) {
    await m.getByRole('tab', { name: new RegExp(tab) }).click();
    await overflow(m, `${w} session ${tab}`);
  }
  if (w === 375) await m.screenshot({ path: `${out}/v2-m375.png`, fullPage: true });
  await m.context().close();
}
await browser.close();
log('\nISSUES:\n' + (issues.join('\n') || 'none'));
process.exitCode = issues.length ? 1 : 0;
