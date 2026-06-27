import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Container,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import type {
  ScannerPeriod,
  ScannerSector,
  ScannerSignal,
  ScannerSymbolOption,
  ScannerUniverse,
} from '../types';
import { getScannerExportCsvUrl, getScannerExportExcelUrl } from '../services/api';
import {
  useScannerJob,
  useScannerOptions,
  useStartScanner,
  useSymbolSearch,
} from '../hooks/useScanner';

const PERIOD_OPTIONS: { value: ScannerPeriod; label: string }[] = [
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: '3y', label: '3 years' },
  { value: '5y', label: '5 years' },
  { value: 'all', label: 'All time' },
];

type SortKey = keyof Pick<
  ScannerSignal,
  | 'symbol'
  | 'company'
  | 'signalDate'
  | 'entryPrice'
  | 'currentPrice'
  | 'returnPct'
  | 'return3mPct'
  | 'return6mPct'
  | 'return12mPct'
  | 'maxGainPct'
  | 'maxDrawdownPct'
>;

function compareSignals(a: ScannerSignal, b: ScannerSignal, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv));
}

function formatPct(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function pctColor(value: number | null): string {
  if (value == null) return 'text.secondary';
  return value >= 0 ? 'success.main' : 'error.main';
}

export default function ScannerPage() {
  const [period, setPeriod] = useState<ScannerPeriod>('1y');
  const [universe, setUniverse] = useState<ScannerUniverse>('nifty100');
  const [sector, setSector] = useState<ScannerSector>('all');
  const [customStocks, setCustomStocks] = useState<ScannerSymbolOption[]>([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('signalDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: scannerOptions } = useScannerOptions();
  const { data: symbolMatches } = useSymbolSearch(symbolSearch);
  const startMutation = useStartScanner();
  const { data: status } = useScannerJob(jobId, !!jobId);

  useEffect(() => {
    if (!status) return;
    if (status.status === 'completed') {
      setRunning(false);
      setSnackbar(`Scanner finished — ${status.signalCount} technical signals found`);
    } else if (status.status === 'failed') {
      setRunning(false);
      setSnackbar(status.errorMessage ?? 'Scanner failed');
    }
  }, [status?.status, status?.signalCount, status?.errorMessage]);

  const signals = useMemo(() => {
    const rows = status?.signals ?? [];
    const sorted = [...rows].sort((a, b) => compareSignals(a, b, sortKey));
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [status?.signals, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'company' ? 'asc' : 'desc');
    }
  };

  const sortCell = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell align={align} sortDirection={sortKey === key ? sortDir : false}>
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortDir : 'asc'}
        onClick={() => handleSort(key)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const handleRun = () => {
    if (universe === 'custom' && customStocks.length === 0) {
      setSnackbar('Add at least one stock to your custom list');
      return;
    }

    startMutation.mutate(
      {
        period,
        universe,
        sector: universe === 'custom' ? 'all' : sector,
        symbols: universe === 'custom' ? customStocks.map((s) => s.symbol) : undefined,
      },
      {
        onSuccess: (data) => {
          setJobId(data.jobId);
          setRunning(true);
          const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;
          const universeLabel =
            universe === 'custom'
              ? `Custom (${customStocks.length})`
              : (scannerOptions?.universes.find((u) => u.id === universe)?.label ?? universe);
          const sectorLabel =
            scannerOptions?.sectors.find((s) => s.id === sector)?.label ?? sector;
          setSnackbar(
            `Scanner started — ${universeLabel}${universe !== 'custom' && sector !== 'all' ? ` · ${sectorLabel}` : ''}, signals in last ${periodLabel}`
          );
        },
        onError: (err) => setSnackbar(err.message),
      }
    );
  };

  const estimatedCount =
    universe === 'custom'
      ? customStocks.length
      : (scannerOptions?.universes.find((u) => u.id === universe)?.estimatedCount ?? null);

  const busy = running || startMutation.isPending;
  const scanActive = busy || status?.status === 'running' || status?.status === 'queued';
  const progress = status?.progress;
  const liveSignals = status?.signalsFoundCount ?? status?.signalCount ?? signals.length;
  const canExport = !!jobId && signals.length > 0 && (scanActive || status?.status === 'completed');
  const sectorDisabled =
    busy ||
    universe === 'custom' ||
    universe === 'us100' ||
    universe === 'bitcoin20' ||
    universe === 'commodities';

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Chartink Monthly Scanner
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Technical conditions only (EMA cluster breakout + 200-month high logic). No
          market-cap / EPS filter — matches Chartink technical scan. Choose universe and
          sector first for a faster scan, then pick how far back to look for signals.
        </Typography>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Stock universe
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={universe}
          onChange={(_, v: ScannerUniverse | null) => v && setUniverse(v)}
          sx={{ mb: 2, flexWrap: 'wrap' }}
          disabled={busy}
        >
          {(scannerOptions?.universes ?? [
            { id: 'nifty100' as const, label: 'Nifty 100', estimatedCount: 100 },
            { id: 'nifty500' as const, label: 'Nifty 500', estimatedCount: 500 },
            { id: 'all' as const, label: 'All NSE EQ', estimatedCount: 0 },
            { id: 'custom' as const, label: 'Custom list', estimatedCount: 0 },
          ]).map((opt) => (
            <ToggleButton key={opt.id} value={opt.id}>
              {opt.label}
              {opt.id !== 'custom' && opt.estimatedCount > 0 ? ` (~${opt.estimatedCount})` : ''}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {universe === 'custom' && (
          <Autocomplete
            multiple
            size="small"
            sx={{ mb: 2, maxWidth: 720 }}
            disabled={busy}
            options={symbolMatches?.results ?? []}
            value={customStocks}
            inputValue={symbolSearch}
            onInputChange={(_, value) => setSymbolSearch(value)}
            onChange={(_, value) => setCustomStocks(value)}
            getOptionLabel={(option) => `${option.symbol} — ${option.company}`}
            isOptionEqualToValue={(a, b) => a.symbol === b.symbol}
            filterOptions={(x) => x}
            noOptionsText={
              symbolSearch.trim().length < 2 ? 'Type 2+ letters to search' : 'No matching stocks'
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Custom stock list"
                placeholder="Search e.g. GN, RELIANCE…"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.symbol}
                  label={option.symbol}
                  size="small"
                />
              ))
            }
          />
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <FormControl
            size="small"
            sx={{ minWidth: 220 }}
            disabled={sectorDisabled}
          >
            <InputLabel id="scanner-sector-label">Sector</InputLabel>
            <Select
              labelId="scanner-sector-label"
              label="Sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as ScannerSector)}
            >
              {(scannerOptions?.sectors ?? [{ id: 'all', label: 'All sectors' }]).map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {estimatedCount != null && estimatedCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              ~{estimatedCount} symbols to scan
              {universe !== 'custom' && sector !== 'all' ? ' (after sector filter)' : ''}
            </Typography>
          )}
        </Stack>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Signal time period
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={period}
          onChange={(_, v: ScannerPeriod | null) => v && setPeriod(v)}
          sx={{ mb: 2, flexWrap: 'wrap' }}
          disabled={busy}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
            disabled={busy || (universe === 'custom' && customStocks.length === 0)}
          >
            Run Scanner
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={<DownloadIcon />}
            href={canExport ? getScannerExportExcelUrl(jobId!) : undefined}
            disabled={!canExport}
            component="a"
          >
            Export for Backtest (Excel)
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<DownloadIcon />}
            href={canExport ? getScannerExportCsvUrl(jobId!) : undefined}
            disabled={!canExport}
            component="a"
          >
            Export Details (CSV)
          </Button>
        </Stack>
      </Paper>

      {scanActive && progress && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            Scanning {progress.currentSymbol || '…'} — {progress.completed} / {progress.total}{' '}
            symbols ({progress.percentComplete}%) · {liveSignals} signals so far
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress.percentComplete}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Paper>
      )}

      {signals.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {scanActive ? 'Live Signals' : 'Historical Signals'} ({signals.length})
            {scanActive && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — updating as scan runs
              </Typography>
            )}
          </Typography>
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {sortCell('symbol', 'Symbol')}
                  {sortCell('company', 'Company')}
                  {sortCell('signalDate', 'Signal Date')}
                  {sortCell('entryPrice', 'Entry Price', 'right')}
                  {sortCell('currentPrice', 'Current Price', 'right')}
                  {sortCell('returnPct', 'Return %', 'right')}
                  {sortCell('return3mPct', '3M %', 'right')}
                  {sortCell('return6mPct', '6M %', 'right')}
                  {sortCell('return12mPct', '12M %', 'right')}
                  {sortCell('maxGainPct', 'Max Gain %', 'right')}
                  {sortCell('maxDrawdownPct', 'Max DD %', 'right')}
                </TableRow>
              </TableHead>
              <TableBody>
                {signals.map((row) => (
                  <TableRow key={`${row.symbol}-${row.signalDate}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {row.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.company}</TableCell>
                    <TableCell>{row.signalDate}</TableCell>
                    <TableCell align="right">{row.entryPrice.toFixed(2)}</TableCell>
                    <TableCell align="right">{row.currentPrice.toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.returnPct) }}>
                      {formatPct(row.returnPct)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.return3mPct) }}>
                      {formatPct(row.return3mPct)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.return6mPct) }}>
                      {formatPct(row.return6mPct)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.return12mPct) }}>
                      {formatPct(row.return12mPct)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.maxGainPct) }}>
                      {formatPct(row.maxGainPct)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: pctColor(row.maxDrawdownPct) }}>
                      {formatPct(row.maxDrawdownPct)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!scanActive && signals.length === 0 && jobId && status?.status === 'completed' && (
        <Alert severity="info">
          No technical signals in the selected period. Try a longer window (e.g. 3 years or All
          time). Shorter periods fetch less history and run faster.
        </Alert>
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
