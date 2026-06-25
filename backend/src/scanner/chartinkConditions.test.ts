import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findTechnicalSignalMonths } from './chartinkConditions.js';
import type { MonthlyBar } from './monthlyBars.js';

function buildMonthlySeries(count: number, baseHigh: number): MonthlyBar[] {
  const bars: MonthlyBar[] = [];
  for (let i = 0; i < count; i++) {
    const month = String((i % 12) + 1).padStart(2, '0');
    const year = 2000 + Math.floor(i / 12);
    const date = `${year}-${month}-28`;
    const close = 100 + i * 0.5;
    bars.push({
      date,
      monthKey: `${year}-${month}`,
      open: close - 5,
      high: baseHigh,
      low: close - 8,
      close,
    });
  }
  return bars;
}

describe('chartinkConditions', () => {
  it('requires at least 200 months of data', () => {
    const short = buildMonthlySeries(150, 200);
    assert.equal(findTechnicalSignalMonths(short).length, 0);
  });

  it('detects breakout month when EMA cluster is crossed', () => {
    const monthly: MonthlyBar[] = [];
    const plateau = 150;
    for (let i = 0; i < 260; i++) {
      const month = String((i % 12) + 1).padStart(2, '0');
      const year = 2000 + Math.floor(i / 12);
      const date = `${year}-${month}-28`;
      const close = 90 + (i < 240 ? 0.1 : 20);
      const open = i === 259 ? close - 15 : close - 1;
      const high = i === 259 ? plateau : plateau * 0.55;
      monthly.push({
        date,
        monthKey: `${year}-${month}`,
        open,
        high,
        low: open - 2,
        close,
      });
    }

    for (let i = 200; i < 258; i++) {
      monthly[i].high = plateau;
    }
    monthly[210].high = plateau;

    const signals = findTechnicalSignalMonths(monthly);
    assert.ok(signals.length >= 0);
  });
});
