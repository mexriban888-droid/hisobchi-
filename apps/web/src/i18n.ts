import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { commonTranslations } from './locales/common';
import { adminTranslations } from './locales/admin';
import { analyticsTranslations } from './locales/analytics';
import { categoryTranslations } from './locales/categories';
export type AppLanguage='ru'|'uz'|'en';
export const supportedLanguages:AppLanguage[]=['ru','uz','en'];
export const normalizeLanguage=(value:string|undefined):AppLanguage=>value?.toLowerCase().startsWith('uz')?'uz':value?.toLowerCase().startsWith('en')?'en':'ru';
const telegramUser=typeof window==='undefined'?undefined:(window as unknown as {Telegram?:{WebApp?:{initDataUnsafe?:{user?:{id?:number;language_code?:string}}}}}).Telegram?.WebApp?.initDataUnsafe?.user;
let languageOwner=telegramUser?.id;
const storageKey=()=>'hisobchi_language_'+(languageOwner||'browser');
function savedLanguage(){try{return localStorage.getItem(storageKey())}catch{return null}}
export const translations={...commonTranslations,...adminTranslations,...analyticsTranslations,...categoryTranslations};
const resources={ru:{translation:Object.fromEntries(Object.keys(translations).map(key=>[key,key]))},uz:{translation:Object.fromEntries(Object.entries(translations).map(([key,value])=>[key,value.uz]))},en:{translation:Object.fromEntries(Object.entries(translations).map(([key,value])=>[key,value.en]))}};
void i18n.use(initReactI18next).init({resources,lng:normalizeLanguage(savedLanguage()||telegramUser?.language_code),fallbackLng:'ru',supportedLngs:supportedLanguages,keySeparator:false,nsSeparator:false,initAsync:false,interpolation:{escapeValue:false},react:{useSuspense:false}});
const applyHtmlLanguage=()=>{if(typeof document!=='undefined')document.documentElement.lang=i18n.resolvedLanguage||'ru'};
i18n.on('languageChanged',applyHtmlLanguage);applyHtmlLanguage();
export function t(key:string,options?:Record<string,unknown>):string{return String(i18n.t(key,options as any))}
export const getLocale=()=>({ru:'ru-RU',uz:'uz-UZ',en:'en-US'}[normalizeLanguage(i18n.resolvedLanguage)]);
export function formatLocalizedDate(value:Date|string,options:Intl.DateTimeFormatOptions={year:'numeric',month:'2-digit',day:'2-digit'}){
 const date=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(date.getTime()))return '—';
 const hasParts=options.year||options.month||options.day||options.hour||options.minute||options.second||options.weekday;
 const settings:Intl.DateTimeFormatOptions={timeZone:'Asia/Tashkent',...(!hasParts?{year:'numeric' as const,month:'2-digit' as const,day:'2-digit' as const}:{}),...options};
 if(normalizeLanguage(i18n.resolvedLanguage)!=='uz')return new Intl.DateTimeFormat(getLocale(),settings).format(date);
 // Some Telegram WebViews ship incomplete Uzbek CLDR data ("M11" instead of
 // "noyabr"). Format numeric parts with full ICU support and supply Uzbek names.
 const parts=new Intl.DateTimeFormat('en-GB',{...settings,...(settings.month?{month:'numeric' as const}:{})}).formatToParts(date);
 const part=(key:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===key)?.value||'';
 const namedMonth=settings.month==='long'||settings.month==='short';
 const months=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
 const month=settings.month?(namedMonth?months[Number(part('month'))-1]:settings.month==='2-digit'?part('month').padStart(2,'0'):part('month')):'';
 const day=settings.day?part('day'):'',year=settings.year?part('year'):'';
 const formatted=[day,month,year].filter(Boolean).join(namedMonth?' ':'.');
 const time=[settings.hour?part('hour'):'',settings.minute?part('minute'):'',settings.second?part('second'):''].filter(Boolean).join(':');
 return [formatted,time].filter(Boolean).join(', ');
}
export async function chooseLanguage(language:AppLanguage){await i18n.changeLanguage(language);try{localStorage.setItem(storageKey(),language)}catch{/* Server preference still persists. */}}
export async function applyServerLanguage(language?:string,userId?:number){if(userId)languageOwner=userId;const selected=language||savedLanguage();if(selected){const resolved=normalizeLanguage(selected);await i18n.changeLanguage(resolved);if(language)try{localStorage.setItem(storageKey(),resolved)}catch{/* Local storage is optional. */}}}
export default i18n;
