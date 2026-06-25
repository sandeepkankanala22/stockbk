import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInvestorPaths } from '../backtest/investorPathAnalysis.js';
import {
  analyzeHitSequence,
  analyzeScenario2Recovery,
} from '../backtest/stoplossAnalysis.js';
import type { OhlcvBar } from '../types/index.js';

describe('investorPathAnalysis', () => {
  const buyDate = '2013-06-05';
  const buyPrice = 850;
  const stoplossPrice = 595;
  const targetPrice = 1105;

  it('detects new ATH and buy pullback after FTT', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-05', open: 845, high: 900, low: 843, close: 855, volume: 1000 },
      { date: '2013-06-06', open: 855, high: 1110, low: 850, close: 1100, volume: 1000 },
      { date: '2013-06-07', open: 1100, high: 1200, low: 840, close: 1150, volume: 1000 },
    ];

    const hitSeq = analyzeHitSequence(
      bars,
      buyDate,
      targetPrice,
      stoplossPrice,
      'STOPLOSS_FIRST'
    );
    const paths = analyzeInvestorPaths(bars, buyPrice, targetPrice, hitSeq, null);

    assert.equal(hitSeq.firstHit, 'TARGET');
    assert.equal(paths.newAthAfterFtt, true);
    assert.equal(paths.lowHitBuyAfterFtt, true);
    assert.equal(paths.newAthAfterFttDate, '2013-06-07');
    assert.equal(paths.lowHitBuyAfterFttDate, '2013-06-07');
    assert.equal(paths.lowHitSlAfterFtt, false);
  });

  it('detects recovery target and new ATH on FSL path', () => {
    const bars: OhlcvBar[] = [
      { date: '2013-06-05', open: 845, high: 860, low: 843, close: 855, volume: 1000 },
      { date: '2013-06-06', open: 855, high: 870, low: 590, close: 600, volume: 1000 },
      { date: '2013-06-10', open: 700, high: 860, low: 690, close: 840, volume: 1000 },
      { date: '2013-06-12', open: 900, high: 1110, low: 890, close: 1100, volume: 1000 },
      { date: '2013-06-15', open: 1100, high: 1250, low: 1090, close: 1200, volume: 1000 },
    ];

    const hitSeq = analyzeHitSequence(
      bars,
      buyDate,
      targetPrice,
      stoplossPrice,
      'STOPLOSS_FIRST'
    );
    const scenario2 = analyzeScenario2Recovery(
      bars,
      buyDate,
      buyPrice,
      stoplossPrice,
      targetPrice,
      'STOPLOSS_FIRST'
    );
    const paths = analyzeInvestorPaths(bars, buyPrice, targetPrice, hitSeq, scenario2);

    assert.equal(hitSeq.firstHit, 'STOPLOSS');
    assert.equal(scenario2?.recoveredToBuyAfterSl, true);
    assert.equal(paths.targetAfterRecovery, true);
    assert.equal(paths.newAthAfterRecoveryTarget, true);
    assert.equal(paths.targetAfterRecoveryDate, '2013-06-12');
    assert.equal(paths.newAthAfterRecoveryTargetDate, '2013-06-15');
  });
});
