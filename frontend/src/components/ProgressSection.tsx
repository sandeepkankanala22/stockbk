import { Paper, Typography, LinearProgress, Box, Chip } from '@mui/material';
import type { JobProgress, JobStatus } from '../types';
import { formatEta } from '../utils/formatters';

interface ProgressSectionProps {
  status: JobStatus;
  progress: JobProgress | null;
}

export default function ProgressSection({ status, progress }: ProgressSectionProps) {
  if (!progress || (status !== 'queued' && status !== 'running')) {
    return null;
  }

  const remaining = progress.total - progress.completed;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Processing Backtest</Typography>
        <Chip label={status.toUpperCase()} color={status === 'running' ? 'primary' : 'default'} />
      </Box>

      <LinearProgress
        variant="determinate"
        value={progress.percentComplete}
        sx={{ height: 10, borderRadius: 5, mb: 2 }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <Typography variant="body2">
          Current Symbol: <strong>{progress.currentSymbol || '-'}</strong>
        </Typography>
        <Typography variant="body2">
          Completed: <strong>{progress.completed}</strong> / {progress.total}
        </Typography>
        <Typography variant="body2">
          Remaining: <strong>{remaining}</strong>
        </Typography>
        <Typography variant="body2">
          Progress: <strong>{progress.percentComplete.toFixed(1)}%</strong>
        </Typography>
        <Typography variant="body2">
          ETA: <strong>{formatEta(progress.etaSeconds)}</strong>
        </Typography>
      </Box>
    </Paper>
  );
}
