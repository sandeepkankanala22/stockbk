export function normalizeSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  if (!symbol) return null;
  return symbol.replace(/\.NS$/i, '');
}

export function toYahooSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol) ?? symbol;
  return `${normalized}.NS`;
}
