const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.theme='dark');
 let categories=[],expenses=[],serial=1,posts=0,failSave=false;
 const stats=c=>{const rows=expenses.filter(e=>e.categoryId===(c.id==='uncategorized'?null:c.id)),total=rows.reduce((s,e)=>s+Number(e.amountUzs),0),all=expenses.reduce((s,e)=>s+Number(e.amountUzs),0);return {...c,count:rows.length,expenseUzs:String(total),expenseUsd:String(total/12500),sharePercent:String(all?total/all*100:0)}};
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();let data={};
  if(path==='/api/auth/telegram')data={role:'USER'};
  else if(path==='/api/analytics/overview')data={todayIncomeUzs:'0',todayExpenseUzs:'0'};
  else if(path==='/api/analytics/timeline')data={items:[]};
  else if(path==='/api/transactions')data={items:[],nextCursor:null};
  else if(path==='/api/categories/summary')data={items:[...categories.map(stats),...(expenses.some(e=>e.categoryId===null)?[stats({id:'uncategorized',name:'Без категории'})]:[])],totalExpenseUzs:String(expenses.reduce((s,e)=>s+Number(e.amountUzs),0)),totalExpenseUsd:'4'};
  else if(path==='/api/categories'&&method==='GET')data=categories;
  else if(path==='/api/categories'&&method==='POST'){
   posts++;if(failSave)return route.fulfill({status:503,json:{error:'unavailable'}});
   const body=route.request().postDataJSON();if(body.name==='Занято')return route.fulfill({status:409,json:{error:'CATEGORY_EXISTS'}});
   await new Promise(r=>setTimeout(r,100));const c={id:'c'+String(serial++).padStart(24,'0'),name:body.name};categories.push(c);return route.fulfill({status:201,json:c});
  }else if(path.match(/^\/api\/categories\/[^/]+\/transactions$/)){const id=path.split('/')[3];data={items:expenses.filter(e=>e.categoryId===(id==='uncategorized'?null:id)),nextCursor:null}}
  else if(path.match(/^\/api\/categories\/[^/]+$/)){
   const id=path.split('/')[3];if(method==='PATCH'){const c=categories.find(c=>c.id===id);c.name=route.request().postDataJSON().name;return route.fulfill({json:c})}
   if(method==='DELETE'){categories=categories.filter(c=>c.id!==id);expenses=expenses.map(e=>e.categoryId===id?{...e,categoryId:null}:e);return route.fulfill({status:204})}
  }
  return route.fulfill({json:data});
 });
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Категории',exact:true}).click();await page.getByRole('heading',{name:'Начните с первой категории'}).waitFor();
 await page.getByRole('button',{name:'Создать категорию',exact:true}).first().click();
 await page.locator('#category-name').fill('  Питание  ');await page.locator('.cat-primary[type=submit]').dblclick();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(posts,1);assert.equal(categories[0].name,'Питание');await page.getByRole('button',{name:'Операции категории Питание'}).waitFor();
 await page.getByRole('button',{name:'Создать категорию',exact:true}).click();await page.locator('#category-name').fill('питание');assert.equal(await page.locator('.cat-primary[type=submit]').isDisabled(),true);await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 expenses=[{id:'expense1',categoryId:categories[0].id,amountUzs:'50000',amountUsdSnapshot:'4',comment:'Обед',occurredAt:'2026-11-17T07:00:00Z'}];
 await page.getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Категории',exact:true}).click();await page.getByText('50 000 UZS',{exact:false}).first().waitFor();
 await page.getByRole('button',{name:'Операции категории Питание'}).click();await page.getByText('Обед',{exact:true}).waitFor();await page.getByRole('button',{name:'Переименовать',exact:true}).click();await page.locator('#category-name').fill('Продукты');await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Операции категории Продукты'}).waitFor();
 await page.getByLabel('Поиск категорий').fill('транспорт');await page.getByRole('heading',{name:'Ничего не найдено'}).waitFor();await page.getByRole('button',{name:'Очистить поиск'}).click();
 await page.getByRole('button',{name:'Создать категорию',exact:true}).click();await page.locator('#category-name').fill('Транспорт');failSave=true;await page.getByRole('button',{name:'Создать категорию',exact:true}).last().click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('#category-name').inputValue(),'Транспорт');failSave=false;await page.getByRole('button',{name:'Создать категорию',exact:true}).last().click();await page.getByRole('dialog').waitFor({state:'hidden'});
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tools/categories-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Операции категории Продукты'}).click();await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(categories.length,2);
 await page.getByRole('button',{name:'Операции категории Продукты'}).click();await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Операции категории Без категории'}).waitFor();assert.equal(expenses.length,1);assert.equal(expenses[0].amountUzs,'50000');
 await page.getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Добавить расход',exact:true}).click();await page.locator('.sheet input').nth(0).fill('50000');await page.locator('.sheet input').nth(1).fill('Поездка');await page.getByRole('button',{name:'Создать категорию в расходе'}).click();await page.locator('#category-name').fill('Такси');await page.locator('.cat-primary[type=submit]').click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.sheet input').nth(0).inputValue(),'50 000');assert.equal(await page.locator('.sheet input').nth(1).inputValue(),'Поездка');assert.equal(await page.getByLabel('Категория расхода').inputValue(),categories.find(c=>c.name==='Такси').id);await page.getByRole('button',{name:'Закрыть форму операции'}).click();
 await page.getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:'Светлая',exact:true}).click();await page.getByRole('button',{name:'Категории',exact:true}).click();await page.locator('.cat-list').waitFor();await page.getByRole('button',{name:'Создать категорию',exact:true}).click();await page.locator('#category-name').fill('Книги');await page.screenshot({path:'tools/category-editor-preview.png',fullPage:true});assert.equal(await page.getByRole('dialog').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('PASS: empty/search, create/double click/duplicate, rename, retry preserves draft, safe delete/uncategorized, expense quick-create preserves form and selects category, dark/light and mobile layout');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
