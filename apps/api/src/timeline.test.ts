import { describe, expect, it } from 'vitest';
import { aggregateDays, timelineRange } from './timeline.js';
describe('Daily timeline (Tashkent)', () => {
  const now = new Date('2026-11-17T00:00:00Z');
  it('includes the local day beginning at 19:00 UTC', () => {
    const { from, until } = timelineRange(7, now);
    expect(from.toISOString()).toBe('2026-11-10T19:00:00.000Z');
    expect(until.toISOString()).toBe('2026-11-17T19:00:00.000Z');
  });
  it('sums all rows, preserves decimal USD and fills empty days', () => {
    const rows = Array.from({ length: 45 }, () => ({ type: 'INCOME', amountUzs: 20000n, amountUsdSnapshot: '0.1', occurredAt: new Date('2026-11-16T20:00:00Z') }));
    const days = aggregateDays(7, rows, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ date: '2026-11-17', incomeUzs: '900000', incomeUsd: '4.5', expenseUzs: '0' });
    expect(days[5].incomeUzs).toBe('0');
  });
  it('does not mix yesterday and today or include future days', () => {
    const row = (date: string, type = 'INCOME') => ({ type, amountUzs: 800000n, amountUsdSnapshot: '63', occurredAt: new Date(date) });
    const days = aggregateDays(7, [row('2026-11-16T18:59:00Z'), row('2026-11-16T19:00:00Z', 'EXPENSE'), row('2026-11-17T19:00:00Z')], now);
    expect(days[5].incomeUzs).toBe('800000');
    expect(days[6].expenseUzs).toBe('800000');
    expect(days[6].incomeUzs).toBe('0');
  });
});
