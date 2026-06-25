import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scannerService } from './scannerService.js';
import { historyFetchStart, signalCutoffDate } from './scannerPeriod.js';

const LIVE = process.env.SCANNER_LIVE_TEST === '1';
const liveIt = LIVE ? it : it.skip;

describe('scanner live — Chartink parity', { timeout: 180_000 }, () => {
  liveIt('finds GNFC signal in last 1 year (Chartink reference)', async () => {
    const period = '1y' as const;
    const signals = await scannerService.scanSymbol(
      'GNFC',
      'GNFC Limited',
      historyFetchStart(period),
      signalCutoffDate(period)
    );
    assert.ok(signals.length >= 1, `expected >=1 GNFC signal, got ${signals.length}`);
    console.log('GNFC signals:', signals.map((s) => s.signalDate).join(', '));
  });

  liveIt('finds BERGEPAINT signal in last 1 year (Chartink reference)', async () => {
    const period = '1y' as const;
    const signals = await scannerService.scanSymbol(
      'BERGEPAINT',
      'Berger Paints India Limited',
      historyFetchStart(period),
      signalCutoffDate(period)
    );
    assert.ok(signals.length >= 1, `expected >=1 BERGEPAINT signal, got ${signals.length}`);
    console.log('BERGEPAINT signals:', signals.map((s) => s.signalDate).join(', '));
  });
});
