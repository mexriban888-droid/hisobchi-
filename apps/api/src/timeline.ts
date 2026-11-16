import { Decimal } from 'decimal.js';
const DAY = 86400000;
export function tashkentDate(date: Date) {
  return new Date(date.getTime() + 5 * 3600000).toISOString().slice(0, 10);
}
export function timelineRange(count: number, now = new Date()) {
  const last = tashkentDate(now);
  const until = new Date(new Date(`${last}T00:00:00+05:00`).getTime() + DAY);
  return { from: new Date(until.getTime() - count * DAY), until };
}
type Row = { type: string; amountUzs: bigint; amountUsdSnapshot: { toString(): string }; occurredAt: Date };
export function aggregateDays(count: number, rows: Row[], now = new Date()) {
  const { from } = timelineRange(count, now);
  const days = Array.from({ length: count }, (_, i) => ({ date: tashkentDate(new Date(from.getTime() + i * DAY)), incomeUzs: '0', expenseUzs: '0', incomeUsd: '0', expenseUsd: '0' }));
  const byDate = new Map(days.map(d => [d.date, d]));
  for (const row of rows) {
    const day = byDate.get(tashkentDate(row.occurredAt));
    if (!day) continue;
    const uzsKey = row.type === 'INCOME' ? 'incomeUzs' : 'expenseUzs';
    const usdKey = row.type === 'INCOME' ? 'incomeUsd' : 'expenseUsd';
    day[uzsKey] = (BigInt(day[uzsKey]) + row.amountUzs).toString();
    day[usdKey] = new Decimal(day[usdKey]).plus(row.amountUsdSnapshot.toString()).toString();
  }
  return days;
}
