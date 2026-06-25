import type { OhlcvBar } from '../types/index.js';
import type { HitSequenceAnalysis, Scenario2Analysis } from './stoplossAnalysis.js';
import { diffDays } from '../utils/dateParser.js';

export interface InvestorPathAnalysis {
  newAthAfterFtt: boolean;
  newAthAfterFttDate: string | null;
  lowHitBuyAfterFtt: boolean;
  lowHitBuyAfterFttDate: string | null;
  lowHitSlAfterFtt: boolean;
  targetAfterRecovery: boolean;
  targetAfterRecoveryDate: string | null;
  newAthAfterRecoveryTarget: boolean;
  newAthAfterRecoveryTargetDate: string | null;
}

const emptyInvestorPath: InvestorPathAnalysis = {
  newAthAfterFtt: false,
  newAthAfterFttDate: null,
  lowHitBuyAfterFtt: false,
  lowHitBuyAfterFttDate: null,
  lowHitSlAfterFtt: false,
  targetAfterRecovery: false,
  targetAfterRecoveryDate: null,
  newAthAfterRecoveryTarget: false,
  newAthAfterRecoveryTargetDate: null,
};

function maxHighUpTo(bars: OhlcvBar[], upToDate: string): number {
  let max = -Infinity;
  for (const bar of bars) {
    if (bar.date <= upToDate) {
      max = Math.max(max, bar.high);
    }
  }
  return max === -Infinity ? 0 : max;
}

function findNewAthAfter(
  bars: OhlcvBar[],
  afterDate: string,
  baselineHigh: number
): { hit: boolean; date: string | null } {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;
    if (bar.high > baselineHigh) {
      return { hit: true, date: bar.date };
    }
  }
  return { hit: false, date: null };
}

function findLowHitAfter(
  bars: OhlcvBar[],
  afterDate: string,
  price: number
): { hit: boolean; date: string | null } {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;
    if (bar.low <= price) {
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

/** Post-hit risk/reward paths for investor dashboard (FTT winners vs FSL recovery). */
export function analyzeInvestorPaths(
  bars: OhlcvBar[],
  buyPrice: number,
  targetPrice: number,
  hitSeq: HitSequenceAnalysis,
  scenario2: Scenario2Analysis | null
): InvestorPathAnalysis {
  if (!hitSeq.firstHit) {
    return emptyInvestorPath;
  }

  let newAthAfterFtt = false;
  let newAthAfterFttDate: string | null = null;
  let lowHitBuyAfterFtt = false;
  let lowHitBuyAfterFttDate: string | null = null;
  let lowHitSlAfterFtt = false;

  if (hitSeq.firstHit === 'TARGET' && hitSeq.targetHitTillDate && hitSeq.targetHitDate) {
    const baseline = maxHighUpTo(bars, hitSeq.targetHitDate);
    const ath = findNewAthAfter(bars, hitSeq.targetHitDate, baseline);
    newAthAfterFtt = ath.hit;
    newAthAfterFttDate = ath.date;
    const buyPullback = findLowHitAfter(bars, hitSeq.targetHitDate, buyPrice);
    lowHitBuyAfterFtt = buyPullback.hit;
    lowHitBuyAfterFttDate = buyPullback.date;
    lowHitSlAfterFtt = hitSeq.stoplossAfterTargetHit;
  }

  let targetAfterRecovery = false;
  let targetAfterRecoveryDate: string | null = null;
  let newAthAfterRecoveryTarget = false;
  let newAthAfterRecoveryTargetDate: string | null = null;

  if (
    hitSeq.firstHit === 'STOPLOSS' &&
    scenario2?.recoveredToBuyAfterSl &&
    scenario2.recoveryDate
  ) {
    const targetHit = findTargetAfterDate(bars, scenario2.recoveryDate, targetPrice);
    targetAfterRecovery = targetHit.hit;
    targetAfterRecoveryDate = targetHit.date;
    if (targetHit.hit && targetHit.date) {
      const baseline = maxHighUpTo(bars, targetHit.date);
      const ath = findNewAthAfter(bars, targetHit.date, baseline);
      newAthAfterRecoveryTarget = ath.hit;
      newAthAfterRecoveryTargetDate = ath.date;
    }
  }

  return {
    newAthAfterFtt,
    newAthAfterFttDate,
    lowHitBuyAfterFtt,
    lowHitBuyAfterFttDate,
    lowHitSlAfterFtt,
    targetAfterRecovery,
    targetAfterRecoveryDate,
    newAthAfterRecoveryTarget,
    newAthAfterRecoveryTargetDate,
  };
}

export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return diffDays(from, to);
}

export { emptyInvestorPath };
