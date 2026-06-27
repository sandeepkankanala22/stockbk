import fs from 'fs/promises';
import path from 'path';
import type { NseEquityRow } from './nseSymbolService.js';
import { nseSymbolService } from './nseSymbolService.js';

export type ScannerUniverse =
  | 'nifty100'
  | 'nifty500'
  | 'all'
  | 'us100'
  | 'bitcoin20'
  | 'commodities'
  | 'custom';

export type ScannerSector =
  | 'all'
  | 'banking'
  | 'it'
  | 'pharma'
  | 'auto'
  | 'fmcg'
  | 'energy'
  | 'metal'
  | 'infra'
  | 'realty'
  | 'telecom'
  | 'chemicals';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

const UNIVERSE_LABELS: Record<ScannerUniverse, string> = {
  nifty100: 'Nifty 100',
  nifty500: 'Nifty 500',
  all: 'All NSE EQ',
  us100: 'Top 100 US Stocks',
  bitcoin20: 'Top 20 Crypto (Bitcoin & majors)',
  commodities: 'Top Commodities',
  custom: 'Custom list',
};

const INTERNATIONAL_UNIVERSES = new Set<ScannerUniverse>(['us100', 'bitcoin20', 'commodities']);

const SECTOR_LABELS: Record<ScannerSector, string> = {
  all: 'All sectors',
  banking: 'Banking & Finance',
  it: 'IT',
  pharma: 'Pharma & Healthcare',
  auto: 'Auto',
  fmcg: 'FMCG',
  energy: 'Oil & Gas / Energy',
  metal: 'Metal & Mining',
  infra: 'Infrastructure & Capital Goods',
  realty: 'Realty',
  telecom: 'Telecom',
  chemicals: 'Chemicals & Paints',
};

function dataPath(...parts: string[]): string {
  return path.resolve(process.cwd(), 'data', ...parts);
}

async function readSymbolListFile(fileName: string): Promise<string[]> {
  const candidates = [
    dataPath('indices', fileName),
    path.resolve(process.cwd(), 'backend/data/indices', fileName),
    dataPath(fileName),
  ];
  for (const filePath of candidates) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      return text
        .split(/\r?\n/)
        .map((l) => l.trim().toUpperCase())
        .filter((l) => l && !l.startsWith('#'));
    } catch {
      // try next
    }
  }
  return [];
}

async function fetchNseIndexSymbols(indexName: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        Referer: 'https://www.nseindia.com/',
      },
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: Array<{ symbol?: string }> };
    return (payload.data ?? [])
      .map((r) => r.symbol?.trim().toUpperCase())
      .filter((s): s is string => !!s);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function loadBundledUniverseSymbols(universe: ScannerUniverse): Promise<string[]> {
  switch (universe) {
    case 'nifty100':
      return readSymbolListFile('nifty100.txt');
    case 'nifty500':
      return readSymbolListFile('nifty500.txt');
    case 'us100':
      return readSymbolListFile('us100.txt');
    case 'bitcoin20':
      return readSymbolListFile('bitcoin20.txt');
    case 'commodities':
      return readSymbolListFile('commodities.txt');
    default:
      return [];
  }
}

async function loadIndexSymbols(universe: ScannerUniverse): Promise<Set<string> | null> {
  if (universe === 'all') return null;

  if (INTERNATIONAL_UNIVERSES.has(universe)) {
    const symbols = await loadBundledUniverseSymbols(universe);
    return symbols.length > 0 ? new Set(symbols) : null;
  }

  const fileName = universe === 'nifty100' ? 'nifty100.txt' : 'nifty500.txt';
  const bundled = await readSymbolListFile(fileName);
  const apiName = universe === 'nifty100' ? 'NIFTY 100' : 'NIFTY 500';
  const fromApi = await fetchNseIndexSymbols(apiName);

  const merged = new Set([...bundled, ...fromApi]);
  if (merged.size === 0) return null;
  return merged;
}

let sectorMapCache: Map<string, ScannerSector> | null = null;

async function loadSectorMap(): Promise<Map<string, ScannerSector>> {
  if (sectorMapCache) return sectorMapCache;

  const map = new Map<string, ScannerSector>();
  const candidates = [dataPath('symbol_sectors.csv'), dataPath('indices', 'symbol_sectors.csv')];
  for (const filePath of candidates) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const [symbol, sector] = lines[i].split(',').map((p) => p.trim().toLowerCase());
        if (!symbol || !sector || sector === 'sector') continue;
        if (isValidScannerSector(sector)) {
          map.set(symbol.toUpperCase(), sector);
        }
      }
      if (map.size > 0) break;
    } catch {
      // try next
    }
  }
  sectorMapCache = map;
  return map;
}

export function isValidScannerUniverse(value: unknown): value is ScannerUniverse {
  return (
    value === 'nifty100' ||
    value === 'nifty500' ||
    value === 'all' ||
    value === 'us100' ||
    value === 'bitcoin20' ||
    value === 'commodities' ||
    value === 'custom'
  );
}

export function isInternationalUniverse(universe: ScannerUniverse): boolean {
  return INTERNATIONAL_UNIVERSES.has(universe);
}

export function isValidScannerSector(value: unknown): value is ScannerSector {
  return (
    value === 'all' ||
    value === 'banking' ||
    value === 'it' ||
    value === 'pharma' ||
    value === 'auto' ||
    value === 'fmcg' ||
    value === 'energy' ||
    value === 'metal' ||
    value === 'infra' ||
    value === 'realty' ||
    value === 'telecom' ||
    value === 'chemicals'
  );
}

export async function resolveScannerSymbols(
  universe: ScannerUniverse,
  sector: ScannerSector,
  customSymbols?: string[]
): Promise<NseEquityRow[]> {
  if (universe === 'custom') {
    const master = await nseSymbolService.loadSymbols();
    const wanted = [
      ...new Set(
        (customSymbols ?? [])
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0)
      ),
    ];
    return wanted
      .map((symbol) => ({
        symbol,
        company: master.find((m) => m.symbol === symbol)?.company ?? symbol,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  const indexSet = await loadIndexSymbols(universe);
  if (indexSet == null) {
    const master = await nseSymbolService.loadSymbols();
    return master.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  if (INTERNATIONAL_UNIVERSES.has(universe)) {
    return [...indexSet]
      .sort()
      .map((symbol) => ({ symbol, company: symbol }));
  }

  const master = await nseSymbolService.loadSymbols();
  let rows = master.filter((r) => indexSet.has(r.symbol));

  if (rows.length === 0) {
    rows = [...indexSet].sort().map((symbol) => ({
      symbol,
      company: master.find((m) => m.symbol === symbol)?.company ?? symbol,
    }));
  }

  if (sector !== 'all') {
    const sectorMap = await loadSectorMap();
    rows = rows.filter((r) => sectorMap.get(r.symbol) === sector);
  }

  return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function searchScannerSymbols(query: string): Promise<NseEquityRow[]> {
  return nseSymbolService.searchSymbols(query);
}

export async function getScannerOptions(): Promise<{
  universes: Array<{ id: ScannerUniverse; label: string; estimatedCount: number }>;
  sectors: Array<{ id: ScannerSector; label: string }>;
}> {
  const [n100, n500, allRows, us100, bitcoin20, commodities] = await Promise.all([
    resolveScannerSymbols('nifty100', 'all'),
    resolveScannerSymbols('nifty500', 'all'),
    resolveScannerSymbols('all', 'all'),
    resolveScannerSymbols('us100', 'all'),
    resolveScannerSymbols('bitcoin20', 'all'),
    resolveScannerSymbols('commodities', 'all'),
  ]);

  return {
    universes: [
      { id: 'nifty100', label: UNIVERSE_LABELS.nifty100, estimatedCount: n100.length },
      { id: 'nifty500', label: UNIVERSE_LABELS.nifty500, estimatedCount: n500.length },
      { id: 'all', label: UNIVERSE_LABELS.all, estimatedCount: allRows.length },
      { id: 'us100', label: UNIVERSE_LABELS.us100, estimatedCount: us100.length },
      { id: 'bitcoin20', label: UNIVERSE_LABELS.bitcoin20, estimatedCount: bitcoin20.length },
      { id: 'commodities', label: UNIVERSE_LABELS.commodities, estimatedCount: commodities.length },
      { id: 'custom', label: UNIVERSE_LABELS.custom, estimatedCount: 0 },
    ],
    sectors: (Object.keys(SECTOR_LABELS) as ScannerSector[]).map((id) => ({
      id,
      label: SECTOR_LABELS[id],
    })),
  };
}
