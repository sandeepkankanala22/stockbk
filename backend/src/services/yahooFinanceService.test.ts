import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OhlcvBar } from '../types/index.js';
import { barsCoverMinMonth } from './yahooFinanceService.js';

describe('yahooFinanceService disk cache coverage', () => {
  it('rejects cache that starts after the signal month', () => {
    const stale: OhlcvBar[] = [
      { date: '2020-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    assert.equal(barsCoverMinMonth(stale, '2015-06-01'), false);
  });

  it('accepts cache with bars in the signal month', () => {
    const ok: OhlcvBar[] = [
      { date: '2015-06-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { date: '2020-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    assert.equal(barsCoverMinMonth(ok, '2015-06-01'), true);
  });
});
