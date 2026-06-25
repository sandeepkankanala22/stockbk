import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  distToNearBand,
  nearestBandLabel,
  pctFromBuyPrice,
  priceMetricsFromBars,
} from '../utils/tradePriceUtils.js';
import type { OhlcvBar } from '../types/index.js';

describe('tradePriceUtils near buy band', () => {
  it('computes pct from buy and distance to configurable bands', () => {
    assert.equal(pctFromBuyPrice(100, 109), 9);
    assert.equal(distToNearBand(9, 10, 10), 1);
    assert.equal(distToNearBand(-9, 10, 10), 1);
    assert.equal(distToNearBand(10, 10, 10), 0);
    assert.equal(distToNearBand(-10, 10, 10), 0);
    assert.equal(distToNearBand(8, 15, 5), 7);
    assert.equal(nearestBandLabel(8, 15, 5), '+15%');
    assert.equal(nearestBandLabel(-4, 15, 5), '-5%');
  });

  it('builds price metrics from bars', () => {
    const bars: OhlcvBar[] = [
      { date: '2024-01-01', open: 100, high: 101, low: 99, close: 100, volume: 1 },
      { date: '2024-01-02', open: 100, high: 110, low: 99, close: 109, volume: 1 },
    ];
    const m = priceMetricsFromBars(100, bars, 10, 10);
    assert.ok(m);
    assert.equal(m!.latestClosePrice, 109);
    assert.equal(m!.pctFromBuyPrice, 9);
    assert.equal(m!.distToNearBand, 1);
  });
});
