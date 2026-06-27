const BROKER_SUFFIX = /-(EQ|BE|BL|BZ|SM|ST|IV|RR|GS)$/i;
const EXCHANGE_SUFFIX = /\.(NS|BO)$/i;
const YAHOO_QUALIFIED = /(-USD|=F|=X)$/i;

export function normalizeSymbol(raw: string): string | null {
  let symbol = raw.trim().toUpperCase();
  if (!symbol) return null;
  symbol = symbol.replace(BROKER_SUFFIX, '').replace(EXCHANGE_SUFFIX, '');
  return symbol || null;
}

/** Yahoo tickers that should not get .NS / .BO suffix (crypto, futures, US listings). */
export function isDirectYahooTicker(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  if (YAHOO_QUALIFIED.test(upper)) return true;
  if (upper.includes('-') || upper.includes('=')) return true;
  return false;
}

export function toYahooSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol) ?? symbol.trim().toUpperCase();
  if (isDirectYahooTicker(normalized)) return normalized;
  return `${normalized}.NS`;
}

/** NSE first, then BSE, then bare symbol for US/international listings. */
export function toYahooSymbols(symbol: string, rawInput?: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return [];
  const raw = (rawInput ?? symbol).trim().toUpperCase();

  if (isDirectYahooTicker(raw) || isDirectYahooTicker(normalized)) {
    return [raw.includes('-') || raw.includes('=') ? raw : normalized];
  }

  if (/\.BO$/i.test(raw)) {
    return [`${normalized}.BO`, `${normalized}.NS`, normalized];
  }
  return [`${normalized}.NS`, `${normalized}.BO`, normalized];
}

/** US / international listings — try bare Yahoo ticker before NSE/BSE suffixes. */
export function toYahooSymbolsPreferBare(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return [];
  if (isDirectYahooTicker(normalized)) return [normalized];
  return [normalized, `${normalized}.NS`, `${normalized}.BO`];
}
