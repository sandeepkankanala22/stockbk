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

interface OpenStocksPanelProps {
  results: TradeResult[];
}

export default function OpenStocksPanel({ results }: OpenStocksPanelProps) {
  const openStocks = results
    .filter((r) => r.result === 'OPEN' && r.buyPrice != null)
    .sort((a, b) => (b.pctFromBuyPrice ?? -Infinity) - (a.pctFromBuyPrice ?? -Infinity));

  if (openStocks.length === 0) return null;

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Open Positions ({openStocks.length})
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trades still open — neither target nor stop loss hit yet. % diff from month-high buy price
        (latest close).
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Buy Date</TableCell>
              <TableCell align="right">Buy Price</TableCell>
              <TableCell align="right">Latest Close</TableCell>
              <TableCell align="right">% From Buy</TableCell>
              <TableCell align="right">Days Open</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {openStocks.map((row) => (
              <TableRow key={`${row.symbol}-${row.minDate}`} hover>
                <TableCell>{row.symbol}</TableCell>
                <TableCell>{row.buyDate ?? '—'}</TableCell>
                <TableCell align="right">{row.buyPrice?.toFixed(2)}</TableCell>
                <TableCell align="right">{row.latestClosePrice?.toFixed(2) ?? '—'}</TableCell>
                <TableCell align="right">
                  {row.pctFromBuyPrice != null ? formatPercent(row.pctFromBuyPrice) : '—'}
                </TableCell>
                <TableCell align="right">{row.days ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
