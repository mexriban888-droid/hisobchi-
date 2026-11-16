import { t, getLocale } from './i18n';
export type DayTotal = { date: string; incomeUzs: string; expenseUzs: string; incomeUsd: string; expenseUsd: string };
export type Currency = 'UZS' | 'USD';
export function axisScale(values: number[]) {
  const peak = Math.max(0, ...values.filter(Number.isFinite));
  const raw = (peak || 4) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const step = ([1, 2, 2.5, 5, 10].find(n => n >= fraction) || 10) * magnitude;
  const max = Math.ceil((peak || 4) / step) * step;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}
export function amountLabel(value: number, currency: Currency, compact = false) {
  const factor = compact && Math.abs(value) >= 1e6 ? 1e6 : compact && Math.abs(value) >= 1e3 ? 1e3 : 1;
  const suffix = factor === 1e6 ? t(" млн") : factor === 1e3 ? t(" тыс.") : '';
  return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: currency === 'USD' || factor > 1 ? 2 : 0 }).format(value / factor)}${suffix}`;
}
export function dayValues(day: DayTotal, currency: Currency) {
  return currency === 'USD' ? { income: Number(day.incomeUsd), expense: Number(day.expenseUsd) } : { income: Number(day.incomeUzs), expense: Number(day.expenseUzs) };
}
export function chartCsv(days: DayTotal[], currency: Currency) {
  return '\uFEFF' + [t('Дата;Доход ({{currency}});Расход ({{currency}});Результат ({{currency}})',{currency}), ...days.map(d => {
    const { income, expense } = dayValues(d, currency);
    return `${d.date};${income};${expense};${income - expense}`;
  })].join('\r\n');
}
