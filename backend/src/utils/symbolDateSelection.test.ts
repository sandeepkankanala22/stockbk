import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSymbolDuplicateNotes,
  monthDiff,
  selectSymbolMinDates,
  SYMBOL_REAPPEAR_MONTHS,
} from '../utils/symbolDateSelection.js';

describe('symbolDateSelection', () => {
  it('computes calendar month difference', () => {
    assert.equal(monthDiff('2013-10-01', '2014-02-03'), 4);
  });

  it('keeps only earliest when all within 50 months of first', () => {
    const kept = selectSymbolMinDates(['2013-10-01', '2014-02-03', '2014-10-01']);
    assert.deepEqual(kept, ['2013-10-01']);
  });

  it('keeps later date when more than 50 months from first kept', () => {
    const kept = selectSymbolMinDates(['2013-10-01', '2018-06-01']);
    assert.deepEqual(kept, ['2013-10-01', '2018-06-01']);
  });

  it('rolling rule: 3rd appearance near 2nd kept is dropped even if far from first', () => {
    const kept = selectSymbolMinDates([
      '2010-05-01',
      '2020-06-02',
      '2021-03-03',
    ]);
    assert.deepEqual(kept, ['2010-05-01', '2020-06-02']);
  });

  it('rolling rule: 3rd kept only if >50 months after 2nd kept', () => {
    const kept = selectSymbolMinDates([
      '2010-05-01',
      '2020-06-02',
      '2025-01-01',
    ]);
    assert.deepEqual(kept, ['2010-05-01', '2020-06-02', '2025-01-01']);
  });

  it('builds duplicate notes for symbols with multiple dates', () => {
    const notes = buildSymbolDuplicateNotes([
      { date: '2013-10-01', symbol: 'ONGC', rowIndex: 1 },
      { date: '2014-02-03', symbol: 'ONGC', rowIndex: 2 },
    ]);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].symbol, 'ONGC');
    assert.equal(notes[0].entries.length, 2);
    assert.equal(notes[0].entries[0].kept, true);
    assert.equal(notes[0].entries[1].kept, false);
    assert.ok(notes[0].entries[1].monthsFromLastKept <= SYMBOL_REAPPEAR_MONTHS);
  });
});
