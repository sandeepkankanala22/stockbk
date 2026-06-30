import { Box, Grid, Paper, Typography } from '@mui/material';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PortfolioMonthlyActivity } from '../types';

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
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
      <Box sx={{ width: '100%', height: 320 }}>{children}</Box>
    </Paper>
  );
}

interface PortfolioMonthlyActivityChartsProps {
  activity: PortfolioMonthlyActivity[];
}

export default function PortfolioMonthlyActivityCharts({
  activity,
}: PortfolioMonthlyActivityChartsProps) {
  if (activity.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No monthly buy/exit activity to chart yet.
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <ChartCard
          title="Monthly Buys vs Exits"
          subtitle="Signal buys (breakout) + pullback buys stacked; exits at ±30% from buy price"
        >
          <ResponsiveContainer>
            <ComposedChart data={activity} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={64}
                interval={activity.length > 18 ? 1 : 0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Legend />
              <Bar dataKey="signalBuys" name="Signal Buys" stackId="buys" fill="#2e7d32" />
              <Bar dataKey="pullbackBuys" name="Pullback Buys" stackId="buys" fill="#1976d2" />
              <Bar dataKey="exits" name="Exits" fill="#c62828" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12} lg={6}>
        <ChartCard
          title="Total Buys per Month"
          subtitle="Combined signal + pullback entries executed"
        >
          <ResponsiveContainer>
            <ComposedChart data={activity} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={64}
                interval={activity.length > 12 ? 1 : 0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Bar dataKey="totalBuys" name="Total Buys" fill="#1565c0" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12} lg={6}>
        <ChartCard
          title="Holdings at Month End"
          subtitle="Open positions still held (complete exit mode — full position until ±30% hit)"
        >
          <ResponsiveContainer>
            <ComposedChart data={activity} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={64}
                interval={activity.length > 12 ? 1 : 0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Line
                type="stepAfter"
                dataKey="holdings"
                name="Holdings"
                stroke="#ed6c02"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Grid item xs={12}>
        <ChartCard
          title="Monthly Activity Overview"
          subtitle="Buys (stacked), exits, and holdings on one chart"
        >
          <ResponsiveContainer>
            <ComposedChart data={activity} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={64}
                interval={activity.length > 18 ? 1 : 0}
              />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="count" dataKey="signalBuys" name="Signal Buys" stackId="buys" fill="#2e7d32" />
              <Bar yAxisId="count" dataKey="pullbackBuys" name="Pullback Buys" stackId="buys" fill="#1976d2" />
              <Bar yAxisId="count" dataKey="exits" name="Exits" fill="#c62828" />
              <Line
                yAxisId="count"
                type="stepAfter"
                dataKey="holdings"
                name="Holdings (month end)"
                stroke="#ff9800"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
    </Grid>
  );
}
