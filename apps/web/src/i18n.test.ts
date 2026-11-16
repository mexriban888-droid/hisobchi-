import { afterEach, describe, expect, it } from 'vitest';
import i18n,{translations,normalizeLanguage,getLocale,t,applyServerLanguage,formatLocalizedDate} from './i18n';
afterEach(async()=>{await i18n.changeLanguage('ru')});
describe('Complete RU / UZ / EN resources',()=>{
 it('has translations and identical interpolation variables for every key',()=>{expect(Object.keys(translations).length).toBeGreaterThan(300);const slots=(s:string)=>[...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m=>m[1]).sort();for(const [key,entry] of Object.entries(translations)){expect(entry.uz,key).not.toBe('');expect(entry.en,key).not.toBe('');expect(slots(entry.uz),key).toEqual(slots(key));expect(slots(entry.en),key).toEqual(slots(key))}});
 it('keeps punctuation in source keys and interpolates values',async()=>{await i18n.changeLanguage('en');expect(t('Профиль')).toBe('Profile');expect(t('Фото {{name}}',{name:'Aziz Original'})).toBe('Photo of Aziz Original');expect(t('Выбранная тема сохранится на этом устройстве.')).toContain('device')});
 it('normalizes only supported languages and selects number/date locale',async()=>{expect(normalizeLanguage('uz-UZ')).toBe('uz');expect(normalizeLanguage('en-US')).toBe('en');expect(normalizeLanguage('unknown')).toBe('ru');await i18n.changeLanguage('uz');expect(getLocale()).toBe('uz-UZ')});
 it('uses server preference without requiring browser storage',async()=>{await applyServerLanguage('en');expect(i18n.resolvedLanguage).toBe('en')});
 it('formats real Uzbek month names even without WebView locale data',async()=>{await i18n.changeLanguage('uz');expect(formatLocalizedDate('2026-11-17T10:00:00Z',{day:'numeric',month:'long',year:'numeric'})).toBe('17 noyabr 2026');expect(formatLocalizedDate('2026-11-17T20:00:00Z',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})).toBe('18.11, 01:00')});
 it('keeps dates visible when only a time zone is specified',async()=>{await i18n.changeLanguage('uz');expect(formatLocalizedDate('2026-11-17T10:00:00Z',{timeZone:'Asia/Tashkent'})).toBe('17.11.2026')});
 it('does not crash a page when a date is missing or malformed',()=>{expect(formatLocalizedDate('invalid')).toBe('—');expect(formatLocalizedDate(new Date(NaN))).toBe('—')});
});
