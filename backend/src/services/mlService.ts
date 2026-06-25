import { cacheService } from '../cache/cacheService.js';
import type {
  JobState,
  MLPredictionSummary,
  ModelInfo,
  TradePrediction,
  TradeResult,
} from '../types/index.js';
import { startOfMonthIso, todayIso } from '../utils/dateParser.js';
import { toYahooSymbols } from '../utils/symbolUtils.js';
import { featureEngine } from '../ml/FeatureEngine.js';
import { logisticModel, type StoredModel } from '../ml/LogisticModel.js';
import { modelStore } from '../ml/modelStore.js';
import { screenerService } from './screenerService.js';
import { config } from '../config/defaults.js';
import { isPriceNearBuyPrice } from '../utils/tradePriceUtils.js';

const MIN_TRAINING_SAMPLES = 10;

export class MlService {
  async getModelInfo(): Promise<ModelInfo | null> {
    const stored = (await modelStore.load()) ?? modelStore.getCached();
    if (!stored) return null;

    return {
      version: stored.version,
      trainedAt: stored.trainedAt,
      featureNames: stored.featureNames,
      metrics: stored.metrics,
      trainingJobId: stored.trainingJobId,
    };
  }

  async trainFromJob(job: JobState): Promise<ModelInfo> {
    const trainable = job.results.filter((r) => featureEngine.isTrainableLabel(r.result));
    if (trainable.length < MIN_TRAINING_SAMPLES) {
      throw Object.assign(
        new Error(
          `Need at least ${MIN_TRAINING_SAMPLES} closed trades (TARGET or STOPLOSS) to train. Found ${trainable.length}.`
        ),
        { code: 'INSUFFICIENT_DATA' }
      );
    }

    const sorted = [...trainable].sort((a, b) =>
      (a.buyDate ?? '').localeCompare(b.buyDate ?? '')
    );

    const featureMatrix: number[][] = [];
    const labels: number[] = [];

    for (const trade of sorted) {
      const bars = await this.getBarsForTrade(trade);
      const features = featureEngine.extractFeatures(trade, job.config, bars);
      if (!features) continue;
      featureMatrix.push(featureEngine.vectorize(features));
      labels.push(featureEngine.labelFromResult(trade.result as 'TARGET' | 'STOPLOSS'));
    }

    if (featureMatrix.length < MIN_TRAINING_SAMPLES) {
      throw Object.assign(
        new Error(`Only ${featureMatrix.length} usable training rows after feature extraction`),
        { code: 'INSUFFICIENT_DATA' }
      );
    }

    const metrics = logisticModel.train(featureMatrix, labels);
    const stored = logisticModel.export(job.jobId, metrics);
    await modelStore.save(stored);

    return this.toModelInfo(stored);
  }

  async predictForJob(job: JobState): Promise<{
    predictions: TradePrediction[];
    summary: MLPredictionSummary;
  }> {
    const stored = (await modelStore.load()) ?? modelStore.getCached();
    if (!stored) {
      throw Object.assign(new Error('No trained model. Train a model first.'), {
        code: 'MODEL_NOT_FOUND',
      });
    }

    logisticModel.load(stored);

    const predictions: TradePrediction[] = [];

    for (const trade of job.results) {
      const bars = await this.getBarsForTrade(trade);
      const features = featureEngine.extractFeatures(trade, job.config, bars);
      if (!features) continue;

      const output = logisticModel.predict(features);
      let fundamentals = null;
      if (
        isPriceNearBuyPrice(trade, bars, config.fundamentalsPriceBandPct)
      ) {
        fundamentals = await screenerService.getFundamentals(trade.symbol);
      }
      const actualResult =
        trade.result === 'TARGET' ||
        trade.result === 'STOPLOSS' ||
        trade.result === 'OPEN'
          ? trade.result
          : undefined;

      predictions.push({
        symbol: trade.symbol,
        minDate: trade.minDate,
        buyDate: trade.buyDate,
        actualResult,
        targetProbability: output.targetProbability,
        predictedClass: output.predictedClass,
        confidence: output.confidence,
        topReasons: output.topReasons,
        featureContributions: output.featureContributions,
        fundamentals,
        predictionMatch:
          actualResult === 'TARGET' || actualResult === 'STOPLOSS'
            ? output.predictedClass === actualResult
            : undefined,
      });
    }

    const closed = predictions.filter(
      (p) => p.actualResult === 'TARGET' || p.actualResult === 'STOPLOSS'
    );
    const matched = closed.filter((p) => p.predictionMatch).length;

    return {
      predictions,
      summary: {
        totalPredictions: predictions.length,
        highConfidence: predictions.filter((p) => p.confidence === 'HIGH').length,
        predictedTargets: predictions.filter((p) => p.predictedClass === 'TARGET').length,
        predictedStoplosses: predictions.filter((p) => p.predictedClass === 'STOPLOSS').length,
        accuracyOnClosed:
          closed.length > 0 ? Math.round((matched / closed.length) * 1000) / 10 : null,
        modelMetrics: stored.metrics,
      },
    };
  }

  attachPredictionsToResults(
    results: TradeResult[],
    predictions: TradePrediction[]
  ): TradeResult[] {
    const byKey = new Map(predictions.map((p) => [`${p.symbol}|${p.minDate}`, p]));

    return results.map((trade) => {
      const key = `${trade.symbol}|${trade.minDate}`;
      const prediction = byKey.get(key);
      return prediction ? { ...trade, prediction } : trade;
    });
  }

  private async getBarsForTrade(trade: TradeResult) {
    const period1 = startOfMonthIso(trade.minDate);
    const period2 = todayIso();
    for (const yahooSymbol of toYahooSymbols(trade.symbol)) {
      const memory = cacheService.get(yahooSymbol, period1, period2);
      if (memory) return memory;
      const disk = await cacheService.getFromDisk(yahooSymbol);
      if (disk && disk.length > 0) return disk;
    }
    return undefined;
  }

  private toModelInfo(stored: StoredModel): ModelInfo {
    return {
      version: stored.version,
      trainedAt: stored.trainedAt,
      featureNames: stored.featureNames,
      metrics: stored.metrics,
      trainingJobId: stored.trainingJobId,
    };
  }

  async clearModel(): Promise<void> {
    await modelStore.clear();
  }
}

export const mlService = new MlService();
