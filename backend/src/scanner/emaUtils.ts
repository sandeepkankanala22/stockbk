/** Exponential moving average on a numeric series (Chartink-style, seeded with SMA). */
export function computeEmaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;
  const k = 2 / (period + 1);

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }

  return out;
}

export const SCANNER_EMA_PERIODS = [20, 25, 30, 35, 40, 45, 50, 55] as const;

export function computeScannerEmaMatrix(closes: number[]): Map<number, (number | null)[]> {
  const map = new Map<number, (number | null)[]>();
  for (const period of SCANNER_EMA_PERIODS) {
    map.set(period, computeEmaSeries(closes, period));
  }
  return map;
}

export function greatestEmaAt(
  emaMatrix: Map<number, (number | null)[]>,
  index: number
): number | null {
  let max: number | null = null;
  for (const period of SCANNER_EMA_PERIODS) {
    const v = emaMatrix.get(period)?.[index];
    if (v == null) return null;
    max = max == null ? v : Math.max(max, v);
  }
  return max;
}

export function leastEmaAt(emaMatrix: Map<number, (number | null)[]>, index: number): number | null {
  let min: number | null = null;
  for (const period of SCANNER_EMA_PERIODS) {
    const v = emaMatrix.get(period)?.[index];
    if (v == null) return null;
    min = min == null ? v : Math.min(min, v);
  }
  return min;
}
