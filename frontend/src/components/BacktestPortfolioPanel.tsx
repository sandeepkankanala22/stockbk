import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type {
  BacktestConfig,
  BacktestPortfolioComparison,
  IgnoredBuySignal,
  PortfolioEntryType,
  PortfolioPerformanceSummary,
  PortfolioSimMetrics,
  PortfolioSimResult,
  PortfolioTradeRecord,
} from '../types';
import { useBacktestPortfolioSimulation } from '../hooks/usePortfolio';
import PortfolioAnalyticsCharts from './PortfolioAnalyticsCharts';

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null, signed = false): string {
  if (value == null) return '—';
  const sign = signed && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function entryTypeLabel(t: PortfolioEntryType): string {
  return t === 'breakout' ? 'Breakout' : 'Pullback';
}

function modeLabel(mode: PortfolioTradeRecord['simulationMode']): string {
  return mode === 'compound' ? 'Complete Exit' : 'Principal Exit';
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

function PortfolioDashboard({ title, subtitle, metrics }: { title: string; subtitle: string; metrics: PortfolioSimMetrics }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {subtitle}
      </Typography>
      <Grid container spacing={1.5}>
        <Grid item xs={6} sm={4}><MetricMini label="Initial Capital" value={formatInr(metrics.initialCapital)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Portfolio Value" value={formatInr(metrics.portfolioValue)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Available Cash" value={formatInr(metrics.availableCash)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Invested Amount" value={formatInr(metrics.investedAmount)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Runner Value" value={formatInr(metrics.runnerValue)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Invest / Stock" value={formatInr(metrics.investmentPerStock)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Active Positions" value={String(metrics.activePositions)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Runner Positions" value={String(metrics.runnerPositions)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Cash Utilization" value={formatPct(metrics.cashUtilizationPct)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Idle Cash" value={formatInr(metrics.idleCash)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Realized Profit" value={formatInr(metrics.totalRealizedProfit)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Unrealized Profit" value={formatInr(metrics.totalUnrealizedProfit)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Total Return" value={formatPct(metrics.totalReturnPct, true)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="CAGR" value={formatPct(metrics.cagrPercent, true)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Max Drawdown" value={formatPct(-metrics.maxDrawdownPct)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Total Trades" value={String(metrics.totalTrades)} /></Grid>
        <Grid item xs={6} sm={4}><MetricMini label="Win Rate" value={formatPct(metrics.winRate)} /></Grid>
      </Grid>
    </Paper>
  );
}

function PerformanceSummaryPanel({ summary }: { summary: PortfolioPerformanceSummary }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Initial Capital', value: formatInr(summary.initialCapital) },
    { label: 'Final Portfolio Value', value: formatInr(summary.finalPortfolioValue) },
    { label: 'Total Return %', value: formatPct(summary.totalReturnPct, true) },
    { label: 'CAGR', value: formatPct(summary.cagrPercent, true) },
    { label: 'Annualized Return', value: formatPct(summary.annualizedReturnPct, true) },
    { label: 'Realized Profit', value: formatInr(summary.totalRealizedProfit) },
    { label: 'Unrealized Profit', value: formatInr(summary.totalUnrealizedProfit) },
    { label: 'Maximum Drawdown', value: formatPct(-summary.maxDrawdownPct) },
    { label: 'Avg Cash Utilization', value: formatPct(summary.averageCashUtilizationPct) },
    { label: 'Max Cash Utilization', value: formatPct(summary.maxCashUtilizationPct) },
    { label: 'Min Cash Utilization', value: formatPct(summary.minCashUtilizationPct) },
    { label: 'Highest Portfolio Value', value: formatInr(summary.highestPortfolioValue) },
    { label: 'Largest Winning Trade', value: formatInr(summary.largestWinningTrade) },
    { label: 'Largest Losing Trade', value: formatInr(summary.largestLosingTrade) },
    { label: 'Avg Holding Period (days)', value: String(summary.averageHoldingDays) },
    { label: 'Avg Investment / Stock', value: formatInr(summary.averageInvestmentPerStock) },
    { label: 'Total Buy Signals', value: String(summary.totalBuySignals) },
    { label: 'Executed Buy Signals', value: String(summary.executedBuySignals) },
    { label: 'Missed Signals (Cash)', value: String(summary.missedSignals) },
  ];

  return (
    <Grid container spacing={1.5}>
      {rows.map((r) => (
        <Grid item xs={6} sm={4} md={3} key={r.label}>
          <MetricMini label={r.label} value={r.value} />
        </Grid>
      ))}
    </Grid>
  );
}

function MissedSignalsPanel({ result, caseLabel }: { result: PortfolioSimResult; caseLabel: string }) {
  if (result.totalBuySignals === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Missed Signals — {caseLabel}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 1.5 }}>
        <Grid item xs={6} sm={3}>
          <MetricMini label="Total Missed" value={String(result.ignoredBuySignals)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricMini label="Due to Cash" value={String(result.ignoredBuySignals)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricMini label="Executed" value={String(result.buysExecuted)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricMini label="Total Signals" value={String(result.totalBuySignals)} />
        </Grid>
      </Grid>

      {result.ignoredBuySignals === 0 ? (
        <Alert severity="success" sx={{ py: 0.5 }}>
          All qualifying signals were executed — no cash-related misses.
        </Alert>
      ) : (
        <TableContainer sx={{ maxHeight: 280 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Entry Type</TableCell>
                <TableCell>Entry Date</TableCell>
                <TableCell align="right">Buy Price</TableCell>
                <TableCell align="right">Cash Available</TableCell>
                <TableCell align="right">Needed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(result.ignoredBuys ?? []).map((row: IgnoredBuySignal) => (
                <TableRow key={`${row.symbol}-${row.entryDate}`} hover>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell>{entryTypeLabel(row.entryType)}</TableCell>
                  <TableCell>{row.entryDate}</TableCell>
                  <TableCell align="right">{row.entryPrice.toFixed(2)}</TableCell>
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

function CapitalDeploymentTimeline({ result }: { result: PortfolioSimResult }) {
  const rows = result.monthlyTimeline;
  if (rows.length === 0) return null;

  return (
    <TableContainer sx={{ maxHeight: 420 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell align="right">Portfolio Value</TableCell>
            <TableCell align="right">Available Cash</TableCell>
            <TableCell align="right">Invested</TableCell>
            <TableCell align="right">Runner Value</TableCell>
            <TableCell align="right">Utilization %</TableCell>
            <TableCell align="right">Active</TableCell>
            <TableCell align="right">Runners</TableCell>
            <TableCell align="right">Invest / Stock</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.date} hover>
              <TableCell>{r.date}</TableCell>
              <TableCell align="right">{formatInr(r.portfolioValue)}</TableCell>
              <TableCell align="right">{formatInr(r.availableCash)}</TableCell>
              <TableCell align="right">{formatInr(r.investedAmount)}</TableCell>
              <TableCell align="right">{formatInr(r.runnerValue)}</TableCell>
              <TableCell align="right">{formatPct(r.cashUtilizationPct)}</TableCell>
              <TableCell align="right">{r.activePositions}</TableCell>
              <TableCell align="right">{r.runnerPositions}</TableCell>
              <TableCell align="right">{formatInr(r.investmentPerStock)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TradeHistoryTable({ trades }: { trades: PortfolioTradeRecord[] }) {
  if (trades.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No trades recorded.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: 480 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Symbol</TableCell>
            <TableCell>Entry Type</TableCell>
            <TableCell>Mode</TableCell>
            <TableCell>Buy Date</TableCell>
            <TableCell align="right">Buy Price</TableCell>
            <TableCell align="right">Investment</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell>Sell Date</TableCell>
            <TableCell align="right">Sell Price</TableCell>
            <TableCell align="right">Principal Returned</TableCell>
            <TableCell align="right">Runner Value</TableCell>
            <TableCell align="right">Realized</TableCell>
            <TableCell align="right">Unrealized</TableCell>
            <TableCell align="right">Return %</TableCell>
            <TableCell align="right">Days</TableCell>
            <TableCell>Exit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trades.map((t) => (
            <TableRow key={`${t.symbol}-${t.buyDate}-${t.sellDate ?? 'open'}`} hover>
              <TableCell>{t.symbol}</TableCell>
              <TableCell>{entryTypeLabel(t.entryType)}</TableCell>
              <TableCell>{modeLabel(t.simulationMode)}</TableCell>
              <TableCell>{t.buyDate}</TableCell>
              <TableCell align="right">{t.buyPrice.toFixed(2)}</TableCell>
              <TableCell align="right">{formatInr(t.investmentAmount)}</TableCell>
              <TableCell align="right">{t.quantity.toFixed(4)}</TableCell>
              <TableCell>{t.sellDate ?? '—'}</TableCell>
              <TableCell align="right">{t.sellPrice?.toFixed(2) ?? '—'}</TableCell>
              <TableCell align="right">{formatInr(t.principalReturned)}</TableCell>
              <TableCell align="right">{formatInr(t.runnerValue)}</TableCell>
              <TableCell align="right">{formatInr(t.realizedProfit)}</TableCell>
              <TableCell align="right">{formatInr(t.unrealizedProfit)}</TableCell>
              <TableCell align="right">{t.returnPct != null ? formatPct(t.returnPct, true) : '—'}</TableCell>
              <TableCell align="right">{t.holdingDays ?? '—'}</TableCell>
              <TableCell>{t.exitReason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ComparisonTable({ data }: { data: BacktestPortfolioComparison }) {
  const m1 = data.case1.metrics;
  const m2 = data.case2.metrics;
  const s1 = data.case1.performanceSummary;
  const s2 = data.case2.performanceSummary;

  const rows: Array<{ label: string; c1: string; c2: string }> = [
    { label: 'Portfolio Value', c1: formatInr(m1.portfolioValue), c2: formatInr(m2.portfolioValue) },
    { label: 'CAGR', c1: formatPct(m1.cagrPercent, true), c2: formatPct(m2.cagrPercent, true) },
    { label: 'Total Return %', c1: formatPct(m1.totalReturnPct, true), c2: formatPct(m2.totalReturnPct, true) },
    { label: 'Realized Profit', c1: formatInr(m1.totalRealizedProfit), c2: formatInr(m2.totalRealizedProfit) },
    { label: 'Unrealized Profit', c1: formatInr(m1.totalUnrealizedProfit), c2: formatInr(m2.totalUnrealizedProfit) },
    { label: 'Maximum Drawdown', c1: formatPct(-m1.maxDrawdownPct), c2: formatPct(-m2.maxDrawdownPct) },
    { label: 'Cash Utilization', c1: formatPct(m1.cashUtilizationPct), c2: formatPct(m2.cashUtilizationPct) },
    { label: 'Avg Investment / Stock', c1: formatInr(s1.averageInvestmentPerStock), c2: formatInr(s2.averageInvestmentPerStock) },
    { label: 'Active Positions', c1: String(m1.activePositions), c2: String(m2.activePositions) },
    { label: 'Runner Positions', c1: String(m1.runnerPositions), c2: String(m2.runnerPositions) },
    { label: 'Executed Signals', c1: String(s1.executedBuySignals), c2: String(s2.executedBuySignals) },
    { label: 'Missed Signals', c1: String(s1.missedSignals), c2: String(s2.missedSignals) },
    { label: 'Win Rate', c1: formatPct(m1.winRate), c2: formatPct(m2.winRate) },
  ];

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell align="right">Case 1 — Complete Exit</TableCell>
            <TableCell align="right">Case 2 — Principal Exit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right">{row.c1}</TableCell>
              <TableCell align="right">{row.c2}</TableCell>
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
  const [targetPercent, setTargetPercent] = useState(String(config.targetPercent));
  const [stoplossPercent, setStoplossPercent] = useState(String(config.stoplossPercent));
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState(0);
  const [tradeTab, setTradeTab] = useState(0);
  const [timelineTab, setTimelineTab] = useState(0);
  const [historyTab, setHistoryTab] = useState(0);

  const simulation = useBacktestPortfolioSimulation();

  const handleRun = () => {
    setError(null);
    const capital = Number(initialCapital);
    const target = Number(targetPercent);
    const sl = Number(stoplossPercent);
    if (!Number.isFinite(capital) || capital <= 0) {
      setError('Initial capital must be a positive number.');
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setError('Target % must be a positive number.');
      return;
    }
    if (!Number.isFinite(sl) || sl <= 0) {
      setError('Stop loss % must be a positive number.');
      return;
    }
    simulation.mutate({
      backtestJobId: jobId,
      initialCapital: capital,
      maxHoldings: Number(maxHoldings) || 20,
      targetPercent: target,
      stoplossPercent: sl,
    });
  };

  const data = simulation.data;

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Portfolio Simulation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Real-investor simulation aligned with backtest Phase 1 (breakout buy) and Phase 2 (first FTT pullback).
        Exits use stored FTT/FSL dates from the backtest when target/stop % match the job config.
        Investment per stock = Portfolio Value ÷ Max Holdings (compounds after each exit).
        Case 2 recycles principal at target while runner profits stay invested.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label="Initial Capital (₹)" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} disabled={simulation.isPending} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label="Maximum Holdings (sizing divisor)" value={maxHoldings} onChange={(e) => setMaxHoldings(e.target.value)} disabled={simulation.isPending} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label="Target %" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} disabled={simulation.isPending} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField fullWidth size="small" label="Stop Loss %" value={stoplossPercent} onChange={(e) => setStoplossPercent(e.target.value)} disabled={simulation.isPending} />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} alignItems="center">
        <Button variant="contained" startIcon={simulation.isPending ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} onClick={handleRun} disabled={simulation.isPending}>
          Run Portfolio Simulation
        </Button>
        {simulation.isPending && (
          <Typography variant="body2" color="text.secondary">Resolving exits from price data…</Typography>
        )}
      </Stack>

      {(error || simulation.error) && (
        <Alert severity="error" sx={{ mt: 2 }}>{error ?? simulation.error?.message}</Alert>
      )}

      {data && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {data.signalCount} breakout · {data.pullbackEntryCount} pullback · {data.combinedEntryCount} total entries ·{' '}
            {data.simulationStart ?? '—'} → {data.simulationEnd ?? '—'}
          </Alert>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Comparison</Typography>
          <ComparisonTable data={data} />

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} lg={6}>
              <PortfolioDashboard title="Case 1 — Complete Exit" subtitle="Full exit · compound all proceeds" metrics={data.case1.metrics} />
            </Grid>
            <Grid item xs={12} lg={6}>
              <PortfolioDashboard title="Case 2 — Principal Exit" subtitle="Withdraw principal · runner profits stay invested" metrics={data.case2.metrics} />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Performance Summary</Typography>
            <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2 }}>
              <Tab label="Case 1 — Complete Exit" />
              <Tab label="Case 2 — Principal Exit" />
            </Tabs>
            {mainTab === 0 ? (
              <PerformanceSummaryPanel summary={data.case1.performanceSummary} />
            ) : (
              <PerformanceSummaryPanel summary={data.case2.performanceSummary} />
            )}
          </Paper>

          <MissedSignalsPanel result={data.case1} caseLabel="Case 1" />
          <MissedSignalsPanel result={data.case2} caseLabel="Case 2" />

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Portfolio Analytics</Typography>
            <Tabs value={tradeTab} onChange={(_, v) => setTradeTab(v)} sx={{ mb: 2 }}>
              <Tab label="Case 1 — Complete Exit" />
              <Tab label="Case 2 — Principal Exit" />
            </Tabs>
            {tradeTab === 0 ? (
              <PortfolioAnalyticsCharts result={data.case1} caseLabel="Complete Exit" />
            ) : (
              <PortfolioAnalyticsCharts result={data.case2} caseLabel="Principal Exit" showRunners />
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Capital Deployment Timeline</Typography>
            <Tabs value={timelineTab} onChange={(_, v) => setTimelineTab(v)} sx={{ mb: 1 }}>
              <Tab label="Case 1" />
              <Tab label="Case 2" />
            </Tabs>
            {timelineTab === 0 ? (
              <CapitalDeploymentTimeline result={data.case1} />
            ) : (
              <CapitalDeploymentTimeline result={data.case2} />
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Trade History</Typography>
            <Tabs value={historyTab} onChange={(_, v) => setHistoryTab(v)} sx={{ mb: 1 }}>
              <Tab label={`Case 1 (${data.case1.tradeHistory.length})`} />
              <Tab label={`Case 2 (${data.case2.tradeHistory.length})`} />
            </Tabs>
            {historyTab === 0 ? (
              <TradeHistoryTable trades={data.case1.tradeHistory} />
            ) : (
              <TradeHistoryTable trades={data.case2.tradeHistory} />
            )}
          </Paper>
        </Box>
      )}
    </Paper>
  );
}
