const BROKER_SUFFIX = /-(EQ|BE|BL|BZ|SM|ST|IV|RR|GS)$/i;
const EXCHANGE_SUFFIX = /\.(NS|BO)$/i;

export function normalizeSymbol(raw: string): string | null {
  let symbol = raw.trim().toUpperCase();
  if (!symbol) return null;
  symbol = symbol.replace(BROKER_SUFFIX, '').replace(EXCHANGE_SUFFIX, '');
  return symbol || null;
}

export function toYahooSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol) ?? symbol;
  return `${normalized}.NS`;
}

/** NSE first, then BSE — input `.BO` tries BSE first. */
export function toYahooSymbols(symbol: string, rawInput?: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return [];
  const raw = (rawInput ?? symbol).trim().toUpperCase();
  if (/\.BO$/i.test(raw)) {
    return [`${normalized}.BO`, `${normalized}.NS`];
  }
  return [`${normalized}.NS`, `${normalized}.BO`];
}
