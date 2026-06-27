import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { BacktestConfig, BenchmarkSeries, TradeResult } from '../types';
import {
  buildBuyMonthTable,
  buildPortfolioInsightChart,
  CHART_PCT_FLOOR,
  downloadAllTradesExport,
  type BuyPathColumn,
  type DashboardMetricRow,
  type InvestorDashboardData,
  type SignalPullbackComparison,
} from '../utils/investorDashboardBuilder';

function formatPct(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(2)}%`;
}

function formatDaysCell(days: { min: number | null; avg: number | null; max: number | null } | null): string {
  if (!days) return '—';
  const parts: string[] = [];
  if (days.min != null) parts.push(`min ${days.min}`);
  if (days.avg != null) parts.push(`avg ${days.avg}`);
  if (days.max != null) parts.push(`max ${days.max}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function PathPieChart({ slices, total }: { slices: BuyPathColumn['pieSlices']; total: number }) {
  if (total === 0 || slices.length === 0) {
    return (
      <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No trades
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
            label={(props) => {
              const p = props.payload as { name?: string; pct?: number } | undefined;
              if (!p?.name) return '';
              return `${p.name} ${(p.pct ?? 0).toFixed(0)}%`;
            }}
            labelLine={{ strokeWidth: 1 }}
          >
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, item) => {
              const v = typeof value === 'number' ? value : Number(value ?? 0);
              const p = item?.payload as { pct?: number } | undefined;
              return [`${v} (${(p?.pct ?? 0).toFixed(1)}%)`, String(name)];
            }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}

function BuyPathColumnPanel({ column, accent }: { column: BuyPathColumn; accent: 'success' | 'warning' }) {
  const headerBg =
    accent === 'success' ? 'rgba(46, 125, 50, 0.1)' : 'rgba(237, 108, 2, 0.1)';
  const borderColor = accent === 'success' ? 'success.main' : 'warning.main';

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        borderTop: 4,
        borderColor,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1, bgcolor: headerBg, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight={800}>
          {column.title}
        </Typography>
      </Box>

      <Box sx={{ px: 2, py: 1 }}>
        <PathPieChart slices={column.pieSlices} total={column.totalTrades} />
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 72 }}>
                Count
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 72 }}>
                %
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, minWidth: 150 }}>
                Days (min · avg · max)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell>
                <Typography variant="body2" fontWeight={700}>
                  No. of trades
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  {column.totalTrades}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  {column.totalTrades > 0 ? '100%' : '—'}
                </Typography>
              </TableCell>
              <TableCell align="right">—</TableCell>
            </TableRow>
            {column.metrics.map((m) => (
              <TableRow key={m.label} hover>
                <TableCell>
                  <Typography variant="body2">{m.label}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600}>
                    {m.count}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatPct(m.pct)}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatDaysCell(m.days)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function SignalPullbackDashboard({ data }: { data: SignalPullbackComparison }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
      }}
    >
      <BuyPathColumnPanel column={data.signalBuys} accent="success" />
      <BuyPathColumnPanel column={data.pullbackBuys} accent="warning" />
    </Box>
  );
}

function MetricTable({
  title,
  subtitle,
  rows,
  accent,
  pctColumnLabel = '% of Total',
  useBranchPct = false,
}: {
  title: string;
  subtitle: string;
  rows: DashboardMetricRow[];
  accent: 'success' | 'warning' | 'neutral';
  pctColumnLabel?: string;
  useBranchPct?: boolean;
}) {
  const headerBg =
    accent === 'success'
      ? 'rgba(46, 125, 50, 0.08)'
      : accent === 'warning'
        ? 'rgba(237, 108, 2, 0.08)'
        : 'action.hover';

  return (
    <Paper sx={{ height: '100%', overflow: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1, bgcolor: headerBg }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 80 }}>
                Count
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 100 }}>
                {pctColumnLabel}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, minWidth: 160 }}>
                Days (min · avg · max)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={row.label.includes('universe') ? 600 : 400}>
                    {row.label}
                  </Typography>
                  {row.note && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.note}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600}>
                    {row.count}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {formatPct(useBranchPct ? row.pctOfBranch : row.pctOfTotal)}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatDaysCell(row.days)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function InsightStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: 1, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} sx={{ color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function PortfolioInsightChart({
  results,
  benchmark,
  config,
}: {
  results: TradeResult[];
  benchmark: BenchmarkSeries | null;
  config: BacktestConfig;
}) {
  const buyMonthOptions = useMemo(() => buildBuyMonthTable(results), [results]);
  const [buyMonthKey, setBuyMonthKey] = useState<string>('');
  const [pctCap, setPctCap] = useState<number>(100);

  useEffect(() => {
    if (buyMonthOptions.length === 0) {
      setBuyMonthKey('');
      return;
    }
    if (!buyMonthKey || !buyMonthOptions.some((o) => o.sortKey === buyMonthKey)) {
      setBuyMonthKey(buyMonthOptions[0].sortKey);
    }
  }, [buyMonthOptions, buyMonthKey]);

  const selectedCohort = buyMonthOptions.find((o) => o.sortKey === buyMonthKey);

  const { rows, insights } = useMemo(
    () =>
      buildPortfolioInsightChart(
        results,
        benchmark,
        config.targetPercent,
        config.stoplossPercent,
        pctCap,
        buyMonthKey || null
      ),
    [results, benchmark, config, pctCap, buyMonthKey]
  );

  if (buyMonthOptions.length === 0 || rows.length === 0 || !insights) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Portfolio vs NIFTY 50
            {selectedCohort ? ` — ${selectedCohort.buyMonth}` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            NIFTY 50 always shown. Portfolio avg & median use only stocks bought in the selected
            month ({selectedCohort?.stocksBought ?? 0} stocks).
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="chart-buy-month-label">Buy month</InputLabel>
            <Select
              labelId="chart-buy-month-label"
              label="Buy month"
              value={buyMonthKey}
              onChange={(e) => setBuyMonthKey(e.target.value)}
            >
              {buyMonthOptions.map((opt) => (
                <MenuItem key={opt.sortKey} value={opt.sortKey}>
                  {opt.buyMonth} ({opt.stocksBought})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={pctCap}
            onChange={(_, v) => v != null && setPctCap(v)}
          >
            <ToggleButton value={100}>±100%</ToggleButton>
            <ToggleButton value={200}>±200%</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <InsightStat
          label="Portfolio avg (latest)"
          value={`${insights.portfolioAvg >= 0 ? '+' : ''}${insights.portfolioAvg.toFixed(1)}%`}
          sub={`Median ${insights.portfolioMedian >= 0 ? '+' : ''}${insights.portfolioMedian.toFixed(1)}%`}
        />
        <InsightStat
          label="NIFTY 50 (latest)"
          value={`${insights.nifty >= 0 ? '+' : ''}${insights.nifty.toFixed(1)}%`}
        />
        <InsightStat
          label="Alpha vs NIFTY"
          value={`${insights.alphaVsNifty >= 0 ? '+' : ''}${insights.alphaVsNifty.toFixed(1)}%`}
          color={insights.alphaVsNifty >= 0 ? 'success.main' : 'error.main'}
        />
        <InsightStat
          label="Beating NIFTY"
          value={`${insights.pctBeatingNifty.toFixed(0)}%`}
          sub={`${insights.activePositions} active positions`}
        />
        <InsightStat
          label={`Above +${config.targetPercent}% target`}
          value={`${insights.pctAboveTarget.toFixed(0)}%`}
          color="success.main"
        />
        <InsightStat
          label={`In −${config.stoplossPercent}% zone`}
          value={`${insights.pctInStopZone.toFixed(0)}%`}
          color="error.main"
        />
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" tickFormatter={monthTick} minTickGap={48} tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={[CHART_PCT_FLOOR, pctCap]}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === 'number' ? `${value.toFixed(1)}%` : '—',
                  String(name),
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <ReferenceArea
                y1={config.targetPercent}
                y2={pctCap}
                fill="#2e7d32"
                fillOpacity={0.06}
              />
              <ReferenceArea
                y1={CHART_PCT_FLOOR}
                y2={-config.stoplossPercent}
                fill="#c62828"
                fillOpacity={0.06}
              />
              <ReferenceLine y={0} stroke="#bdbdbd" />
              <ReferenceLine y={config.targetPercent} stroke="#2e7d32" strokeDasharray="4 4" />
              <ReferenceLine y={-config.stoplossPercent} stroke="#c62828" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="NIFTY50"
                name="NIFTY 50"
                stroke="#1565c0"
                strokeWidth={3}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="portfolioAvg"
                name="Portfolio Avg"
                stroke="#2e7d32"
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="portfolioMedian"
                name="Portfolio Median"
                stroke="#ef6c00"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    </Box>
  );
}

function monthTick(v: string): string {
  const d = new Date(v);
  return `${d.toLocaleString('en-US', { month: 'short' })}-${String(d.getFullYear()).slice(-2)}`;
}

function BuyMonthTable({ results }: { results: TradeResult[] }) {
  const rows = useMemo(() => buildBuyMonthTable(results), [results]);
  if (rows.length === 0) return null;

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Buy Month Summary
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Stocks grouped by breakout buy month — FTT / FSL split per cohort.
      </Typography>
      <TableContainer sx={{ maxHeight: 360 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Buy Month</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Stocks Bought
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                FTT
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                FSL
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Open
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                FTT %
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                FSL %
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sortKey} hover>
                <TableCell>{row.buyMonth}</TableCell>
                <TableCell align="right">{row.stocksBought}</TableCell>
                <TableCell align="right">{row.ftt}</TableCell>
                <TableCell align="right">{row.fsl}</TableCell>
                <TableCell align="right">{row.open}</TableCell>
                <TableCell align="right">{row.fttPct.toFixed(1)}%</TableCell>
                <TableCell align="right">{row.fslPct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function InvestorDashboard({
  data,
  results,
  benchmark,
  config,
}: {
  data: InvestorDashboardData;
  results: TradeResult[];
  benchmark: BenchmarkSeries | null;
  config: BacktestConfig;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadAllTradesExport(results)}
        >
          Download All Trades (Signal + Pullback)
        </Button>
      </Stack>

      {data.signalPullback ? (
        <SignalPullbackDashboard data={data.signalPullback} />
      ) : (
        <MetricTable
          title="Overview — Hit Sequence"
          subtitle="Risk/reward split across the full universe"
          rows={data.overview}
          accent="neutral"
        />
      )}

      <Box sx={{ mt: 2 }}>
        <MetricTable
          title="FSL Recovery Path"
          subtitle={`${data.fslData[1]?.count ?? 0} first-hit stop loss — recovery sub-metrics`}
          rows={data.fslData}
          accent="warning"
          pctColumnLabel="% of FSL"
          useBranchPct
        />
      </Box>

      <BuyMonthTable results={results} />

      <PortfolioInsightChart results={results} benchmark={benchmark} config={config} />

      {data.errors.length > 0 && (
        <Paper sx={{ mt: 2, p: 2, borderLeft: 4, borderColor: 'error.main' }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Data errors ({data.errors.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Symbols that could not be loaded from NSE or BSE. Re-run after a short wait if
            rate-limited.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {data.errors.map((e) => (
              <Chip
                key={e.symbol}
                label={`${e.symbol}: ${e.message}`}
                size="small"
                color="error"
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
