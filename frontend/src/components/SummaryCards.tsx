import { useMemo } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import type { DashboardSummary, TradeResult } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { buildFlowDiagramTree, dedupeResultsBySymbolMinDate } from '../utils/flowDiagramBuilder';
import FlowDiagram from './FlowDiagram';

interface SummaryCardsProps {
  summary: DashboardSummary | null;
  results: TradeResult[];
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

export default function SummaryCards({ summary, results }: SummaryCardsProps) {
  const { tree, dedupeInfo } = useMemo(() => {
    const info = dedupeResultsBySymbolMinDate(results);
    return {
      tree: buildFlowDiagramTree(results),
      dedupeInfo: info,
    };
  }, [results]);

  if (!summary) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Dashboard
      </Typography>

      {tree ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            One row per symbol using earliest min date (same as backtest).{' '}
            {dedupeInfo.duplicatesDropped > 0
              ? `${dedupeInfo.duplicatesDropped} duplicate symbol row(s) dropped (${dedupeInfo.rawCount} → ${dedupeInfo.deduped.length}).`
              : `${dedupeInfo.deduped.length} unique symbol(s).`}
          </Typography>
          <FlowDiagram tree={tree} />
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
