import { roundPrice } from '../backtest/priceUtils.js';
import { dayjs } from '../utils/dateParser.js';
import type {
  IgnoredBuySignal,
  PortfolioClosedTrade,
  PortfolioEntryType,
  PortfolioOpenPosition,
  PortfolioPerformanceSummary,
  PortfolioSimConfig,
  PortfolioSimResult,
  PortfolioSimulationMode,
  PortfolioTimeSnapshot,
  PortfolioTradeRecord,
} from '../types/index.js';
import type { SignalExitPlan } from './portfolioExitResolver.js';

interface InternalPosition {
  id: string;
  planKey: string;
  symbol: string;
  entryType: PortfolioEntryType;
  buyDate: string;
  buyPrice: number;
  quantity: number;
  investmentAmount: number;
  principalReturned: number;
  isRunner: boolean;
  lastPrice: number;
  lastDate: string;
}

type SimEvent =
  | { kind: 'BUY'; date: string; plan: SignalExitPlan }
  | {
      kind: 'FULL_EXIT';
      date: string;
      planKey: string;
      price: number;
      reason: 'TARGET' | 'STOPLOSS';
    }
  | {
      kind: 'PARTIAL_TARGET';
      date: string;
      planKey: string;
      price: number;
    }
  | {
      kind: 'REMAINDER_SL';
      date: string;
      planKey: string;
      price: number;
    }
  | { kind: 'MARK'; date: string };

function investmentPerStock(portfolioVal: number, maxHoldings: number): number {
  if (maxHoldings <= 0) return 0;
  return roundPrice(portfolioVal / maxHoldings, 2);
}

function markPriceOnDate(plan: SignalExitPlan, date: string): number {
  let price = plan.entryPrice;
  for (const bar of plan.priceSeries) {
    if (bar.date <= date) price = bar.close;
    else break;
  }
  return price;
}

function buildEvents(plans: SignalExitPlan[], mode: PortfolioSimulationMode): SimEvent[] {
  const events: SimEvent[] = [];

  for (const plan of plans) {
    events.push({ kind: 'BUY', date: plan.signalDate, plan });

    if (mode === 'compound') {
      if (plan.fullExitDate && plan.fullExitPrice && plan.fullExitReason) {
        events.push({
          kind: 'FULL_EXIT',
          date: plan.fullExitDate,
          planKey: plan.signalKey,
          price: plan.fullExitPrice,
          reason: plan.fullExitReason,
        });
      }
      continue;
    }

    if (plan.slBeforeTargetDate && plan.slBeforeTargetPrice) {
      events.push({
        kind: 'FULL_EXIT',
        date: plan.slBeforeTargetDate,
        planKey: plan.signalKey,
        price: plan.slBeforeTargetPrice,
        reason: 'STOPLOSS',
      });
      continue;
    }

    if (plan.partialTargetDate && plan.partialTargetPrice) {
      events.push({
        kind: 'PARTIAL_TARGET',
        date: plan.partialTargetDate,
        planKey: plan.signalKey,
        price: plan.partialTargetPrice,
      });
    }

    if (plan.remainderSlDate && plan.remainderSlPrice) {
      events.push({
        kind: 'REMAINDER_SL',
        date: plan.remainderSlDate,
        planKey: plan.signalKey,
        price: plan.remainderSlPrice,
      });
    }
  }

  return events.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const order = (e: SimEvent) => (e.kind === 'BUY' ? 1 : 0);
    return order(a) - order(b);
  });
}

function monthEndDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start).startOf('month');
  const endD = dayjs(end);
  while (cursor.isBefore(endD) || cursor.isSame(endD, 'month')) {
    const monthEnd = cursor.endOf('month');
    const dateStr = monthEnd.format('YYYY-MM-DD');
    if (dateStr >= start && dateStr <= endD.format('YYYY-MM-DD')) {
      out.push(dateStr);
    }
    cursor = cursor.add(1, 'month');
  }
  return out;
}

function mergeTimelineEvents(tradeEvents: SimEvent[], plans: SignalExitPlan[]): SimEvent[] {
  if (tradeEvents.length === 0) return [];

  const dates = tradeEvents.map((e) => e.date).sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const monthMarks: SimEvent[] = monthEndDates(start, end).map((date) => ({
    kind: 'MARK',
    date,
  }));

  const all = [...tradeEvents, ...monthMarks];
  return all.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const order = (e: SimEvent) => {
      if (e.kind === 'MARK') return 2;
      if (e.kind === 'BUY') return 1;
      return 0;
    };
    return order(a) - order(b);
  });
}

function updateMarksAtDate(
  positions: Map<string, InternalPosition>,
  planByKey: Map<string, SignalExitPlan>,
  priceByPlan: Map<string, { price: number }>,
  date: string
): void {
  for (const pos of positions.values()) {
    const plan = planByKey.get(pos.planKey);
    if (!plan) continue;
    priceByPlan.set(pos.planKey, { price: markPriceOnDate(plan, date) });
  }
}

function portfolioValue(
  cash: number,
  positions: InternalPosition[],
  priceByPlan: Map<string, { price: number }>
): number {
  let total = cash;
  for (const pos of positions) {
    const mark = priceByPlan.get(pos.planKey)?.price ?? pos.lastPrice;
    total += pos.quantity * mark;
  }
  return roundPrice(total, 2);
}

function splitPositionValues(
  positions: InternalPosition[],
  priceByPlan: Map<string, { price: number }>
): { activeValue: number; runnerValue: number; activeCount: number; runnerCount: number } {
  let activeValue = 0;
  let runnerValue = 0;
  let activeCount = 0;
  let runnerCount = 0;
  for (const pos of positions) {
    const mark = priceByPlan.get(pos.planKey)?.price ?? pos.lastPrice;
    const mv = pos.quantity * mark;
    if (pos.isRunner) {
      runnerValue += mv;
      runnerCount += 1;
    } else {
      activeValue += mv;
      activeCount += 1;
    }
  }
  return {
    activeValue: roundPrice(activeValue, 2),
    runnerValue: roundPrice(runnerValue, 2),
    activeCount,
    runnerCount,
  };
}

function holdingDays(buyDate: string, sellDate: string): number {
  return Math.max(0, dayjs(sellDate).diff(dayjs(buyDate), 'day'));
}

function buildMonthlyTimeline(snapshots: PortfolioTimeSnapshot[]): PortfolioTimeSnapshot[] {
  const byMonth = new Map<string, PortfolioTimeSnapshot>();
  for (const snap of snapshots) {
    const key = dayjs(snap.date).format('YYYY-MM');
    const existing = byMonth.get(key);
    if (!existing || snap.date >= existing.date) {
      byMonth.set(key, snap);
    }
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildPerformanceSummary(
  config: PortfolioSimConfig,
  snapshots: PortfolioTimeSnapshot[],
  closedTrades: PortfolioClosedTrade[],
  totalBuySignals: number,
  buysExecuted: number,
  missedSignals: number,
  finalMetrics: PortfolioSimResult['metrics']
): PortfolioPerformanceSummary {
  const utils = snapshots.map((s) => s.cashUtilizationPct);
  const pvSeries = snapshots.map((s) => s.portfolioValue);
  const ipsSeries = snapshots.map((s) => s.investmentPerStock);

  const wins = closedTrades.filter((t) => t.profitLoss > 0);
  const losses = closedTrades.filter((t) => t.profitLoss < 0);

  const simStart = snapshots[0]?.date ?? null;
  const simEnd = snapshots[snapshots.length - 1]?.date ?? null;
  let annualizedReturnPct: number | null = null;
  if (simStart && simEnd) {
    const years = dayjs(simEnd).diff(dayjs(simStart), 'day') / 365.25;
    if (years > 0 && config.initialCapital > 0) {
      annualizedReturnPct = roundPrice(
        ((finalMetrics.portfolioValue - config.initialCapital) / config.initialCapital / years) *
          100,
        2
      );
    }
  }

  const avgHolding =
    closedTrades.length > 0
      ? roundPrice(
          closedTrades.reduce((sum, t) => sum + t.holdingDays, 0) / closedTrades.length,
          1
        )
      : 0;

  return {
    initialCapital: config.initialCapital,
    finalPortfolioValue: finalMetrics.portfolioValue,
    totalReturnPct: finalMetrics.totalReturnPct,
    cagrPercent: finalMetrics.cagrPercent,
    annualizedReturnPct,
    totalRealizedProfit: finalMetrics.totalRealizedProfit,
    totalUnrealizedProfit: finalMetrics.totalUnrealizedProfit,
    maxDrawdownPct: finalMetrics.maxDrawdownPct,
    averageCashUtilizationPct:
      utils.length > 0 ? roundPrice(utils.reduce((a, b) => a + b, 0) / utils.length, 2) : 0,
    maxCashUtilizationPct: utils.length > 0 ? Math.max(...utils) : 0,
    minCashUtilizationPct: utils.length > 0 ? Math.min(...utils) : 0,
    highestPortfolioValue: pvSeries.length > 0 ? Math.max(...pvSeries) : config.initialCapital,
    largestWinningTrade:
      wins.length > 0 ? Math.max(...wins.map((t) => t.profitLoss)) : 0,
    largestLosingTrade:
      losses.length > 0 ? Math.min(...losses.map((t) => t.profitLoss)) : 0,
    averageHoldingDays: avgHolding,
    averageInvestmentPerStock:
      ipsSeries.length > 0 ? roundPrice(ipsSeries.reduce((a, b) => a + b, 0) / ipsSeries.length, 2) : 0,
    totalBuySignals,
    executedBuySignals: buysExecuted,
    missedSignals,
  };
}

function buildTradeHistory(
  mode: PortfolioSimulationMode,
  closedTrades: PortfolioClosedTrade[],
  openPositions: PortfolioOpenPosition[],
  asOfDate: string
): PortfolioTradeRecord[] {
  const closed: PortfolioTradeRecord[] = closedTrades.map((t) => ({
    symbol: t.symbol,
    entryType: t.entryType,
    simulationMode: mode,
    buyDate: t.buyDate,
    buyPrice: t.buyPrice,
    investmentAmount: t.investmentAmount,
    quantity: t.quantity,
    sellDate: t.sellDate,
    sellPrice: t.sellPrice,
    principalReturned: t.principalReturned,
    runnerValue: 0,
    realizedProfit: t.profitLoss,
    unrealizedProfit: 0,
    returnPct: t.returnPct,
    holdingDays: t.holdingDays,
    exitReason: t.exitReason,
    isRunner: t.principalReturned > 0,
  }));

  const open: PortfolioTradeRecord[] = openPositions.map((p) => ({
    symbol: p.symbol,
    entryType: p.entryType,
    simulationMode: mode,
    buyDate: p.buyDate,
    buyPrice: p.buyPrice,
    investmentAmount: p.investmentAmount,
    quantity: p.quantity,
    sellDate: null,
    sellPrice: null,
    principalReturned: p.principalReturned,
    runnerValue: p.isRunner ? p.marketValue : 0,
    realizedProfit: p.principalReturned,
    unrealizedProfit: p.unrealizedProfit,
    returnPct:
      p.investmentAmount > 0
        ? roundPrice(((p.marketValue + p.principalReturned - p.investmentAmount) / p.investmentAmount) * 100, 2)
        : null,
    holdingDays: holdingDays(p.buyDate, asOfDate),
    exitReason: p.isRunner ? 'RUNNER' : 'OPEN',
    isRunner: p.isRunner,
  }));

  return [...closed, ...open].sort((a, b) => a.buyDate.localeCompare(b.buyDate));
}

export function runPortfolioSimulation(
  plans: SignalExitPlan[],
  config: PortfolioSimConfig,
  mode: PortfolioSimulationMode
): PortfolioSimResult {
  if (plans.length === 0) {
    const metrics = {
      mode,
      initialCapital: config.initialCapital,
      availableCash: config.initialCapital,
      portfolioValue: config.initialCapital,
      investedAmount: 0,
      activeInvestedValue: 0,
      runnerValue: 0,
      idleCash: config.initialCapital,
      cashUtilizationPct: 0,
      investmentPerStock: investmentPerStock(config.initialCapital, config.maxHoldings),
      maxHoldings: config.maxHoldings,
      activePositions: 0,
      runnerPositions: 0,
      openPositions: 0,
      closedPositions: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalRealizedProfit: 0,
      totalUnrealizedProfit: 0,
      totalReturnPct: 0,
      cagrPercent: null,
      maxDrawdownPct: 0,
    };
    const performanceSummary: PortfolioPerformanceSummary = {
      initialCapital: config.initialCapital,
      finalPortfolioValue: config.initialCapital,
      totalReturnPct: 0,
      cagrPercent: null,
      annualizedReturnPct: null,
      totalRealizedProfit: 0,
      totalUnrealizedProfit: 0,
      maxDrawdownPct: 0,
      averageCashUtilizationPct: 0,
      maxCashUtilizationPct: 0,
      minCashUtilizationPct: 0,
      highestPortfolioValue: config.initialCapital,
      largestWinningTrade: 0,
      largestLosingTrade: 0,
      averageHoldingDays: 0,
      averageInvestmentPerStock: metrics.investmentPerStock,
      totalBuySignals: 0,
      executedBuySignals: 0,
      missedSignals: 0,
    };
    return {
      metrics,
      closedTrades: [],
      openPositions: [],
      tradeHistory: [],
      snapshots: [],
      monthlyTimeline: [],
      performanceSummary,
      ignoredBuySignals: 0,
      ignoredBuys: [],
      buysExecuted: 0,
      totalBuySignals: 0,
    };
  }

  const tradeEvents = buildEvents(plans, mode);
  const events = mergeTimelineEvents(tradeEvents, plans);
  const planByKey = new Map(plans.map((p) => [p.signalKey, p]));

  let cash = config.initialCapital;
  const positions = new Map<string, InternalPosition>();
  const closedTrades: PortfolioClosedTrade[] = [];
  const ignoredBuys: IgnoredBuySignal[] = [];
  const snapshots: PortfolioTimeSnapshot[] = [];
  let buysExecuted = 0;

  const priceByPlan = new Map<string, { price: number }>();
  for (const plan of plans) {
    priceByPlan.set(plan.signalKey, { price: plan.lastPrice });
  }

  let peak = config.initialCapital;
  let maxDrawdownPct = 0;

  const recordSnapshot = (date: string) => {
    updateMarksAtDate(positions, planByKey, priceByPlan, date);
    const pv = portfolioValue(cash, [...positions.values()], priceByPlan);
    const split = splitPositionValues([...positions.values()], priceByPlan);
    const investedAmount = roundPrice(split.activeValue + split.runnerValue, 2);
    const util =
      pv > 0 ? roundPrice((investedAmount / pv) * 100, 2) : 0;

    peak = Math.max(peak, pv);
    const dd = peak > 0 ? roundPrice(((peak - pv) / peak) * 100, 2) : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, dd);

    snapshots.push({
      date,
      portfolioValue: pv,
      availableCash: roundPrice(cash, 2),
      investedAmount,
      activeInvestedValue: split.activeValue,
      runnerValue: split.runnerValue,
      cashUtilizationPct: util,
      activePositions: split.activeCount,
      runnerPositions: split.runnerCount,
      investmentPerStock: investmentPerStock(pv, config.maxHoldings),
      drawdownPct: dd,
    });
  };

  recordSnapshot(
    tradeEvents.length > 0 ? tradeEvents[0].date : dayjs().format('YYYY-MM-DD')
  );

  for (const event of events) {
    if (event.kind === 'MARK') {
      recordSnapshot(event.date);
      continue;
    }

    if (event.kind === 'BUY') {
      updateMarksAtDate(positions, planByKey, priceByPlan, event.date);
      const currentPv = portfolioValue(cash, [...positions.values()], priceByPlan);
      const ips = investmentPerStock(currentPv, config.maxHoldings);

      if (cash < ips || ips <= 0) {
        ignoredBuys.push({
          symbol: event.plan.symbol,
          entryType: event.plan.entryType,
          entryDate: event.plan.signalDate,
          entryPrice: event.plan.entryPrice,
          reason: 'insufficient_cash',
          openPositionsAtSkip: positions.size,
          availableCashAtSkip: roundPrice(cash, 2),
          requiredInvestment: ips,
        });
        continue;
      }

      const qty = ips / event.plan.entryPrice;
      cash = roundPrice(cash - ips, 2);
      buysExecuted += 1;
      positions.set(event.plan.signalKey, {
        id: event.plan.signalKey,
        planKey: event.plan.signalKey,
        symbol: event.plan.symbol,
        entryType: event.plan.entryType,
        buyDate: event.plan.signalDate,
        buyPrice: event.plan.entryPrice,
        quantity: qty,
        investmentAmount: ips,
        principalReturned: 0,
        isRunner: false,
        lastPrice: event.plan.lastPrice,
        lastDate: event.plan.lastDate,
      });
      priceByPlan.set(event.plan.signalKey, { price: event.plan.entryPrice });
      recordSnapshot(event.date);
      continue;
    }

    const pos = positions.get(event.planKey);
    if (!pos) continue;

    if (event.kind === 'FULL_EXIT') {
      const proceeds = roundPrice(pos.quantity * event.price, 2);
      cash = roundPrice(cash + proceeds, 2);
      const pnl = roundPrice(proceeds - pos.investmentAmount, 2);
      closedTrades.push({
        symbol: pos.symbol,
        entryType: pos.entryType,
        buyDate: pos.buyDate,
        sellDate: event.date,
        buyPrice: pos.buyPrice,
        sellPrice: event.price,
        investmentAmount: pos.investmentAmount,
        quantity: roundPrice(pos.quantity, 4),
        profitLoss: pnl,
        returnPct: roundPrice((pnl / pos.investmentAmount) * 100, 2),
        holdingDays: holdingDays(pos.buyDate, event.date),
        exitReason: event.reason,
        principalReturned: 0,
      });
      positions.delete(event.planKey);
      priceByPlan.set(event.planKey, { price: event.price });
      recordSnapshot(event.date);
      continue;
    }

    if (event.kind === 'PARTIAL_TARGET') {
      const principal = pos.investmentAmount;
      const sharesSold = principal / event.price;
      const remainingQty = pos.quantity - sharesSold;
      cash = roundPrice(cash + principal, 2);
      pos.quantity = remainingQty;
      pos.principalReturned = principal;
      pos.isRunner = true;
      priceByPlan.set(event.planKey, { price: event.price });
      recordSnapshot(event.date);
      continue;
    }

    if (event.kind === 'REMAINDER_SL') {
      const proceeds = roundPrice(pos.quantity * event.price, 2);
      cash = roundPrice(cash + proceeds, 2);
      const totalReceived = roundPrice(pos.principalReturned + proceeds, 2);
      const pnl = roundPrice(totalReceived - pos.investmentAmount, 2);
      closedTrades.push({
        symbol: pos.symbol,
        entryType: pos.entryType,
        buyDate: pos.buyDate,
        sellDate: event.date,
        buyPrice: pos.buyPrice,
        sellPrice: event.price,
        investmentAmount: pos.investmentAmount,
        quantity: roundPrice(pos.quantity, 4),
        profitLoss: pnl,
        returnPct: roundPrice((pnl / pos.investmentAmount) * 100, 2),
        holdingDays: holdingDays(pos.buyDate, event.date),
        exitReason: 'STOPLOSS',
        principalReturned: pos.principalReturned,
      });
      positions.delete(event.planKey);
      priceByPlan.set(event.planKey, { price: event.price });
      recordSnapshot(event.date);
    }
  }

  const lastDate =
    snapshots.length > 0
      ? snapshots[snapshots.length - 1].date
      : tradeEvents[0]?.date ?? dayjs().format('YYYY-MM-DD');

  updateMarksAtDate(positions, planByKey, priceByPlan, lastDate);

  const openList: PortfolioOpenPosition[] = [...positions.values()].map((pos) => {
    const plan = planByKey.get(pos.planKey);
    const currentPrice = priceByPlan.get(pos.planKey)?.price ?? plan?.lastPrice ?? pos.lastPrice;
    const marketValue = roundPrice(pos.quantity * currentPrice, 2);
    const costBasis = roundPrice(pos.investmentAmount - pos.principalReturned, 2);
    const unrealizedProfit = roundPrice(marketValue - costBasis, 2);
    return {
      symbol: pos.symbol,
      entryType: pos.entryType,
      buyDate: pos.buyDate,
      buyPrice: pos.buyPrice,
      quantity: roundPrice(pos.quantity, 4),
      investmentAmount: pos.investmentAmount,
      currentPrice,
      marketValue,
      unrealizedProfit,
      principalReturned: pos.principalReturned,
      isRunner: pos.isRunner,
    };
  });

  const split = splitPositionValues([...positions.values()], priceByPlan);
  const openMarketValue = roundPrice(split.activeValue + split.runnerValue, 2);
  const finalPortfolioValue = roundPrice(cash + openMarketValue, 2);
  const idleCash = roundPrice(cash, 2);
  const cashUtilizationPct =
    finalPortfolioValue > 0
      ? roundPrice((openMarketValue / finalPortfolioValue) * 100, 2)
      : 0;

  const totalRealizedProfit = roundPrice(
    closedTrades.reduce((sum, t) => sum + t.profitLoss, 0),
    2
  );
  const totalUnrealizedProfit = roundPrice(
    openList.reduce((sum, p) => sum + p.unrealizedProfit, 0),
    2
  );
  const totalReturnPct = roundPrice(
    ((finalPortfolioValue - config.initialCapital) / config.initialCapital) * 100,
    2
  );

  const winningTrades = closedTrades.filter((t) => t.profitLoss > 0).length;
  const losingTrades = closedTrades.filter((t) => t.profitLoss < 0).length;
  const totalTrades = closedTrades.length;

  const dates = [
    ...plans.map((p) => p.signalDate),
    ...closedTrades.map((t) => t.sellDate),
    ...openList.map((p) => p.buyDate),
  ].sort();

  let cagrPercent: number | null = null;
  const simulationStart = dates[0] ?? null;
  const simulationEnd = dates[dates.length - 1] ?? null;
  if (simulationStart && simulationEnd) {
    const years = dayjs(simulationEnd).diff(dayjs(simulationStart), 'day') / 365.25;
    if (years > 0 && config.initialCapital > 0) {
      cagrPercent = roundPrice(
        (Math.pow(finalPortfolioValue / config.initialCapital, 1 / years) - 1) * 100,
        2
      );
    }
  }

  const metrics = {
    mode,
    initialCapital: config.initialCapital,
    availableCash: idleCash,
    portfolioValue: finalPortfolioValue,
    investedAmount: openMarketValue,
    activeInvestedValue: split.activeValue,
    runnerValue: split.runnerValue,
    idleCash,
    cashUtilizationPct,
    investmentPerStock: investmentPerStock(finalPortfolioValue, config.maxHoldings),
    maxHoldings: config.maxHoldings,
    activePositions: split.activeCount,
    runnerPositions: split.runnerCount,
    openPositions: openList.length,
    closedPositions: closedTrades.length,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: totalTrades > 0 ? roundPrice((winningTrades / totalTrades) * 100, 2) : 0,
    totalRealizedProfit,
    totalUnrealizedProfit,
    totalReturnPct,
    cagrPercent,
    maxDrawdownPct: roundPrice(maxDrawdownPct, 2),
  };

  const monthlyTimeline = buildMonthlyTimeline(snapshots);
  const performanceSummary = buildPerformanceSummary(
    config,
    snapshots,
    closedTrades,
    plans.length,
    buysExecuted,
    ignoredBuys.length,
    metrics
  );

  const tradeHistory = buildTradeHistory(mode, closedTrades, openList, lastDate);

  return {
    metrics,
    closedTrades,
    openPositions: openList,
    tradeHistory,
    snapshots,
    monthlyTimeline,
    performanceSummary,
    ignoredBuySignals: ignoredBuys.length,
    ignoredBuys,
    buysExecuted,
    totalBuySignals: plans.length,
  };
}
