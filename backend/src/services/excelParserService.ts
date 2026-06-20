import ExcelJS from 'exceljs';
import type { InputRow, InvalidRow, ParsedUpload } from '../types/index.js';
import { parseCsvContent } from '../utils/csvParser.js';
import { parseDateValue } from '../utils/dateParser.js';
import { normalizeSymbol } from '../utils/symbolUtils.js';

function findColumnIndex(headers: string[], names: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCellValue(row: ExcelJS.Row, colIndex: number): unknown {
  const cell = row.getCell(colIndex + 1);
  return cell.value;
}

function processRows(
  rows: Array<{ rawDate: unknown; rawSymbol: unknown; rowIndex: number }>
): ParsedUpload {
  const validRows: InputRow[] = [];
  const invalidRows: InvalidRow[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  for (const row of rows) {
    const { rawDate, rawSymbol, rowIndex } = row;
    const symbolStr = rawSymbol != null ? String(rawSymbol).trim() : '';
    const symbol = normalizeSymbol(symbolStr);

    if (!symbol && (rawDate === null || rawDate === undefined || rawDate === '')) {
      continue;
    }

    if (!symbol) {
      invalidRows.push({
        rowIndex,
        rawDate: String(rawDate ?? ''),
        symbol: symbolStr,
        reason: 'Empty or invalid symbol',
      });
      continue;
    }

    const dateResult = parseDateValue(rawDate);
    if ('error' in dateResult) {
      invalidRows.push({
        rowIndex,
        rawDate: String(rawDate ?? ''),
        symbol,
        reason: dateResult.error,
      });
      continue;
    }

    const dedupeKey = `${dateResult.iso}|${symbol}`;
    if (seen.has(dedupeKey)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(dedupeKey);

    validRows.push({
      date: dateResult.iso,
      symbol,
      rowIndex,
    });
  }

  return { validRows, invalidRows, duplicatesRemoved };
}

export class ExcelParserService {
  async parseUpload(buffer: Buffer, filename: string): Promise<ParsedUpload> {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv')) {
      return this.parseCsv(buffer);
    }
    return this.parseExcel(buffer);
  }

  async parseExcel(buffer: Buffer): Promise<ParsedUpload> {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS Buffer type differs from Node Buffer in strict TS
    await workbook.xlsx.load(buffer as never);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw Object.assign(new Error('Excel file has no worksheets'), { code: 'NO_WORKSHEET' });
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    const dateCol = findColumnIndex(headers, ['date', 'Date']);
    const symbolCol = findColumnIndex(headers, ['symbol', 'Symbol']);

    if (dateCol === -1 || symbolCol === -1) {
      throw Object.assign(new Error('File must contain Date and Symbol columns'), {
        code: 'MISSING_COLUMNS',
      });
    }

    const rows: Array<{ rawDate: unknown; rawSymbol: unknown; rowIndex: number }> = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({
        rawDate: getCellValue(row, dateCol),
        rawSymbol: getCellValue(row, symbolCol),
        rowIndex: rowNumber,
      });
    });

    return processRows(rows);
  }

  parseCsv(buffer: Buffer): ParsedUpload {
    const content = buffer.toString('utf-8');
    const table = parseCsvContent(content);

    if (table.length === 0) {
      throw Object.assign(new Error('CSV file is empty'), { code: 'EMPTY_FILE' });
    }

    const headers = table[0];
    const dateCol = findColumnIndex(headers, ['date', 'Date']);
    const symbolCol = findColumnIndex(headers, ['symbol', 'Symbol']);

    if (dateCol === -1 || symbolCol === -1) {
      throw Object.assign(new Error('File must contain Date and Symbol columns'), {
        code: 'MISSING_COLUMNS',
      });
    }

    const rows = table.slice(1).map((cells, index) => ({
      rawDate: cells[dateCol] ?? '',
      rawSymbol: cells[symbolCol] ?? '',
      rowIndex: index + 2,
    }));

    const parsed = processRows(rows);
    const uniqueSymbols = this.extractUniqueSymbols(parsed.validRows);
    // #region agent log
    fetch('http://127.0.0.1:7542/ingest/38dceb47-4325-4db9-870b-5ac797cdab44',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d96eef'},body:JSON.stringify({sessionId:'d96eef',location:'excelParserService.ts:parseCsv',message:'CSV parse summary',data:{validRows:parsed.validRows.length,invalidRows:parsed.invalidRows.length,uniqueSymbols:uniqueSymbols.size,invalidSample:parsed.invalidRows.slice(0,3).map(r=>({rawDate:r.rawDate,reason:r.reason}))},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return parsed;
  }

  extractUniqueSymbols(rows: InputRow[]): Map<string, string> {
    const symbolMinDates = new Map<string, string>();
    for (const row of rows) {
      const existing = symbolMinDates.get(row.symbol);
      if (!existing || row.date < existing) {
        symbolMinDates.set(row.symbol, row.date);
      }
    }
    return symbolMinDates;
  }
}

export const excelParserService = new ExcelParserService();
