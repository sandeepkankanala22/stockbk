import ExcelJS from 'exceljs';
import type { DashboardSummary, InvalidRow, JobState, TradeResult } from '../types/index.js';

const RESULT_COLUMNS = [
  'Symbol',
  'Min Date',
  'Buy Price',
  'Buy Date',
  'Target Price',
  'Stoploss Price',
  'Result',
  'Result Date',
  'Days',
  'Status',
  'Error Message',
  'Month High Date',
  'Breakout Candle High',
  'Exit Price',
  'Investment (INR)',
  'Exit Value (INR)',
  'P&L (INR)',
  'Return (%)',
  'SL Hit Till Date',
  'SL Hit Date',
  'SL Hit Days',
  'First Hit',
  'SL After Target',
  'Target After SL',
  'Recovered To Buy After SL',
  'Recovery Date',
  '2nd SL Hit',
  '2nd SL Hit Date',
];

function tradeToRow(result: TradeResult): (string | number | null)[] {
  return [
    result.symbol,
    result.minDate,
    result.buyPrice,
    result.buyDate,
    result.targetPrice,
    result.stoplossPrice,
    result.result,
    result.resultDate,
    result.days,
    result.status,
    result.errorMessage,
    result.monthHighDate,
    result.breakoutCandleHigh,
    result.exitPrice,
    result.investmentAmount,
    result.exitValue,
    result.pnl,
    result.returnPercent,
    result.stoplossHitTillDate == null ? null : result.stoplossHitTillDate ? 'Yes' : 'No',
    result.stoplossHitDate,
    result.stoplossHitDays,
    result.firstHit,
    result.stoplossAfterTargetHit == null ? null : result.stoplossAfterTargetHit ? 'Yes' : 'No',
    result.targetAfterStoplossHit == null ? null : result.targetAfterStoplossHit ? 'Yes' : 'No',
    result.recoveredToBuyAfterSl == null ? null : result.recoveredToBuyAfterSl ? 'Yes' : 'No',
    result.recoveryDate,
    result.secondStoplossHit == null ? null : result.secondStoplossHit ? 'Yes' : 'No',
    result.secondStoplossHitDate,
  ];
}

export class ExportService {
  async exportExcel(job: JobState): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const resultsSheet = workbook.addWorksheet('Results');
    resultsSheet.addRow(RESULT_COLUMNS);
    for (const result of job.results) {
      resultsSheet.addRow(tradeToRow(result));
    }
    resultsSheet.columns.forEach((col) => {
      col.width = 18;
    });

    const summarySheet = workbook.addWorksheet('Summary');
    const summary = job.summary;
    if (summary) {
      summarySheet.addRow(['Metric', 'Value']);
      summarySheet.addRow(['Total Symbols', summary.totalSymbols]);
      summarySheet.addRow(['Target Hits', summary.targetHits]);
      summarySheet.addRow(['Stoploss Hits', summary.stoplossHits]);
      summarySheet.addRow(['No Breakouts', summary.noBreakouts]);
      summarySheet.addRow(['Open Trades', summary.openTrades]);
      summarySheet.addRow(['Errors', summary.errors]);
      summarySheet.addRow(['Win Rate (%)', summary.winRate]);
      summarySheet.addRow(['Average Holding Days', summary.averageHoldingDays]);
      summarySheet.addRow(['Median Holding Days', summary.medianHoldingDays]);
      summarySheet.addRow([
        'Best Trade',
        summary.bestTrade
          ? `${summary.bestTrade.symbol} (${summary.bestTrade.days} days, ${summary.bestTrade.result})`
          : 'N/A',
      ]);
      summarySheet.addRow([
        'Worst Trade',
        summary.worstTrade
          ? `${summary.worstTrade.symbol} (${summary.worstTrade.days} days, ${summary.worstTrade.result})`
          : 'N/A',
      ]);
      summarySheet.addRow(['SL Hit Till Date Count', summary.stoplossHitTillDateCount]);
      summarySheet.addRow(['SL Hit Till Date (%)', summary.stoplossHitTillDatePct]);
      if (summary.scenario2) {
        summarySheet.addRow(['Scenario 2 — First SL Hits', summary.scenario2.eligibleTrades]);
        summarySheet.addRow(['Scenario 2 — Recovered To Buy', summary.scenario2.recoveredToBuyCount]);
        summarySheet.addRow(['Scenario 2 — Recovered To Buy (%)', summary.scenario2.recoveredToBuyPct]);
        summarySheet.addRow(['Scenario 2 — 2nd SL Hit', summary.scenario2.secondStoplossHitCount]);
        summarySheet.addRow(['Scenario 2 — 2nd SL Hit (%)', summary.scenario2.secondStoplossHitPct]);
      }
      if (summary.analytics) {
        const an = summary.analytics;
        summarySheet.addRow(['Never Hit Stoploss', an.neverHitStoploss.count]);
        summarySheet.addRow(['Never Hit Stoploss (%)', an.neverHitStoploss.pct]);
        summarySheet.addRow(['Case 1 — Target First', an.case1.firstHitCount]);
        summarySheet.addRow(['Case 1 — Target First (%)', an.case1.firstHitPct]);
        summarySheet.addRow(['Case 1 — SL After Target', an.case1.followUpCount]);
        summarySheet.addRow(['Case 1 — SL After Target (%)', an.case1.followUpPct]);
        summarySheet.addRow(['Case 2 — SL First', an.case2.firstHitCount]);
        summarySheet.addRow(['Case 2 — SL First (%)', an.case2.firstHitPct]);
        summarySheet.addRow(['Case 2 — Target After SL', an.case2.followUpCount]);
        summarySheet.addRow(['Case 2 — Target After SL (%)', an.case2.followUpPct]);
      }
      if (summary.finance) {
        summarySheet.addRow(['Investment Per Trade (INR)', summary.finance.investmentPerTrade]);
        summarySheet.addRow(['Total Invested (INR)', summary.finance.totalInvested]);
        summarySheet.addRow(['Total Exit Value (INR)', summary.finance.totalExitValue]);
        summarySheet.addRow(['Total P&L (INR)', summary.finance.totalPnl]);
        summarySheet.addRow(['ROI (%)', summary.finance.roiPercent]);
        summarySheet.addRow(['CAGR (%)', summary.finance.cagrPercent ?? 'N/A']);
        summarySheet.addRow(['Period Start', summary.finance.periodStart ?? 'N/A']);
        summarySheet.addRow(['Period End', summary.finance.periodEnd ?? 'N/A']);
      }
    }

    const financeSheet = workbook.addWorksheet('Finance');
    if (summary?.finance) {
      const f = summary.finance;
      financeSheet.addRow(['Metric', 'Value']);
      financeSheet.addRow(['Investment Per Trade (INR)', f.investmentPerTrade]);
      financeSheet.addRow(['Total Invested (INR)', f.totalInvested]);
      financeSheet.addRow(['Total Exit Value (INR)', f.totalExitValue]);
      financeSheet.addRow(['Total Profit / Loss (INR)', f.totalPnl]);
      financeSheet.addRow(['Return on Investment (%)', f.roiPercent]);
      financeSheet.addRow(['CAGR (%)', f.cagrPercent ?? 'N/A']);
      financeSheet.addRow(['Period Start', f.periodStart ?? 'N/A']);
      financeSheet.addRow(['Period End', f.periodEnd ?? 'N/A']);
      financeSheet.addRow(['Period (Years)', f.periodYears ?? 'N/A']);
    }

    const errorsSheet = workbook.addWorksheet('Errors');
    errorsSheet.addRow(['Row Index', 'Raw Date', 'Symbol', 'Reason', 'Type']);
    for (const row of job.upload.invalidRows) {
      errorsSheet.addRow([row.rowIndex, row.rawDate, row.symbol, row.reason, 'Upload']);
    }
    for (const result of job.results.filter((r) => r.result === 'ERROR')) {
      errorsSheet.addRow([
        '',
        '',
        result.symbol,
        result.errorMessage ?? 'Unknown error',
        'Symbol',
      ]);
    }

    const statsSheet = workbook.addWorksheet('Statistics');
    if (summary) {
      statsSheet.addRow(['Category', 'Count', 'Percentage']);
      const total = summary.totalSymbols || 1;
      statsSheet.addRow(['Target Hits', summary.targetHits, `${((summary.targetHits / total) * 100).toFixed(2)}%`]);
      statsSheet.addRow(['Stoploss Hits', summary.stoplossHits, `${((summary.stoplossHits / total) * 100).toFixed(2)}%`]);
      statsSheet.addRow(['No Breakouts', summary.noBreakouts, `${((summary.noBreakouts / total) * 100).toFixed(2)}%`]);
      statsSheet.addRow(['Open Trades', summary.openTrades, `${((summary.openTrades / total) * 100).toFixed(2)}%`]);
      statsSheet.addRow(['Errors', summary.errors, `${((summary.errors / total) * 100).toFixed(2)}%`]);
      statsSheet.addRow(['Win Rate', `${summary.winRate}%`, '']);
      statsSheet.addRow(['Avg Holding Days', summary.averageHoldingDays, '']);
      statsSheet.addRow(['Median Holding Days', summary.medianHoldingDays, '']);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  exportCsv(job: JobState): string {
    const lines: string[] = [];
    lines.push(RESULT_COLUMNS.map((c) => `"${c}"`).join(','));

    for (const result of job.results) {
      const row = tradeToRow(result).map((val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      lines.push(row.join(','));
    }

    return '\uFEFF' + lines.join('\n');
  }

  formatInvalidRowsForExport(invalidRows: InvalidRow[]): string[][] {
    return invalidRows.map((r) => [
      String(r.rowIndex),
      r.rawDate,
      r.symbol,
      r.reason,
    ]);
  }
}

export const exportService = new ExportService();
