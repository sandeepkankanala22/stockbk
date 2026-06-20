import { FEATURE_NAMES, type FeatureName, type FeatureVector } from './featureDefinitions.js';
import { REASON_TEMPLATES } from './reasonTemplates.js';

export interface ModelMetrics {
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  auc: number;
}

export interface StoredModel {
  version: string;
  trainedAt: string;
  featureNames: FeatureName[];
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
  metrics: ModelMetrics;
  trainingJobId: string | null;
}

export interface PredictionOutput {
  targetProbability: number;
  predictedClass: 'TARGET' | 'STOPLOSS';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  topReasons: string[];
  featureContributions: Record<string, number>;
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function formatFeatureValue(name: FeatureName, raw: number): string {
  switch (name) {
    case 'target_percent':
    case 'stoploss_percent':
      return (raw * 100).toFixed(1);
    case 'reward_risk_ratio':
      return (raw * 5).toFixed(2);
    case 'breakout_extension_pct':
      return (raw * 100).toFixed(1);
    case 'days_to_breakout':
      return Math.round(raw * 60).toString();
    case 'month_high_day_norm':
      return Math.round(raw * 31).toString();
    case 'volume_ratio':
      return (raw * 5).toFixed(2);
    case 'prior_5d_return':
      return (((raw * 60) - 30)).toFixed(1);
    default:
      return raw.toFixed(2);
  }
}

export class LogisticModel {
  private weights: number[] = [];
  private bias = 0;
  private means: number[] = [];
  private stds: number[] = [];

  train(
    featureMatrix: number[][],
    labels: number[],
    options?: { epochs?: number; learningRate?: number; l2?: number }
  ): ModelMetrics {
    const epochs = options?.epochs ?? 800;
    const learningRate = options?.learningRate ?? 0.08;
    const l2 = options?.l2 ?? 0.01;
    const n = featureMatrix.length;
    const m = FEATURE_NAMES.length;

    if (n < 2) {
      throw new Error('Need at least 2 training samples');
    }

    this.means = Array.from({ length: m }, (_, j) => {
      const col = featureMatrix.map((row) => row[j]);
      return col.reduce((s, v) => s + v, 0) / n;
    });

    this.stds = Array.from({ length: m }, (_, j) => {
      const mean = this.means[j];
      const variance =
        featureMatrix.reduce((s, row) => s + (row[j] - mean) ** 2, 0) / Math.max(n - 1, 1);
      return Math.sqrt(variance) || 1;
    });

    const normalized = featureMatrix.map((row) =>
      row.map((v, j) => (v - this.means[j]) / this.stds[j])
    );

    this.weights = new Array(m).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let db = 0;
      const dw = new Array(m).fill(0);

      for (let i = 0; i < n; i++) {
        const z =
          this.bias + normalized[i].reduce((s, v, j) => s + v * this.weights[j], 0);
        const pred = sigmoid(z);
        const error = pred - labels[i];
        db += error;
        for (let j = 0; j < m; j++) {
          dw[j] += error * normalized[i][j];
        }
      }

      this.bias -= learningRate * (db / n);
      for (let j = 0; j < m; j++) {
        this.weights[j] -=
          learningRate * (dw[j] / n + (l2 * this.weights[j]) / n);
      }
    }

    const splitIdx = Math.max(1, Math.floor(n * 0.8));
    const testX = normalized.slice(splitIdx);
    const testY = labels.slice(splitIdx);

    return this.evaluate(normalized.slice(0, splitIdx), labels.slice(0, splitIdx), testX, testY);
  }

  private evaluate(
    trainX: number[][],
    trainY: number[],
    testX: number[][],
    testY: number[]
  ): ModelMetrics {
    const predict = (matrix: number[][]) =>
      matrix.map((row) => {
        const z = this.bias + row.reduce((s, v, j) => s + v * this.weights[j], 0);
        return sigmoid(z);
      });

    const trainPreds = predict(trainX);
    const testPreds = testX.length > 0 ? predict(testX) : trainPreds;
    const testLabels = testY.length > 0 ? testY : trainY;

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (let i = 0; i < testPreds.length; i++) {
      const pred = testPreds[i] >= 0.5 ? 1 : 0;
      const actual = testLabels[i];
      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 0) tn++;
      else fn++;
    }

    const accuracy = testPreds.length > 0 ? (tp + tn) / testPreds.length : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

    const sorted = testLabels
      .map((label, i) => ({ label, score: testPreds[i] }))
      .sort((a, b) => b.score - a.score);

    let auc = 0.5;
    if (sorted.length > 1) {
      let positives = 0;
      let negatives = 0;
      let rankSum = 0;
      for (const item of sorted) {
        if (item.label === 1) positives++;
        else negatives++;
      }
      if (positives > 0 && negatives > 0) {
        let rank = 1;
        for (const item of sorted) {
          if (item.label === 1) rankSum += rank;
          rank++;
        }
        auc = (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
      }
    }

    return {
      trainSize: trainX.length,
      testSize: testX.length,
      accuracy: round(accuracy * 100, 2),
      precision: round(precision * 100, 2),
      recall: round(recall * 100, 2),
      auc: round(auc, 4),
    };
  }

  predict(features: FeatureVector): PredictionOutput {
    const vector = FEATURE_NAMES.map((name) => features[name]);
    const normalized = vector.map((v, j) => (v - this.means[j]) / this.stds[j]);
    const z = this.bias + normalized.reduce((s, v, j) => s + v * this.weights[j], 0);
    const prob = sigmoid(z);

    const contributions: Record<string, number> = {};
    for (let j = 0; j < FEATURE_NAMES.length; j++) {
      contributions[FEATURE_NAMES[j]] = round(normalized[j] * this.weights[j], 4);
    }

    const sorted = Object.entries(contributions).sort(
      (a, b) => Math.abs(b[1]) - Math.abs(a[1])
    );

    const topReasons = sorted.slice(0, 3).map(([name, contribution]) => {
      const featureName = name as FeatureName;
      const idx = FEATURE_NAMES.indexOf(featureName);
      const template =
        contribution >= 0
          ? REASON_TEMPLATES[featureName].positive
          : REASON_TEMPLATES[featureName].negative;
      return template.replace('{value}', formatFeatureValue(featureName, vector[idx]));
    });

    let confidence: PredictionOutput['confidence'] = 'LOW';
    if (prob >= 0.7 || prob <= 0.3) confidence = 'HIGH';
    else if (prob >= 0.55 || prob <= 0.45) confidence = 'MEDIUM';

    return {
      targetProbability: round(prob * 100, 2),
      predictedClass: prob >= 0.5 ? 'TARGET' : 'STOPLOSS',
      confidence,
      topReasons,
      featureContributions: contributions,
    };
  }

  load(stored: StoredModel): void {
    this.weights = [...stored.weights];
    this.bias = stored.bias;
    this.means = [...stored.means];
    this.stds = [...stored.stds];
  }

  export(trainingJobId: string | null, metrics: ModelMetrics): StoredModel {
    return {
      version: '1.0',
      trainedAt: new Date().toISOString(),
      featureNames: [...FEATURE_NAMES],
      weights: [...this.weights],
      bias: this.bias,
      means: [...this.means],
      stds: [...this.stds],
      metrics,
      trainingJobId,
    };
  }

  isTrained(): boolean {
    return this.weights.length === FEATURE_NAMES.length;
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export const logisticModel = new LogisticModel();
