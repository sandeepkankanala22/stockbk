import { useMemo, useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import type { BacktestConfig, TradeResult } from '../types';
import { formatPercent } from '../utils/formatters';
import {
  buildThreeBandPanels,
  sortBandRows,
  type BandPanelData,
  type BandSortMode,
  type BandStockRow,
} from '../utils/dashboardBandViews';

const SORT_OPTIONS: { value: BandSortMode; label: string }[] = [
  { value: 'nearest', label: 'Nearest to buy (0%)' },
  { value: 'highest', label: 'Highest % first' },
  { value: 'lowest', label: 'Lowest % first' },
  { value: 'symbol', label: 'Symbol A–Z' },
];

function pctColor(pct: number): string {
  if (pct >= 0) return 'success.main';
  return 'error.main';
}

function RiskRewardSummary({ rr }: { rr: BandPanelData['riskReward'] }) {
  if (rr.total === 0) {
    return (
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {rr.phaseLabel}: no historical trades
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.25,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.75 }}>
        Risk / reward — {rr.phaseLabel} ({rr.total} total)
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
        <Typography variant="caption" sx={{ color: 'success.main' }}>
          {rr.targetLabel}: {rr.targetHits} ({rr.targetPct}%)
        </Typography>
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          {rr.stopLabel}: {rr.stoplossHits} ({rr.stoplossPct}%)
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {rr.openLabel}: {rr.openPending} ({rr.openPct}%)
        </Typography>
      </Box>
    </Box>
  );
}

function BandColumn({
  panel,
  sortMode,
  onSortChange,
  accent,
}: {
  panel: BandPanelData;
  sortMode: BandSortMode;
  onSortChange: (mode: BandSortMode) => void;
  accent: 'primary' | 'warning' | 'info';
}) {
  const sorted = useMemo(
    () => sortBandRows(panel.rows, sortMode),
    [panel.rows, sortMode]
  );

  const borderColor =
    accent === 'primary' ? 'primary.main' : accent === 'warning' ? 'warning.main' : 'info.main';
  const headerBg =
    accent === 'primary'
      ? 'rgba(25, 118, 210, 0.08)'
      : accent === 'warning'
        ? 'rgba(237, 108, 2, 0.08)'
        : 'rgba(2, 136, 209, 0.08)';

  const showPullbackCols = panel.id === 'fttPullbackInBand';

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: 4,
        borderColor,
        minHeight: 420,
      }}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1, bgcolor: headerBg }}>
        <Typography variant="subtitle1" fontWeight={800} gutterBottom>
          {panel.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {panel.subtitle}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {panel.rows.length} in band
          <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>
            {' '}
            / {panel.totalInUniverse} in universe
          </Typography>
        </Typography>
        <RiskRewardSummary rr={panel.riskReward} />
        <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
          <InputLabel id={`sort-${panel.id}`}>Sort</InputLabel>
          <Select
            labelId={`sort-${panel.id}`}
            label="Sort"
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as BandSortMode)}
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TableContainer sx={{ flex: 1, maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Symbol</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Signal</TableCell>
              {panel.id !== 'noBuyOpen' && (
                <TableCell sx={{ fontWeight: 600 }}>Buy</TableCell>
              )}
              {showPullbackCols && (
                <>
                  <TableCell sx={{ fontWeight: 600 }}>FTT</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Pullback</TableCell>
                </>
              )}
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                <TableSortLabel active direction={sortMode === 'lowest' ? 'asc' : 'desc'} hideSortIcon>
                  % from buy
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Close
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showPullbackCols ? 7 : panel.id === 'noBuyOpen' ? 4 : 5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No stocks in this band
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row: BandStockRow) => (
                <TableRow key={`${row.symbol}-${row.signalDate}`} hover>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{row.signalDate}</TableCell>
                  {panel.id !== 'noBuyOpen' && (
                    <TableCell sx={{ fontSize: '0.75rem' }}>{row.buyDate ?? '—'}</TableCell>
                  )}
                  {showPullbackCols && (
                    <>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{row.fttDate ?? '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{row.pullbackDate ?? '—'}</TableCell>
                    </>
                  )}
                  <TableCell align="right" sx={{ color: pctColor(row.pctFromBuy), fontWeight: 600 }}>
                    {row.pctFromBuy >= 0 ? '+' : ''}
                    {formatPercent(row.pctFromBuy)}
                  </TableCell>
                  <TableCell align="right">
                    {row.latestClose != null ? row.latestClose.toFixed(2) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function ThreeBandDashboard({
  results,
  config,
}: {
  results: TradeResult[];
  config: BacktestConfig;
}) {
  const panels = useMemo(
    () => buildThreeBandPanels(results, config.targetPercent, config.stoplossPercent),
    [results, config.targetPercent, config.stoplossPercent]
  );

  const [sortBought, setSortBought] = useState<BandSortMode>('nearest');
  const [sortPullback, setSortPullback] = useState<BandSortMode>('nearest');
  const [sortNoBuy, setSortNoBuy] = useState<BandSortMode>('nearest');

  const [bought, fttPullback, noBuy] = panels;

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Live band view — ±{config.targetPercent}% / −{config.stoplossPercent}%
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Three cohorts side by side. Column 1: bought but neither FTT nor FSL yet (no pullbacks).
        % from buy uses latest close vs signal month-high buy price. Default sort: nearest to 0% first.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <BandColumn
          panel={bought}
          sortMode={sortBought}
          onSortChange={setSortBought}
          accent="primary"
        />
        <BandColumn
          panel={fttPullback}
          sortMode={sortPullback}
          onSortChange={setSortPullback}
          accent="warning"
        />
        <BandColumn
          panel={noBuy}
          sortMode={sortNoBuy}
          onSortChange={setSortNoBuy}
          accent="info"
        />
      </Box>
    </Box>
  );
}
