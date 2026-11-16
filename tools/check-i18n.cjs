const {chromium}=require(process.argv[2]||'playwright'),assert=require('node:assert/strict');require('tsx/cjs');
const {translations}=require('../apps/web/src/i18n.ts');const {buildReport,reportRange}=require('../apps/api/src/analytics.ts');
const tr=(key,lang)=>lang==='ru'?key:translations[key]?.[lang]||key;
(async()=>{
 const browser=await chromium.launch({headless:true});let actor='OWNER',serverLanguage='ru',failSave=false,patches=0;const errors=[];
 const now=new Date().toISOString(),user={id:'c123456789012345678901234',telegramId:'123456',firstName:'Aziz',lastName:'Original',username:'original_user',role:'USER',isBanned:false,createdAt:now,lastActivityAt:now,accessRequestStatus:null,accessRequestedAt:null,miniAppFirstOpenedAt:now,miniAppLastOpenedAt:now,botStartedAt:now,subscription:{startsAt:now,endsAt:'2099-12-01T00:00:00Z',revokedAt:null}};
 const category={id:'c123456789012345678901234',name:'Моя еда',expenseUzs:'50000',expenseUsd:'4',count:1,sharePercent:'100'};
 const trackingNote='Запуски бота, открытия Mini App и заявки учитываются с момента включения отслеживания. Старые не записанные действия неизвестны. Активность — открытие Mini App за последние 7 дней; наличие подписки не подтверждает оплату.';
 const setup=async page=>{page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),path=url.pathname;let data={};
  if(path==='/api/auth/telegram')data={role:actor,languageCode:serverLanguage,isBanned:false};
  else if(path==='/api/me/preferences'){patches++;if(failSave)return route.fulfill({status:503,json:{error:'unavailable'}});serverLanguage=route.request().postDataJSON().languageCode;data={languageCode:serverLanguage};}
  else if(path==='/api/me')data={...user,role:actor,languageCode:serverLanguage};
  else if(path==='/api/me/photo')return route.fulfill({status:404});
  else if(path==='/api/analytics/overview')data={todayIncomeUzs:'50000',todayExpenseUzs:'0',todayIncomeUsd:'4',todayExpenseUsd:'0'};
  else if(path==='/api/transactions')data={items:[{id:'tx1',type:'EXPENSE',amountUzs:'50000',occurredAt:now,category:{name:'Моя еда'},comment:'Мой комментарий'}],nextCursor:null};
  else if(path==='/api/categories')data=[category];
  else if(path==='/api/categories/summary')data={items:[category],totalExpenseUzs:'50000',totalExpenseUsd:'4'};
  else if(path.endsWith('/transactions'))data={items:[],nextCursor:null};
  else if(path==='/api/analytics/timeline')data={items:[{date:now.slice(0,10),incomeUzs:'50000',expenseUzs:'0',incomeUsd:'4',expenseUsd:'0'}]};
  else if(path==='/api/analytics/report')data=buildReport([],reportRange(url.searchParams.get('period')));
  else if(path==='/api/admin/overview')data={total:2,users:1,admins:1,botStarted:1,appOpened:1,active7Days:1,activeSubscriptions:1,withoutSubscription:0,expiredSubscriptions:0,revokedSubscriptions:0,banned:0,pendingRequests:0,registeredToday:1,trackingNote};
  else if(path==='/api/admin/users')data={items:[user],total:1};
  else if(path.includes('/api/admin/')&&path.endsWith('/audit'))data=path==='/api/admin/audit'?[]:{subscriptionEvents:[],audit:[]};
  return route.fulfill({json:data});
 })};
 const page=await browser.newPage({viewport:{width:390,height:844}});await setup(page);await page.goto('http://127.0.0.1:5173');await page.getByRole('heading',{name:tr('Управление Hisobchi','ru')}).waitFor();await page.getByRole('button',{name:tr('Мой кабинет','ru'),exact:true}).click();
 for(const name of ['Главная','История','Категории','Аналитика']){await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('.admin-return').count(),0)}
 await page.getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:/Открыть админ-панель/}).waitFor();assert.equal(await page.locator('.admin-return').count(),1);
 for(const lang of ['en','uz','ru']){
  const previous=await page.locator('html').getAttribute('lang');await page.getByLabel(tr('Язык интерфейса',previous)).selectOption(lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);assert.equal(serverLanguage,lang);
  await page.getByRole('heading',{name:tr('Профиль',lang),exact:true}).waitFor();await page.getByRole('heading',{name:'Aziz Original',exact:true}).waitFor();
  for(const key of ['Главная','История','Категории','Аналитика']){
   await page.getByRole('button',{name:tr(key,lang),exact:true}).click();assert.equal(await page.locator('.admin-return').count(),0);
   if(key==='Главная'){await page.getByText(tr('Валовой доход',lang),{exact:true}).waitFor();await page.getByRole('button',{name:tr('Добавить доход',lang),exact:true}).click();await page.getByRole('heading',{name:tr('Доход',lang),exact:true}).waitFor();await page.getByRole('button',{name:tr('Закрыть форму операции',lang)}).click();}
   if(key==='История'){await page.getByText('Моя еда',{exact:true}).waitFor();await page.getByText(/Мой комментарий/).waitFor()}
   if(key==='Категории'){await page.getByRole('button',{name:tr('Операции категории {{name}}',lang).replace('{{name}}','Моя еда')}).waitFor();await page.getByRole('button',{name:tr('Создать категорию',lang),exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:tr('Закрыть',lang),exact:true}).click();}
   if(key==='Аналитика'){await page.getByLabel(tr('Период аналитики',lang)).waitFor();await page.locator('.report-kpis').waitFor()}
  }
  await page.getByRole('button',{name:tr('Профиль',lang),exact:true}).click();await page.getByRole('button',{name:tr('Открыть админ-панель',lang)+' OWNER',exact:true}).click();await page.getByRole('heading',{name:tr('Управление Hisobchi',lang)}).waitFor();await page.getByText(trackingNote===tr(trackingNote,lang)?trackingNote:tr(trackingNote,lang),{exact:true}).waitFor();await page.getByRole('tab',{name:tr('Пользователи',lang),exact:true}).click();await page.getByRole('button',{name:tr('Открыть пользователя {{name}}',lang).replace('{{name}}','Aziz Original')}).click();await page.locator('.admin-user-facts').waitFor();assert.match(await page.locator('.admin-detail-identity').innerText(),/original_user/);await page.getByRole('button',{name:tr('Закрыть карточку пользователя',lang)}).click();
  await page.getByRole('button',{name:tr('Мой кабинет',lang),exact:true}).click();await page.getByRole('button',{name:tr('Профиль',lang),exact:true}).click();
 }
 assert.ok(patches>=3);await page.getByLabel('Язык интерфейса').selectOption('en');await page.getByRole('heading',{name:'Profile',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:tr('Управление Hisobchi','en')}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.getByRole('button',{name:tr('Мой кабинет','en'),exact:true}).click();await page.getByRole('button',{name:'Profile',exact:true}).click();
 failSave=true;await page.getByLabel('Interface language').selectOption('uz');await page.getByRole('alert').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.getByLabel('Interface language').inputValue(),'en');failSave=false;
 await page.getByLabel('Interface language').selectOption('uz');await page.waitForFunction(()=>document.documentElement.lang==='uz');await page.setViewportSize({width:320,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'tools/profile-language-preview.png',fullPage:true});
 const fresh=await browser.newPage({viewport:{width:390,height:844}});await setup(fresh);await fresh.goto('http://127.0.0.1:5173');await fresh.getByRole('heading',{name:tr('Управление Hisobchi','uz')}).waitFor();assert.equal(await fresh.locator('html').getAttribute('lang'),'uz');await fresh.close();
 actor='USER';await page.reload();await page.getByRole('button',{name:tr('Профиль','uz'),exact:true}).click();await page.locator('.account-language').waitFor();assert.equal(await page.locator('.admin-return').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: admin entry only in OWNER/ADMIN profile; RU/UZ/EN navigation/forms/charts/categories/admin; user data unchanged; persisted language after reload and fresh session; failed save does not switch; USER has no admin entry; 320px layout');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
