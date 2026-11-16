import { formatLocalizedDate } from './i18n';
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import WebApp from '@twa-dev/sdk';
import { useTranslation } from 'react-i18next';
import { t, getLocale, applyServerLanguage } from './i18n';
import {BarChart3,Clock3,FolderOpen,House,Moon,Plus,Sun,Trash2,UserRound,WalletCards,X} from 'lucide-react';
import './style.css';
import DailyChart from './DailyChart';
import AnalyticsPage from './AnalyticsPage';
import ProfilePage from './ProfilePage';
import MoneyActions from './MoneyActions';
import AdminPage from './AdminPage';
import './access-gate.css';
import { ShieldCheck } from 'lucide-react';
import CategoriesPage, { CategoryEditor, type Category } from './CategoriesPage';
const api=import.meta.env.VITE_API_URL||'';
const fmt=(v:any)=>new Intl.NumberFormat(getLocale()).format(Number(v||0));
const usd=(v:any)=>Number(v||0).toFixed(2);
type Tx={id:string;type:'INCOME'|'EXPENSE';amountUzs:string|number;comment?:string;occurredAt:string;category?:{name:string}|null};
type AppRole='USER'|'ADMIN'|'OWNER';
type GateUser={isBanned?:boolean;accessRequestStatus?:string;adminContact?:string;subscription?:{endsAt:string;revokedAt:string|null}|null};
function App(){
 useTranslation();
 const[tab,setTab]=useState('home'),[loading,setLoading]=useState(true),[blocked,setBlocked]=useState(''),[tx,setTx]=useState<Tx[]>([]),[cats,setCats]=useState<any[]>([]),[o,setO]=useState<any>({}),[modal,setModal]=useState<any>(null),[dark,setDark]=useState(localStorage.theme==='dark');
 const[role,setRole]=useState<AppRole>('USER'),[mode,setMode]=useState<'personal'|'admin'>('personal'),[gateUser,setGateUser]=useState<GateUser|null>(null);
 const user=WebApp.initDataUnsafe.user,isAdmin=role==='ADMIN'||role==='OWNER';
 const load=async()=>{
  const responses=await Promise.all(['/api/analytics/overview','/api/transactions','/api/categories'].map(path=>fetch(api+path,{credentials:'include'})));
  const failed=responses.find(r=>!r.ok);if(failed){const body=await failed.json().catch(()=>({}));throw Error(body.error||'LOAD_FAILED')}
  const[overview,transactions,categories]=await Promise.all(responses.map(r=>r.json()));setO(overview);setTx(Array.isArray(transactions)?transactions:transactions.items||[]);setCats(Array.isArray(categories)?categories:[]);
 };
 const gate=async(code:string)=>{
  setBlocked(code);
  try{const r=await fetch(api+'/api/me',{credentials:'include'});if(r.ok)setGateUser(await r.json());else setGateUser(null)}catch{setGateUser(null)}
 };
 const boot=async()=>{
  setLoading(true);setBlocked('');setRole('USER');setMode('personal');
  try{
   const r=await fetch(api+'/api/auth/telegram',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({initData:WebApp.initData})});
   if(!r.ok)throw Error('AUTH');
   const auth=await r.json();await applyServerLanguage(auth.languageCode,user?.id);const next:AppRole=auth.role==='OWNER'?'OWNER':auth.role==='ADMIN'?'ADMIN':'USER';setRole(next);
   if(auth.isBanned){await gate('BANNED');return}
   if(next==='ADMIN'||next==='OWNER'){setMode('admin');return}
   try{await load()}catch(e){await gate(e instanceof Error?e.message:'LOAD_FAILED')}
  }catch{await gate('AUTH')}
  finally{setLoading(false)}
 };
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.theme=dark?'dark':'light'},[dark]);
 useEffect(()=>{WebApp.ready();WebApp.expand();boot()},[]);
 const personal=async()=>{setMode('personal');setLoading(true);setBlocked('');setTab('home');try{await load()}catch(e){await gate(e instanceof Error?e.message:'LOAD_FAILED')}finally{setLoading(false)}};
 if(loading)return <div className="center" role="status">{t("Загружаем Hisobchi…")}</div>;
 if(isAdmin&&mode==='admin'&&!blocked)return <main className="admin-app"><AdminPage role={role as 'OWNER'|'ADMIN'} onPersonal={personal}/></main>;
 if(blocked)return <AccessGate code={blocked} me={gateUser} retry={boot} onAdmin={isAdmin&&blocked!=='BANNED'?()=>{setBlocked('');setMode('admin')}:undefined}/>;
 const inc=+o.todayIncomeUzs||0,exp=+o.todayExpenseUzs||0;
 return <main>
 {tab==='home'&&<Home inc={inc} exp={exp} o={o} tx={tx} add={setModal}/>}
 {tab==='history'&&<History tx={tx} del={async id=>{if(confirm(t(t('Удалить?')))){await fetch(api+'/api/transactions/'+id,{method:'DELETE',credentials:'include'});await load()}}}/>}
 {tab==='analytics'&&<AnalyticsPage revision={tx}/>}
 {tab==='categories'&&<CategoriesPage onChanged={load}/>}
 {tab==='profile'&&<ProfilePage user={user} dark={dark} onTheme={setDark} onAdmin={isAdmin?()=>setMode('admin'):undefined}/>}
 {modal&&<Form type={modal} cats={cats} close={()=>setModal(null)} saved={()=>{setModal(null);load().catch(()=>gate('LOAD_FAILED'))}} onCategoryCreated={category=>setCats(old=>[...old,category])}/>}
 <nav>{[['home',House,t('Главная')],['analytics',BarChart3,t('Аналитика')],['history',Clock3,t('История')],['categories',FolderOpen,t('Категории')],['profile',UserRound,t('Профиль')]].map(([id,I,l]:any)=>{const Icon=I;return <button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><Icon size={19}/><small>{l}</small></button>})}</nav></main>;
}
function AccessGate({code,me,retry,onAdmin}:{code:string;me:GateUser|null;retry:()=>void;onAdmin?:()=>void}){
 const[busy,setBusy]=useState(false),[pending,setPending]=useState(me?.accessRequestStatus==='PENDING'),[error,setError]=useState('');
 const banned=code==='BANNED'||me?.isBanned;
 const needsAccess=code==='SUBSCRIPTION_REQUIRED';
 const request=async()=>{if(busy||pending)return;setBusy(true);setError('');try{const r=await fetch(api+'/api/me/access-request',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}'});if(!r.ok)throw Error(t('Не удалось отправить заявку. Обновите доступ и попробуйте ещё раз.'));setPending(true)}catch(e){setError(e instanceof Error?e.message:t('Нет соединения'))}finally{setBusy(false)}};
 return <main className="access-gate"><div className="gate-symbol"><ShieldCheck size={30}/></div><p>{t("Hisobchi · личный кабинет")}</p><h1>{banned?t('Доступ ограничен'):needsAccess?t('Нужна подписка'):code==='AUTH'?t('Не удалось войти'):t('Не удалось загрузить данные')}</h1><p>{banned?t('Свяжитесь с администратором, чтобы уточнить причину блокировки.'):needsAccess?t('Запросите доступ. Администратор проверит оплату и вручную активирует подписку.'):t('Откройте приложение через кнопку Hisobchi в Telegram или повторите вход.')}</p>{me&&!banned&&needsAccess&&<button disabled={busy||pending} onClick={request}>{pending?t('Заявка отправлена'):busy?t('Отправляем…'):t('Запросить доступ')}</button>}{pending&&<p role="status">{t("Администратор увидит вашу заявку в разделе «Заявки». Оплата согласуется отдельно.")}</p>}{error&&<p role="alert">{error}</p>}{me?.adminContact&&<a href={'https://t.me/'+encodeURIComponent(me.adminContact)} target="_blank" rel="noreferrer">{t("Написать администратору ↗")}</a>}{onAdmin&&!banned&&<button className="gate-retry" onClick={onAdmin}>{t("Вернуться в управление")}</button>}<button className="gate-retry" onClick={retry}>{t("Обновить доступ")}</button></main>;
}
function Home({inc,exp,o,tx,add}:{inc:number;exp:number;o:any;tx:Tx[];add:(x:any)=>void}){return <section className="dashboard"><p className="eyebrow">{t("Сегодня · личный баланс")}</p><div className="balance"><div><small>{t("Валовой доход")}</small><h1>{fmt(inc)} <em>UZS</em></h1><p>≈ ${usd(o.todayIncomeUsd)} USD</p></div><WalletCards/></div><div className="cards"><article><small>{t("Чистый результат")}</small><b className={inc-exp >= 0 ? "pos" : "neg"}>{inc-exp >= 0 ? '+' : ''}{fmt(inc-exp)}</b><span>UZS</span></article><article><small>{t("Расходы")}</small><b className="neg">{fmt(exp)}</b><span>≈ ${usd(o.todayExpenseUsd)} USD</span></article></div><DailyChart revision={tx}/><MoneyActions onAdd={add}/></section>}
function History({tx,del}:{tx:Tx[];del:(id:string)=>void}){return <section className="page"><p className="eyebrow">{t("Все операции")}</p><h2>{t("История")}</h2><div className="list">{tx.map(x=><article className="row" key={x.id}><div className="tx-dot">{x.type==='INCOME'?'↗':'↘'}</div><div className="row-main"><b>{x.category?.name||(x.type==='INCOME'?t('Доход'):t('Расход'))}</b><small>{x.comment||t('Без комментария')} · {formatLocalizedDate(new Date(x.occurredAt))}</small></div><strong className={x.type==='INCOME'?'pos':'neg'}>{x.type==='INCOME'?'+':'−'}{fmt(x.amountUzs)}</strong><button className="delete" onClick={()=>del(x.id)}><Trash2 size={16}/></button></article>)}</div></section>}
function Form({type,cats,close,saved,onCategoryCreated}:{type:'INCOME'|'EXPENSE';cats:Category[];close:()=>void;saved:()=>void;onCategoryCreated:(category:Category)=>void}){
 const[a,setA]=useState(''),[c,setC]=useState(''),[cat,setCat]=useState(''),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current)return;const digits=a.replace(/\s/g,'');if(!/^\d+$/.test(digits)||BigInt(digits)<=0n){setError(t('Введите положительную сумму в целых сумах'));return}lock.current=true;setBusy(true);setError('');try{const r=await fetch(api+'/api/transactions',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({type,amountUzs:digits,occurredAt:new Date().toISOString(),comment:c||undefined,categoryId:type==='EXPENSE'?cat||undefined:undefined})});if(!r.ok)throw Error(t('Не удалось сохранить операцию. Попробуйте ещё раз.'));saved()}catch(e){setError(e instanceof Error?e.message:t('Нет соединения'))}finally{lock.current=false;setBusy(false)}};
 return <><div className="overlay"><form className="sheet" onSubmit={submit}><div className="sheet-head"><h2>{type==='INCOME'?t('Доход'):t('Расход')}</h2><button type="button" className="round" aria-label={t("Закрыть форму операции")} disabled={busy} onClick={close}><X/></button></div><label>{t("Сумма, UZS")}<input autoFocus inputMode="numeric" value={a} onChange={e=>setA(e.target.value.replace(/[^\d]/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,' '))} placeholder="0" disabled={busy}/></label>{type==='EXPENSE'&&<label>{t("Категория")}<div className="expense-category-select"><select aria-label={t("Категория расхода")} value={cat} onChange={e=>setCat(e.target.value)} disabled={busy}><option value="">{t("Без категории")}</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button type="button" aria-label={t("Создать категорию в расходе")} disabled={busy} onClick={()=>setCreating(true)}><Plus size={20}/></button></div></label>}<label>{t("Комментарий")}<input value={c} maxLength={500} disabled={busy} onChange={e=>setC(e.target.value)} placeholder={t("Например, продукты")}/></label>{error&&<p className="cat-error" role="alert">{error}</p>}<button disabled={busy} className={'submit '+(type==='INCOME'?'income':'expense')}>{busy?t('Сохраняем…'):t('Сохранить операцию')}</button></form></div>{creating&&<CategoryEditor existing={cats} onClose={()=>setCreating(false)} onSaved={category=>{onCategoryCreated(category);setCat(category.id)}}/>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
