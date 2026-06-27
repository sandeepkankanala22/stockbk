import { useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PortfolioSimResult, PortfolioTimeSnapshot } from '../types';

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function tooltipInrFormatter(value: unknown): string {
  return formatInr(typeof value === 'number' ? value : Number(value ?? 0));
}

function tooltipPctFormatter(value: unknown): string {
  return `${(typeof value === 'number' ? value : Number(value ?? 0)).toFixed(2)}%`;
}

function formatInrShort(value: number): string {
  if (Math.abs(value) >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  return formatInr(value);
}

function filterSnapshots(
  snapshots: PortfolioTimeSnapshot[],
  startDate: string,
  endDate: string
): PortfolioTimeSnapshot[] {
  return snapshots.filter((s) => {
    if (startDate && s.date < startDate) return false;
    if (endDate && s.date > endDate) return false;
    return true;
  });
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ width: '100%', height: 280 }}>{children}</Box>
    </Paper>
  );
}

interface PortfolioAnalyticsChartsProps {
  result: PortfolioSimResult;
  caseLabel: string;
  showRunners?: boolean;
}

export default function PortfolioAnalyticsCharts({
  result,
  caseLabel,
  showRunners = false,
}: PortfolioAnalyticsChartsProps) {
  const allDates = result.snapshots.map((s) => s.date);
  const minDate = allDates[0] ?? '';
  const maxDate = allDates[allDates.length - 1] ?? '';

  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [chartCase, setChartCase] = useState<'daily' | 'monthly'>('monthly');

  const source =
    chartCase === 'monthly' && result.monthlyTimeline.length > 0
      ? result.monthlyTimeline
      : result.snapshots;

  const data = useMemo(
    () => filterSnapshots(source, startDate, endDate),
    [source, startDate, endDate]
  );

  if (data.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No timeline data for {caseLabel}.
      </Typography>
    );
  }

  const compositionData = data.map((d) => ({
    date: d.date,
    cash: d.availableCash,
    active: d.activeInvestedValue,
    runner: d.runnerValue,
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Portfolio Analytics — {caseLabel}
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Granularity</InputLabel>
          <Select
            label="Granularity"
            value={chartCase}
            onChange={(e) => setChartCase(e.target.value as 'daily' | 'monthly')}
          >
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="daily">Event / Daily</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="From"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <ChartCard title="Portfolio Value" subtitle="Total portfolio growth over time">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Legend />
                <Line type="monotone" dataKey="portfolioValue" name="Portfolio Value" stroke="#1976d2" dot={false} />
                <Brush dataKey="date" height={24} stroke="#1976d2" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Equity Curve" subtitle="Cumulative portfolio value">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Line type="monotone" dataKey="portfolioValue" name="Equity" stroke="#2e7d32" dot={false} />
                <Brush dataKey="date" height={24} stroke="#2e7d32" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Available Cash" subtitle="Idle cash over time">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Line type="monotone" dataKey="availableCash" name="Available Cash" stroke="#ed6c02" dot={false} />
                <Brush dataKey="date" height={24} stroke="#ed6c02" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Invested Amount" subtitle="Capital deployed in the market">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Line type="monotone" dataKey="investedAmount" name="Invested" stroke="#9c27b0" dot={false} />
                <Brush dataKey="date" height={24} stroke="#9c27b0" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Cash Utilization %" subtitle="Invested / Portfolio Value">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={48} domain={[0, 100]} />
                <Tooltip formatter={(value) => tooltipPctFormatter(value)} />
                <Line type="monotone" dataKey="cashUtilizationPct" name="Utilization %" stroke="#0288d1" dot={false} />
                <Brush dataKey="date" height={24} stroke="#0288d1" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Investment Per Stock" subtitle="Position size compounding">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Line type="monotone" dataKey="investmentPerStock" name="Invest / Stock" stroke="#d32f2f" dot={false} />
                <Brush dataKey="date" height={24} stroke="#d32f2f" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Drawdown Curve" subtitle="% below previous peak">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={48} />
                <Tooltip formatter={(value) => tooltipPctFormatter(value)} />
                <Line type="monotone" dataKey="drawdownPct" name="Drawdown %" stroke="#c62828" dot={false} />
                <Brush dataKey="date" height={24} stroke="#c62828" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title="Active Positions" subtitle="Capital-backed open positions">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Line type="stepAfter" dataKey="activePositions" name="Active" stroke="#1565c0" dot={false} />
                <Brush dataKey="date" height={24} stroke="#1565c0" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {showRunners && (
          <Grid item xs={12} lg={6}>
            <ChartCard title="Runner Positions" subtitle="Profit runners (Case 2)">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Line type="stepAfter" dataKey="runnerPositions" name="Runners" stroke="#6a1b9a" dot={false} />
                  <Brush dataKey="date" height={24} stroke="#6a1b9a" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        )}

        <Grid item xs={12}>
          <ChartCard title="Portfolio Composition" subtitle="Cash vs Active vs Runner allocations">
            <ResponsiveContainer>
              <AreaChart data={compositionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tickFormatter={formatInrShort} tick={{ fontSize: 10 }} width={56} />
                <Tooltip formatter={(value) => tooltipInrFormatter(value)} />
                <Legend />
                <Area type="monotone" dataKey="cash" stackId="1" name="Available Cash" fill="#ed6c02" stroke="#ed6c02" />
                <Area type="monotone" dataKey="active" stackId="1" name="Active Investments" fill="#1976d2" stroke="#1976d2" />
                {showRunners && (
                  <Area type="monotone" dataKey="runner" stackId="1" name="Runner Investments" fill="#9c27b0" stroke="#9c27b0" />
                )}
                <Brush dataKey="date" height={24} stroke="#1976d2" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
