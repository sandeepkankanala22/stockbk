/**
 * Debug scanner for specific symbols vs Chartink.
 * Run: npx tsx backend/scripts/debugScanner.ts GNFC BERGEPAINT
 */
import { findTechnicalSignalMonths, MIN_MONTHS_FOR_SCAN } from '../src/scanner/chartinkConditions.js';
import { aggregateDailyToMonthly, normalizeYahooMonthlyBars } from '../src/scanner/monthlyBars.js';
import { computeScannerEmaMatrix, greatestEmaAt, leastEmaAt } from '../src/scanner/emaUtils.js';
import { yahooFinanceService } from '../src/services/yahooFinanceService.js';
import { signalCutoffDate } from '../src/scanner/scannerPeriod.js';

const symbols = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['GNFC', 'BERGEPAINT'];

function rollingMaxHigh(highs: number[], endIdx: number, window: number): number | null {
  const start = endIdx - window + 1;
  if (start < 0) return null;
  let max = -Infinity;
  for (let i = start; i <= endIdx; i++) max = Math.max(max, highs[i]);
  return max;
}

function highsEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= scale * 0.005;
}

function diagnoseLatest(symbol: string) {
  return async () => {
    const fetchStart = '2004-01-01';
    let monthly;
    const mo = await yahooFinanceService.fetchMonthlyForSymbol(symbol, fetchStart);
    if (!mo.error && mo.bars.length > 0) {
      monthly = normalizeYahooMonthlyBars(mo.bars);
      console.log(`\n=== ${symbol} — monthly bars: ${monthly.length} (yahoo 1mo)`);
    }
    if (!monthly || monthly.length <= MIN_MONTHS_FOR_SCAN) {
      const daily = await yahooFinanceService.fetchForSymbol(symbol, fetchStart);
      monthly = aggregateDailyToMonthly(daily.bars);
      console.log(`\n=== ${symbol} — monthly bars: ${monthly.length} (daily agg)`);
      if (daily.error) console.log('Daily error:', daily.error);
    }

    if (monthly.length <= MIN_MONTHS_FOR_SCAN) {
      console.log(`NOT ENOUGH DATA (need > ${MIN_MONTHS_FOR_SCAN})`);
      return;
    }

    const signals = findTechnicalSignalMonths(monthly, null);
    const recent = findTechnicalSignalMonths(monthly, signalCutoffDate('1y')!);
    console.log(`All-time signals: ${signals.length}`);
    console.log(`Last 1y signals: ${recent.length}`);
    if (signals.length > 0) {
      const last3 = signals.slice(-3);
      for (const s of last3) {
        console.log(`  Signal: ${s.bar.date} close=${s.bar.close} high=${s.bar.high}`);
      }
    }

    const i = monthly.length - 1;
    const bar = monthly[i];
    const closes = monthly.map((m) => m.close);
    const highs = monthly.map((m) => m.high);
    const emaMatrix = computeScannerEmaMatrix(closes);
    const greatestEma = greatestEmaAt(emaMatrix, i)!;
    const leastEma = leastEmaAt(emaMatrix, i)!;
    const max200 = rollingMaxHigh(highs, i, 200)!;
    const max100At49 = rollingMaxHigh(highs, i - 49, 100)!;

    console.log(`\nLatest bar ${bar.date}:`);
    console.log(`  O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close}`);
    console.log(`  Close > Greatest(EMA): ${bar.close > greatestEma} (${bar.close} > ${greatestEma.toFixed(2)})`);
    console.log(`  Open < Least(EMA):     ${bar.open < leastEma} (${bar.open} < ${leastEma.toFixed(2)})`);
    console.log(`  Max200=${max200.toFixed(2)} Max100@49ago=${max100At49.toFixed(2)} equal=${highsEqual(max200, max100At49)} diff%=${((Math.abs(max200-max100At49)/max200)*100).toFixed(3)}`);
    console.log(`  High > 50% Max200:     ${bar.high > max200 * 0.5} (${bar.high} > ${(max200 * 0.5).toFixed(2)})`);
  };
}

for (const sym of symbols) {
  await diagnoseLatest(sym)();
}
