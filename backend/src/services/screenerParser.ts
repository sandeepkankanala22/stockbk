import { dayjs } from '../utils/dateParser.js';
import { config } from '../config/defaults.js';

export interface QuarterNetProfit {
  label: string;
  dateKey: string;
  valueCr: number;
}

export interface FundamentalSnapshot {
  quarter: string;
  quarterDateKey: string;
  netProfitCr: number;
  qoqChangePct: number | null;
  qoqPriorQuarter: string | null;
  yoyChangePct: number | null;
  yoyPriorQuarter: string | null;
  source: 'screener.in';
  view: 'consolidated' | 'standalone';
  asOfDate: string;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function parseIndianNumber(text: string): number | null {
  const cleaned = text.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractQuartersTableSection(html: string): string {
  const sectionStart = html.indexOf('<section id="quarters"');
  if (sectionStart === -1) return '';

  const sectionEnd = html.indexOf('<section id="profit-loss"', sectionStart);
  const section = html.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);

  const tableMarker = section.indexOf('data-result-table');
  if (tableMarker === -1) return section;

  return section.slice(tableMarker);
}

function parseQuarterHeaders(tableSection: string): { label: string; dateKey: string }[] {
  const theadEnd = tableSection.indexOf('</thead>');
  if (theadEnd === -1) return [];

  const thead = tableSection.slice(0, theadEnd);
  const headers: { label: string; dateKey: string }[] = [];
  const headerRe = /<th[^>]*data-date-key="([^"]+)"[^>]*>\s*([A-Za-z]{3}\s+\d{4})/g;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = headerRe.exec(thead)) !== null) {
    headers.push({
      dateKey: headerMatch[1],
      label: headerMatch[2].trim(),
    });
  }
  return headers;
}

function findNetProfitRowHtml(tableSection: string): string | null {
  const tbodyStart = tableSection.indexOf('<tbody>');
  if (tbodyStart === -1) return null;

  const tbody = tableSection.slice(tbodyStart);
  const rowRe = /<tr[\s\S]*?<\/tr>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const rowHtml = rowMatch[0];
    if (
      rowHtml.includes("showSchedule('Net Profit', 'quarters'") ||
      rowHtml.includes('showSchedule("Net Profit", "quarters"')
    ) {
      return rowHtml;
    }
  }
  return null;
}

function parseRowValues(rowHtml: string): (number | null)[] {
  const tds = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
  return tds.slice(1).map((td) => parseIndianNumber(stripHtml(td[1])));
}

export function parseQuarterlyNetProfitFromHtml(html: string): QuarterNetProfit[] {
  const tableSection = extractQuartersTableSection(html);
  if (!tableSection) return [];

  const headers = parseQuarterHeaders(tableSection);
  const rowHtml = findNetProfitRowHtml(tableSection);
  if (!rowHtml || headers.length === 0) return [];

  const rawValues = parseRowValues(rowHtml);
  const count = Math.min(headers.length, rawValues.length);
  const quarters: QuarterNetProfit[] = [];

  for (let i = 0; i < count; i++) {
    const value = rawValues[i];
    if (value == null) continue;
    quarters.push({
      label: headers[i].label,
      dateKey: headers[i].dateKey,
      valueCr: value,
    });
  }

  return quarters;
}

/** Quarters whose results are likely published (not future / not pending). */
export function filterAnnouncedQuarters(
  quarters: QuarterNetProfit[],
  asOfDate: string,
  announcementLagDays = config.screenerAnnouncementLagDays
): QuarterNetProfit[] {
  const today = dayjs(asOfDate);
  return quarters.filter((q) => {
    const quarterEnd = dayjs(q.dateKey);
    if (!quarterEnd.isValid() || quarterEnd.isAfter(today, 'day')) return false;
    const expectedAnnounce = quarterEnd.add(announcementLagDays, 'day');
    return !today.isBefore(expectedAnnounce, 'day');
  });
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

export function buildFundamentalSnapshot(
  quarters: QuarterNetProfit[],
  view: 'consolidated' | 'standalone',
  asOfDate: string
): FundamentalSnapshot | null {
  const announced = filterAnnouncedQuarters(quarters, asOfDate);
  if (announced.length === 0) return null;

  const latestIdx = announced.length - 1;
  const latest = announced[latestIdx];
  const priorQ = latestIdx >= 1 ? announced[latestIdx - 1] : null;
  const priorY = latestIdx >= 4 ? announced[latestIdx - 4] : null;

  return {
    quarter: latest.label,
    quarterDateKey: latest.dateKey,
    netProfitCr: latest.valueCr,
    qoqChangePct: priorQ ? pctChange(latest.valueCr, priorQ.valueCr) : null,
    qoqPriorQuarter: priorQ?.label ?? null,
    yoyChangePct: priorY ? pctChange(latest.valueCr, priorY.valueCr) : null,
    yoyPriorQuarter: priorY?.label ?? null,
    source: 'screener.in',
    view,
    asOfDate,
  };
}

export function formatFundamentalReasons(snapshot: FundamentalSnapshot): string[] {
  const reasons: string[] = [];
  const qLabel = snapshot.quarter;

  reasons.push(
    `Latest announced quarter: ${qLabel} — Net Profit ₹${snapshot.netProfitCr.toLocaleString('en-IN')} Cr [${snapshot.source}, ${snapshot.view}]`
  );

  if (snapshot.qoqChangePct != null && snapshot.qoqPriorQuarter) {
    const sign = snapshot.qoqChangePct >= 0 ? '+' : '';
    reasons.push(
      `Net Profit QOQ (${qLabel} vs ${snapshot.qoqPriorQuarter}): ${sign}${snapshot.qoqChangePct}%`
    );
  }

  if (snapshot.yoyChangePct != null && snapshot.yoyPriorQuarter) {
    const sign = snapshot.yoyChangePct >= 0 ? '+' : '';
    reasons.push(
      `Net Profit YOY (${qLabel} vs ${snapshot.yoyPriorQuarter}): ${sign}${snapshot.yoyChangePct}%`
    );
  }

  return reasons;
}
