import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Grid,
  Button,
  Stack,
  Snackbar,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UploadSection from '../components/UploadSection';
import ConfigInputs from '../components/ConfigInputs';
import ProgressSection from '../components/ProgressSection';
import SummaryCards from '../components/SummaryCards';
import ResultsGrid from '../components/ResultsGrid';
import ExportPanel from '../components/ExportPanel';
import PredictionPanel from '../components/PredictionPanel';
import MlDecisionsView from '../components/MlDecisionsView';
import { useUpload } from '../hooks/useUpload';
import { useBacktest } from '../hooks/useBacktest';
import { useJobStatus } from '../hooks/useJobStatus';
import { useMlAnalyze } from '../hooks/useMlAnalyze';
import { getResults, resetState } from '../services/api';
import type { BacktestConfig, MLPredictionSummary, ModelInfo, ResultsResponse, UploadResponse } from '../types';

const defaultConfig: BacktestConfig = {
  targetPercent: 30,
  stoplossPercent: 30,
  sameDayHitMode: 'STOPLOSS_FIRST',
  investmentAmount: 100000,
  nearBuyPlusPct: 10,
  nearBuyMinusPct: 10,
};

export default function BacktestPage() {
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [uploadInfo, setUploadInfo] = useState<UploadResponse | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<ResultsResponse | null>(null);
  const [mlModel, setMlModel] = useState<ModelInfo | null>(null);
  const [mlSummary, setMlSummary] = useState<MLPredictionSummary | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const uploadMutation = useUpload();
  const backtestMutation = useBacktest();
  const mlAnalyzeMutation = useMlAnalyze();
  const { data: statusData } = useJobStatus(jobId, isRunning);

  const handleFileSelected = useCallback(
    (file: File) => {
      uploadMutation.mutate(file, {
        onSuccess: (data) => {
          setUploadInfo(data);
          setResultsData(null);
          setJobId(null);
          setMlModel(null);
          setMlSummary(null);
          setShowPredictions(false);
          setSnackbar({ message: `Uploaded ${data.validRows} valid rows`, severity: 'success' });
        },
        onError: (err) => {
          setSnackbar({ message: err.message, severity: 'error' });
        },
      });
    },
    [uploadMutation]
  );

  const handleRunBacktest = () => {
    if (!uploadInfo?.uploadId) {
      setSnackbar({ message: 'Please upload an Excel file first', severity: 'error' });
      return;
    }

    if (config.targetPercent < 0 || config.targetPercent > 100) {
      setSnackbar({ message: 'Target must be between 0 and 100', severity: 'error' });
      return;
    }

    if (config.stoplossPercent < 0 || config.stoplossPercent > 100) {
      setSnackbar({ message: 'Stoploss must be between 0 and 100', severity: 'error' });
      return;
    }

    if (!config.investmentAmount || config.investmentAmount <= 0) {
      setSnackbar({ message: 'Investment amount must be greater than 0', severity: 'error' });
      return;
    }

    if (config.nearBuyPlusPct < 0 || config.nearBuyPlusPct > 100) {
      setSnackbar({ message: 'Near buy plus band must be between 0 and 100', severity: 'error' });
      return;
    }

    if (config.nearBuyMinusPct < 0 || config.nearBuyMinusPct > 100) {
      setSnackbar({ message: 'Near buy minus band must be between 0 and 100', severity: 'error' });
      return;
    }

    setResultsData(null);
    setMlModel(null);
    setMlSummary(null);
    setShowPredictions(false);
    setIsRunning(true);

    backtestMutation.mutate(
      { uploadId: uploadInfo.uploadId, ...config },
      {
        onSuccess: (data) => {
          setJobId(data.jobId);
          setSnackbar({
            message: `Backtest started for ${data.symbolCount} symbols`,
            severity: 'info',
          });
        },
        onError: (err) => {
          setIsRunning(false);
          setSnackbar({ message: err.message, severity: 'error' });
        },
      }
    );
  };

  useEffect(() => {
    if (!jobId || !statusData) return;

    if (statusData.status === 'completed') {
      setIsRunning(false);
      getResults(jobId)
        .then((data) => {
          setResultsData(data);
          setSnackbar({ message: 'Backtest completed successfully', severity: 'success' });
        })
        .catch((err) => {
          setSnackbar({ message: err.message, severity: 'error' });
        });
    } else if (statusData.status === 'failed') {
      setIsRunning(false);
      setSnackbar({
        message: statusData.errorMessage ?? 'Backtest failed',
        severity: 'error',
      });
    }
  }, [jobId, statusData?.status, statusData?.errorMessage]);

  const handleReset = async () => {
    try {
      await resetState();
      setUploadInfo(null);
      setJobId(null);
      setResultsData(null);
      setMlModel(null);
      setMlSummary(null);
      setShowPredictions(false);
      setIsRunning(false);
      setConfig(defaultConfig);
      setSnackbar({ message: 'Reset complete', severity: 'info' });
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Reset failed',
        severity: 'error',
      });
    }
  };

  const handleMlAnalyze = () => {
    if (!jobId) return;

    mlAnalyzeMutation.mutate(jobId, {
      onSuccess: (data) => {
        setMlModel(data.model);
        setMlSummary(data.summary);
        setShowPredictions(true);
        setResultsData((prev) =>
          prev ? { ...prev, results: data.results } : prev
        );
        setSnackbar({
          message: `ML model trained — ${data.summary.totalPredictions} predictions generated`,
          severity: 'success',
        });
      },
      onError: (err) => {
        setSnackbar({ message: err.message, severity: 'error' });
      },
    });
  };

  const busy = isRunning || uploadMutation.isPending || backtestMutation.isPending || mlAnalyzeMutation.isPending;

  return (
    <>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <UploadSection
              onFileSelected={handleFileSelected}
              uploadInfo={uploadInfo}
              disabled={busy}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ConfigInputs config={config} onChange={setConfig} disabled={busy} />
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={handleRunBacktest}
                disabled={busy || !uploadInfo}
              >
                Run Backtest
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<RestartAltIcon />}
                onClick={() => void handleReset()}
                disabled={busy}
              >
                Reset
              </Button>
            </Stack>
          </Grid>
        </Grid>

        <ProgressSection
          status={statusData?.status ?? 'queued'}
          progress={statusData?.progress ?? null}
        />

        {resultsData?.summary && resultsData.results && (
          <SummaryCards
            summary={resultsData.summary}
            results={resultsData.results}
            config={resultsData.config ?? config}
            benchmark={resultsData.benchmark ?? null}
            duplicateSymbolNotes={resultsData.duplicateSymbolNotes ?? []}
            nearBuyPlusPct={resultsData.config?.nearBuyPlusPct ?? config.nearBuyPlusPct}
            nearBuyMinusPct={resultsData.config?.nearBuyMinusPct ?? config.nearBuyMinusPct}
          />
        )}

        {jobId && resultsData && (
          <ExportPanel jobId={jobId} />
        )}

        {jobId && resultsData?.status === 'completed' && (
          <PredictionPanel
            jobId={jobId}
            model={mlModel}
            summary={mlSummary}
            isLoading={mlAnalyzeMutation.isPending}
            onAnalyze={handleMlAnalyze}
          />
        )}

        {showPredictions && resultsData?.results && (
          <MlDecisionsView results={resultsData.results} />
        )}

        {resultsData?.results && resultsData.results.length > 0 && (
          <ResultsGrid
            results={resultsData.results}
            showPredictions={showPredictions}
            nearBuyPlusPct={resultsData.config?.nearBuyPlusPct ?? config.nearBuyPlusPct}
            nearBuyMinusPct={resultsData.config?.nearBuyMinusPct ?? config.nearBuyMinusPct}
          />
        )}

        {!resultsData && !isRunning && uploadInfo && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Configure parameters and click Run Backtest to start
            </Typography>
          </Box>
        )}
      </Container>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
          {snackbar?.message ?? ''}
        </Alert>
      </Snackbar>
    </>
  );
}
