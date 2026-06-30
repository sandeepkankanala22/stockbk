import ExcelJS from 'exceljs';
import type { InputRow, InvalidRow, ParsedUpload } from '../types/index.js';
import { parseCsvContent } from '../utils/csvParser.js';
import { parseDateValue } from '../utils/dateParser.js';
import { normalizeSymbol } from '../utils/symbolUtils.js';
import { selectSymbolMinDates } from '../utils/symbolDateSelection.js';

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
  const value = cell.value;
  if (value == null) return value;
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
    }
    if ('text' in value && typeof (value as { text: string }).text === 'string') {
      return (value as { text: string }).text;
    }
    if ('result' in value) {
      return (value as { result: unknown }).result;
    }
  }
  return value;
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
    return parsed;
  }

  extractUniqueSymbols(rows: InputRow[]): Map<string, string> {
    const jobs = this.extractSymbolJobs(rows);
    const map = new Map<string, string>();
    for (const job of jobs) {
      const existing = map.get(job.symbol);
      if (!existing || job.minDate < existing) {
        map.set(job.symbol, job.minDate);
      }
    }
    return map;
  }

  /** One job per symbol+minDate; rolling 50-month gap from each kept date. */
  extractSymbolJobs(rows: InputRow[]): Array<{ symbol: string; minDate: string }> {
    const bySymbol = new Map<string, string[]>();
    for (const row of rows) {
      const list = bySymbol.get(row.symbol) ?? [];
      list.push(row.date);
      bySymbol.set(row.symbol, list);
    }

    const jobs: Array<{ symbol: string; minDate: string }> = [];
    for (const [symbol, dates] of bySymbol) {
      for (const minDate of selectSymbolMinDates(dates)) {
        jobs.push({ symbol, minDate });
      }
    }
    return jobs.sort((a, b) => a.minDate.localeCompare(b.minDate) || a.symbol.localeCompare(b.symbol));
  }
}

export const excelParserService = new ExcelParserService();
