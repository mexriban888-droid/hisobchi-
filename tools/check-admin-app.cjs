const {chromium}=require(process.argv[2]||'playwright');const assert=require('node:assert/strict');
require('tsx/cjs');const {buildReport,reportRange}=require('../apps/api/src/analytics.ts');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{if(!localStorage.theme)localStorage.theme='dark'});
 let actor='OWNER',financialReads=0,adminReads=0,grants=0,requests=0,requestKeys=new Set();
 const now=new Date().toISOString();const user={id:'c123456789012345678901234',telegramId:'123456',username:'new_user',firstName:'Новый',lastName:'Пользователь',role:'USER',isBanned:false,banReason:null,createdAt:now,lastActivityAt:now,botStartedAt:now,miniAppFirstOpenedAt:now,miniAppLastOpenedAt:now,accessRequestedAt:now,accessRequestStatus:'PENDING',subscription:null};
 const owner={...user,id:'c223456789012345678901234',telegramId:'7737214772',firstName:'Владелец',lastName:null,role:'OWNER',username:'owner'};const events=[];
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();let data={};
  if(path==='/api/auth/telegram')data={role:actor,isBanned:false};
  else if(path==='/api/me')data={...(actor==='USER'?user:owner),role:actor};
  else if(path==='/api/me/access-request'){requests++;user.accessRequestStatus='PENDING';user.accessRequestedAt=now;data={status:'PENDING'}}
  else if(path==='/api/analytics/report')data=buildReport([],reportRange('MONTH'));
  else if(path.startsWith('/api/admin/')){
   adminReads++;if(actor==='USER')return route.fulfill({status:403,json:{error:'ADMIN_REQUIRED'}});
   if(path==='/api/admin/overview')data={total:2,users:1,admins:1,botStarted:2,appOpened:2,active7Days:2,activeSubscriptions:user.subscription&&!user.subscription.revokedAt&&!user.isBanned?1:0,withoutSubscription:user.subscription?0:1,expiredSubscriptions:0,revokedSubscriptions:user.subscription?.revokedAt?1:0,banned:user.isBanned?1:0,pendingRequests:user.accessRequestStatus==='PENDING'?1:0,registeredToday:2,trackingNote:'Учитываются только записанные события. Старые действия неизвестны.'};
   else if(path==='/api/admin/users'){
    let items=[owner,user];const s=url.searchParams.get('search');if(s)items=items.filter(u=>[u.telegramId,u.username,u.firstName].join(' ').includes(s));const role=url.searchParams.get('role');if(role)items=items.filter(u=>u.role===role);const status=url.searchParams.get('status');if(status==='PENDING')items=items.filter(u=>u.accessRequestStatus==='PENDING'&&u.role==='USER');if(status==='NONE')items=items.filter(u=>!u.subscription&&u.role==='USER');data={items,total:items.length};
   }else if(path.endsWith('/subscription')&&method==='POST'){
    const input=route.request().postDataJSON();assert.ok(input.requestId);if(!requestKeys.has(input.requestId)){grants++;requestKeys.add(input.requestId);user.subscription={startsAt:now,endsAt:new Date(Date.now()+input.value*86400000).toISOString(),revokedAt:null};user.accessRequestStatus='APPROVED';events.push({id:String(events.length),action:'GRANT',occurredAt:now,newExpiresAt:user.subscription.endsAt})}return route.fulfill({status:204});
   }else if(path.endsWith('/subscription/revoke')){user.subscription.revokedAt=now;return route.fulfill({status:204})}
   else if(path.endsWith('/ban')){user.isBanned=true;user.banReason=route.request().postDataJSON().reason;return route.fulfill({status:204})}
   else if(path.endsWith('/unban')){user.isBanned=false;return route.fulfill({status:204})}
   else if(path.endsWith('/access-request/reject')){user.accessRequestStatus='REJECTED';return route.fulfill({status:204})}
   else if(path==='/api/admin/admins'&&method==='POST'){user.role='ADMIN';return route.fulfill({status:204})}
   else if(path.endsWith('/remove')){user.role='USER';return route.fulfill({status:204})}
   else if(path.endsWith('/audit'))data=path==='/api/admin/audit'?[]:{subscriptionEvents:events,audit:[]};
  }else{
   financialReads++;if(actor==='USER'&&(!user.subscription||user.subscription.revokedAt||user.isBanned))return route.fulfill({status:403,json:{error:'SUBSCRIPTION_REQUIRED'}});
   data=path.endsWith('/transactions')?{items:[],nextCursor:null}:path.endsWith('/categories')?[]:path.endsWith('/timeline')?{items:[]}:{};
  }
  return route.fulfill({json:data});
 });
 await page.goto('http://127.0.0.1:5173');await page.getByRole('heading',{name:'Управление Hisobchi'}).waitFor();assert.equal(financialReads,0);await page.getByText('Зарегистрировано',{exact:true}).waitFor();
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tools/admin-overview-preview.png',fullPage:true});
 await page.getByRole('tab',{name:/Заявки/}).click();await page.getByRole('button',{name:'Открыть пользователя Новый Пользователь'}).click();await page.getByLabel('Срок подписки').fill('30');await page.getByRole('button',{name:'Выдать / продлить',exact:true}).dblclick();await page.getByText('Подписка обновлена',{exact:true}).waitFor();assert.equal(grants,1);assert.equal(user.accessRequestStatus,'APPROVED');await page.getByText('Подписка активна',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Отозвать подписку',exact:true}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await page.getByText('Подписка отозвана',{exact:true}).waitFor();assert.ok(user.subscription.revokedAt);
 await page.getByRole('button',{name:'Заблокировать',exact:true}).click();await page.getByLabel('Причина административного действия').fill('Тестовая причина');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await page.getByText('Пользователь заблокирован',{exact:true}).waitFor();assert.ok(user.isBanned);
 await page.getByRole('button',{name:'Разблокировать',exact:true}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await page.getByText('Пользователь разблокирован',{exact:true}).waitFor();assert.equal(user.isBanned,false);
 await page.getByRole('button',{name:'Закрыть карточку пользователя'}).click();await page.getByRole('tab',{name:'Администраторы',exact:true}).click();await page.getByLabel('Назначить администратора по Telegram ID').fill('123456');await page.getByRole('button',{name:'Назначить',exact:true}).click();await page.getByText('Администратор назначен',{exact:true}).waitFor();assert.equal(user.role,'ADMIN');
 await page.getByRole('button',{name:'Открыть пользователя Новый Пользователь'}).click();await page.getByRole('button',{name:'Снять администратора',exact:true}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await page.getByText('Роль администратора снята',{exact:true}).waitFor();assert.equal(user.role,'USER');await page.getByRole('button',{name:'Закрыть карточку пользователя'}).click();
 await page.getByRole('button',{name:'Мой кабинет',exact:true}).click();await page.getByRole('button',{name:'Профиль',exact:true}).waitFor();
 for(const name of ['Главная','История','Категории','Аналитика']){await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('.admin-return').count(),0)}
 await page.getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:/Открыть админ-панель/}).click();await page.getByRole('heading',{name:'Управление Hisobchi'}).waitFor();
 actor='ADMIN';await page.reload();await page.getByRole('heading',{name:'Управление Hisobchi'}).waitFor();assert.equal(await page.getByRole('tab',{name:'Администраторы',exact:true}).count(),0);
 actor='USER';user.accessRequestStatus=null;const before=adminReads;await page.reload();await page.getByRole('heading',{name:'Нужна подписка'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Управление Hisobchi'}).count(),0);assert.equal(adminReads,before);
 await page.getByRole('button',{name:'Запросить доступ',exact:true}).click();await page.getByRole('button',{name:'Заявка отправлена',exact:true}).waitFor();assert.equal(requests,1);assert.equal(user.accessRequestStatus,'PENDING');assert.equal(await page.getByRole('button',{name:'Заявка отправлена',exact:true}).isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: OWNER/ADMIN auto admin mode, no financial fetch, overview/users/requests, grant idempotency, revoke/ban/unban, owner roles, personal/profile return, USER access request and no admin UI, 320px layout');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
