import { useMemo, useState } from 'react';
import {
  Paper,
  Typography,
  Chip,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  Tab,
  Stack,
  Alert,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { TradeResult, TradeResultType, FundamentalSnapshot } from '../types';

type FilterTab = 'all' | 'target' | 'stoploss' | 'open' | 'waiting' | 'high';

type SortKey =
  | 'symbol'
  | 'minDate'
  | 'setupStatus'
  | 'actualResult'
  | 'mlDecision'
  | 'probability'
  | 'confidence';

interface MlDecisionsViewProps {
  results: TradeResult[];
}

interface DecisionRow {
  symbol: string;
  minDate: string;
  setupStatus: string;
  setupColor: 'default' | 'warning' | 'info' | 'success' | 'error';
  mlDecision: 'TARGET' | 'STOPLOSS' | null;
  targetProbability: number | null;
  confidence: string | null;
  actualResult: TradeResultType;
  predictionMatch: boolean | null;
  topReasons: string[];
  fundamentals: FundamentalSnapshot | null | undefined;
  buyPrice: number | null;
  buyDate: string | null;
}

/** Sort order: OPEN first when ascending — groups open trades together */
const RESULT_SORT_ORDER: Record<TradeResultType, number> = {
  OPEN: 0,
  NO_BREAKOUT: 1,
  TARGET: 2,
  STOPLOSS: 3,
  ERROR: 4,
};

const SETUP_SORT_ORDER: Record<string, number> = {
  'Broke out — trade still open': 0,
  'Sideways — waiting for breakout': 1,
  'No setup yet': 2,
  'Closed — hit target': 3,
  'Closed — hit stoploss': 4,
  'Error — no data': 5,
};

function deriveSetupStatus(result: TradeResult): { label: string; color: DecisionRow['setupColor'] } {
  switch (result.result) {
    case 'NO_BREAKOUT':
      return result.buyPrice != null
        ? { label: 'Sideways — waiting for breakout', color: 'warning' }
        : { label: 'No setup yet', color: 'default' };
    case 'OPEN':
      return { label: 'Broke out — trade still open', color: 'info' };
    case 'TARGET':
      return { label: 'Closed — hit target', color: 'success' };
    case 'STOPLOSS':
      return { label: 'Closed — hit stoploss', color: 'error' };
    case 'ERROR':
      return { label: 'Error — no data', color: 'default' };
    default:
      return { label: result.result, color: 'default' };
  }
}

function confidenceRank(c: string | null): number {
  if (c === 'HIGH') return 3;
  if (c === 'MEDIUM') return 2;
  if (c === 'LOW') return 1;
  return 0;
}

function mlDecisionRank(d: 'TARGET' | 'STOPLOSS' | null): number {
  if (d === 'TARGET') return 2;
  if (d === 'STOPLOSS') return 1;
  return 0;
}

function compareRows(a: DecisionRow, b: DecisionRow, sortKey: SortKey): number {
  switch (sortKey) {
    case 'symbol':
      return a.symbol.localeCompare(b.symbol);
    case 'minDate':
      return a.minDate.localeCompare(b.minDate);
    case 'setupStatus':
      return (
        (SETUP_SORT_ORDER[a.setupStatus] ?? 99) - (SETUP_SORT_ORDER[b.setupStatus] ?? 99)
      );
    case 'actualResult':
      return RESULT_SORT_ORDER[a.actualResult] - RESULT_SORT_ORDER[b.actualResult];
    case 'mlDecision':
      return mlDecisionRank(a.mlDecision) - mlDecisionRank(b.mlDecision);
    case 'probability':
      return (a.targetProbability ?? -1) - (b.targetProbability ?? -1);
    case 'confidence':
      return confidenceRank(a.confidence) - confidenceRank(b.confidence);
    default:
      return 0;
  }
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value}%`;
}

function FundamentalReasons({ data }: { data: FundamentalSnapshot }) {
  return (
    <Box sx={{ mt: 1, p: 1, bgcolor: 'info.50', borderRadius: 1, borderLeft: 3, borderColor: 'info.main' }}>
      <Typography variant="caption" fontWeight={700} color="info.dark" display="block" gutterBottom>
        Fundamentals — {data.quarter} ({data.view}, {data.source})
      </Typography>
      <Typography variant="body2">
        Net Profit: ₹{data.netProfitCr.toLocaleString('en-IN')} Cr
      </Typography>
      <Typography variant="body2">
        QOQ {data.qoqPriorQuarter ? `vs ${data.qoqPriorQuarter}` : ''}: {formatPct(data.qoqChangePct)}
      </Typography>
      <Typography variant="body2">
        YOY {data.yoyPriorQuarter ? `vs ${data.yoyPriorQuarter}` : ''}: {formatPct(data.yoyChangePct)}
      </Typography>
    </Box>
  );
}

function DecisionChip({ decision }: { decision: 'TARGET' | 'STOPLOSS' | null }) {
  if (!decision) {
    return <Chip size="small" label="No prediction" variant="outlined" />;
  }
  if (decision === 'TARGET') {
    return (
      <Chip size="small" icon={<TrendingUpIcon />} label="Likely TARGET" color="success" />
    );
  }
  return (
    <Chip size="small" icon={<TrendingDownIcon />} label="Likely STOPLOSS" color="error" />
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  sortAsc,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <TableCell align={align}>
      <TableSortLabel
        active={activeKey === sortKey}
        direction={sortAsc ? 'asc' : 'desc'}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

export default function MlDecisionsView({ results }: MlDecisionsViewProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('actualResult');
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo<DecisionRow[]>(() => {
    return results.map((r) => {
      const setup = deriveSetupStatus(r);
      return {
        symbol: r.symbol,
        minDate: r.minDate,
        setupStatus: setup.label,
        setupColor: setup.color,
        mlDecision: r.prediction?.predictedClass ?? null,
        targetProbability: r.prediction?.targetProbability ?? null,
        confidence: r.prediction?.confidence ?? null,
        actualResult: r.result,
        predictionMatch: r.prediction?.predictionMatch ?? null,
        topReasons: r.prediction?.topReasons ?? [],
        fundamentals: r.prediction?.fundamentals,
        buyPrice: r.buyPrice,
        buyDate: r.buyDate,
      };
    });
  }, [results]);

  const filtered = useMemo(() => {
    let list = rows;
    switch (filter) {
      case 'target':
        list = rows.filter((r) => r.mlDecision === 'TARGET');
        break;
      case 'stoploss':
        list = rows.filter((r) => r.mlDecision === 'STOPLOSS');
        break;
      case 'open':
        list = rows.filter((r) => r.actualResult === 'OPEN');
        break;
      case 'waiting':
        list = rows.filter((r) => r.mlDecision == null && r.actualResult === 'NO_BREAKOUT');
        break;
      case 'high':
        list = rows.filter((r) => r.confidence === 'HIGH');
        break;
      default:
        list = rows.filter((r) => r.mlDecision != null);
        break;
    }

    return [...list].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, filter, sortKey, sortAsc]);

  const counts = useMemo(
    () => ({
      predicted: rows.filter((r) => r.mlDecision != null).length,
      target: rows.filter((r) => r.mlDecision === 'TARGET').length,
      stoploss: rows.filter((r) => r.mlDecision === 'STOPLOSS').length,
      open: rows.filter((r) => r.actualResult === 'OPEN').length,
      waiting: rows.filter((r) => r.mlDecision == null && r.actualResult === 'NO_BREAKOUT').length,
      high: rows.filter((r) => r.confidence === 'HIGH').length,
    }),
    [rows]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'actualResult' || key === 'setupStatus');
    }
  };

  const handleFilterChange = (v: FilterTab) => {
    setFilter(v);
    if (v === 'open') {
      setSortKey('actualResult');
      setSortAsc(true);
    }
  };

  if (rows.every((r) => r.mlDecision == null)) {
    return null;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        ML Stock Decisions &amp; Reasons
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Click column headers to sort. Fundamentals (QOQ/YOY from screener.in) appear only for
        stocks trading within ±15% of buy price, using the latest announced quarter.
      </Typography>

      <Tabs
        value={filter}
        onChange={(_, v: FilterTab) => handleFilterChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="all" label={`All predictions (${counts.predicted})`} />
        <Tab value="target" label={`Likely TARGET (${counts.target})`} />
        <Tab value="stoploss" label={`Likely STOPLOSS (${counts.stoploss})`} />
        <Tab
          value="open"
          icon={<OpenInNewIcon fontSize="small" />}
          iconPosition="start"
          label={`Open trades (${counts.open})`}
        />
        <Tab value="high" label={`High confidence (${counts.high})`} />
        <Tab
          value="waiting"
          icon={<HourglassEmptyIcon fontSize="small" />}
          iconPosition="start"
          label={`Sideways / waiting (${counts.waiting})`}
        />
      </Tabs>

      {filter === 'waiting' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          These stocks have not broken out above the month high yet. The ML model cannot predict
          TARGET vs STOPLOSS until a breakout occurs.
        </Alert>
      )}

      {filter === 'open' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          These trades broke out but neither target nor stoploss has been hit yet — still open in
          the backtest window.
        </Alert>
      )}

      {filtered.length === 0 ? (
        <Typography color="text.secondary">No stocks in this category.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <SortableHeader
                  label="Symbol"
                  sortKey="symbol"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Min Date"
                  sortKey="minDate"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Setup Status"
                  sortKey="setupStatus"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <TableCell>Buy Price</TableCell>
                <SortableHeader
                  label="ML Decision"
                  sortKey="mlDecision"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="P(TARGET) %"
                  sortKey="probability"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Confidence"
                  sortKey="confidence"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Actual Result"
                  sortKey="actualResult"
                  activeKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
                <TableCell>Match</TableCell>
                <TableCell sx={{ minWidth: 320 }}>Reasons</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={`${row.symbol}-${row.minDate}`}
                  sx={{
                    bgcolor:
                      row.actualResult === 'OPEN'
                        ? 'warning.50'
                        : row.mlDecision === 'TARGET'
                          ? 'success.50'
                          : row.mlDecision === 'STOPLOSS'
                            ? 'error.50'
                            : undefined,
                  }}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{row.symbol}</Typography>
                  </TableCell>
                  <TableCell>{row.minDate}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.setupStatus}
                      color={row.setupColor}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{row.buyPrice ?? '—'}</TableCell>
                  <TableCell>
                    <DecisionChip decision={row.mlDecision} />
                  </TableCell>
                  <TableCell align="right">
                    {row.targetProbability != null ? `${row.targetProbability}%` : '—'}
                  </TableCell>
                  <TableCell>
                    {row.confidence ? (
                      <Chip
                        size="small"
                        label={row.confidence}
                        color={row.confidence === 'HIGH' ? 'primary' : 'default'}
                        variant={row.confidence === 'HIGH' ? 'filled' : 'outlined'}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.actualResult}
                      color={row.actualResult === 'OPEN' ? 'warning' : 'default'}
                      variant={row.actualResult === 'OPEN' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    {row.predictionMatch == null
                      ? '—'
                      : row.predictionMatch
                        ? '✓ Yes'
                        : '✗ No'}
                  </TableCell>
                  <TableCell>
                    {row.topReasons.length > 0 && (
                      <Stack component="ul" sx={{ m: 0, pl: 2, mb: row.fundamentals ? 1 : 0 }}>
                        {row.topReasons.map((reason, i) => (
                          <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>
                            {reason}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                    {row.fundamentals ? (
                      <FundamentalReasons data={row.fundamentals} />
                    ) : (
                      row.topReasons.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Breakout required before ML can predict
                        </Typography>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
