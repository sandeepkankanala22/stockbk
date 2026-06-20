import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { excelParserService } from '../dist/services/excelParserService.js';

const csvPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'Backtest old is gold.csv');
const buffer = fs.readFileSync(csvPath);
const parsed = excelParserService.parseCsv(buffer);
const unique = excelParserService.extractUniqueSymbols(parsed.validRows);
console.log(JSON.stringify({
  validRows: parsed.validRows.length,
  invalidRows: parsed.invalidRows.length,
  duplicatesRemoved: parsed.duplicatesRemoved,
  uniqueSymbols: unique.size,
  symbols: [...unique.keys()],
  invalidSample: parsed.invalidRows.slice(0, 8).map((r) => ({ rawDate: r.rawDate, reason: r.reason })),
}, null, 2));
