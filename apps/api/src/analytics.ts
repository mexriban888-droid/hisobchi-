import { Decimal } from 'decimal.js';
import { tashkentDate } from './timeline.js';
export const periods = ['TODAY', 'YESTERDAY', 'WEEK', 'LAST_WEEK', 'MONTH', 'LAST_MONTH', 'CUSTOM'] as const;
export type Period = typeof periods[number];
const DAY = 86400000;
const midnight = (key: string) => new Date(`${key}T00:00:00+05:00`);
const shift = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
export function reportRange(period: Period, now = new Date(), start?: string, end?: string) {
  const today = midnight(tashkentDate(now));
  let from = today, until = shift(today, 1), previousFrom = shift(today, -1);
  if (period === 'YESTERDAY') { from = shift(today, -1); until = today; previousFrom = shift(from, -1); }
  if (period === 'WEEK' || period === 'LAST_WEEK') {
    const weekday = new Date(today.getTime() + 5 * 3600000).getUTCDay();
    from = shift(today, -((weekday + 6) % 7) - (period === 'LAST_WEEK' ? 7 : 0));
    until = shift(from, 7); previousFrom = shift(from, -7);
  }
  if (period === 'MONTH' || period === 'LAST_MONTH') {
    const key = tashkentDate(now), [year, month] = key.split('-').map(Number);
    const first = (offset: number) => midnight(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10));
    const offset = period === 'LAST_MONTH' ? -1 : 0;
    from = first(offset); until = first(offset + 1); previousFrom = first(offset - 1);
  }
  if (period === 'CUSTOM') {
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw Error('Укажите даты периода');
    from = midnight(start); until = shift(midnight(end), 1);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime()) || tashkentDate(from) !== start || tashkentDate(shift(until, -1)) !== end || until <= from || (until.getTime() - from.getTime()) / DAY > 366) throw Error('Период должен быть от 1 до 366 дней');
    previousFrom = shift(from, -(until.getTime() - from.getTime()) / DAY);
  }
  return { from, until, previousFrom, previousUntil: from };
}
export type Totals = { incomeUzs: string; expenseUzs: string; netUzs: string; incomeUsd: string; expenseUsd: string; netUsd: string; count: number };
export type AnalyticsRow = { id: string; type: string; amountUzs: bigint; amountUsdSnapshot: { toString(): string }; occurredAt: Date; categoryId: string | null; category: { name: string } | null; comment: string | null };
export function totals(rows: AnalyticsRow[]): Totals {
  let incomeUzs = 0n, expenseUzs = 0n, incomeUsd = new Decimal(0), expenseUsd = new Decimal(0);
  for (const row of rows) if (row.type === 'INCOME') { incomeUzs += row.amountUzs; incomeUsd = incomeUsd.plus(row.amountUsdSnapshot.toString()); } else { expenseUzs += row.amountUzs; expenseUsd = expenseUsd.plus(row.amountUsdSnapshot.toString()); }
  return { incomeUzs: String(incomeUzs), expenseUzs: String(expenseUzs), netUzs: String(incomeUzs - expenseUzs), incomeUsd: incomeUsd.toString(), expenseUsd: expenseUsd.toString(), netUsd: incomeUsd.minus(expenseUsd).toString(), count: rows.length };
}
export function buildReport(rows: AnalyticsRow[], range: ReturnType<typeof reportRange>, now = new Date()) {
  const { from, until, previousFrom } = range;
  const current = rows.filter(r => r.occurredAt >= from && r.occurredAt < until && r.occurredAt <= now);
  const previous = rows.filter(r => r.occurredAt >= previousFrom && r.occurredAt < from && r.occurredAt <= now);
  const currentDays = Math.round((until.getTime() - from.getTime()) / DAY), previousDays = Math.round((from.getTime() - previousFrom.getTime()) / DAY);
  const daily = currentDays === 1;
  const minute = (r: AnalyticsRow) => Math.floor((r.occurredAt.getTime() + 5 * 3600000) / 60000) % 1440;
  const slots = daily ? [...new Set([0, 1439, ...current.map(minute), ...previous.map(minute)])].sort((a, b) => a - b) : Array.from({ length: Math.max(currentDays, previousDays) }, (_, i) => i);
  const series = slots.map(index => {
    const currDate = shift(from, index), prevDate = shift(previousFrom, index);
    const pick = (items: AnalyticsRow[], date: Date) => items.filter(r => daily ? minute(r) <= index : tashkentDate(r.occurredAt) === tashkentDate(date));
    const currentFuture = daily ? from.getTime() + index * 60000 > now.getTime() : currDate > now || index >= currentDays;
    return { label: daily ? `${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}` : String(index + 1), currentDate: daily ? tashkentDate(from) : index < currentDays ? tashkentDate(currDate) : null, previousDate: daily ? tashkentDate(previousFrom) : index < previousDays ? tashkentDate(prevDate) : null, current: currentFuture ? null : totals(pick(current, currDate)), previous: index >= previousDays && !daily ? null : totals(pick(previous, prevDate)) };
  });
  const grouped = new Map<string, AnalyticsRow[]>();
  for (const row of current.filter(r => r.type === 'EXPENSE')) { const key = row.categoryId || 'uncategorized'; grouped.set(key, [...(grouped.get(key) || []), row]); }
  const categories = [...grouped.entries()].map(([id, items]) => ({ id, name: items[0].category?.name || 'Без категории', ...totals(items) })).sort((a, b) => new Decimal(b.expenseUzs).comparedTo(a.expenseUzs));
  const byDay = new Map<string, AnalyticsRow[]>();
  for (const row of current) { const key = tashkentDate(row.occurredAt); byDay.set(key, [...(byDay.get(key) || []), row]); }
  const activeDays = [...byDay].map(([date, items]) => ({ date, ...totals(items) }));
  const summary = totals(current), previousSummary = totals(previous);
  const bestDay = [...activeDays].sort((a, b) => new Decimal(b.incomeUzs).comparedTo(a.incomeUzs))[0] || null;
  const elapsedDays = Math.max(1, Math.min(currentDays, Math.floor((now.getTime() - from.getTime()) / DAY) + 1));
  return { from: tashkentDate(from), to: tashkentDate(shift(until, -1)), previousFrom: tashkentDate(previousFrom), previousTo: tashkentDate(shift(from, -1)), timeZone: 'Asia/Tashkent', partial: until > now, elapsedDays, summary, previousSummary, series, categories, bestDay, activeDays: activeDays.length, topExpenses: current.filter(r => r.type === 'EXPENSE').sort((a, b) => a.amountUzs === b.amountUzs ? 0 : a.amountUzs > b.amountUzs ? -1 : 1).slice(0, 5).map(r => ({ id: r.id, category: r.category?.name || 'Без категории', comment: r.comment, occurredAt: r.occurredAt, amountUzs: String(r.amountUzs), amountUsd: r.amountUsdSnapshot.toString() })) };
}
