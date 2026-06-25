import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { featureEngine } from './FeatureEngine.js';
import { logisticModel } from './LogisticModel.js';
import type { BacktestConfig, TradeResult } from '../types/index.js';

const config: BacktestConfig = {
  targetPercent: 30,
  stoplossPercent: 30,
  sameDayHitMode: 'STOPLOSS_FIRST',
  investmentAmount: 100000,
  nearBuyPlusPct: 10,
  nearBuyMinusPct: 10,
};

function makeTrade(overrides: Partial<TradeResult> & Pick<TradeResult, 'result'>): TradeResult {
  return {
    symbol: 'RELIANCE',
    minDate: '2024-01-15',
    buyPrice: 100,
    buyDate: '2024-02-05',
    targetPrice: 130,
    stoplossPrice: 70,
    resultDate: '2024-03-01',
    days: 25,
    status: 'SUCCESS',
    errorMessage: null,
    monthHighDate: '2024-01-20',
    breakoutCandleHigh: 102,
    exitPrice: 130,
    latestClosePrice: null,
    pctFromBuyPrice: null,
    distToNearBand: null,
    investmentAmount: 100000,
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
    ...overrides,
  };
}

describe('FeatureEngine', () => {
  it('extracts features for breakout trades', () => {
    const trade = makeTrade({ result: 'TARGET' });
    const features = featureEngine.extractFeatures(trade, config);
    assert.ok(features);
    assert.equal(features.target_percent, 0.3);
    assert.ok(features.breakout_extension_pct > 0);
  });

  it('returns null for NO_BREAKOUT', () => {
    const trade = makeTrade({ result: 'TARGET' });
    trade.result = 'NO_BREAKOUT';
    trade.buyDate = null;
    const features = featureEngine.extractFeatures(trade, config);
    assert.equal(features, null);
  });
});

describe('LogisticModel', () => {
  it('trains and predicts with explainability', () => {
    const trades: TradeResult[] = [];
    for (let i = 0; i < 20; i++) {
      const isTarget = i % 2 === 0;
      trades.push(
        makeTrade({
          symbol: `SYM${i}`,
          result: isTarget ? 'TARGET' : 'STOPLOSS',
          breakoutCandleHigh: isTarget ? 108 : 101,
          buyDate: `2024-02-${String(5 + i).padStart(2, '0')}`,
        })
      );
    }

    const matrix: number[][] = [];
    const labels: number[] = [];

    for (const trade of trades) {
      const features = featureEngine.extractFeatures(trade, config);
      assert.ok(features);
      matrix.push(featureEngine.vectorize(features));
      labels.push(featureEngine.labelFromResult(trade.result as 'TARGET' | 'STOPLOSS'));
    }

    const metrics = logisticModel.train(matrix, labels);
    assert.ok(metrics.trainSize >= 10);
    assert.ok(logisticModel.isTrained());

    const sampleFeatures = featureEngine.extractFeatures(trades[0], config)!;
    const prediction = logisticModel.predict(sampleFeatures);
    assert.ok(prediction.targetProbability >= 0 && prediction.targetProbability <= 100);
    assert.ok(['TARGET', 'STOPLOSS'].includes(prediction.predictedClass));
    assert.ok(prediction.topReasons.length > 0);
  });
});
