import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAthEvents, buildBenchmarkPath, buildPricePath } from '../backtest/pricePathBuilder.js';
import type { OhlcvBar } from '../types/index.js';

describe('pricePathBuilder', () => {
  const bars: OhlcvBar[] = [
    { date: '2024-01-02', open: 98, high: 102, low: 97, close: 100, volume: 1 },
    { date: '2024-01-03', open: 100, high: 110, low: 99, close: 108, volume: 1 },
    { date: '2024-01-04', open: 108, high: 115, low: 105, close: 112, volume: 1 },
  ];

  it('builds % path from buy date', () => {
    const path = buildPricePath(bars, '2024-01-02', 100);
    assert.equal(path.length, 3);
    assert.equal(path[0].pct, 0);
    assert.equal(path[1].pct, 8);
  });

  it('marks ATH events after buy', () => {
    const events = buildAthEvents(bars, '2024-01-02', 100);
    assert.ok(events.length >= 2);
  });

  it('builds benchmark % from start date', () => {
    const bench = buildBenchmarkPath(bars, '2024-01-02');
    assert.equal(bench[0].pct, 0);
    assert.ok(bench[2].pct > 0);
  });
});
