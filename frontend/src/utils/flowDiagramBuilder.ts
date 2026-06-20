import type { DashboardTreeNode, TimingStats, TradeResult } from '../types';

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 10000) / 100;
}

function daysToMonths(days: number): number {
  return Math.round((days / 30.44) * 100) / 100;
}

function diffDays(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86400000);
}

function computeTimingStats(values: number[]): TimingStats {
  if (values.length === 0) {
    return {
      count: 0,
      minDays: null,
      maxDays: null,
      avgDays: null,
      minMonths: null,
      maxMonths: null,
      avgMonths: null,
    };
  }
  const minDays = Math.min(...values);
  const maxDays = Math.max(...values);
  const avgDays = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
  return {
    count: values.length,
    minDays,
    maxDays,
    avgDays,
    minMonths: daysToMonths(minDays),
    maxMonths: daysToMonths(maxDays),
    avgMonths: daysToMonths(avgDays),
  };
}

/** Same rule as backend extractUniqueSymbols: one row per symbol, earliest minDate wins. */
export function dedupeResultsBySymbolMinDate(results: TradeResult[]): {
  deduped: TradeResult[];
  rawCount: number;
  duplicatesDropped: number;
} {
  const map = new Map<string, TradeResult>();
  for (const r of results) {
    const existing = map.get(r.symbol);
    if (!existing || r.minDate < existing.minDate) {
      map.set(r.symbol, r);
    }
  }
  const deduped = Array.from(map.values());
  return {
    deduped,
    rawCount: results.length,
    duplicatesDropped: results.length - deduped.length,
  };
}

function targetDaysFrom(trades: TradeResult[]): number[] {
  return trades.filter((t) => t.targetHitDays != null).map((t) => t.targetHitDays as number);
}

function stoplossDaysFrom(trades: TradeResult[]): number[] {
  return trades.filter((t) => t.stoplossHitDays != null).map((t) => t.stoplossHitDays as number);
}

function daysAfterTargetToSl(trades: TradeResult[]): number[] {
  return trades
    .filter((t) => t.targetHitDate && t.stoplossAfterTargetDate)
    .map((t) => diffDays(t.targetHitDate as string, t.stoplossAfterTargetDate as string));
}

function daysAfterSlToTarget(trades: TradeResult[]): number[] {
  return trades
    .filter((t) => t.stoplossHitDate && t.targetAfterStoplossDate)
    .map((t) => diffDays(t.stoplossHitDate as string, t.targetAfterStoplossDate as string));
}

function buildNode(
  id: string,
  label: string,
  trades: TradeResult[],
  total: number,
  parentCount: number | null,
  isLeaf: boolean,
  children: DashboardTreeNode[] | undefined,
  afterPriorDays: number[] | null
): DashboardTreeNode {
  return {
    id,
    label,
    count: trades.length,
    pct: pct(trades.length, total),
    pctOfParent: parentCount != null ? pct(trades.length, parentCount) : null,
    isLeaf,
    children,
    toFirstTarget: computeTimingStats(targetDaysFrom(trades)),
    toFirstStoploss: computeTimingStats(stoplossDaysFrom(trades)),
    afterPriorHit: afterPriorDays ? computeTimingStats(afterPriorDays) : null,
  };
}

export function buildFlowDiagramTree(results: TradeResult[]): DashboardTreeNode | null {
  const { deduped } = dedupeResultsBySymbolMinDate(results);
  const total = deduped.length;
  if (total === 0) return null;

  const actionable = deduped.filter(
    (r) => r.buyDate != null && r.result !== 'ERROR' && r.result !== 'NO_BREAKOUT'
  );
  const firstTarget = actionable.filter((r) => r.firstHit === 'TARGET');
  const firstSl = actionable.filter((r) => r.firstHit === 'STOPLOSS');
  const sideways = actionable.filter((r) => r.firstHit === null);
  const noBreakout = deduped.filter((r) => r.result === 'NO_BREAKOUT');
  const errors = deduped.filter((r) => r.result === 'ERROR');
  const neverSl = actionable.filter((r) => r.stoplossHitTillDate === false);

  const targetSlAfter = firstTarget.filter((r) => r.stoplossAfterTargetHit === true);
  const targetNeverSl = firstTarget.filter((r) => r.stoplossAfterTargetHit !== true);
  const slTargetAfter = firstSl.filter((r) => r.targetAfterStoplossHit === true);
  const slNeverTarget = firstSl.filter((r) => r.targetAfterStoplossHit !== true);

  const ft = firstTarget.length;
  const fsl = firstSl.length;

  const children: DashboardTreeNode[] = [
    buildNode(
      'first_target',
      '1st Target Hit',
      firstTarget,
      total,
      null,
      false,
      [
        buildNode(
          'target_then_sl',
          'Then Hit Stoploss',
          targetSlAfter,
          total,
          ft,
          true,
          undefined,
          daysAfterTargetToSl(targetSlAfter)
        ),
        buildNode(
          'target_never_sl',
          'Never Hit Stoploss After',
          targetNeverSl,
          total,
          ft,
          true,
          undefined,
          null
        ),
      ],
      null
    ),
    buildNode(
      'first_stoploss',
      '1st Stoploss Hit',
      firstSl,
      total,
      null,
      false,
      [
        buildNode(
          'sl_then_target',
          'Then Hit Target',
          slTargetAfter,
          total,
          fsl,
          true,
          undefined,
          daysAfterSlToTarget(slTargetAfter)
        ),
        buildNode(
          'sl_never_target',
          'Never Hit Target After',
          slNeverTarget,
          total,
          fsl,
          true,
          undefined,
          null
        ),
      ],
      null
    ),
    buildNode('sideways', 'Sideways (Open)', sideways, total, null, true, undefined, null),
    buildNode('no_breakout', 'No Breakout', noBreakout, total, null, true, undefined, null),
    buildNode('never_stoploss', 'Never Hit Stoploss', neverSl, total, null, true, undefined, null),
  ];

  if (errors.length > 0) {
    children.push(buildNode('errors', 'Errors', errors, total, null, true, undefined, null));
  }

  return {
    id: 'root',
    label: 'Total Stocks (unique · min date)',
    count: total,
    pct: 100,
    pctOfParent: null,
    isLeaf: false,
    children,
    toFirstTarget: computeTimingStats(targetDaysFrom(actionable)),
    toFirstStoploss: computeTimingStats(stoplossDaysFrom(actionable)),
    afterPriorHit: null,
  };
}
