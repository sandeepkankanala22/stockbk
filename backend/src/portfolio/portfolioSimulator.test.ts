import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PortfolioSimConfig } from '../types/index.js';
import type { SignalExitPlan } from './portfolioExitResolver.js';
import { runPortfolioSimulation } from './portfolioSimulator.js';

function plan(
  key: string,
  symbol: string,
  signalDate: string,
  entry: number,
  overrides: Partial<SignalExitPlan> = {}
): SignalExitPlan {
  const target = entry * 1.3;
  const sl = entry * 0.7;
  return {
    signalKey: key,
    symbol,
    signalDate,
    entryPrice: entry,
    targetPrice: target,
    stoplossPrice: sl,
    lastPrice: entry,
    lastDate: signalDate,
    fullExitDate: null,
    fullExitPrice: null,
    fullExitReason: null,
    partialTargetDate: null,
    partialTargetPrice: null,
    remainderSlDate: null,
    remainderSlPrice: null,
    slBeforeTargetDate: null,
    slBeforeTargetPrice: null,
    ...overrides,
  };
}

const config: PortfolioSimConfig = {
  initialCapital: 1_000_000,
  maxHoldings: 20,
  targetPercent: 30,
  stoplossPercent: 30,
};

describe('portfolioSimulator', () => {
  it('invests availableCash / maxHoldings per new position', () => {
    const p1 = plan('A:2024-01-01', 'A', '2024-01-01', 100, {
      fullExitDate: '2024-06-01',
      fullExitPrice: 130,
      fullExitReason: 'TARGET',
      lastDate: '2024-06-01',
    });
    const result = runPortfolioSimulation([p1], config, 'compound');
    assert.equal(result.closedTrades.length, 1);
    assert.equal(result.closedTrades[0].investmentAmount, 50_000);
    assert.ok(result.metrics.availableCash > config.initialCapital);
  });

  it('ignores buys when max holdings reached', () => {
    const plans = Array.from({ length: 25 }, (_, i) => {
      const d = `2024-${String(i + 1).padStart(2, '0')}-01`;
      return plan(`S${i}:${d}`, `S${i}`, d, 100);
    });
    const result = runPortfolioSimulation(plans, config, 'compound');
    assert.equal(result.metrics.openPositions, 20);
    assert.ok(result.ignoredBuySignals >= 5);
  });

  it('mode 2 withdraws principal at target and keeps profit invested', () => {
    const p = plan('B:2024-01-01', 'B', '2024-01-01', 100, {
      partialTargetDate: '2024-03-01',
      partialTargetPrice: 130,
      lastPrice: 125,
      lastDate: '2024-12-01',
    });
    const result = runPortfolioSimulation([p], config, 'withdraw_principal');
    assert.equal(result.closedTrades.length, 0);
    assert.equal(result.openPositions.length, 1);
    assert.equal(result.openPositions[0].principalReturned, 50_000);
    assert.ok(result.metrics.availableCash >= 50_000);
  });

  it('recalculates investment per stock after profitable exit in compound mode', () => {
    const p1 = plan('A:2024-01-01', 'A', '2024-01-01', 100, {
      fullExitDate: '2024-02-01',
      fullExitPrice: 130,
      fullExitReason: 'TARGET',
    });
    const p2 = plan('B:2024-03-01', 'B', '2024-03-01', 100);
    const result = runPortfolioSimulation([p1, p2], config, 'compound');
    assert.equal(result.closedTrades.length, 1);
    assert.equal(result.closedTrades[0].investmentAmount, 50_000);
    assert.equal(result.openPositions.length, 1);
    assert.equal(result.openPositions[0].investmentAmount, 50_750);
  });
});
