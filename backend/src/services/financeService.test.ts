import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { financeService } from '../services/financeService.js';
import type { TradeResult } from '../types/index.js';

const baseTrade: TradeResult = {
  symbol: 'TEST',
  minDate: '2020-01-01',
  buyPrice: 100,
  buyDate: '2020-02-01',
  targetPrice: 130,
  stoplossPrice: 70,
  result: 'TARGET',
  resultDate: '2020-03-01',
  days: 29,
  status: 'SUCCESS',
  errorMessage: null,
  monthHighDate: '2020-01-15',
  breakoutCandleHigh: 105,
  exitPrice: 130,
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
  targetHitTillDate: null,
  targetHitDate: null,
  targetHitDays: null,
  firstHit: null,
  firstHitDate: null,
  firstHitDays: null,
  stoplossAfterTargetHit: null,
  stoplossAfterTargetDate: null,
  targetAfterStoplossHit: null,
  targetAfterStoplossDate: null,
  recoveredToBuyAfterSl: null,
  recoveryDate: null,
  secondStoplossHit: null,
  secondStoplossHitDate: null,
  newAthAfterFtt: null,
  lowHitBuyAfterFtt: null,
  lowHitSlAfterFtt: null,
  targetAfterRecovery: null,
  newAthAfterRecoveryTarget: null,
  newAthAfterFttDate: null,
  lowHitBuyAfterFttDate: null,
  targetAfterRecoveryDate: null,
  newAthAfterRecoveryTargetDate: null,
  pricePath: null,
  athEvents: null,
};

describe('financeService', () => {
  it('computes per-trade P&L and return for target hit', () => {
    const enriched = financeService.enrichResults([baseTrade], 100000)[0];
    assert.equal(enriched.exitValue, 130000);
    assert.equal(enriched.pnl, 30000);
    assert.equal(enriched.returnPercent, 30);
  });

  it('computes portfolio ROI and CAGR', () => {
    const stoploss: TradeResult = {
      ...baseTrade,
      symbol: 'LOSS',
      result: 'STOPLOSS',
      exitPrice: 70,
      resultDate: '2020-04-01',
    };
    const enriched = financeService.enrichResults([baseTrade, stoploss], 100000);
    const summary = financeService.computeFinanceSummary(enriched, 100000);
    assert.ok(summary);
    assert.equal(summary!.totalInvested, 200000);
    assert.equal(summary!.totalExitValue, 200000);
    assert.equal(summary!.totalPnl, 0);
    assert.equal(summary!.roiPercent, 0);
    assert.ok(summary!.cagrPercent != null);
  });
});
