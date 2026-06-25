import {
  estimateMarketCapAtPrice,
  parseCurrentPriceFromHtml,
  parseMarketCapCrFromHtml,
  parseQuarterlyEpsFromHtml,
  passesScannerFundamentalFilter,
  type QuarterNetProfit,
} from '../services/screenerParser.js';
import { screenerService } from '../services/screenerService.js';

export interface ScannerFundamentals {
  marketCapCr: number;
  currentPrice: number;
  epsQuarters: QuarterNetProfit[];
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchScreenerHtml(symbol: string): Promise<string | null> {
  const diskKey = symbol.toUpperCase();
  const consolidatedUrl = `https://www.screener.in/company/${encodeURIComponent(diskKey)}/consolidated/`;
  try {
    const res = await fetch(consolidatedUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    if (res.ok) return await res.text();
  } catch {
    // try standalone
  }
  const standaloneUrl = `https://www.screener.in/company/${encodeURIComponent(diskKey)}/`;
  try {
    const res = await fetch(standaloneUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    });
    if (res.ok) return await res.text();
  } catch {
    return null;
  }
  return null;
}

export async function fetchScannerFundamentals(
  symbol: string
): Promise<ScannerFundamentals | null> {
  await screenerService.ensureCacheDir();
  const html = await fetchScreenerHtml(symbol);
  if (!html) return null;

  const marketCapCr = parseMarketCapCrFromHtml(html);
  const currentPrice = parseCurrentPriceFromHtml(html);
  const epsQuarters = parseQuarterlyEpsFromHtml(html);

  if (marketCapCr == null || currentPrice == null || epsQuarters.length === 0) {
    return null;
  }

  return { marketCapCr, currentPrice, epsQuarters };
}

export function fundamentalsPassAtSignal(
  fundamentals: ScannerFundamentals,
  signalDate: string,
  entryPrice: number
): boolean {
  const mcapAtSignal = estimateMarketCapAtPrice(
    fundamentals.marketCapCr,
    fundamentals.currentPrice,
    entryPrice
  );
  return passesScannerFundamentalFilter(mcapAtSignal, fundamentals.epsQuarters, signalDate);
}
