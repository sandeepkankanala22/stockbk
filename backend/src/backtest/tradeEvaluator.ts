import type { OhlcvBar, SameDayHitMode, TradeResultType } from '../types/index.js';
import { diffDays } from '../utils/dateParser.js';

export interface TradeEvaluation {
  result: TradeResultType;
  resultDate: string | null;
  days: number | null;
}

export function evaluateTrade(
  bars: OhlcvBar[],
  buyDate: string,
  targetPrice: number,
  stoplossPrice: number,
  sameDayHitMode: SameDayHitMode
): TradeEvaluation {
  for (const bar of bars) {
    if (bar.date <= buyDate) continue;

    const targetHit = bar.high >= targetPrice;
    const stoplossHit = bar.low <= stoplossPrice;

    if (targetHit && stoplossHit) {
      const result: TradeResultType =
        sameDayHitMode === 'TARGET_FIRST' ? 'TARGET' : 'STOPLOSS';
      return {
        result,
        resultDate: bar.date,
        days: diffDays(buyDate, bar.date),
      };
    }

    if (targetHit) {
      return {
        result: 'TARGET',
        resultDate: bar.date,
        days: diffDays(buyDate, bar.date),
      };
    }

    if (stoplossHit) {
      return {
        result: 'STOPLOSS',
        resultDate: bar.date,
        days: diffDays(buyDate, bar.date),
      };
    }
  }

  return { result: 'OPEN', resultDate: null, days: null };
}
