import { useMemo } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import type { BacktestConfig, BenchmarkSeries, DashboardSummary, SymbolDuplicateNote, TradeResult } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { getDashboardResults, SYMBOL_REAPPEAR_MONTHS } from '../utils/symbolDateSelection';
import { buildInvestorDashboard } from '../utils/investorDashboardBuilder';
import DuplicateSymbolsPanel from './DuplicateSymbolsPanel';
import InvestorDashboard from './InvestorDashboard';
import NearBuyBandPanel from './NearBuyBandPanel';
import OpenStocksPanel from './OpenStocksPanel';

interface SummaryCardsProps {
  summary: DashboardSummary | null;
  results: TradeResult[];
  config: BacktestConfig;
  benchmark: BenchmarkSeries | null;
  duplicateSymbolNotes: SymbolDuplicateNote[];
  nearBuyPlusPct: number;
  nearBuyMinusPct: number;
}

function MetricTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <Paper sx={{ height: '100%' }}>
      <Typography variant="subtitle1" sx={{ px: 2, pt: 2, pb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {rows.map((row) => (
        <Box
          key={row.label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            px: 2,
            py: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2">{row.label}</Typography>
          <Typography variant="body2" fontWeight={500}>
            {row.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

export default function SummaryCards({
  summary,
  results,
  config,
  benchmark,
  duplicateSymbolNotes,
  nearBuyPlusPct,
  nearBuyMinusPct,
}: SummaryCardsProps) {
  const { dashboard, dashboardRows } = useMemo(() => {
    const { rows } = getDashboardResults(results);
    return {
      dashboard: buildInvestorDashboard(results),
      dashboardRows: rows,
    };
  }, [results]);

  if (!summary) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Dashboard — Risk / Reward
      </Typography>

      {dashboard ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {dashboardRows.length} backtest run(s). Duplicate symbols use a rolling{' '}
            {SYMBOL_REAPPEAR_MONTHS}-month rule from each kept date (not always the earliest).
          </Typography>
          <InvestorDashboard
            data={dashboard}
            results={results}
            benchmark={benchmark}
            config={config}
          />
          <DuplicateSymbolsPanel notes={duplicateSymbolNotes} />
          <OpenStocksPanel results={dashboardRows} />
          <NearBuyBandPanel
            results={dashboardRows}
            plusPct={nearBuyPlusPct}
            minusPct={nearBuyMinusPct}
          />
        </>
      ) : (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography>No results to display</Typography>
        </Paper>
      )}

      {summary.finance && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Finance Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <MetricTable
                title="Portfolio"
                rows={[
                  {
                    label: 'Investment / trade',
                    value: formatCurrency(summary.finance.investmentPerTrade),
                  },
                  {
                    label: 'Total invested',
                    value: formatCurrency(summary.finance.totalInvested),
                  },
                  {
                    label: 'Total exit value',
                    value: formatCurrency(summary.finance.totalExitValue),
                  },
                  {
                    label: 'Total P&L',
                    value: formatCurrency(summary.finance.totalPnl),
                  },
                  { label: 'ROI', value: formatPercent(summary.finance.roiPercent) },
                  {
                    label: 'CAGR',
                    value:
                      summary.finance.cagrPercent != null
                        ? formatPercent(summary.finance.cagrPercent)
                        : 'N/A',
                  },
                ]}
              />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
