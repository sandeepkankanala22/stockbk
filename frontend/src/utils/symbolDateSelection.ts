import type { TradeResult } from '../types';

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

export function monthDiff(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Rolling anchor: each kept date must be >50 months after the previous kept date. */
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

export function tradeSeriesKey(symbol: string, minDate: string): string {
  return `${symbol}|${minDate}`;
}

export function getDashboardResults(results: TradeResult[]): {
  rows: TradeResult[];
  rawCount: number;
} {
  return { rows: results, rawCount: results.length };
}

/** Symbols with 2+ kept min dates (>50 months apart) — excludes dropped near-duplicates. */
export function filterReappearedDuplicateNotes(notes: SymbolDuplicateNote[]): SymbolDuplicateNote[] {
  return notes
    .map((note) => ({
      ...note,
      entries: note.entries.filter((e) => e.kept),
    }))
    .filter((note) => note.entries.length >= 2)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}
