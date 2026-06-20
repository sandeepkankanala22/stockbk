import fs from 'fs/promises';
import path from 'path';
import NodeCache from 'node-cache';
import { config } from '../config/defaults.js';
import type { OhlcvBar } from '../types/index.js';

class CacheService {
  private memoryCache: NodeCache;
  private diskCacheDir: string;

  constructor() {
    this.memoryCache = new NodeCache({ stdTTL: config.cacheTtlSeconds });
    this.diskCacheDir = path.resolve(process.cwd(), config.diskCacheDir);
  }

  private cacheKey(yahooSymbol: string, period1: string, period2: string): string {
    return `yahoo:${yahooSymbol}:${period1}:${period2}`;
  }

  private diskPath(yahooSymbol: string): string {
    const safe = yahooSymbol.replace(/[^a-zA-Z0-9.-]/g, '_');
    return path.join(this.diskCacheDir, `${safe}.json`);
  }

  async ensureDiskDir(): Promise<void> {
    if (config.diskCacheEnabled) {
      await fs.mkdir(this.diskCacheDir, { recursive: true });
    }
  }

  get(yahooSymbol: string, period1: string, period2: string): OhlcvBar[] | undefined {
    const key = this.cacheKey(yahooSymbol, period1, period2);
    const cached = this.memoryCache.get<OhlcvBar[]>(key);
    return cached;
  }

  async getFromDisk(yahooSymbol: string): Promise<OhlcvBar[] | undefined> {
    if (!config.diskCacheEnabled) return undefined;
    try {
      const content = await fs.readFile(this.diskPath(yahooSymbol), 'utf-8');
      return JSON.parse(content) as OhlcvBar[];
    } catch {
      return undefined;
    }
  }

  set(yahooSymbol: string, period1: string, period2: string, bars: OhlcvBar[]): void {
    const key = this.cacheKey(yahooSymbol, period1, period2);
    this.memoryCache.set(key, bars);
  }

  async setToDisk(yahooSymbol: string, bars: OhlcvBar[]): Promise<void> {
    if (!config.diskCacheEnabled) return;
    await this.ensureDiskDir();
    await fs.writeFile(this.diskPath(yahooSymbol), JSON.stringify(bars), 'utf-8');
  }

  clear(): void {
    this.memoryCache.flushAll();
  }
}

export const cacheService = new CacheService();
