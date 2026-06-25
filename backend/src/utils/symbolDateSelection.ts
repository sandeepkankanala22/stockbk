import type { InputRow, TradeResult } from '../types/index.js';

export const SYMBOL_REAPPEAR_MONTHS = 50;

export interface SymbolDateEntry {
  date: string;
  kept: boolean;
  monthsFromMin: number;
  monthsFromLastKept: number;
  reason: string;
}

export interface SymbolDuplicateNote {
  symbol: string;
  minDate: string;
  entries: SymbolDateEntry[];
  results?: Array<{
    minDate: string;
    result: string;
    buyDate: string | null;
    pctFromBuyPrice: number | null;
  }>;
}

/** Calendar month difference (to - from). */
export function monthDiff(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Rolling 50-month rule: keep earliest, then each next date only if >50 months
 * after the previous *kept* date (not always the first).
 */
export function selectSymbolMinDates(dates: string[]): string[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const kept: string[] = [sorted[0]];
  let lastKept = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const date = sorted[i];
    if (monthDiff(lastKept, date) > SYMBOL_REAPPEAR_MONTHS) {
      kept.push(date);
      lastKept = date;
    }
  }

  return kept;
}

function evaluateSymbolDates(sorted: string[]): {
  keptSet: Set<string>;
  reasons: Map<string, string>;
  monthsFromLastKept: Map<string, number>;
} {
  const keptSet = new Set<string>();
  const reasons = new Map<string, string>();
  const monthsFromLastKept = new Map<string, number>();

  if (sorted.length === 0) {
    return { keptSet, reasons, monthsFromLastKept };
  }

  keptSet.add(sorted[0]);
  reasons.set(sorted[0], 'First min date (kept)');
  monthsFromLastKept.set(sorted[0], 0);
  let lastKept = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const date = sorted[i];
    const diff = monthDiff(lastKept, date);
    monthsFromLastKept.set(date, diff);
    if (diff > SYMBOL_REAPPEAR_MONTHS) {
      keptSet.add(date);
      reasons.set(
        date,
        `>${SYMBOL_REAPPEAR_MONTHS} months after previous kept (${lastKept})`
      );
      lastKept = date;
    } else {
      reasons.set(
        date,
        `≤${SYMBOL_REAPPEAR_MONTHS} months after previous kept (${lastKept}) — dropped`
      );
    }
  }

  return { keptSet, reasons, monthsFromLastKept };
}

export function buildSymbolDuplicateNotes(rows: InputRow[]): SymbolDuplicateNote[] {
  const bySymbol = new Map<string, string[]>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row.date);
    bySymbol.set(row.symbol, list);
  }

  const notes: SymbolDuplicateNote[] = [];
  for (const [symbol, dates] of bySymbol) {
    if (dates.length < 2) continue;
    const sorted = [...dates].sort();
    const minDate = sorted[0];
    const { keptSet, reasons, monthsFromLastKept } = evaluateSymbolDates(sorted);

    notes.push({
      symbol,
      minDate,
      entries: sorted.map((date) => ({
        date,
        kept: keptSet.has(date),
        monthsFromMin: monthDiff(minDate, date),
        monthsFromLastKept: monthsFromLastKept.get(date) ?? 0,
        reason: reasons.get(date) ?? '',
      })),
    });
  }

  return notes.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function attachResultsToDuplicateNotes(
  notes: SymbolDuplicateNote[],
  results: TradeResult[]
): SymbolDuplicateNote[] {
  return notes.map((note) => ({
    ...note,
    results: results
      .filter((r) => r.symbol === note.symbol)
      .map((r) => ({
        minDate: r.minDate,
        result: r.result,
        buyDate: r.buyDate,
        pctFromBuyPrice: r.pctFromBuyPrice,
      })),
  }));
}

export function tradeSeriesKey(trade: Pick<TradeResult, 'symbol' | 'minDate'>): string {
  return `${trade.symbol}|${trade.minDate}`;
}
