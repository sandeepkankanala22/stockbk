import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { excelParserService } from '../services/excelParserService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(__dirname, '..', '..', 'sample-input.xlsx');

describe('excelParserService', () => {
  it('parses sample Excel with dedup and invalid rows', async () => {
    const buffer = await fs.readFile(samplePath);
    const parsed = await excelParserService.parseExcel(buffer);

    assert.equal(parsed.validRows.length, 4);
    assert.equal(parsed.duplicatesRemoved, 1);
    assert.ok(parsed.invalidRows.some((r) => r.symbol === 'INFY'));

    const symbols = excelParserService.extractUniqueSymbols(parsed.validRows);
    assert.equal(symbols.get('RELIANCE'), '2013-05-02');
    assert.equal(symbols.get('TCS'), '2021-01-15');
  });

  it('parses CSV with Date and Symbol columns', () => {
    const csv = Buffer.from(
      'Date,Symbol\n02 May 2013,RELIANCE\n15 Jan 2021,TCS\n',
      'utf-8'
    );
    const parsed = excelParserService.parseCsv(csv);
    assert.equal(parsed.validRows.length, 2);
    assert.equal(parsed.validRows[0].symbol, 'RELIANCE');
    assert.equal(parsed.validRows[0].date, '2013-05-02');
  });
});
