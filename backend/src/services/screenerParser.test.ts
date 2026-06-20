import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  buildFundamentalSnapshot,
  filterAnnouncedQuarters,
  parseQuarterlyNetProfitFromHtml,
  type QuarterNetProfit,
} from './screenerParser.js';
import { isPriceNearBuyPrice } from '../utils/tradePriceUtils.js';
import type { TradeResult } from '../types/index.js';

const sampleQuarters: QuarterNetProfit[] = [
  { label: 'Mar 2024', dateKey: '2024-03-31', valueCr: 100 },
  { label: 'Jun 2024', dateKey: '2024-06-30', valueCr: 110 },
  { label: 'Sep 2024', dateKey: '2024-09-30', valueCr: 120 },
  { label: 'Dec 2024', dateKey: '2024-12-31', valueCr: 130 },
  { label: 'Mar 2025', dateKey: '2025-03-31', valueCr: 140 },
  { label: 'Jun 2025', dateKey: '2025-06-30', valueCr: 150 },
  { label: 'Sep 2025', dateKey: '2025-09-30', valueCr: 160 },
  { label: 'Dec 2025', dateKey: '2025-12-31', valueCr: 170 },
  { label: 'Mar 2026', dateKey: '2026-03-31', valueCr: 180 },
  { label: 'Jun 2026', dateKey: '2026-06-30', valueCr: 999 },
];

describe('screenerParser', () => {
  it('uses latest announced quarter as of May 2026', () => {
    const announced = filterAnnouncedQuarters(sampleQuarters, '2026-05-20', 45);
    assert.ok(announced.some((q) => q.label === 'Mar 2026'));
    assert.equal(announced.some((q) => q.label === 'Jun 2026'), false);

    const snapshot = buildFundamentalSnapshot(sampleQuarters, 'consolidated', '2026-05-20');
    assert.ok(snapshot);
    assert.equal(snapshot!.quarter, 'Mar 2026');
    assert.equal(snapshot!.yoyPriorQuarter, 'Mar 2025');
    assert.equal(snapshot!.qoqPriorQuarter, 'Dec 2025');
    assert.equal(snapshot!.yoyChangePct, 28.6);
    assert.equal(snapshot!.qoqChangePct, 5.9);
  });

  it('parses BERGEPAINT live HTML with Mar 2026 net profit', async () => {
    const res = await fetch('https://www.screener.in/company/BERGEPAINT/consolidated/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return;

    const html = await res.text();
    const quarters = parseQuarterlyNetProfitFromHtml(html);
    assert.ok(quarters.length >= 10);

    const last = quarters[quarters.length - 1];
    assert.equal(last.label, 'Mar 2026');
    assert.equal(last.valueCr, 335);

    const snapshot = buildFundamentalSnapshot(quarters, 'consolidated', '2026-06-20');
    assert.ok(snapshot);
    assert.equal(snapshot!.quarter, 'Mar 2026');
    assert.equal(snapshot!.netProfitCr, 335);
    assert.equal(snapshot!.qoqPriorQuarter, 'Dec 2025');
    assert.equal(snapshot!.yoyPriorQuarter, 'Mar 2025');
    assert.equal(snapshot!.qoqChangePct, 23.6);
    assert.equal(snapshot!.yoyChangePct, 27.4);
  });

  it('parses fixture HTML when present', async () => {
    const fixture = path.resolve(process.cwd(), 'test-fixtures', 'bergepaint.html');
    let html: string;
    try {
      html = await fs.readFile(fixture, 'utf-8');
    } catch {
      return;
    }

    const quarters = parseQuarterlyNetProfitFromHtml(html);
    const snapshot = buildFundamentalSnapshot(quarters, 'consolidated', '2026-06-20');
    assert.ok(snapshot);
    assert.equal(snapshot!.quarter, 'Mar 2026');
  });
});

describe('tradePriceUtils', () => {
  it('allows fundamentals only within 15% of buy price', () => {
    const trade: TradeResult = {
      symbol: 'TEST',
      minDate: '2026-01-01',
      buyPrice: 100,
      buyDate: null,
      targetPrice: 130,
      stoplossPrice: 70,
      result: 'NO_BREAKOUT',
      resultDate: null,
      days: null,
      status: 'SUCCESS',
      errorMessage: null,
      monthHighDate: '2026-01-10',
      breakoutCandleHigh: null,
      exitPrice: null,
      investmentAmount: null,
      exitValue: null,
      pnl: null,
      returnPercent: null,
      stoplossHitTillDate: null,
      stoplossHitDate: null,
      stoplossHitDays: null,
      targetHitTillDate: null,
      targetHitDate: null,
      targetHitDays: null,
      firstHit: null,
      firstHitDate: null,
      firstHitDays: null,
      stoplossAfterTargetHit: null,
      stoplossAfterTargetDate: null,
      targetAfterStoplossHit: null,
      targetAfterStoplossDate: null,
      recoveredToBuyAfterSl: null,
      recoveryDate: null,
      secondStoplossHit: null,
      secondStoplossHitDate: null,
    };

    assert.equal(
      isPriceNearBuyPrice(
        trade,
        [{ date: '2026-05-01', open: 1, high: 1, low: 1, close: 112, volume: 1 }],
        15
      ),
      true
    );
    assert.equal(
      isPriceNearBuyPrice(
        trade,
        [{ date: '2026-05-01', open: 1, high: 1, low: 1, close: 120, volume: 1 }],
        15
      ),
      false
    );
  });
});
