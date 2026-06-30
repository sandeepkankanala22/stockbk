import type { TradeResult, BenchmarkSeries } from '../types';
import { getDashboardResults, tradeSeriesKey } from './symbolDateSelection';

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 10000) / 100;
}

function diffDays(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86400000);
}

export interface DaysTiming {
  min: number | null;
  avg: number | null;
  max: number | null;
}

export interface DashboardMetricRow {
  label: string;
  count: number;
  pctOfTotal: number | null;
  pctOfBranch: number | null;
  days: DaysTiming | null;
  note?: string;
}

export interface InvestorDashboardData {
  totalStocks: number;
  actionableStocks: number;
  overview: DashboardMetricRow[];
  fttData: DashboardMetricRow[];
  fslData: DashboardMetricRow[];
  signalPullback: SignalPullbackComparison | null;
  errors: { symbol: string; message: string }[];
  duplicatesDropped: number;
  rawCount: number;
}

export interface PieSlice {
  name: string;
  value: number;
  pct: number;
  color: string;
}

export interface PathMetricStat {
  label: string;
  count: number;
  pct: number;
  days: DaysTiming | null;
}

export interface BuyPathColumn {
  title: string;
  totalTrades: number;
  metrics: PathMetricStat[];
  pieSlices: PieSlice[];
}

export interface SignalPullbackComparison {
  signalBuys: BuyPathColumn;
  pullbackBuys: BuyPathColumn;
}

function computeDaysTiming(values: (number | null | undefined)[]): DaysTiming | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100;
  return { min, avg, max };
}

function row(
  label: string,
  count: number,
  total: number,
  branchTotal: number | null,
  days: DaysTiming | null,
  note?: string
): DashboardMetricRow {
  return {
    label,
    count,
    pctOfTotal: pct(count, total),
    pctOfBranch: branchTotal != null && branchTotal > 0 ? pct(count, branchTotal) : null,
    days,
    note,
  };
}

function daysFromDates(
  trades: TradeResult[],
  fromKey: keyof TradeResult,
  toKey: keyof TradeResult
): (number | null)[] {
  return trades.map((t) => {
    const from = t[fromKey] as string | null;
    const to = t[toKey] as string | null;
    if (!from || !to) return null;
    return diffDays(from, to);
  });
}

export function buildInvestorDashboard(results: TradeResult[]): InvestorDashboardData | null {
  const { rows, rawCount } = getDashboardResults(results);
  const total = rows.length;
  if (total === 0) return null;

  const actionable = rows.filter(
    (r) => r.buyDate != null && r.result !== 'ERROR' && r.result !== 'NO_BREAKOUT'
  );
  const ftt = actionable.filter((r) => r.firstHit === 'TARGET');
  const fsl = actionable.filter((r) => r.firstHit === 'STOPLOSS');
  const errors = rows
    .filter((r) => r.result === 'ERROR')
    .map((r) => ({
      symbol: r.symbol,
      message: r.errorMessage ?? 'Unknown error',
    }));

  const fttCount = ftt.length;
  const fslCount = fsl.length;

  const fttNewAth = ftt.filter((r) => r.newAthAfterFtt === true);
  const fttLowSl = ftt.filter((r) => r.lowHitSlAfterFtt === true);

  const actionableCount = actionable.length;
  const slTillDate = actionable.filter((r) => r.stoplossHitTillDate === true);

  const fslRecovered = fsl.filter((r) => r.recoveredToBuyAfterSl === true);
  const fslTargetAfterRecovery = fsl.filter((r) => r.targetAfterRecovery === true);
  const fslAthAfterRecoveryTarget = fsl.filter((r) => r.newAthAfterRecoveryTarget === true);

  return {
    totalStocks: total,
    actionableStocks: actionable.length,
    duplicatesDropped: 0,
    rawCount,
    signalPullback: buildSignalPullbackComparison(rows),
    overview: [
      row('Total stocks (backtest runs)', total, total, null, null),
      row(
        'First Time Target (FTT)',
        fttCount,
        total,
        null,
        computeDaysTiming(ftt.map((r) => r.firstHitDays)),
        'Stocks where target was hit before stop loss'
      ),
      row(
        'First Time Stop Loss (FSL)',
        fslCount,
        total,
        null,
        computeDaysTiming(fsl.map((r) => r.firstHitDays)),
        'Stocks where stop loss was hit before target'
      ),
    ],
    fttData: [
      row(
        'FTT universe',
        fttCount,
        total,
        fttCount,
        computeDaysTiming(ftt.map((r) => r.targetHitDays)),
        'Reward path — target hit first'
      ),
      row(
        'Formed new ATH after FTT',
        fttNewAth.length,
        total,
        fttCount,
        computeDaysTiming(daysFromDates(fttNewAth, 'targetHitDate', 'newAthAfterFttDate')),
        'Fresh all-time high after first target'
      ),
      row(
        'Pullback to stop loss after FTT',
        fttLowSl.length,
        total,
        fttCount,
        computeDaysTiming(
          fttLowSl.map((r) =>
            r.targetHitDate && r.stoplossAfterTargetDate
              ? diffDays(r.targetHitDate, r.stoplossAfterTargetDate)
              : null
          )
        ),
        'Low touched stop loss after target — full round-trip risk'
      ),
    ],
    fslData: [
      row(
        'Stop loss hit till date (buy → today)',
        slTillDate.length,
        total,
        actionableCount,
        computeDaysTiming(slTillDate.map((r) => r.stoplossHitDays)),
        'Any stock that touched SL after buy — includes target-first then fallback'
      ),
      row(
        'FSL universe (first hit = SL)',
        fslCount,
        total,
        fslCount,
        computeDaysTiming(fsl.map((r) => r.stoplossHitDays)),
        'Stop loss was the first event after buy'
      ),
      row(
        'Recovered to buy price after FSL',
        fslRecovered.length,
        total,
        fslCount,
        computeDaysTiming(daysFromDates(fslRecovered, 'stoplossHitDate', 'recoveryDate')),
        'Price reclaimed entry after initial stop loss'
      ),
      row(
        'Hit target after recovery',
        fslTargetAfterRecovery.length,
        total,
        fslCount,
        computeDaysTiming(daysFromDates(fslTargetAfterRecovery, 'recoveryDate', 'targetAfterRecoveryDate')),
        'Second-chance target hit after recovery'
      ),
      row(
        'New ATH after recovery + target',
        fslAthAfterRecoveryTarget.length,
        total,
        fslCount,
        computeDaysTiming(
          daysFromDates(fslAthAfterRecoveryTarget, 'targetAfterRecoveryDate', 'newAthAfterRecoveryTargetDate')
        ),
        'Fresh ATH after recovery and target'
      ),
    ],
    errors,
  };
}

function firstHitAfterPullbackFromPath(trade: TradeResult): 'TARGET' | 'STOPLOSS' | null {
  if (!trade.lowHitBuyAfterFttDate || !trade.pricePath?.length || trade.buyPrice == null) {
    return null;
  }
  const targetPct =
    trade.targetPrice != null ? ((trade.targetPrice / trade.buyPrice) - 1) * 100 : 30;
  const stopPct =
    trade.stoplossPrice != null ? ((trade.stoplossPrice / trade.buyPrice) - 1) * 100 : -30;

  const afterPullback = trade.pricePath
    .filter((p) => p.date > trade.lowHitBuyAfterFttDate!)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const p of afterPullback) {
    const targetHit = p.pct >= targetPct - 0.5;
    const stopHit = p.pct <= stopPct + 0.5;
    if (targetHit && stopHit) {
      return 'STOPLOSS';
    }
    if (targetHit) return 'TARGET';
    if (stopHit) return 'STOPLOSS';
  }
  return null;
}

export function resolveFirstHitAfterPullback(trade: TradeResult): 'TARGET' | 'STOPLOSS' | 'OPEN' {
  if (!trade.lowHitBuyAfterFttDate || trade.firstHit !== 'TARGET') return 'OPEN';
  if (trade.firstHitAfterPullback != null) {
    return trade.firstHitAfterPullback === 'TARGET' ? 'TARGET' : trade.firstHitAfterPullback === 'STOPLOSS' ? 'STOPLOSS' : 'OPEN';
  }
  const fromPath = firstHitAfterPullbackFromPath(trade);
  if (fromPath) return fromPath;
  if (trade.targetAfterPullbackHit && trade.stoplossAfterPullbackHit) {
    const tDate = trade.targetAfterPullbackDate;
    const sDate = trade.stoplossAfterPullbackDate;
    if (tDate && sDate) return tDate <= sDate ? 'TARGET' : 'STOPLOSS';
  }
  if (trade.targetAfterPullbackHit) return 'TARGET';
  if (trade.stoplossAfterPullbackHit) return 'STOPLOSS';
  return 'OPEN';
}

function resolveFirstHitAfterPullbackDate(trade: TradeResult): string | null {
  if (trade.firstHitAfterPullbackDate) return trade.firstHitAfterPullbackDate;
  const hit = resolveFirstHitAfterPullback(trade);
  if (hit === 'TARGET') return trade.targetAfterPullbackDate ?? null;
  if (hit === 'STOPLOSS') return trade.stoplossAfterPullbackDate ?? null;
  if (!trade.pricePath?.length || !trade.lowHitBuyAfterFttDate) return null;
  const targetPct =
    trade.buyPrice && trade.targetPrice ? ((trade.targetPrice / trade.buyPrice) - 1) * 100 : 30;
  const stopPct =
    trade.buyPrice && trade.stoplossPrice ? ((trade.stoplossPrice / trade.buyPrice) - 1) * 100 : -30;
  const afterPullback = trade.pricePath
    .filter((p) => p.date > trade.lowHitBuyAfterFttDate!)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const p of afterPullback) {
    const targetHit = p.pct >= targetPct - 0.5;
    const stopHit = p.pct <= stopPct + 0.5;
    if (targetHit || stopHit) return p.date;
  }
  return null;
}

function resolveTargetAfterPullbackDate(trade: TradeResult): string | null {
  if (resolveFirstHitAfterPullback(trade) !== 'TARGET') return null;
  return trade.firstHitAfterPullbackDate ?? trade.targetAfterPullbackDate ?? null;
}

function resolveStoplossAfterPullbackDate(trade: TradeResult): string | null {
  if (resolveFirstHitAfterPullback(trade) !== 'STOPLOSS') return null;
  return trade.firstHitAfterPullbackDate ?? trade.stoplossAfterPullbackDate ?? null;
}

function daysAfterPullbackToTarget(trade: TradeResult): number | null {
  const targetDate = resolveTargetAfterPullbackDate(trade);
  if (!trade.lowHitBuyAfterFttDate || !targetDate) return null;
  return diffDays(trade.lowHitBuyAfterFttDate, targetDate);
}

function daysAfterPullbackToSl(trade: TradeResult): number | null {
  const slDate = resolveStoplossAfterPullbackDate(trade);
  if (!trade.lowHitBuyAfterFttDate || !slDate) return null;
  return diffDays(trade.lowHitBuyAfterFttDate, slDate);
}

function buildPieSlices(
  slices: Array<{ name: string; count: number; color: string }>,
  total: number
): PieSlice[] {
  return slices
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.name,
      value: s.count,
      pct: pct(s.count, total),
      color: s.color,
    }));
}

function pathMetric(
  label: string,
  count: number,
  total: number,
  days: DaysTiming | null
): PathMetricStat {
  return { label, count, pct: pct(count, total), days };
}

function pullbackOutcomeAfterDate(trade: TradeResult): 'TARGET' | 'STOPLOSS' | 'OPEN' {
  return resolveFirstHitAfterPullback(trade);
}

function phase1OutcomeLabel(trade: TradeResult): string {
  if (trade.result === 'NO_BREAKOUT' || !trade.buyDate) return 'OPEN (No Buy)';
  if (trade.firstHit === 'TARGET') return 'FTT';
  if (trade.firstHit === 'STOPLOSS') return 'FSL';
  return 'SIDEWAYS';
}

function phase2OutcomeLabel(trade: TradeResult): string {
  if (!trade.lowHitBuyAfterFttDate || trade.firstHit !== 'TARGET') return '';
  const hit = resolveFirstHitAfterPullback(trade);
  if (hit === 'TARGET') return 'FTT';
  if (hit === 'STOPLOSS') return 'FSL';
  return 'SIDEWAYS';
}

export function buildSignalPullbackComparison(results: TradeResult[]): SignalPullbackComparison | null {
  const actionable = results.filter(
    (r) => r.buyDate != null && r.result !== 'ERROR' && r.result !== 'NO_BREAKOUT'
  );
  if (actionable.length === 0) return null;

  const signalTotal = actionable.length;
  const fttTrades = actionable.filter((r) => r.firstHit === 'TARGET');
  const fslTrades = actionable.filter((r) => r.firstHit === 'STOPLOSS');
  const openTrades = actionable.filter((r) => r.firstHit !== 'TARGET' && r.firstHit !== 'STOPLOSS');

  const pullbackTrades = actionable.filter(
    (r) => r.lowHitBuyAfterFtt === true && r.lowHitBuyAfterFttDate
  );
  const pullbackTotal = pullbackTrades.length;
  const targetAfterPb = pullbackTrades.filter((t) => pullbackOutcomeAfterDate(t) === 'TARGET');
  const slAfterPb = pullbackTrades.filter((t) => pullbackOutcomeAfterDate(t) === 'STOPLOSS');
  const pullbackPending = pullbackTrades.filter((t) => pullbackOutcomeAfterDate(t) === 'OPEN');

  return {
    signalBuys: {
      title: 'Signal Buys',
      totalTrades: signalTotal,
      metrics: [
        pathMetric(
          'FTT (First Time Target)',
          fttTrades.length,
          signalTotal,
          computeDaysTiming(fttTrades.map((r) => r.firstHitDays))
        ),
        pathMetric(
          'FSL (First Stop Loss)',
          fslTrades.length,
          signalTotal,
          computeDaysTiming(fslTrades.map((r) => r.firstHitDays))
        ),
      ],
      pieSlices: buildPieSlices(
        [
          { name: 'FTT', count: fttTrades.length, color: '#2e7d32' },
          { name: 'FSL', count: fslTrades.length, color: '#c62828' },
          { name: 'Open / Pending', count: openTrades.length, color: '#757575' },
        ],
        signalTotal
      ),
    },
    pullbackBuys: {
      title: 'Pullback Buys',
      totalTrades: pullbackTotal,
      metrics: [
        pathMetric(
          'Target hit after pullback (+30% from buy)',
          targetAfterPb.length,
          pullbackTotal || 1,
          computeDaysTiming(targetAfterPb.map(daysAfterPullbackToTarget))
        ),
        pathMetric(
          'Stop loss hit after pullback (−30% from buy)',
          slAfterPb.length,
          pullbackTotal || 1,
          computeDaysTiming(slAfterPb.map(daysAfterPullbackToSl))
        ),
      ],
      pieSlices: buildPieSlices(
        [
          { name: 'Target after pullback', count: targetAfterPb.length, color: '#2e7d32' },
          { name: 'SL after pullback', count: slAfterPb.length, color: '#c62828' },
          { name: 'Open / Pending', count: pullbackPending.length, color: '#757575' },
        ],
        pullbackTotal || 1
      ),
    },
  };
}

export const CHART_PCT_CAP = 200;
export const CHART_PCT_FLOOR = -50;

export function clampChartPct(value: number, cap = CHART_PCT_CAP, floor = CHART_PCT_FLOOR): number {
  return Math.max(floor, Math.min(cap, value));
}

export function formatBuyMonth(dateIso: string): string {
  const d = new Date(dateIso);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export interface BuyMonthRow {
  buyMonth: string;
  sortKey: string;
  stocksBought: number;
  ftt: number;
  fsl: number;
  open: number;
  fttPct: number;
  fslPct: number;
}

export interface FttPullbackRow {
  symbol: string;
  signalDate: string;
  buyDate: string;
  fttDate: string;
  pullbackDate: string;
  daysSignalToPullback: number;
  daysSignalToBuy: number | null;
  daysSignalToFtt: number | null;
  daysFttToPullback: number | null;
  pctFromBuyAfterPullback: number | null;
}

export interface FttPullbackCorrelationAnalysis {
  count: number;
  signalToPullback: DaysTiming;
  fttToPullback: DaysTiming;
  correlations: {
    signalDateVsPullbackDate: number | null;
    signalToPullbackDaysVsPctAfterPullback: number | null;
    fttToPullbackDaysVsPctAfterPullback: number | null;
  };
  bySignalMonth: Array<{
    month: string;
    count: number;
    avgDaysToPullback: number;
    medianDaysToPullback: number;
    avgPctAfterPullback: number | null;
  }>;
  insights: string[];
}

function dateToOrdinal(iso: string): number {
  return new Date(iso).getTime() / 86400000;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

function describeCorrelation(r: number | null): string {
  if (r == null) return 'not enough data';
  const abs = Math.abs(r);
  const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'no';
  const strength =
    abs >= 0.7 ? 'strong' : abs >= 0.4 ? 'moderate' : abs >= 0.2 ? 'weak' : 'negligible';
  return `${strength} ${direction} (r = ${r.toFixed(3)})`;
}

export function buildFttPullbackCorrelationAnalysis(
  rows: FttPullbackRow[]
): FttPullbackCorrelationAnalysis | null {
  if (rows.length === 0) return null;

  const signalOrdinals = rows.map((r) => dateToOrdinal(r.signalDate));
  const pullbackOrdinals = rows.map((r) => dateToOrdinal(r.pullbackDate));
  const daysSignalToPullback = rows.map((r) => r.daysSignalToPullback);
  const daysFttToPullback = rows
    .map((r) => r.daysFttToPullback)
    .filter((v): v is number => v != null);

  const pctsByRow = rows.filter((r) => r.pctFromBuyAfterPullback != null);
  const signalDaysForPct = pctsByRow.map((r) => r.daysSignalToPullback);
  const pctValues = pctsByRow.map((r) => r.pctFromBuyAfterPullback!);

  const fttPullbackPairs = rows.filter(
    (r) => r.daysFttToPullback != null && r.pctFromBuyAfterPullback != null
  );
  const fttDaysForPct = fttPullbackPairs.map((r) => r.daysFttToPullback!);
  const fttPctValues = fttPullbackPairs.map((r) => r.pctFromBuyAfterPullback!);

  const correlations = {
    signalDateVsPullbackDate: pearsonCorrelation(signalOrdinals, pullbackOrdinals),
    signalToPullbackDaysVsPctAfterPullback: pearsonCorrelation(signalDaysForPct, pctValues),
    fttToPullbackDaysVsPctAfterPullback: pearsonCorrelation(fttDaysForPct, fttPctValues),
  };

  const byMonthMap = new Map<string, FttPullbackRow[]>();
  for (const row of rows) {
    const key = row.signalDate.slice(0, 7);
    const list = byMonthMap.get(key) ?? [];
    list.push(row);
    byMonthMap.set(key, list);
  }

  const bySignalMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, monthRows]) => {
      const days = monthRows.map((r) => r.daysSignalToPullback);
      const sortedDays = [...days].sort((a, b) => a - b);
      const mid = Math.floor(sortedDays.length / 2);
      const medianDaysToPullback =
        sortedDays.length % 2 === 0
          ? Math.round(((sortedDays[mid - 1] + sortedDays[mid]) / 2) * 100) / 100
          : sortedDays[mid];
      const pctsInMonth = monthRows
        .map((r) => r.pctFromBuyAfterPullback)
        .filter((v): v is number => v != null);
      return {
        month: formatBuyMonth(`${key}-01`),
        count: monthRows.length,
        avgDaysToPullback: Math.round((days.reduce((s, v) => s + v, 0) / days.length) * 100) / 100,
        medianDaysToPullback,
        avgPctAfterPullback:
          pctsInMonth.length > 0
            ? Math.round((pctsInMonth.reduce((s, v) => s + v, 0) / pctsInMonth.length) * 100) / 100
            : null,
      };
    });

  const insights: string[] = [];
  const avgPullback =
    daysSignalToPullback.reduce((s, v) => s + v, 0) / daysSignalToPullback.length;
  insights.push(
    `Average ${Math.round(avgPullback)} days from signal date to pullback to buy (${rows.length} stocks).`
  );

  if (correlations.signalDateVsPullbackDate != null) {
    insights.push(
      `Signal date ↔ pullback date: ${describeCorrelation(correlations.signalDateVsPullbackDate)} — ` +
        (correlations.signalDateVsPullbackDate > 0.2
          ? 'later signals tend to see later pullbacks.'
          : correlations.signalDateVsPullbackDate < -0.2
            ? 'later signals tend to see earlier pullbacks.'
            : 'no clear timing link between signal and pullback dates.')
    );
  }

  if (correlations.signalToPullbackDaysVsPctAfterPullback != null) {
    insights.push(
      `Days (signal→pullback) ↔ % after pullback: ${describeCorrelation(correlations.signalToPullbackDaysVsPctAfterPullback)} — ` +
        (correlations.signalToPullbackDaysVsPctAfterPullback < -0.2
          ? 'faster pullbacks after signal often coincide with worse post-pullback returns.'
          : correlations.signalToPullbackDaysVsPctAfterPullback > 0.2
            ? 'longer wait to pullback often coincides with better post-pullback returns.'
            : 'pullback speed after signal does not strongly predict post-pullback %.')
    );
  }

  if (correlations.fttToPullbackDaysVsPctAfterPullback != null) {
    insights.push(
      `Days (FTT→pullback) ↔ % after pullback: ${describeCorrelation(correlations.fttToPullbackDaysVsPctAfterPullback)} — ` +
        (correlations.fttToPullbackDaysVsPctAfterPullback < -0.2
          ? 'quicker giveback after target tends to mean weaker follow-through.'
          : correlations.fttToPullbackDaysVsPctAfterPullback > 0.2
            ? 'more time after target before pullback tends to mean better follow-through.'
            : 'time from target to pullback does not strongly predict post-pullback %.')
    );
  }

  if (bySignalMonth.length >= 2) {
    const spread =
      Math.max(...bySignalMonth.map((m) => m.avgDaysToPullback)) -
      Math.min(...bySignalMonth.map((m) => m.avgDaysToPullback));
    if (spread > 30) {
      insights.push(
        `Signal-month cohorts differ by up to ${Math.round(spread)} days in avg signal→pullback timing — review month table below.`
      );
    }
  }

  return {
    count: rows.length,
    signalToPullback: computeDaysTiming(daysSignalToPullback) ?? {
      min: null,
      avg: null,
      max: null,
    },
    fttToPullback: computeDaysTiming(daysFttToPullback) ?? { min: null, avg: null, max: null },
    correlations,
    bySignalMonth,
    insights,
  };
}

function pctFromBuyAfterPullbackDate(trade: TradeResult): number | null {
  if (!trade.lowHitBuyAfterFttDate) return trade.pctFromBuyPrice;

  const path = trade.pricePath;
  if (!path?.length) return trade.pctFromBuyPrice;

  const afterPullback = path.filter((p) => p.date > trade.lowHitBuyAfterFttDate!);
  if (afterPullback.length > 0) {
    return afterPullback[afterPullback.length - 1].pct;
  }

  const onPullbackDay = path.find((p) => p.date === trade.lowHitBuyAfterFttDate);
  return onPullbackDay?.pct ?? trade.pctFromBuyPrice;
}

export function buildFttPullbackTable(results: TradeResult[]): FttPullbackRow[] {
  const { rows } = getDashboardResults(results);

  return rows
    .filter(
      (r) =>
        r.firstHit === 'TARGET' &&
        r.lowHitBuyAfterFtt === true &&
        r.buyDate &&
        r.targetHitDate &&
        r.lowHitBuyAfterFttDate
    )
    .map((r) => ({
      symbol: r.symbol,
      signalDate: r.minDate,
      buyDate: r.buyDate!,
      fttDate: r.targetHitDate!,
      pullbackDate: r.lowHitBuyAfterFttDate!,
      daysSignalToPullback: diffDays(r.minDate, r.lowHitBuyAfterFttDate!),
      daysSignalToBuy: r.buyDate ? diffDays(r.minDate, r.buyDate) : null,
      daysSignalToFtt: r.targetHitDate ? diffDays(r.minDate, r.targetHitDate) : null,
      daysFttToPullback: diffDays(r.targetHitDate!, r.lowHitBuyAfterFttDate!),
      pctFromBuyAfterPullback: pctFromBuyAfterPullbackDate(r),
    }));
}

export interface AllTradesExportRow {
  symbol: string;
  signalDate: string;
  monthHighDate: string;
  buyPrice: number | null;
  buyDate: string;
  targetPrice: number | null;
  stoplossPrice: number | null;
  phase1Outcome: string;
  phase1HitDate: string;
  phase1HitDays: string;
  fttDate: string;
  fslDate: string;
  fallbackToBuyDate: string;
  phase2FirstHit: string;
  phase2HitDate: string;
  phase2HitDays: string;
  currentPctFromBuy: string;
  status: string;
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDays(d: number | null | undefined): string {
  return d == null ? '' : String(d);
}

export function buildAllTradesExportRows(results: TradeResult[]): AllTradesExportRow[] {
  const { rows } = getDashboardResults(results);

  return rows
    .filter((r) => r.result !== 'ERROR')
    .map((r) => {
      const phase1 = phase1OutcomeLabel(r);
      const phase1HitDate =
        r.firstHit === 'TARGET'
          ? r.targetHitDate ?? r.firstHitDate ?? ''
          : r.firstHit === 'STOPLOSS'
            ? r.stoplossHitDate ?? r.firstHitDate ?? ''
            : '';
      const phase2Hit = phase2OutcomeLabel(r);
      const phase2Date = resolveFirstHitAfterPullbackDate(r) ?? '';
      const phase2Days =
        r.firstHitAfterPullbackDays ??
        (r.lowHitBuyAfterFttDate && phase2Date
          ? diffDays(r.lowHitBuyAfterFttDate, phase2Date)
          : null);

      return {
        symbol: r.symbol,
        signalDate: r.minDate,
        monthHighDate: r.monthHighDate ?? '',
        buyPrice: r.buyPrice,
        buyDate: r.buyDate ?? '',
        targetPrice: r.targetPrice,
        stoplossPrice: r.stoplossPrice,
        phase1Outcome: phase1,
        phase1HitDate,
        phase1HitDays: fmtDays(r.firstHitDays),
        fttDate: r.firstHit === 'TARGET' ? r.targetHitDate ?? '' : '',
        fslDate: r.firstHit === 'STOPLOSS' ? r.stoplossHitDate ?? '' : '',
        fallbackToBuyDate: r.lowHitBuyAfterFttDate ?? '',
        phase2FirstHit: phase2Hit,
        phase2HitDate: phase2Date,
        phase2HitDays: fmtDays(phase2Days),
        currentPctFromBuy: r.pctFromBuyPrice != null ? r.pctFromBuyPrice.toFixed(2) : '',
        status: r.result,
      };
    })
    .sort((a, b) => {
      const d = a.signalDate.localeCompare(b.signalDate);
      if (d !== 0) return d;
      return a.symbol.localeCompare(b.symbol);
    });
}

export function buildAllTradesExportCsv(results: TradeResult[]): string {
  const rows = buildAllTradesExportRows(results);
  const headers: (keyof AllTradesExportRow)[] = [
    'symbol',
    'signalDate',
    'monthHighDate',
    'buyPrice',
    'buyDate',
    'targetPrice',
    'stoplossPrice',
    'phase1Outcome',
    'phase1HitDate',
    'phase1HitDays',
    'fttDate',
    'fslDate',
    'fallbackToBuyDate',
    'phase2FirstHit',
    'phase2HitDate',
    'phase2HitDays',
    'currentPctFromBuy',
    'status',
  ];
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => headers.map((h) => csvCell(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function downloadAllTradesExport(results: TradeResult[], filename = 'all-trades-phase1-phase2.csv'): void {
  const csv = buildAllTradesExportCsv(results);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildBuyMonthTable(results: TradeResult[]): BuyMonthRow[] {
  const { rows } = getDashboardResults(results);
  const bought = rows.filter(
    (r) => r.buyDate != null && r.result !== 'ERROR' && r.result !== 'NO_BREAKOUT'
  );

  const byMonth = new Map<string, TradeResult[]>();
  for (const trade of bought) {
    const key = trade.buyDate!.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(trade);
    byMonth.set(key, list);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, trades]) => {
      const ftt = trades.filter((t) => t.firstHit === 'TARGET').length;
      const fsl = trades.filter((t) => t.firstHit === 'STOPLOSS').length;
      const open = trades.filter((t) => t.firstHit === null).length;
      const n = trades.length;
      return {
        buyMonth: formatBuyMonth(`${sortKey}-01`),
        sortKey,
        stocksBought: n,
        ftt,
        fsl,
        open,
        fttPct: n > 0 ? Math.round((ftt / n) * 10000) / 100 : 0,
        fslPct: n > 0 ? Math.round((fsl / n) * 10000) / 100 : 0,
      };
    });
}

export function formatMonthYear(dateIso: string): string {
  const d = new Date(dateIso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${year}`;
}

export interface AthScatterPoint {
  symbol: string;
  seriesKey: string;
  date: string;
  monthLabel: string;
  pct: number;
  displayPct: number;
}

export interface ChartRow {
  date: string;
  monthLabel: string;
  [seriesKey: string]: string | number | null;
}

export interface InsightChartRow {
  date: string;
  monthLabel: string;
  NIFTY50: number | null;
  portfolioAvg: number | null;
  portfolioMedian: number | null;
}

export interface PortfolioInsights {
  latestDate: string;
  portfolioAvg: number;
  portfolioMedian: number;
  nifty: number;
  alphaVsNifty: number;
  pctBeatingNifty: number;
  pctAboveTarget: number;
  pctInStopZone: number;
  activePositions: number;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Rebase benchmark % so anchor date = 0% (fair cohort comparison). */
function rebaseBenchmarkMap(
  benchmark: BenchmarkSeries,
  anchorDate: string,
  pctCap: number
): Map<string, number> {
  const onOrAfter = benchmark.points.filter((p) => p.date >= anchorDate);
  if (onOrAfter.length === 0) return new Map();

  const anchorPct = onOrAfter[0].pct;
  const map = new Map<string, number>();
  for (const pt of benchmark.points) {
    if (pt.date < anchorDate) continue;
    const rebased = ((1 + pt.pct / 100) / (1 + anchorPct / 100) - 1) * 100;
    map.set(pt.date, clampChartPct(rebased, pctCap));
  }
  return map;
}

export function buildPortfolioInsightChart(
  results: TradeResult[],
  benchmark: BenchmarkSeries | null,
  targetPercent: number,
  stoplossPercent: number,
  pctCap = CHART_PCT_CAP,
  buyMonthKey: string | null = null
): { rows: InsightChartRow[]; insights: PortfolioInsights | null } {
  const { rows: dashboardRows } = getDashboardResults(results);
  let actionable = dashboardRows.filter(
    (r) => r.buyDate != null && r.pricePath && r.pricePath.length > 0
  );

  if (buyMonthKey) {
    actionable = actionable.filter((r) => r.buyDate!.slice(0, 7) === buyMonthKey);
  }

  if (actionable.length === 0 && !benchmark) return { rows: [], insights: null };

  const pathMaps = new Map<string, Map<string, number>>();
  const dateSet = new Set<string>();

  for (const trade of actionable) {
    const key = tradeSeriesKey(trade.symbol, trade.minDate);
    const map = new Map<string, number>();
    for (const pt of trade.pricePath!) {
      map.set(pt.date, clampChartPct(pt.pct, pctCap));
      dateSet.add(pt.date);
    }
    pathMaps.set(key, map);
  }

  const cohortAnchor =
    buyMonthKey && actionable.length > 0
      ? actionable.reduce<string | null>((min, t) => {
          if (!t.buyDate) return min;
          return !min || t.buyDate < min ? t.buyDate : min;
        }, null)
      : benchmark?.startDate ?? null;

  const benchmarkMap = new Map<string, number>();
  if (benchmark) {
    const map =
      cohortAnchor != null
        ? rebaseBenchmarkMap(benchmark, cohortAnchor, pctCap)
        : new Map(
            benchmark.points.map((pt) => [pt.date, clampChartPct(pt.pct, pctCap)] as const)
          );
    for (const [date, pctVal] of map) {
      benchmarkMap.set(date, pctVal);
      dateSet.add(date);
    }
  }

  const keys = Array.from(pathMaps.keys());
  const dates = Array.from(dateSet).sort();

  const fullRows: InsightChartRow[] = dates.map((date) => {
    const values: number[] = [];
    for (const key of keys) {
      const v = pathMaps.get(key)?.get(date);
      if (v != null) values.push(v);
    }
    return {
      date,
      monthLabel: formatMonthYear(date),
      NIFTY50: benchmarkMap.get(date) ?? null,
      portfolioAvg:
        values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
          : null,
      portfolioMedian: values.length > 0 ? Math.round(median(values) * 100) / 100 : null,
    };
  });

  const rows =
    fullRows.length > 500
      ? fullRows.filter((_, i) => i % Math.ceil(fullRows.length / 500) === 0)
      : fullRows;

  const latest = fullRows[fullRows.length - 1];
  if (!latest) return { rows, insights: null };

  const latestValues: number[] = [];
  for (const key of keys) {
    const v = pathMaps.get(key)?.get(latest.date);
    if (v != null) latestValues.push(v);
  }

  const nifty = latest.NIFTY50 ?? 0;
  const portfolioAvg = latest.portfolioAvg ?? 0;
  const beatingNifty = latestValues.filter((v) => v > nifty).length;

  if (latestValues.length === 0) {
    return {
      rows,
      insights: {
        latestDate: latest.date,
        portfolioAvg: 0,
        portfolioMedian: 0,
        nifty,
        alphaVsNifty: 0,
        pctBeatingNifty: 0,
        pctAboveTarget: 0,
        pctInStopZone: 0,
        activePositions: 0,
      },
    };
  }

  return {
    rows,
    insights: {
      latestDate: latest.date,
      portfolioAvg,
      portfolioMedian: latest.portfolioMedian ?? 0,
      nifty,
      alphaVsNifty: Math.round((portfolioAvg - nifty) * 100) / 100,
      pctBeatingNifty: pct(beatingNifty, latestValues.length),
      pctAboveTarget: pct(latestValues.filter((v) => v >= targetPercent).length, latestValues.length),
      pctInStopZone: pct(latestValues.filter((v) => v <= -stoplossPercent).length, latestValues.length),
      activePositions: latestValues.length,
    },
  };
}

/** @deprecated use buildPortfolioInsightChart */
export function buildPerformanceChartData(
  results: TradeResult[],
  benchmark: BenchmarkSeries | null,
  pctCap = CHART_PCT_CAP
): {
  rows: ChartRow[];
  symbols: string[];
  athDots: AthScatterPoint[];
  clippedCount: number;
} {
  const { rows: dashboardRows } = getDashboardResults(results);
  const actionable = dashboardRows.filter(
    (r) => r.buyDate != null && r.pricePath && r.pricePath.length > 0
  );

  const pathMaps = new Map<string, Map<string, number>>();
  const dateSet = new Set<string>();
  const seriesKeys: string[] = [];
  let clippedCount = 0;

  for (const trade of actionable) {
    const key = tradeSeriesKey(trade.symbol, trade.minDate);
    seriesKeys.push(key);
    const map = new Map<string, number>();
    for (const pt of trade.pricePath!) {
      const clipped = clampChartPct(pt.pct, pctCap);
      if (clipped !== pt.pct) clippedCount++;
      map.set(pt.date, clipped);
      dateSet.add(pt.date);
    }
    pathMaps.set(key, map);
  }

  const benchmarkMap = new Map<string, number>();
  if (benchmark) {
    for (const pt of benchmark.points) {
      benchmarkMap.set(pt.date, clampChartPct(pt.pct, pctCap));
      dateSet.add(pt.date);
    }
  }

  const dates = Array.from(dateSet).sort();

  const fullRows: ChartRow[] = dates.map((date) => {
    const row: ChartRow = {
      date,
      monthLabel: formatMonthYear(date),
    };
    for (const key of seriesKeys) {
      row[key] = pathMaps.get(key)?.get(date) ?? null;
    }
    row.NIFTY50 = benchmarkMap.get(date) ?? null;
    return row;
  });

  const rows =
    fullRows.length > 500
      ? fullRows.filter((_, i) => i % Math.ceil(fullRows.length / 500) === 0)
      : fullRows;

  const athDots: AthScatterPoint[] = actionable.flatMap((trade) =>
    (trade.athEvents ?? [])
      .map((e) => ({
        symbol: trade.symbol,
        seriesKey: tradeSeriesKey(trade.symbol, trade.minDate),
        date: e.date,
        monthLabel: formatMonthYear(e.date),
        pct: e.pct,
        displayPct: clampChartPct(e.pct, pctCap),
      }))
      .filter((e) => e.displayPct >= CHART_PCT_FLOOR && e.displayPct <= pctCap)
  );

  return { rows, symbols: seriesKeys, athDots, clippedCount };
}
