import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateValue } from '../utils/dateParser.js';
import {
  calculateMonthHigh,
  findBreakoutDate,
  findFirstTradingDayNextMonth,
} from '../backtest/dateUtils.js';
import { evaluateTrade } from '../backtest/tradeEvaluator.js';
import {
  calculateTargetPrice,
  calculateStoplossPrice,
} from '../backtest/priceUtils.js';
import type { OhlcvBar } from '../types/index.js';

describe('dateParser', () => {
  it('parses DD MMM YYYY text format', () => {
    const result = parseDateValue('02 May 2013');
    assert.ok(!('error' in result));
    if (!('error' in result)) {
      assert.equal(result.iso, '2013-05-02');
    }
  });

  it('parses D MMM YYYY text format', () => {
    const result = parseDateValue('7 Dec 2021');
    assert.ok(!('error' in result));
    if (!('error' in result)) {
      assert.equal(result.iso, '2021-12-07');
    }
  });

  it('parses Excel serial number', () => {
    const result = parseDateValue(41396);
    assert.ok(!('error' in result));
    if (!('error' in result)) {
      assert.equal(result.iso, '2013-05-02');
    }
  });

  it('rejects invalid dates', () => {
    const result = parseDateValue('not a date');
    assert.ok('error' in result);
  });

  it('trims spaces before parsing', () => {
    const result = parseDateValue('  15 Jan 2021  ');
    assert.ok(!('error' in result));
    if (!('error' in result)) {
      assert.equal(result.iso, '2021-01-15');
    }
  });

  it('parses full month name dates', () => {
    const result = parseDateValue('01 July 2013');
    assert.ok(!('error' in result));
    if (!('error' in result)) {
      assert.equal(result.iso, '2013-07-01');
    }
  });
});

describe('priceUtils', () => {
  it('calculates target and stoploss prices', () => {
    const buyPrice = 850;
    assert.equal(calculateTargetPrice(buyPrice, 30), 1105);
    assert.equal(calculateStoplossPrice(buyPrice, 30), 595);
  });
});

describe('dateUtils', () => {
  const mayBars: OhlcvBar[] = [
    { date: '2013-05-01', open: 800, high: 820, low: 790, close: 815, volume: 1000 },
    { date: '2013-05-02', open: 815, high: 830, low: 810, close: 825, volume: 1000 },
    { date: '2013-05-15', open: 840, high: 850, low: 835, close: 845, volume: 1000 },
    { date: '2013-05-20', open: 840, high: 845, low: 830, close: 835, volume: 1000 },
    { date: '2013-06-03', open: 835, high: 840, low: 830, close: 838, volume: 1000 },
    { date: '2013-06-04', open: 838, high: 845, low: 835, close: 842, volume: 1000 },
    { date: '2013-06-05', open: 845, high: 860, low: 843, close: 855, volume: 1000 },
  ];

  it('finds month high for min date month', () => {
    const result = calculateMonthHigh(mayBars, '2013-05-02');
    assert.ok(result);
    assert.equal(result!.price, 850);
    assert.equal(result!.date, '2013-05-15');
  });

  it('finds first trading day of next month', () => {
    const result = findFirstTradingDayNextMonth(mayBars, '2013-05-02');
    assert.equal(result, '2013-06-03');
  });

  it('finds breakout when high exceeds buy price', () => {
    const result = findBreakoutDate(mayBars, '2013-06-03', 850);
    assert.ok(result);
    assert.equal(result!.date, '2013-06-05');
    assert.equal(result!.high, 860);
  });
});

describe('tradeEvaluator', () => {
  const bars: OhlcvBar[] = [
    { date: '2013-06-05', open: 845, high: 860, low: 843, close: 855, volume: 1000 },
    { date: '2013-06-06', open: 855, high: 870, low: 850, close: 865, volume: 1000 },
    { date: '2013-06-07', open: 865, high: 900, low: 860, close: 895, volume: 1000 },
  ];

  it('detects target hit', () => {
    const result = evaluateTrade(bars, '2013-06-05', 880, 595, 'STOPLOSS_FIRST');
    assert.equal(result.result, 'TARGET');
    assert.equal(result.resultDate, '2013-06-07');
    assert.equal(result.days, 2);
  });

  it('uses stoploss first on same candle', () => {
    const sameCandle: OhlcvBar[] = [
      { date: '2013-06-06', open: 850, high: 1110, low: 590, close: 900, volume: 1000 },
    ];
    const stoplossResult = evaluateTrade(sameCandle, '2013-06-05', 1105, 595, 'STOPLOSS_FIRST');
    assert.equal(stoplossResult.result, 'STOPLOSS');

    const targetResult = evaluateTrade(sameCandle, '2013-06-05', 1105, 595, 'TARGET_FIRST');
    assert.equal(targetResult.result, 'TARGET');
  });

  it('returns OPEN when neither target nor stoploss hit', () => {
    const openBars: OhlcvBar[] = [
      { date: '2013-06-06', open: 855, high: 870, low: 840, close: 860, volume: 1000 },
    ];
    const result = evaluateTrade(openBars, '2013-06-05', 1105, 595, 'STOPLOSS_FIRST');
    assert.equal(result.result, 'OPEN');
    assert.equal(result.resultDate, null);
  });
});
