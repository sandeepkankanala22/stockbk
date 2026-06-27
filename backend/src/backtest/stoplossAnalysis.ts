import type { OhlcvBar, SameDayHitMode } from '../types/index.js';
import { diffDays } from '../utils/dateParser.js';
import { evaluateTrade } from './tradeEvaluator.js';

export type FirstHitType = 'TARGET' | 'STOPLOSS' | null;

export interface HitSequenceAnalysis {
  targetHitTillDate: boolean;
  targetHitDate: string | null;
  targetHitDays: number | null;
  stoplossHitTillDate: boolean;
  stoplossHitDate: string | null;
  stoplossHitDays: number | null;
  firstHit: FirstHitType;
  firstHitDate: string | null;
  firstHitDays: number | null;
  stoplossAfterTargetHit: boolean;
  stoplossAfterTargetDate: string | null;
  targetAfterStoplossHit: boolean;
  targetAfterStoplossDate: string | null;
}

export interface Scenario2Analysis {
  recoveredToBuyAfterSl: boolean;
  recoveryDate: string | null;
  secondStoplossHit: boolean;
  secondStoplossHitDate: string | null;
}

const emptyHitSequence: HitSequenceAnalysis = {
  targetHitTillDate: false,
  targetHitDate: null,
  targetHitDays: null,
  stoplossHitTillDate: false,
  stoplossHitDate: null,
  stoplossHitDays: null,
  firstHit: null,
  firstHitDate: null,
  firstHitDays: null,
  stoplossAfterTargetHit: false,
  stoplossAfterTargetDate: null,
  targetAfterStoplossHit: false,
  targetAfterStoplossDate: null,
};

const emptyScenario2: Scenario2Analysis = {
  recoveredToBuyAfterSl: false,
  recoveryDate: null,
  secondStoplossHit: false,
  secondStoplossHitDate: null,
};

function findFirstTargetHit(
  bars: OhlcvBar[],
  buyDate: string,
  targetPrice: number
): { hit: boolean; date: string | null; days: number | null } {
  for (const bar of bars) {
    if (bar.date <= buyDate) continue;
    if (bar.high >= targetPrice) {
      return { hit: true, date: bar.date, days: diffDays(buyDate, bar.date) };
    }
  }
  return { hit: false, date: null, days: null };
}

function findFirstStoplossHit(
  bars: OhlcvBar[],
  buyDate: string,
  stoplossPrice: number
): { hit: boolean; date: string | null; days: number | null } {
  for (const bar of bars) {
    if (bar.date <= buyDate) continue;
    if (bar.low <= stoplossPrice) {
      return { hit: true, date: bar.date, days: diffDays(buyDate, bar.date) };
    }
  }
  return { hit: false, date: null, days: null };
}

function resolveSameDayFirstHit(
  targetHit: boolean,
  stoplossHit: boolean,
  sameDayHitMode: SameDayHitMode
): FirstHitType | null {
  if (targetHit && stoplossHit) {
    return sameDayHitMode === 'TARGET_FIRST' ? 'TARGET' : 'STOPLOSS';
  }
  if (targetHit) return 'TARGET';
  if (stoplossHit) return 'STOPLOSS';
  return null;
}

function findFirstHit(
  bars: OhlcvBar[],
  buyDate: string,
  targetPrice: number,
  stoplossPrice: number,
  sameDayHitMode: SameDayHitMode
): { firstHit: FirstHitType; date: string | null; days: number | null } {
  for (const bar of bars) {
    if (bar.date <= buyDate) continue;

    const firstHit = resolveSameDayFirstHit(
      bar.high >= targetPrice,
      bar.low <= stoplossPrice,
      sameDayHitMode
    );
    if (firstHit) {
      return { firstHit, date: bar.date, days: diffDays(buyDate, bar.date) };
    }
  }
  return { firstHit: null, date: null, days: null };
}

/** First ±target/stop hit strictly after `afterDate` (used for post-pullback phase 2). */
export function findFirstHitAfterDate(
  bars: OhlcvBar[],
  afterDate: string,
  targetPrice: number,
  stoplossPrice: number,
  sameDayHitMode: SameDayHitMode
): { firstHit: FirstHitType; date: string | null } {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;

    const firstHit = resolveSameDayFirstHit(
      bar.high >= targetPrice,
      bar.low <= stoplossPrice,
      sameDayHitMode
    );
    if (firstHit) {
      return { firstHit, date: bar.date };
    }
  }
  return { firstHit: null, date: null };
}

function findStoplossAfterDate(
  bars: OhlcvBar[],
  afterDate: string,
  stoplossPrice: number
): { hit: boolean; date: string | null } {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;
    if (bar.low <= stoplossPrice) {
      return { hit: true, date: bar.date };
    }
  }
  return { hit: false, date: null };
}

function findTargetAfterDate(
  bars: OhlcvBar[],
  afterDate: string,
  targetPrice: number
): { hit: boolean; date: string | null } {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;
    if (bar.high >= targetPrice) {
      return { hit: true, date: bar.date };
    }
  }
  return { hit: false, date: null };
}

export function analyzeHitSequence(
  bars: OhlcvBar[],
  buyDate: string,
  targetPrice: number,
  stoplossPrice: number,
  sameDayHitMode: SameDayHitMode
): HitSequenceAnalysis {
  const target = findFirstTargetHit(bars, buyDate, targetPrice);
  const stoploss = findFirstStoplossHit(bars, buyDate, stoplossPrice);
  const first = findFirstHit(bars, buyDate, targetPrice, stoplossPrice, sameDayHitMode);

  let stoplossAfterTargetHit = false;
  let stoplossAfterTargetDate: string | null = null;
  if (target.hit && target.date) {
    const after = findStoplossAfterDate(bars, target.date, stoplossPrice);
    stoplossAfterTargetHit = after.hit;
    stoplossAfterTargetDate = after.date;
  }

  let targetAfterStoplossHit = false;
  let targetAfterStoplossDate: string | null = null;
  if (stoploss.hit && stoploss.date) {
    const after = findTargetAfterDate(bars, stoploss.date, targetPrice);
    targetAfterStoplossHit = after.hit;
    targetAfterStoplossDate = after.date;
  }

  return {
    targetHitTillDate: target.hit,
    targetHitDate: target.date,
    targetHitDays: target.days,
    stoplossHitTillDate: stoploss.hit,
    stoplossHitDate: stoploss.date,
    stoplossHitDays: stoploss.days,
    firstHit: first.firstHit,
    firstHitDate: first.date,
    firstHitDays: first.days,
    stoplossAfterTargetHit,
    stoplossAfterTargetDate,
    targetAfterStoplossHit,
    targetAfterStoplossDate,
  };
}

/** @deprecated use analyzeHitSequence */
export function analyzeStoplossTillDate(
  bars: OhlcvBar[],
  buyDate: string,
  stoplossPrice: number
) {
  const seq = analyzeHitSequence(bars, buyDate, Infinity, stoplossPrice, 'STOPLOSS_FIRST');
  return {
    stoplossHitTillDate: seq.stoplossHitTillDate,
    stoplossHitDate: seq.stoplossHitDate,
    stoplossHitDays: seq.stoplossHitDays,
  };
}

export function analyzeScenario2Recovery(
  bars: OhlcvBar[],
  buyDate: string,
  buyPrice: number,
  stoplossPrice: number,
  targetPrice: number,
  sameDayHitMode: SameDayHitMode
): Scenario2Analysis | null {
  const seq = analyzeHitSequence(
    bars,
    buyDate,
    targetPrice,
    stoplossPrice,
    sameDayHitMode
  );
  if (!seq.stoplossHitTillDate || !seq.stoplossHitDate) {
    return null;
  }

  let recoveryDate: string | null = null;
  for (const bar of bars) {
    if (bar.date <= seq.stoplossHitDate) continue;
    if (bar.high >= buyPrice) {
      recoveryDate = bar.date;
      break;
    }
  }

  if (!recoveryDate) {
    return emptyScenario2;
  }

  const reentry = evaluateTrade(
    bars,
    recoveryDate,
    targetPrice,
    stoplossPrice,
    sameDayHitMode
  );

  if (reentry.result === 'STOPLOSS' && reentry.resultDate) {
    return {
      recoveredToBuyAfterSl: true,
      recoveryDate,
      secondStoplossHit: true,
      secondStoplossHitDate: reentry.resultDate,
    };
  }

  return {
    recoveredToBuyAfterSl: true,
    recoveryDate,
    secondStoplossHit: false,
    secondStoplossHitDate: null,
  };
}

export { emptyHitSequence, emptyScenario2 };
