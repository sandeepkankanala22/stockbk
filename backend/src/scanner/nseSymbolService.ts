import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/defaults.js';

export interface NseEquityRow {
  symbol: string;
  company: string;
}

const NSE_CSV_URLS = [
  'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
  'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

async function readBundledFile(): Promise<NseEquityRow[]> {
  const candidates = [
    path.resolve(process.cwd(), 'data/nse_equity_eq.csv'),
    path.resolve(process.cwd(), 'backend/data/nse_equity_eq.csv'),
  ];
  for (const filePath of candidates) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      const rows = parseEquityCsv(text);
      if (rows.length > 0) return rows;
    } catch {
      // try next path
    }
  }
  return [];
}

function parseEquityCsv(text: string): NseEquityRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: NseEquityRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;
    const symbol = parts[0]?.trim().toUpperCase();
    const company = parts[1]?.trim() ?? symbol;
    const series = parts[2]?.trim();
    if (!symbol || (series && series !== 'EQ')) continue;
    rows.push({ symbol, company });
  }

  return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/csv,*/*',
        Referer: 'https://www.nseindia.com/',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

class NseSymbolService {
  private cachePath = path.resolve(process.cwd(), 'cache/nse_equity.csv');
  private memory: NseEquityRow[] | null = null;

  private async readBundled(): Promise<NseEquityRow[]> {
    return readBundledFile();
  }

  private async readCache(): Promise<NseEquityRow[] | null> {
    try {
      const stat = await fs.stat(this.cachePath);
      const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
      if (ageHours > config.scannerSymbolCacheHours) return null;
      const text = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = parseEquityCsv(text);
      return parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  private async writeCache(text: string): Promise<void> {
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fs.writeFile(this.cachePath, text, 'utf-8');
  }

  private async fetchFromNse(): Promise<NseEquityRow[]> {
    let lastError: Error | null = null;
    for (const url of NSE_CSV_URLS) {
      try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) {
          lastError = new Error(`NSE equity list HTTP ${res.status} from ${url}`);
          continue;
        }
        const text = await res.text();
        const rows = parseEquityCsv(text);
        if (rows.length === 0) {
          lastError = new Error(`NSE equity list parse failed from ${url}`);
          continue;
        }
        await this.writeCache(text);
        return rows;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error('NSE equity list unavailable');
  }

  async loadSymbols(): Promise<NseEquityRow[]> {
    if (this.memory) return this.memory;

    const cached = await this.readCache();
    if (cached && cached.length > 50) {
      this.memory = cached;
      return cached;
    }

    const bundled = await this.readBundled();
    if (bundled.length > 0) {
      this.memory = bundled;
      void this.tryRefreshInBackground();
      return bundled;
    }

    try {
      const rows = await this.fetchFromNse();
      this.memory = rows;
      return rows;
    } catch (err) {
      console.warn('NSE symbol fetch failed:', err);
      this.memory = bundled.length > 0 ? bundled : [];
      return this.memory;
    }
  }

  async searchSymbols(query: string, limit = 25): Promise<NseEquityRow[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const q = trimmed.toUpperCase();
    const all = await this.loadSymbols();
    const matches: NseEquityRow[] = [];

    for (const row of all) {
      if (row.symbol.startsWith(q) || row.company.toUpperCase().includes(q)) {
        matches.push(row);
        if (matches.length >= limit) break;
      }
    }

    return matches;
  }

  private async tryRefreshInBackground(): Promise<void> {
    try {
      const rows = await this.fetchFromNse();
      if (rows.length > (this.memory?.length ?? 0)) {
        this.memory = rows;
      }
    } catch {
      // keep bundled list
    }
  }
}

export const nseSymbolService = new NseSymbolService();
