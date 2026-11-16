// UI integration check with isolated API fixtures; never writes user data.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.theme = 'dark'; });
  let fail = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path.endsWith('/telegram')) data = { role: 'USER' };
    else if (path.endsWith('/overview')) data = { todayIncomeUzs: '900000', todayExpenseUzs: '50000', todayIncomeUsd: '70.25', todayExpenseUsd: '3.91' };
    else if (path.endsWith('/categories')) data = [];
    else if (path.endsWith('/transactions')) data = { items: [], nextCursor: null };
    else if (path.endsWith('/timeline')) {
      if (fail) return route.fulfill({ status: 503, json: { error: 'unavailable' } });
      const n = Number(new URL(route.request().url()).searchParams.get('days'));
      data = { items: Array.from({ length: n }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, incomeUzs: String(i === n - 1 ? 900000 : i === n - 2 ? 800000 : i * 100000), expenseUzs: String(i * 20000), incomeUsd: String(i * 8), expenseUsd: String(i * 2) })) };
    }
    await route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'Динамика по дням' }).waitFor();
  await page.locator('.daily-plot svg').waitFor();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await page.locator('.daily-scroll').boundingBox();
    assert.ok(Math.abs(box.x - 8) < 1, `left inset at ${width}: ${box.x}`);
    assert.ok(Math.abs(box.x + box.width - (width - 8)) < 1, `right inset at ${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.daily-plot circle').count(), 14);
  assert.equal(await page.locator('.daily-axis').filter({ hasText: '07.11' }).count(), 1);
  const hit = page.locator('rect[role=button]').last();
  await hit.hover();
  assert.match(await page.locator('.daily-tooltip').innerText(), /900\s000/);
  await hit.focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.daily-tooltip').innerText(), /7 ноября/);
  await hit.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: (await hit.boundingBox()).x + 5 });
  await page.waitForTimeout(100);
  for (const rect of await page.locator('rect[role=button]').all()) {
    await rect.hover();
    const tip = await page.locator('.daily-tooltip').boundingBox();
    assert.ok(tip && tip.x >= 0 && tip.x + tip.width <= 390);
  }
  await page.screenshot({ path: 'tools/chart-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Расходы', exact: true }).click();
  assert.equal(await page.locator('.daily-plot circle').count(), 7);
  await page.getByLabel('Валюта графика').selectOption('USD');
  assert.match(await page.locator('.daily-unit').textContent(), /USD/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать данные графика CSV' }).click();
  assert.match((await downloadPromise).suggestedFilename(), /USD.csv$/);
  await page.getByRole('button', { name: '14 дней' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.daily-plot rect[role=button]').length === 14);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  fail = true;
  await page.getByRole('button', { name: '30 дней' }).click();
  await page.getByText('Не удалось загрузить данные графика').waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Повторить' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.daily-plot rect[role=button]').length === 30);
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  assert.equal(await page.locator('.daily-chart').evaluate(el => getComputedStyle(el).color), 'rgb(21, 23, 27)');
  await page.getByRole('button', { name: 'Добавить доход', exact: true }).click();
  await page.getByRole('heading', { name: 'Доход', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть форму операции' }).click();
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await page.getByRole('heading', { name: 'Расход', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Закрыть форму операции' }).click();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.locator('.money-actions').screenshot({ path: 'tools/money-actions-preview.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: mobile chart, hover/tap/keyboard, scales, currency, legend, CSV, periods, retry, light theme, no page overflow or runtime errors');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
