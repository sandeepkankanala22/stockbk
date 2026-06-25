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
import type { SymbolDuplicateNote } from '../types';
import { SYMBOL_REAPPEAR_MONTHS, filterReappearedDuplicateNotes } from '../utils/symbolDateSelection';

export default function DuplicateSymbolsPanel({ notes }: { notes: SymbolDuplicateNote[] }) {
  const reappeared = filterReappearedDuplicateNotes(notes);
  if (reappeared.length === 0) return null;

  return (
    <Paper sx={{ p: 2, mt: 2, borderLeft: 4, borderColor: 'info.main' }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Reappeared symbols — {SYMBOL_REAPPEAR_MONTHS}+ months apart
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Only symbols kept twice (or more) under the rolling {SYMBOL_REAPPEAR_MONTHS}-month rule.
        Near-duplicate uploads within {SYMBOL_REAPPEAR_MONTHS} months are not listed here.
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Appearance</TableCell>
              <TableCell>Min Date</TableCell>
              <TableCell align="right">Mo. from last kept</TableCell>
              <TableCell>Backtest Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reappeared.flatMap((note) =>
              note.entries.map((entry, idx) => {
                const result = note.results?.find((r) => r.minDate === entry.date);
                return (
                  <TableRow key={`${note.symbol}-${entry.date}`} hover>
                    <TableCell>{idx === 0 ? note.symbol : ''}</TableCell>
                    <TableCell>
                      {idx + 1}
                      {idx === 0 ? ' (first)' : ''}
                    </TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell align="right">{entry.monthsFromLastKept}</TableCell>
                    <TableCell>
                      {result ? (
                        <>
                          <Typography variant="body2" component="span" fontWeight={600}>
                            {result.result}
                          </Typography>
                          {result.pctFromBuyPrice != null && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {result.pctFromBuyPrice >= 0 ? '+' : ''}
                              {result.pctFromBuyPrice.toFixed(2)}% from buy
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
