import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

const EXCEL_EPOCH = dayjs('1899-12-30');

const TEXT_FORMATS = [
  'DD MMM YYYY',
  'D MMM YYYY',
  'DD MMMM YYYY',
  'D MMMM YYYY',
  'YYYY-MM-DD',
];

export function formatIso(date: dayjs.Dayjs): string {
  return date.format('YYYY-MM-DD');
}

export function parseDateValue(raw: unknown): { iso: string } | { error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { error: 'Empty date' };
  }

  if (raw instanceof Date) {
    const parsed = dayjs(raw);
    if (!parsed.isValid()) return { error: 'Invalid date object' };
    return { iso: formatIso(parsed) };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = EXCEL_EPOCH.add(raw, 'day');
    if (!parsed.isValid()) return { error: 'Invalid Excel serial date' };
    return { iso: formatIso(parsed) };
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return { error: 'Empty date' };

  for (const format of TEXT_FORMATS) {
    const parsed = dayjs(trimmed, format, true);
    if (parsed.isValid()) {
      return { iso: formatIso(parsed) };
    }
  }

  const loose = dayjs(trimmed);
  if (loose.isValid() && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { iso: formatIso(loose) };
  }

  return { error: `Invalid date format: "${trimmed}"` };
}

export function todayIso(): string {
  return formatIso(dayjs());
}

export function startOfMonthIso(isoDate: string): string {
  return formatIso(dayjs(isoDate).startOf('month'));
}

export function endOfMonthIso(isoDate: string): string {
  return formatIso(dayjs(isoDate).endOf('month'));
}

export function nextMonthStartIso(isoDate: string): string {
  return formatIso(dayjs(isoDate).add(1, 'month').startOf('month'));
}

export function isSameCalendarMonth(isoDate: string, referenceIso: string): boolean {
  const d = dayjs(isoDate);
  const ref = dayjs(referenceIso);
  return d.year() === ref.year() && d.month() === ref.month();
}

export function isInCalendarMonth(isoDate: string, year: number, month: number): boolean {
  const d = dayjs(isoDate);
  return d.year() === year && d.month() === month;
}

export function diffDays(fromIso: string, toIso: string): number {
  return dayjs(toIso).diff(dayjs(fromIso), 'day');
}

/** Backtest upload format e.g. "02 May 2025" */
export function formatDisplayDate(isoDate: string): string {
  return dayjs(isoDate).format('DD MMM YYYY');
}

export { dayjs };
