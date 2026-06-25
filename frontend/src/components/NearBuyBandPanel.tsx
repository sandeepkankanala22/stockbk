import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { TradeResult } from '../types';
import { formatPercent } from '../utils/formatters';
import { getTop10NearBuyBand, nearestBandLabel } from '../utils/nearBuyBand';

interface NearBuyBandPanelProps {
  results: TradeResult[];
  plusPct: number;
  minusPct: number;
}

export default function NearBuyBandPanel({ results, plusPct, minusPct }: NearBuyBandPanelProps) {
  const top10 = getTop10NearBuyBand(results, plusPct, minusPct);

  if (top10.length === 0) return null;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Top 10 — Nearest to +{plusPct}% / -{minusPct}% from Buy Price
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Latest close vs month-high buy price. Sorted by closest to +{plusPct}% or -{minusPct}% band.
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Symbol</TableCell>
              <TableCell align="right">Buy Price</TableCell>
              <TableCell align="right">Latest Close</TableCell>
              <TableCell align="right">% From Buy</TableCell>
              <TableCell align="right">
                Dist to +{plusPct}% / -{minusPct}%
              </TableCell>
              <TableCell>Nearest Band</TableCell>
              <TableCell>Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {top10.map((row, i) => (
              <TableRow key={row.symbol}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{row.symbol}</TableCell>
                <TableCell align="right">{row.buyPrice?.toFixed(2)}</TableCell>
                <TableCell align="right">{row.latestClosePrice?.toFixed(2)}</TableCell>
                <TableCell align="right">
                  {row.pctFromBuyPrice != null ? formatPercent(row.pctFromBuyPrice) : '—'}
                </TableCell>
                <TableCell align="right">
                  {row.distToNearBand != null ? `${row.distToNearBand.toFixed(2)}%` : '—'}
                </TableCell>
                <TableCell>{nearestBandLabel(row.pctFromBuyPrice, plusPct, minusPct)}</TableCell>
                <TableCell>{row.result}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
