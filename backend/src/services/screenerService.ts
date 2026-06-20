import fs from 'fs/promises';
import path from 'path';
import pLimit from 'p-limit';
import { config } from '../config/defaults.js';
import {
  buildFundamentalSnapshot,
  parseQuarterlyNetProfitFromHtml,
  type FundamentalSnapshot,
} from './screenerParser.js';
import { todayIso } from '../utils/dateParser.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

class ScreenerService {
  private cacheDir = path.resolve(process.cwd(), config.screenerCacheDir);
  private memoryCache = new Map<string, FundamentalSnapshot | null>();
  private limit = pLimit(config.screenerConcurrency);
  private lastRequestAt = 0;

  private async throttle(): Promise<void> {
    const wait = Math.max(0, config.screenerMinIntervalMs - (Date.now() - this.lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  private cachePath(symbol: string): string {
    const safe = symbol.replace(/[^a-zA-Z0-9.-]/g, '_').toUpperCase();
    return path.join(this.cacheDir, `${safe}.v3.json`);
  }

  async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private async fetchPage(url: string): Promise<string | null> {
    await this.throttle();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  private parsePage(
    html: string,
    view: 'consolidated' | 'standalone',
    asOfDate: string
  ): FundamentalSnapshot | null {
    const quarters = parseQuarterlyNetProfitFromHtml(html);
    return buildFundamentalSnapshot(quarters, view, asOfDate);
  }

  async getFundamentals(symbol: string, asOfDate = todayIso()): Promise<FundamentalSnapshot | null> {
    const key = `${symbol.toUpperCase()}|${asOfDate}`;
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) ?? null;
    }

    const diskKey = symbol.toUpperCase();
    try {
      const cached = await fs.readFile(this.cachePath(diskKey), 'utf-8');
      const parsed = JSON.parse(cached) as FundamentalSnapshot;
      if (parsed.asOfDate === asOfDate) {
        this.memoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // cache miss or stale
    }

    return this.limit(async () => {
      const consolidatedUrl = `https://www.screener.in/company/${encodeURIComponent(diskKey)}/consolidated/`;
      let html = await this.fetchPage(consolidatedUrl);
      let snapshot = html ? this.parsePage(html, 'consolidated', asOfDate) : null;

      if (!snapshot) {
        const standaloneUrl = `https://www.screener.in/company/${encodeURIComponent(diskKey)}/`;
        html = await this.fetchPage(standaloneUrl);
        snapshot = html ? this.parsePage(html, 'standalone', asOfDate) : null;
      }

      this.memoryCache.set(key, snapshot);

      if (snapshot) {
        await this.ensureCacheDir();
        await fs.writeFile(this.cachePath(diskKey), JSON.stringify(snapshot), 'utf-8');
      }

      return snapshot;
    });
  }

  clearCache(): void {
    this.memoryCache.clear();
  }
}

export const screenerService = new ScreenerService();
