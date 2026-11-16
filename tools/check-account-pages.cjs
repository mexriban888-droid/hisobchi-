const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
require('tsx/cjs');
const {buildReport,reportRange}=require('../apps/api/src/analytics.ts');
const now=new Date('2026-11-17T08:00:00Z');
const make=(id,date,amount,type='INCOME',categoryId=null)=>({id,occurredAt:new Date(date),amountUzs:BigInt(amount),amountUsdSnapshot:type==='INCOME'?'70.25':'3.91',type,categoryId,category:categoryId?{name:'Еда'}:null,comment:'Тестовая операция'});
const rows=[make('1','2026-11-17T07:00:00Z',900000),make('2','2026-11-16T07:00:00Z',50000,'EXPENSE','food'),make('3','2026-10-17T07:00:00Z',800000),make('4','2026-10-16T07:00:00Z',100000,'EXPENSE')];
(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.theme)localStorage.theme='dark'});
  let fail=false,photoAbsent=false;
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    let data={};
    if(path.endsWith('/telegram'))data={role:'USER'};
    else if(path.endsWith('/overview'))data={todayIncomeUzs:'900000',todayExpenseUzs:'50000',todayIncomeUsd:'70.25',todayExpenseUsd:'3.91'};
    else if(path.endsWith('/categories'))data=[];
    else if(path.endsWith('/transactions'))data={items:[],nextCursor:null};
    else if(path.endsWith('/timeline'))data={items:[]};
    else if(path.endsWith('/report')){
      if(fail)return route.fulfill({status:503,json:{error:'unavailable'}});
      data=buildReport(rows,reportRange(url.searchParams.get('period'),now,url.searchParams.get('from')||undefined,url.searchParams.get('to')||undefined),now);
    }else if(path.endsWith('/photo')){
      if(photoAbsent)return route.fulfill({status:404});
      return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5L8AAAAASUVORK5CYII=','base64')});
    }else if(path.endsWith('/me'))data={telegramId:'123456',firstName:'Азиз',lastName:'Тест',username:'test_user',role:'USER',createdAt:'2026-11-01T00:00:00Z',isBanned:false,subscription:{endsAt:'2099-12-01T00:00:00Z',revokedAt:null}};
    await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'Аналитика',exact:true}).click();
  await page.locator('.report-kpis').waitFor();
  assert.match(await page.locator('.report-kpis').innerText(),/900\s000/);
  assert.match(await page.locator('.report-category-list').innerText(),/Еда/);
  await page.getByRole('button',{name:'Столбчатый график'}).click();
  assert.ok(await page.locator('.report-comparison rect:not([role=button])').count()>0);
  await page.getByRole('button',{name:'Результат',exact:true}).click();
  await page.getByRole('button',{name:'Линейный график'}).click();
  await page.locator('.report-comparison rect[role=button]').nth(15).focus();
  await page.keyboard.press('Enter');
  await page.locator('.report-tooltip').waitFor();
  await page.getByLabel('Валюта аналитики').selectOption('USD');
  assert.match(await page.locator('.report-kpis').innerText(),/USD/);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать отчёт CSV'}).click();assert.match((await download).suggestedFilename(),/USD.csv$/);
  for(const period of ['TODAY','YESTERDAY','WEEK','LAST_WEEK','MONTH','LAST_MONTH']){await page.getByLabel('Период аналитики').selectOption(period);await page.locator('.report-kpis').waitFor();assert.ok(await page.locator('.report-comparison svg').count())}
  await page.getByLabel('Период аналитики').selectOption('CUSTOM');
  await page.locator('input[type=date]').nth(0).fill('2026-11-10');await page.locator('input[type=date]').nth(1).fill('2026-11-17');await page.getByRole('button',{name:'Показать',exact:true}).click();await page.locator('.report-kpis').waitFor();
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tools/analytics-preview.png',fullPage:true});
  fail=true;await page.getByLabel('Период аналитики').selectOption('TODAY');await page.getByRole('alert').waitFor();fail=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.locator('.report-kpis').waitFor();
  await page.getByRole('button',{name:'Профиль',exact:true}).click();
  await page.getByRole('heading',{name:'Азиз Тест'}).waitFor();assert.match(await page.locator('.account-identity').innerText(),/@test_user/);
  await page.waitForFunction(()=>document.querySelector('.account-photo img')?.naturalWidth>0);
  assert.match(await page.locator('.profile-page').innerText(),/Подписка активна/);
  await page.getByRole('button',{name:'Светлая',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');assert.equal(await page.evaluate(()=>localStorage.theme),'light');
  await page.getByRole('button',{name:'Аналитика',exact:true}).click();await page.locator('.report-kpis').waitFor();assert.equal(await page.locator('.account-page').evaluate(e=>getComputedStyle(e).color),'rgb(21, 21, 27)');
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.theme),'light');await page.getByRole('button',{name:'Профиль',exact:true}).click();await page.locator('.account-themes').waitFor();assert.equal(await page.getByRole('button',{name:'Светлая',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Тёмная',exact:true}).click();await page.screenshot({path:'tools/profile-preview.png',fullPage:true});
  photoAbsent=true;await page.reload();await page.getByRole('button',{name:'Профиль',exact:true}).click();await page.getByLabel('Инициалы пользователя').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: all analytics periods, custom range, comparison charts, metrics/currency, categories, CSV, retry, responsive layout, Telegram photo/fallback, persistent profile theme');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
