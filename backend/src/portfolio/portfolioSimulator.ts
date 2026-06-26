import { roundPrice } from '../backtest/priceUtils.js';
import { dayjs } from '../utils/dateParser.js';
import type {
  IgnoredBuySignal,
  PortfolioClosedTrade,
  PortfolioOpenPosition,
  PortfolioSimConfig,
  PortfolioSimResult,
  PortfolioSimulationMode,
} from '../types/index.js';
import type { SignalExitPlan } from './portfolioExitResolver.js';

interface InternalPosition {
  id: string;
  planKey: string;
  symbol: string;
  buyDate: string;
  buyPrice: number;
  quantity: number;
  investmentAmount: number;
  principalReturned: number;
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
    };

function investmentPerStock(availableCash: number, maxHoldings: number): number {
  if (maxHoldings <= 0) return 0;
  return roundPrice(availableCash / maxHoldings, 2);
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

export function runPortfolioSimulation(
  plans: SignalExitPlan[],
  config: PortfolioSimConfig,
  mode: PortfolioSimulationMode
): PortfolioSimResult {
  const events = buildEvents(plans, mode);
  const planByKey = new Map(plans.map((p) => [p.signalKey, p]));

  let cash = config.initialCapital;
  const positions = new Map<string, InternalPosition>();
  const closedTrades: PortfolioClosedTrade[] = [];
  const ignoredBuys: IgnoredBuySignal[] = [];
  let buysExecuted = 0;

  const priceByPlan = new Map<string, { price: number }>();
  for (const plan of plans) {
    priceByPlan.set(plan.signalKey, { price: plan.lastPrice });
  }

  const equityCurve: number[] = [config.initialCapital];
  let peak = config.initialCapital;
  let maxDrawdownPct = 0;

  const recordEquity = () => {
    const value = portfolioValue(cash, [...positions.values()], priceByPlan);
    equityCurve.push(value);
    peak = Math.max(peak, value);
    if (peak > 0) {
      const dd = ((peak - value) / peak) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
    }
  };

  for (const event of events) {
    if (event.kind === 'BUY') {
      const ips = investmentPerStock(cash, config.maxHoldings);
      const capEnabled = config.enforceMaxHoldings !== false;
      if (capEnabled && positions.size >= config.maxHoldings) {
        ignoredBuys.push({
          symbol: event.plan.symbol,
          entryDate: event.plan.signalDate,
          entryPrice: event.plan.entryPrice,
          reason: 'max_holdings',
          openPositionsAtSkip: positions.size,
          availableCashAtSkip: roundPrice(cash, 2),
          requiredInvestment: ips,
        });
        continue;
      }
      if (cash < ips || ips <= 0) {
        ignoredBuys.push({
          symbol: event.plan.symbol,
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
        buyDate: event.plan.signalDate,
        buyPrice: event.plan.entryPrice,
        quantity: qty,
        investmentAmount: ips,
        principalReturned: 0,
        lastPrice: event.plan.lastPrice,
        lastDate: event.plan.lastDate,
      });
      recordEquity();
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
        buyDate: pos.buyDate,
        sellDate: event.date,
        buyPrice: pos.buyPrice,
        sellPrice: event.price,
        investmentAmount: pos.investmentAmount,
        quantity: roundPrice(pos.quantity, 4),
        profitLoss: pnl,
        returnPct: roundPrice((pnl / pos.investmentAmount) * 100, 2),
        exitReason: event.reason,
      });
      positions.delete(event.planKey);
      priceByPlan.set(event.planKey, { price: event.price });
      recordEquity();
      continue;
    }

    if (event.kind === 'PARTIAL_TARGET') {
      const principal = pos.investmentAmount;
      const sharesSold = principal / event.price;
      const remainingQty = pos.quantity - sharesSold;
      cash = roundPrice(cash + principal, 2);
      pos.quantity = remainingQty;
      pos.principalReturned = principal;
      priceByPlan.set(event.planKey, { price: event.price });
      recordEquity();
      continue;
    }

    if (event.kind === 'REMAINDER_SL') {
      const proceeds = roundPrice(pos.quantity * event.price, 2);
      cash = roundPrice(cash + proceeds, 2);
      const totalReceived = roundPrice(pos.principalReturned + proceeds, 2);
      const pnl = roundPrice(totalReceived - pos.investmentAmount, 2);
      closedTrades.push({
        symbol: pos.symbol,
        buyDate: pos.buyDate,
        sellDate: event.date,
        buyPrice: pos.buyPrice,
        sellPrice: event.price,
        investmentAmount: pos.investmentAmount,
        quantity: roundPrice(pos.quantity, 4),
        profitLoss: pnl,
        returnPct: roundPrice((pnl / pos.investmentAmount) * 100, 2),
        exitReason: 'STOPLOSS',
      });
      positions.delete(event.planKey);
      priceByPlan.set(event.planKey, { price: event.price });
      recordEquity();
    }
  }

  const openList: PortfolioOpenPosition[] = [...positions.values()].map((pos) => {
    const plan = planByKey.get(pos.planKey);
    const currentPrice = plan?.lastPrice ?? pos.lastPrice;
    const marketValue = roundPrice(pos.quantity * currentPrice, 2);
    const costBasis = roundPrice(pos.investmentAmount - pos.principalReturned, 2);
    const unrealizedProfit = roundPrice(marketValue - costBasis, 2);
    return {
      symbol: pos.symbol,
      buyDate: pos.buyDate,
      buyPrice: pos.buyPrice,
      quantity: roundPrice(pos.quantity, 4),
      investmentAmount: pos.investmentAmount,
      currentPrice,
      marketValue,
      unrealizedProfit,
      principalReturned: pos.principalReturned,
    };
  });

  const openMarketValue = openList.reduce((sum, p) => sum + p.marketValue, 0);
  const finalPortfolioValue = roundPrice(cash + openMarketValue, 2);
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

  return {
    metrics: {
      mode,
      initialCapital: config.initialCapital,
      availableCash: roundPrice(cash, 2),
      portfolioValue: finalPortfolioValue,
      investmentPerStock: investmentPerStock(cash, config.maxHoldings),
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
    },
    closedTrades,
    openPositions: openList,
    ignoredBuySignals: ignoredBuys.length,
    ignoredBuys,
    buysExecuted,
  };
}
