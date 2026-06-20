import {
  Paper,
  Typography,
  Button,
  Grid,
  Box,
  Chip,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import type { MLPredictionSummary, ModelInfo } from '../types';

interface PredictionPanelProps {
  jobId: string;
  model: ModelInfo | null;
  summary: MLPredictionSummary | null;
  isLoading: boolean;
  onAnalyze: () => void;
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}

export default function PredictionPanel({
  jobId,
  model,
  summary,
  isLoading,
  onAnalyze,
}: PredictionPanelProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <PsychologyIcon color="primary" />
        <Typography variant="h6">ML Target Prediction</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trains a model on past TARGET vs STOPLOSS trades, then predicts which breakout stocks
        are more likely to hit <strong>target</strong> or <strong>stoploss</strong>. Results
        appear in the <strong>ML Stock Decisions &amp; Reasons</strong> table below.
      </Typography>

      <Button
        variant="contained"
        color="secondary"
        onClick={onAnalyze}
        disabled={isLoading || !jobId}
        startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <PsychologyIcon />}
        sx={{ mb: 2 }}
      >
        {isLoading ? 'Training & Predicting…' : 'Train Model & Predict'}
      </Button>

      {!model && !summary && !isLoading && (
        <Alert severity="info">
          Run a backtest first, then click Train Model & Predict. Requires at least 10 closed
          trades (TARGET or STOPLOSS).
        </Alert>
      )}

      {model && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Model v{model.version} — trained {new Date(model.trainedAt).toLocaleString()}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <MetricChip label="Train Accuracy" value={`${model.metrics.accuracy}%`} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricChip label="Precision" value={`${model.metrics.precision}%`} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricChip label="Recall" value={`${model.metrics.recall}%`} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricChip label="AUC" value={model.metrics.auc} />
            </Grid>
          </Grid>
        </Box>
      )}

      {summary && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Prediction Summary
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${summary.totalPredictions} predictions`} />
            <Chip label={`${summary.predictedTargets} → TARGET`} color="success" variant="outlined" />
            <Chip label={`${summary.predictedStoplosses} → STOPLOSS`} color="error" variant="outlined" />
            <Chip label={`${summary.highConfidence} high confidence`} color="primary" variant="outlined" />
            {summary.accuracyOnClosed != null && (
              <Chip
                label={`${summary.accuracyOnClosed}% match on closed trades`}
                color={summary.accuracyOnClosed >= 55 ? 'success' : 'warning'}
              />
            )}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
