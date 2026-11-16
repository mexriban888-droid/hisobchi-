import { formatLocalizedDate } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, Copy, Globe2, Moon, RefreshCw, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { chooseLanguage, getLocale, normalizeLanguage, t, type AppLanguage } from './i18n';
import './account-pages.css';
const api=import.meta.env.VITE_API_URL||'';
type User={id?:number;first_name?:string;last_name?:string;username?:string;photo_url?:string};
type Me={telegramId:string;firstName?:string;lastName?:string;username?:string;role:string;isBanned:boolean;createdAt:string;languageCode?:string;adminContact?:string;subscription?:{endsAt:string;revokedAt:string|null}|null};
export default function ProfilePage({user,dark,onTheme,onAdmin}:{user?:User;dark:boolean;onTheme:(dark:boolean)=>void;onAdmin?:()=>void}) {
  const {i18n}=useTranslation();
  const [me,setMe]=useState<Me|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[photo,setPhoto]=useState(0),[copied,setCopied]=useState(false);
  const [languageSaving,setLanguageSaving]=useState(false),[languageError,setLanguageError]=useState(''),[languageNotice,setLanguageNotice]=useState('');const languageLock=useRef(false);
  useEffect(()=>{const controller=new AbortController();setError(false);fetch(api+'/api/me',{credentials:'include',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();setMe(await r.json())}).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>controller.abort()},[retry]);
  const fullName=[me?.firstName||user?.first_name,me?.lastName||user?.last_name].filter(Boolean).join(' ')||t('Пользователь Telegram');
  const username=me?.username||user?.username, telegramId=me?.telegramId||String(user?.id||'');
  const initials=fullName.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const provided=user?.photo_url?.startsWith('https:')?user.photo_url:null;
  const photoUrl=photo===0?(provided||api+'/api/me/photo'):photo===1&&provided?api+'/api/me/photo':null;
  const active=!!me?.subscription&&!me.subscription.revokedAt&&new Date(me.subscription.endsAt)>new Date()&&!me.isBanned;
  const admin=me?.role==='ADMIN'||me?.role==='OWNER';
  const formatDate=(s:string)=>formatLocalizedDate(new Date(s), {day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Tashkent'});
  const changeLanguage=async(language:AppLanguage)=>{
    if(languageLock.current)return;languageLock.current=true;setLanguageSaving(true);setLanguageError('');setLanguageNotice('');
    try{const r=await fetch(api+'/api/me/preferences',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({languageCode:language})});if(!r.ok)throw Error();await chooseLanguage(language);setMe(old=>old?{...old,languageCode:language}:old);setLanguageNotice('Язык сохранён')}
    catch{setLanguageError('Не удалось сохранить язык. Попробуйте ещё раз.')}
    finally{languageLock.current=false;setLanguageSaving(false)}
  };
  return <section className="account-page profile-page"><div className="account-title"><div><p>{t('Ваш личный кабинет')}</p><h1>{t('Профиль')}</h1></div><UserRound size={22}/></div>
    <div className="account-identity"><div className="account-photo">{photoUrl?<img src={photoUrl} alt={t('Фото {{name}}',{name:fullName})} referrerPolicy="no-referrer" onError={()=>setPhoto(n=>n+1)}/>:<span aria-label={t('Инициалы пользователя')}>{initials}</span>}</div><h2>{fullName}</h2>{username&&<p>@{username}</p>}<span className="account-telegram">{t('Аккаунт Telegram')}</span></div>
    <div className="account-detail"><span>Telegram ID</span><button aria-label={t('Скопировать Telegram ID')} className="account-copy" disabled={!telegramId} onClick={async()=>{try{await navigator.clipboard.writeText(telegramId);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{setCopied(false)}}}>{telegramId||'—'}{copied?<Check size={14}/>:<Copy size={14}/>}</button></div>
    <div className="account-section-heading"><ShieldCheck size={18}/><h2>{t('Доступ и подписка')}</h2></div>
    {admin&&onAdmin&&<button className="admin-return" onClick={onAdmin}><ShieldCheck size={16}/>{t('Открыть админ-панель')} <span>{me?.role}</span></button>}
    {error?<div role="alert" className="report-state"><p>{t('Не удалось загрузить статус подписки')}</p><button onClick={()=>setRetry(n=>n+1)}><RefreshCw size={14}/>{t('Повторить')}</button></div>:me?<><div className="account-detail"><span>{t('Статус')}</span><strong className={me.isBanned?'neg':active||admin?'account-status':''}>{t(me.isBanned?'Заблокирован':admin?'Доступ администратора':active?'Подписка активна':'Подписка неактивна')}</strong></div>{me.subscription&&<div className="account-detail"><span>{t('Действует до')}</span><strong>{formatDate(me.subscription.endsAt)}</strong></div>}<div className="account-detail"><span>{t('С нами с')}</span><strong>{formatDate(me.createdAt)}</strong></div></>:<p className="report-caption" role="status">{t('Загружаем профиль…')}</p>}
    <div className="account-section-heading"><Sun size={18}/><h2>{t('Оформление')}</h2></div><p className="report-caption">{t('Выбранная тема сохранится на этом устройстве.')}</p><div className="account-themes"><button aria-pressed={!dark} onClick={()=>onTheme(false)}><Sun size={20}/><span>{t('Светлая')}</span>{!dark&&<Check size={16}/>}</button><button aria-pressed={dark} onClick={()=>onTheme(true)}><Moon size={20}/><span>{t('Тёмная')}</span>{dark&&<Check size={16}/>}</button></div>
    <div className="account-section-heading"><Globe2 size={18}/><h2>{t('Язык приложения')}</h2></div><div className="account-language"><label htmlFor="profile-language">{t('Язык интерфейса')}</label><select id="profile-language" aria-label={t('Язык интерфейса')} disabled={languageSaving} value={normalizeLanguage(i18n.resolvedLanguage)} onChange={e=>changeLanguage(e.target.value as AppLanguage)}><option value="ru">Русский · RU</option><option value="uz">O‘zbekcha · UZ</option><option value="en">English · EN</option></select></div><p className="report-caption">{t('Выбор языка сохраняется в вашем аккаунте.')}</p>
    {languageSaving&&<p className="report-caption" role="status">{t('Меняем язык…')}</p>}{languageError&&<p className="account-language-error" role="alert">{t(languageError)}</p>}{languageNotice&&<p className="account-status" role="status">{t(languageNotice)}</p>}
    <div className="account-section-heading"><CalendarDays size={18}/><h2>{t('О приложении')}</h2></div><div className="account-detail"><span>{t('Часовой пояс')}</span><strong>{t('Ташкент · UTC+5')}</strong></div><div className="account-detail"><span>{t('Валюта ввода')}</span><strong>{t('Узбекский сум · UZS')}</strong></div><p className="account-info">{t('Hisobchi — ваш личный учёт доходов и расходов. USD в отчётах рассчитывается по курсу, сохранённому вместе с операцией. Ваши финансовые записи доступны только вам.')}</p>
    {me?.adminContact&&<a className="account-contact" href={'https://t.me/'+encodeURIComponent(me.adminContact)} target="_blank" rel="noreferrer">{t('Связаться с администратором ↗')}</a>}
  </section>;
}
