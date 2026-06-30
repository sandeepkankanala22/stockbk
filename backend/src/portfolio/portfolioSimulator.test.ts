import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PortfolioSimConfig } from '../types/index.js';
import type { SignalExitPlan } from './portfolioExitResolver.js';
import { runPortfolioSimulation, buildMonthlyActivity } from './portfolioSimulator.js';

function plan(
  key: string,
  symbol: string,
  signalDate: string,
  entry: number,
  overrides: Partial<SignalExitPlan> = {}
): SignalExitPlan {
  const target = entry * 1.3;
  const sl = entry * 0.7;
  const lastDate = overrides.lastDate ?? signalDate;
  return {
    signalKey: key,
    symbol,
    signalDate,
    entryType: 'breakout' as const,
    entryPrice: entry,
    targetPrice: target,
    stoplossPrice: sl,
    lastPrice: entry,
    lastDate,
    fullExitDate: null,
    fullExitPrice: null,
    fullExitReason: null,
    partialTargetDate: null,
    partialTargetPrice: null,
    remainderSlDate: null,
    remainderSlPrice: null,
    slBeforeTargetDate: null,
    slBeforeTargetPrice: null,
    priceSeries: [
      { date: signalDate, close: entry },
      { date: lastDate, close: overrides.lastPrice ?? entry },
    ],
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
  it('invests portfolioValue / maxHoldings per new position', () => {
    const p1 = plan('A:2024-01-01', 'A', '2024-01-01', 100, {
      fullExitDate: '2024-06-01',
      fullExitPrice: 130,
      fullExitReason: 'TARGET',
      lastDate: '2024-06-01',
      priceSeries: [
        { date: '2024-01-01', close: 100 },
        { date: '2024-06-01', close: 130 },
      ],
    });
    const result = runPortfolioSimulation([p1], config, 'compound');
    assert.equal(result.closedTrades.length, 1);
    assert.equal(result.closedTrades[0].investmentAmount, 50_000);
    assert.ok(result.metrics.availableCash > config.initialCapital);
    assert.ok(result.snapshots.length > 0);
    assert.ok(result.monthlyTimeline.length > 0);
  });

  it('does not block buys due to position count — only insufficient cash', () => {
    const plans = Array.from({ length: 5 }, (_, i) => {
      const d = `2024-${String(i + 1).padStart(2, '0')}-01`;
      return plan(`S${i}:${d}`, `S${i}`, d, 100, {
        lastDate: d,
        priceSeries: [{ date: d, close: 100 }],
      });
    });
    const result = runPortfolioSimulation(plans, config, 'compound');
    assert.equal(result.buysExecuted, 5);
    assert.equal(result.ignoredBuySignals, 0);
    assert.ok(result.ignoredBuys.every((b) => b.reason === 'insufficient_cash'));
  });

  it('mode 2 withdraws principal at target and keeps runner invested', () => {
    const p = plan('B:2024-01-01', 'B', '2024-01-01', 100, {
      partialTargetDate: '2024-03-01',
      partialTargetPrice: 130,
      lastPrice: 125,
      lastDate: '2024-12-01',
      priceSeries: [
        { date: '2024-01-01', close: 100 },
        { date: '2024-03-01', close: 130 },
        { date: '2024-12-01', close: 125 },
      ],
    });
    const result = runPortfolioSimulation([p], config, 'withdraw_principal');
    assert.equal(result.closedTrades.length, 0);
    assert.equal(result.openPositions.length, 1);
    assert.equal(result.openPositions[0].principalReturned, 50_000);
    assert.equal(result.openPositions[0].isRunner, true);
    assert.equal(result.metrics.runnerPositions, 1);
    assert.ok(result.metrics.availableCash >= 50_000);
  });

  it('recalculates investment per stock after profitable exit in compound mode', () => {
    const p1 = plan('A:2024-01-01', 'A', '2024-01-01', 100, {
      fullExitDate: '2024-02-01',
      fullExitPrice: 130,
      fullExitReason: 'TARGET',
      priceSeries: [
        { date: '2024-01-01', close: 100 },
        { date: '2024-02-01', close: 130 },
      ],
    });
    const p2 = plan('B:2024-03-01', 'B', '2024-03-01', 100, {
      priceSeries: [{ date: '2024-03-01', close: 100 }],
    });
    const result = runPortfolioSimulation([p1, p2], config, 'compound');
    assert.equal(result.closedTrades.length, 1);
    assert.equal(result.closedTrades[0].investmentAmount, 50_000);
    assert.equal(result.openPositions.length, 1);
    assert.equal(result.openPositions[0].investmentAmount, 50_750);
  });

  it('builds monthly activity with buys, exits, and holdings', () => {
    const signal = plan('A:2024-01-15', 'A', '2024-01-15', 100, {
      fullExitDate: '2024-03-10',
      fullExitPrice: 130,
      fullExitReason: 'TARGET',
      priceSeries: [
        { date: '2024-01-15', close: 100 },
        { date: '2024-03-10', close: 130 },
      ],
    });
    const pullback = plan('B:2024-02-01', 'B', '2024-02-01', 100, {
      entryType: 'pullback',
      fullExitDate: '2024-04-01',
      fullExitPrice: 70,
      fullExitReason: 'STOPLOSS',
      priceSeries: [
        { date: '2024-02-01', close: 100 },
        { date: '2024-04-01', close: 70 },
      ],
    });

    const result = runPortfolioSimulation([signal, pullback], config, 'compound');
    assert.ok(result.monthlyActivity.length > 0);

    const jan = result.monthlyActivity.find((m) => m.month === '2024-01');
    assert.ok(jan);
    assert.equal(jan!.signalBuys, 1);
    assert.equal(jan!.pullbackBuys, 0);
    assert.equal(jan!.totalBuys, 1);

    const feb = result.monthlyActivity.find((m) => m.month === '2024-02');
    assert.ok(feb);
    assert.equal(feb!.pullbackBuys, 1);
    assert.equal(feb!.totalBuys, 1);

    const mar = result.monthlyActivity.find((m) => m.month === '2024-03');
    assert.ok(mar);
    assert.equal(mar!.exits, 1);

    const activity = buildMonthlyActivity(
      result.tradeHistory,
      result.monthlyTimeline,
      'compound'
    );
    assert.equal(activity.length, result.monthlyActivity.length);
  });
});
