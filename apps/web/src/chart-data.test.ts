import { describe, expect, it } from 'vitest';
import { axisScale, chartCsv, dayValues } from './chart-data';
describe('Daily chart data', () => {
  it.each([[0], [800000, 900000], [123456789], [0.05, 0.12]])('keeps a nonzero, correctly scaled axis for %j', (...values) => {
    const scale = axisScale(values);
    expect(scale.max).toBeGreaterThan(0);
    expect(scale.max).toBeGreaterThanOrEqual(Math.max(...values));
    expect(scale.ticks[0]).toBe(0);
    expect(scale.ticks.at(-1)).toBe(scale.max);
  });
  it('uses USD snapshots and exports correctly named income/expense series', () => {
    const day = { date: '2026-11-17', incomeUzs: '900000', expenseUzs: '50000', incomeUsd: '70.25', expenseUsd: '3.91' };
    expect(dayValues(day, 'USD')).toEqual({ income: 70.25, expense: 3.91 });
    expect(chartCsv([day], 'UZS')).toContain('2026-11-17;900000;50000;850000');
  });
});
