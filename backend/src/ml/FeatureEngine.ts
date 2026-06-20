import type { BacktestConfig, OhlcvBar, TradeResult } from '../types/index.js';
import { dayjs } from '../utils/dateParser.js';
import { FEATURE_NAMES, type FeatureVector } from './featureDefinitions.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeVolumeAndMomentum(bars: OhlcvBar[] | undefined, buyDate: string): {
  volumeRatio: number;
  prior5dReturn: number;
} {
  if (!bars || bars.length === 0) {
    return { volumeRatio: 1, prior5dReturn: 0 };
  }

  const breakoutIdx = bars.findIndex((b) => b.date === buyDate);
  if (breakoutIdx < 0) {
    return { volumeRatio: 1, prior5dReturn: 0 };
  }

  const breakoutBar = bars[breakoutIdx];
  const priorBars = bars.slice(Math.max(0, breakoutIdx - 20), breakoutIdx);
  const avgVolume = avg(priorBars.map((b) => b.volume));
  const volumeRatio = avgVolume > 0 ? breakoutBar.volume / avgVolume : 1;

  const fiveDayStart = Math.max(0, breakoutIdx - 5);
  const startClose = bars[fiveDayStart]?.close ?? breakoutBar.close;
  const prior5dReturn =
    startClose > 0 ? ((breakoutBar.close - startClose) / startClose) * 100 : 0;

  return {
    volumeRatio: clamp(volumeRatio, 0, 5),
    prior5dReturn: clamp(prior5dReturn, -30, 30),
  };
}

export class FeatureEngine {
  extractFeatures(
    trade: TradeResult,
    config: BacktestConfig,
    bars?: OhlcvBar[]
  ): FeatureVector | null {
    if (
      trade.buyPrice == null ||
      trade.buyDate == null ||
      trade.result === 'NO_BREAKOUT' ||
      trade.result === 'ERROR'
    ) {
      return null;
    }

    const stoploss = Math.max(config.stoplossPercent, 0.1);
    const rewardRisk = clamp(config.targetPercent / stoploss, 0, 5) / 5;

    const breakoutExtension =
      trade.breakoutCandleHigh != null && trade.buyPrice > 0
        ? clamp((trade.breakoutCandleHigh - trade.buyPrice) / trade.buyPrice, 0, 0.5)
        : 0;

    const daysToBreakout =
      trade.monthHighDate != null
        ? clamp(dayjs(trade.buyDate).diff(dayjs(trade.monthHighDate), 'day') / 60, 0, 1)
        : 0.5;

    const monthHighDayNorm =
      trade.monthHighDate != null
        ? dayjs(trade.monthHighDate).date() / 31
        : 0.5;

    const { volumeRatio, prior5dReturn } = computeVolumeAndMomentum(bars, trade.buyDate);

    return {
      target_percent: config.targetPercent / 100,
      stoploss_percent: config.stoplossPercent / 100,
      reward_risk_ratio: rewardRisk,
      breakout_extension_pct: breakoutExtension,
      days_to_breakout: daysToBreakout,
      month_high_day_norm: monthHighDayNorm,
      volume_ratio: volumeRatio / 5,
      prior_5d_return: (prior5dReturn + 30) / 60,
    };
  }

  vectorize(features: FeatureVector): number[] {
    return FEATURE_NAMES.map((name) => features[name]);
  }

  isTrainableLabel(result: TradeResult['result']): result is 'TARGET' | 'STOPLOSS' {
    return result === 'TARGET' || result === 'STOPLOSS';
  }

  labelFromResult(result: 'TARGET' | 'STOPLOSS'): 0 | 1 {
    return result === 'TARGET' ? 1 : 0;
  }
}

export const featureEngine = new FeatureEngine();
