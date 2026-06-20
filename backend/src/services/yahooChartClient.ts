import type { OhlcvBar } from '../types/index.js';
import { formatIso, dayjs } from '../utils/dateParser.js';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function fetchYahooChart(
  yahooSymbol: string,
  period1: string,
  period2: string
): Promise<OhlcvBar[]> {
  const startSec = Math.floor(dayjs(period1).startOf('day').valueOf() / 1000);
  const endSec = Math.floor(dayjs(period2).endOf('day').valueOf() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?period1=${startSec}&period2=${endSec}&interval=1d&includePrePost=false`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (response.status === 429) {
    throw new Error('Too Many Requests');
  }

  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    return [];
  }

  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];

  const bars: OhlcvBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    if (high == null || low == null || !Number.isFinite(high) || !Number.isFinite(low)) {
      continue;
    }

    const open = quote.open?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    bars.push({
      date: formatIso(dayjs.unix(result.timestamp[i])),
      open: Number.isFinite(open) ? (open as number) : (close as number),
      high,
      low,
      close: Number.isFinite(close) ? (close as number) : high,
      volume: Number.isFinite(volume) ? (volume as number) : 0,
    });
  }

  return bars.sort((a, b) => a.date.localeCompare(b.date));
}
