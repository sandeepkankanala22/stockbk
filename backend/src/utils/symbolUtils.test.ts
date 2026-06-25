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

  it('tries BSE first when input is .BO', () => {
    assert.deepEqual(toYahooSymbols('HEROMOTOCO.BO'), ['HEROMOTOCO.BO', 'HEROMOTOCO.NS']);
  });

  it('tries NSE then BSE for bare symbols', () => {
    assert.deepEqual(toYahooSymbols('RELIANCE'), ['RELIANCE.NS', 'RELIANCE.BO']);
  });
});
