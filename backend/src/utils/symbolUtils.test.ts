import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSymbol, toYahooSymbol, toYahooSymbols } from '../utils/symbolUtils.js';

describe('symbolUtils', () => {
  it('normalizes broker and exchange suffixes', () => {
    assert.equal(normalizeSymbol('RELIANCE-EQ'), 'RELIANCE');
    assert.equal(normalizeSymbol('reliance.ns'), 'RELIANCE');
    assert.equal(normalizeSymbol('HEROMOTOCO.BO'), 'HEROMOTOCO');
  });

  it('builds NSE symbol by default', () => {
    assert.equal(toYahooSymbol('RELIANCE'), 'RELIANCE.NS');
  });

  it('uses direct Yahoo ticker for crypto and futures', () => {
    assert.equal(toYahooSymbol('BTC-USD'), 'BTC-USD');
    assert.equal(toYahooSymbol('GC=F'), 'GC=F');
    assert.deepEqual(toYahooSymbols('BTC-USD'), ['BTC-USD']);
    assert.deepEqual(toYahooSymbols('GC=F'), ['GC=F']);
  });

  it('falls back to bare symbol for short tickers after NSE/BSE', () => {
    assert.equal(toYahooSymbol('AAPL'), 'AAPL.NS');
    assert.deepEqual(toYahooSymbols('AAPL'), ['AAPL.NS', 'AAPL.BO', 'AAPL']);
  });

  it('tries BSE first when input is .BO', () => {
    assert.deepEqual(toYahooSymbols('HEROMOTOCO.BO'), [
      'HEROMOTOCO.BO',
      'HEROMOTOCO.NS',
      'HEROMOTOCO',
    ]);
  });

  it('tries NSE then BSE then bare symbol for Indian listings', () => {
    assert.deepEqual(toYahooSymbols('RELIANCE'), ['RELIANCE.NS', 'RELIANCE.BO', 'RELIANCE']);
  });
});
