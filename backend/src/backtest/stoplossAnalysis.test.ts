import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeHitSequence,
  analyzeScenario2Recovery,
  analyzeStoplossTillDate,
} from '../backtest/stoplossAnalysis.js';
import type { OhlcvBar } from '../types/index.js';

describe('stoplossAnalysis', () => {
  const buyDate = '2013-06-05';
  const buyPrice = 850;
  const stoplossPrice = 595;
  const targetPrice = 1105;

  it('detects stoploss hit till date even when trade ends OPEN', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-05', open: 845, high: 860, low: 843, close: 855, volume: 1000 },
      { date: '2013-06-06', open: 855, high: 870, low: 590, close: 650, volume: 1000 },
      { date: '2013-06-07', open: 650, high: 700, low: 620, close: 680, volume: 1000 },
    ];

    const result = analyzeStoplossTillDate(bars, buyDate, stoplossPrice);
    assert.equal(result.stoplossHitTillDate, true);
    assert.equal(result.stoplossHitDate, '2013-06-06');
    assert.equal(result.stoplossHitDays, 1);
  });

  it('returns no hit when price stays above stoploss', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-06', open: 855, high: 870, low: 640, close: 860, volume: 1000 },
    ];

    const result = analyzeStoplossTillDate(bars, buyDate, stoplossPrice);
    assert.equal(result.stoplossHitTillDate, false);
    assert.equal(result.stoplossHitDate, null);
  });

  it('detects target first and stoploss after target', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-06', open: 855, high: 1110, low: 850, close: 1100, volume: 1000 },
      { date: '2013-06-07', open: 1100, high: 1120, low: 590, close: 600, volume: 1000 },
    ];

    const seq = analyzeHitSequence(
      bars,
      buyDate,
      targetPrice,
      stoplossPrice,
      'STOPLOSS_FIRST'
    );
    assert.equal(seq.firstHit, 'TARGET');
    assert.equal(seq.stoplossAfterTargetHit, true);
    assert.equal(seq.stoplossAfterTargetDate, '2013-06-07');
  });

  it('detects stoploss first and target after stoploss', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-06', open: 855, high: 870, low: 590, close: 600, volume: 1000 },
      { date: '2013-06-10', open: 700, high: 1110, low: 690, close: 1100, volume: 1000 },
    ];

    const seq = analyzeHitSequence(
      bars,
      buyDate,
      targetPrice,
      stoplossPrice,
      'STOPLOSS_FIRST'
    );
    assert.equal(seq.firstHit, 'STOPLOSS');
    assert.equal(seq.targetAfterStoplossHit, true);
    assert.equal(seq.targetAfterStoplossDate, '2013-06-10');
  });

  it('scenario2: recovery to buy then second stoploss hit', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-05', open: 845, high: 860, low: 843, close: 855, volume: 1000 },
      { date: '2013-06-06', open: 855, high: 870, low: 590, close: 600, volume: 1000 },
      { date: '2013-06-07', open: 600, high: 620, low: 580, close: 610, volume: 1000 },
      { date: '2013-06-10', open: 700, high: 860, low: 690, close: 840, volume: 1000 },
      { date: '2013-06-11', open: 840, high: 845, low: 590, close: 620, volume: 1000 },
    ];

    const result = analyzeScenario2Recovery(
      bars,
      buyDate,
      buyPrice,
      stoplossPrice,
      targetPrice,
      'STOPLOSS_FIRST'
    );

    assert.ok(result);
    assert.equal(result!.recoveredToBuyAfterSl, true);
    assert.equal(result!.recoveryDate, '2013-06-10');
    assert.equal(result!.secondStoplossHit, true);
    assert.equal(result!.secondStoplossHitDate, '2013-06-11');
  });

  it('scenario2: null when stoploss never hit', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-06', open: 855, high: 870, low: 640, close: 860, volume: 1000 },
    ];

    const result = analyzeScenario2Recovery(
      bars,
      buyDate,
      buyPrice,
      stoplossPrice,
      targetPrice,
      'STOPLOSS_FIRST'
    );

    assert.equal(result, null);
  });
});
