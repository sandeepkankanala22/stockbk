import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TradeResult } from '../types/index.js';
import {
  buildCombinedPortfolioEntries,
  buildPullbackBuyEntries,
  buildSignalBuyEntries,
} from './backtestPortfolioService.js';
import { runPortfolioSimulation } from './portfolioSimulator.js';
import type { SignalExitPlan } from './portfolioExitResolver.js';

function baseTrade(overrides: Partial<TradeResult>): TradeResult {
  return {
    symbol: 'TEST',
    minDate: '2020-01-01',
    buyPrice: 100,
    buyDate: '2020-02-01',
    targetPrice: 130,
    stoplossPrice: 70,
    result: 'TARGET',
    resultDate: '2020-06-01',
    days: 100,
    status: 'SUCCESS',
    errorMessage: null,
    monthHighDate: null,
    breakoutCandleHigh: null,
    exitPrice: null,
    latestClosePrice: null,
    pctFromBuyPrice: null,
    distToNearBand: null,
    investmentAmount: null,
    exitValue: null,
    pnl: null,
    returnPercent: null,
    stoplossHitTillDate: null,
    stoplossHitDate: null,
    stoplossHitDays: null,
    targetHitTillDate: true,
    targetHitDate: '2020-06-01',
    targetHitDays: 100,
    firstHit: 'TARGET',
    firstHitDate: '2020-06-01',
    firstHitDays: 100,
    stoplossAfterTargetHit: null,
    stoplossAfterTargetDate: null,
    targetAfterStoplossHit: null,
    targetAfterStoplossDate: null,
    recoveredToBuyAfterSl: null,
    recoveryDate: null,
    secondStoplossHit: null,
    secondStoplossHitDate: null,
    newAthAfterFtt: null,
    lowHitBuyAfterFtt: true,
    lowHitSlAfterFtt: null,
    targetAfterRecovery: null,
    newAthAfterRecoveryTarget: null,
    newAthAfterFttDate: null,
    lowHitBuyAfterFttDate: '2020-08-01',
    targetAfterRecoveryDate: null,
    newAthAfterRecoveryTargetDate: null,
    pricePath: null,
    athEvents: null,
    ...overrides,
  };
}

describe('backtest portfolio entries', () => {
  it('pullback entry uses first lowHitBuyAfterFttDate only (one per trade row)', () => {
    const trade = baseTrade({
      symbol: 'GNFC',
      minDate: '2020-01-01',
      targetHitDate: '2020-06-01',
      lowHitBuyAfterFttDate: '2023-05-02',
    });
    const entries = buildPullbackBuyEntries([trade]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].entryDate, '2023-05-02');
    assert.equal(entries[0].entryType, 'pullback_buy');
  });

  it('combined has signal buy and single pullback per trade row', () => {
    const trade = baseTrade({ symbol: 'A' });
    const combined = buildCombinedPortfolioEntries([trade]);
    assert.equal(combined.length, 2);
    assert.ok(combined.some((e) => e.entryType === 'signal_buy'));
    assert.ok(combined.some((e) => e.entryType === 'pullback_buy'));
  });

  it('skips pullback when lowHitBuyAfterFtt is false', () => {
    const trade = baseTrade({ lowHitBuyAfterFtt: false, lowHitBuyAfterFttDate: null });
    assert.equal(buildPullbackBuyEntries([trade]).length, 0);
    assert.equal(buildSignalBuyEntries([trade]).length, 1);
  });
});

describe('case 4 unlimited holdings', () => {
  it('case 4 config does not skip buys due to max holdings', () => {
    const plans: SignalExitPlan[] = Array.from({ length: 25 }, (_, i) => {
      const d = `2024-${String(i + 1).padStart(2, '0')}-01`;
      return {
        signalKey: `S${i}:${d}`,
        symbol: `S${i}`,
        signalDate: d,
        entryPrice: 100,
        targetPrice: 130,
        stoplossPrice: 70,
        lastPrice: 100,
        lastDate: d,
        fullExitDate: null,
        fullExitPrice: null,
        fullExitReason: null,
        partialTargetDate: null,
        partialTargetPrice: null,
        remainderSlDate: null,
        remainderSlPrice: null,
        slBeforeTargetDate: null,
        slBeforeTargetPrice: null,
      };
    });

    const capped = runPortfolioSimulation(plans, {
      initialCapital: 1_000_000,
      maxHoldings: 20,
      targetPercent: 30,
      stoplossPercent: 30,
      enforceMaxHoldings: true,
    });
    const uncapped = runPortfolioSimulation(plans, {
      initialCapital: 1_000_000,
      maxHoldings: 20,
      targetPercent: 30,
      stoplossPercent: 30,
      enforceMaxHoldings: false,
    });

    assert.ok(capped.ignoredBuys.some((b) => b.reason === 'max_holdings'));
    assert.equal(uncapped.ignoredBuys.filter((b) => b.reason === 'max_holdings').length, 0);
    assert.ok(uncapped.buysExecuted > capped.buysExecuted);
  });
});
