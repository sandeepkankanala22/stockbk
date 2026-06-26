import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type {
  BacktestConfig,
  BacktestPortfolioComparison,
  IgnoredBuySignal,
  PortfolioSimMetrics,
  PortfolioSimResult,
} from '../types';
import { useBacktestPortfolioSimulation } from '../hooks/usePortfolio';

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  );
}

function CaseMetrics({ title, subtitle, metrics }: { title: string; subtitle: string; metrics: PortfolioSimMetrics }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {subtitle}
      </Typography>
      <Grid container spacing={1.5}>
        <Grid item xs={6}><MetricMini label="Portfolio Value" value={formatInr(metrics.portfolioValue)} /></Grid>
        <Grid item xs={6}><MetricMini label="Total Return" value={formatPct(metrics.totalReturnPct)} /></Grid>
        <Grid item xs={6}><MetricMini label="CAGR" value={formatPct(metrics.cagrPercent)} /></Grid>
        <Grid item xs={6}><MetricMini label="Win Rate" value={formatPct(metrics.winRate)} /></Grid>
        <Grid item xs={6}><MetricMini label="Available Cash" value={formatInr(metrics.availableCash)} /></Grid>
        <Grid item xs={6}><MetricMini label="Invest / Stock" value={formatInr(metrics.investmentPerStock)} /></Grid>
        <Grid item xs={6}><MetricMini label="Realized P/L" value={formatInr(metrics.totalRealizedProfit)} /></Grid>
        <Grid item xs={6}><MetricMini label="Unrealized P/L" value={formatInr(metrics.totalUnrealizedProfit)} /></Grid>
        <Grid item xs={6}><MetricMini label="Open / Closed" value={`${metrics.openPositions} / ${metrics.closedPositions}`} /></Grid>
        <Grid item xs={6}><MetricMini label="Max Drawdown" value={formatPct(-metrics.maxDrawdownPct)} /></Grid>
      </Grid>
    </Paper>
  );
}

function reasonLabel(reason: IgnoredBuySignal['reason'], maxHoldings: number): string {
  return reason === 'max_holdings'
    ? `Max holdings (${maxHoldings} slots full)`
    : 'Insufficient cash';
}

function IgnoredBuysSummary({
  result,
  caseLabel,
  maxHoldings,
}: {
  result: PortfolioSimResult;
  caseLabel: string;
  maxHoldings: number;
}) {
  const maxHoldingsSkips = (result.ignoredBuys ?? []).filter((b) => b.reason === 'max_holdings').length;
  const cashSkips = (result.ignoredBuys ?? []).filter((b) => b.reason === 'insufficient_cash').length;
  const totalBuyEvents = result.buysExecuted + result.ignoredBuySignals;

  if (totalBuyEvents === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Missed buy signals — {caseLabel}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {totalBuyEvents} buy events in timeline · <strong>{result.buysExecuted} taken</strong> ·{' '}
        <strong>{result.ignoredBuySignals} skipped</strong>
        {result.ignoredBuySignals > 0 && (
          <>
            {' '}
            ({maxHoldingsSkips} max holdings, {cashSkips} insufficient cash)
          </>
        )}
      </Typography>

      {result.ignoredBuySignals === 0 ? (
        <Alert severity="success" sx={{ py: 0.5 }}>
          No buy signals were skipped — you did not miss any entries due to the holding cap.
        </Alert>
      ) : (
        <TableContainer sx={{ maxHeight: 280 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Entry Date</TableCell>
                <TableCell align="right">Buy Price</TableCell>
                <TableCell>Why skipped</TableCell>
                <TableCell align="right">Open slots used</TableCell>
                <TableCell align="right">Cash available</TableCell>
                <TableCell align="right">Needed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(result.ignoredBuys ?? []).map((row) => (
                <TableRow key={`${row.symbol}-${row.entryDate}-${row.reason}`} hover>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell>{row.entryDate}</TableCell>
                  <TableCell align="right">{row.entryPrice.toFixed(2)}</TableCell>
                  <TableCell>{reasonLabel(row.reason, maxHoldings)}</TableCell>
                  <TableCell align="right">
                    {row.openPositionsAtSkip} / {maxHoldings}
                  </TableCell>
                  <TableCell align="right">{formatInr(row.availableCashAtSkip)}</TableCell>
                  <TableCell align="right">{formatInr(row.requiredInvestment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

function ComparisonTable({ data }: { data: BacktestPortfolioComparison }) {
  const rows: Array<{ label: string; c1: string; c2: string; c3a: string; c3b: string; c4: string }> = [
    {
      label: 'Final Portfolio Value',
      c1: formatInr(data.case1.metrics.portfolioValue),
      c2: formatInr(data.case2.metrics.portfolioValue),
      c3a: formatInr(data.case3Compound.metrics.portfolioValue),
      c3b: formatInr(data.case3Withdraw.metrics.portfolioValue),
      c4: formatInr(data.case4.metrics.portfolioValue),
    },
    {
      label: 'Total Return %',
      c1: formatPct(data.case1.metrics.totalReturnPct),
      c2: formatPct(data.case2.metrics.totalReturnPct),
      c3a: formatPct(data.case3Compound.metrics.totalReturnPct),
      c3b: formatPct(data.case3Withdraw.metrics.totalReturnPct),
      c4: formatPct(data.case4.metrics.totalReturnPct),
    },
    {
      label: 'CAGR',
      c1: formatPct(data.case1.metrics.cagrPercent),
      c2: formatPct(data.case2.metrics.cagrPercent),
      c3a: formatPct(data.case3Compound.metrics.cagrPercent),
      c3b: formatPct(data.case3Withdraw.metrics.cagrPercent),
      c4: formatPct(data.case4.metrics.cagrPercent),
    },
    {
      label: 'Skipped buy signals',
      c1: String(data.case1.ignoredBuySignals),
      c2: String(data.case2.ignoredBuySignals),
      c3a: String(data.case3Compound.ignoredBuySignals),
      c3b: String(data.case3Withdraw.ignoredBuySignals),
      c4: String(data.case4.ignoredBuySignals),
    },
    {
      label: 'Buys executed',
      c1: String(data.case1.buysExecuted),
      c2: String(data.case2.buysExecuted),
      c3a: String(data.case3Compound.buysExecuted),
      c3b: String(data.case3Withdraw.buysExecuted),
      c4: String(data.case4.buysExecuted),
    },
    {
      label: 'Open positions',
      c1: String(data.case1.metrics.openPositions),
      c2: String(data.case2.metrics.openPositions),
      c3a: String(data.case3Compound.metrics.openPositions),
      c3b: String(data.case3Withdraw.metrics.openPositions),
      c4: String(data.case4.metrics.openPositions),
    },
  ];

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell align="right">Case 1</TableCell>
            <TableCell align="right">Case 2</TableCell>
            <TableCell align="right">Case 3 — Total Exit</TableCell>
            <TableCell align="right">Case 3 — Keep Profit</TableCell>
            <TableCell align="right">Case 4 — No Cap</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right">{row.c1}</TableCell>
              <TableCell align="right">{row.c2}</TableCell>
              <TableCell align="right">{row.c3a}</TableCell>
              <TableCell align="right">{row.c3b}</TableCell>
              <TableCell align="right">{row.c4}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface BacktestPortfolioPanelProps {
  jobId: string;
  config: BacktestConfig;
}

export default function BacktestPortfolioPanel({ jobId, config }: BacktestPortfolioPanelProps) {
  const [initialCapital, setInitialCapital] = useState('1000000');
  const [maxHoldings, setMaxHoldings] = useState('20');
  const [error, setError] = useState<string | null>(null);

  const simulation = useBacktestPortfolioSimulation();

  const handleRun = () => {
    setError(null);
    const capital = Number(initialCapital);
    if (!Number.isFinite(capital) || capital <= 0) {
      setError('Initial capital must be a positive number.');
      return;
    }
    simulation.mutate({
      backtestJobId: jobId,
      initialCapital: capital,
      maxHoldings: Number(maxHoldings) || 20,
      targetPercent: config.targetPercent,
      stoplossPercent: config.stoplossPercent,
    });
  };

  const data = simulation.data;

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Portfolio Simulation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simulates chronological capital allocation from backtest signals. Investment per stock =
        Available Cash ÷ Max Holdings (recalculated after each exit). Target +{config.targetPercent}%
        and stop loss −{config.stoplossPercent}% from buy price.
      </Typography>

      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Cases
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        <strong>Case 1</strong> — Buy after signal (breakout buy date), full exit &amp; compound.
        <br />
        <strong>Case 2</strong> — Buy after signal (breakout buy date), withdraw principal at target.
        <br />
        <strong>Case 3</strong> — Breakout buy + <em>first</em> FTT pullback to buy price only (later
        pullbacks before target are ignored); max {maxHoldings} holdings; total exit vs keep profit.
        <br />
        <strong>Case 4</strong> — Same entries as Case 3 (first pullback only), but <strong>no holding cap</strong>
        — every signal is bought if cash allows; full exit &amp; compound.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Initial Capital (₹)"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            disabled={simulation.isPending}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Maximum Holdings"
            value={maxHoldings}
            onChange={(e) => setMaxHoldings(e.target.value)}
            disabled={simulation.isPending}
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="contained"
          startIcon={simulation.isPending ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
          onClick={handleRun}
          disabled={simulation.isPending}
        >
          Run Portfolio Simulation
        </Button>
        {simulation.isPending && (
          <Typography variant="body2" color="text.secondary">
            Resolving exits from price data…
          </Typography>
        )}
      </Stack>

      {(error || simulation.error) && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error ?? simulation.error?.message}
        </Alert>
      )}

      {data && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {data.signalCount} breakout entries · {data.pullbackEntryCount} first-FTT-pullback entries ·{' '}
            {data.combinedEntryCount} combined (Cases 3 &amp; 4) · {data.simulationStart ?? '—'} →{' '}
            {data.simulationEnd ?? '—'}
          </Alert>

          <ComparisonTable data={data} />

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <CaseMetrics
                title="Case 1"
                subtitle="Signal buy · full exit & compound"
                metrics={data.case1.metrics}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CaseMetrics
                title="Case 2"
                subtitle="Signal buy · withdraw principal at target"
                metrics={data.case2.metrics}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CaseMetrics
                title="Case 3 — Total Exit"
                subtitle="First pullback only · max holdings · full exit & compound"
                metrics={data.case3Compound.metrics}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CaseMetrics
                title="Case 3 — Keep Profit"
                subtitle="First pullback only · max holdings · withdraw principal"
                metrics={data.case3Withdraw.metrics}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CaseMetrics
                title="Case 4 — No Cap"
                subtitle="First pullback only · buy all signals · full exit & compound"
                metrics={data.case4.metrics}
              />
            </Grid>
          </Grid>

          <IgnoredBuysSummary result={data.case1} caseLabel="Case 1" maxHoldings={data.config.maxHoldings} />
          <IgnoredBuysSummary result={data.case2} caseLabel="Case 2" maxHoldings={data.config.maxHoldings} />
          <IgnoredBuysSummary
            result={data.case3Compound}
            caseLabel="Case 3 — Total Exit"
            maxHoldings={data.config.maxHoldings}
          />
          <IgnoredBuysSummary
            result={data.case3Withdraw}
            caseLabel="Case 3 — Keep Profit"
            maxHoldings={data.config.maxHoldings}
          />
          <IgnoredBuysSummary
            result={data.case4}
            caseLabel="Case 4 — No Cap (holding cap disabled)"
            maxHoldings={data.config.maxHoldings}
          />
        </Box>
      )}
    </Paper>
  );
}
