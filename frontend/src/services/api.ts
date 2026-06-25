import axios from 'axios';
import type {
  BacktestRequest,
  BacktestStartResponse,
  MlAnalyzeResponse,
  ModelInfo,
  ResultsResponse,
  ScannerOptionsResponse,
  ScannerResultsResponse,
  ScannerRunRequest,
  ScannerStartResponse,
  ScannerStatusResponse,
  ScannerSymbolSearchResponse,
  StatusResponse,
  UploadResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        return Promise.reject(
          new Error('Cannot reach backend. Run npm run dev and ensure port 3001 is up.')
        );
      }
      const data = error.response.data as { message?: string; code?: string } | undefined;
      const message = data?.message ?? error.message;
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error instanceof Error ? error : new Error('Request failed'));
  }
);

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<UploadResponse>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function startBacktest(request: BacktestRequest): Promise<BacktestStartResponse> {
  const { data } = await api.post<BacktestStartResponse>('/backtest', request);
  return data;
}

export async function getJobStatus(jobId: string): Promise<StatusResponse> {
  const { data } = await api.get<StatusResponse>('/status', { params: { jobId } });
  return data;
}

export async function getResults(jobId: string): Promise<ResultsResponse> {
  const { data } = await api.get<ResultsResponse>('/results', { params: { jobId } });
  return data;
}

export async function resetState(): Promise<void> {
  await api.post('/reset');
}

export function getExportExcelUrl(jobId: string): string {
  return `/api/export/excel?jobId=${encodeURIComponent(jobId)}`;
}

export function getExportCsvUrl(jobId: string): string {
  return `/api/export/csv?jobId=${encodeURIComponent(jobId)}`;
}

export async function getModelInfo(): Promise<{ model: ModelInfo | null }> {
  const { data } = await api.get<{ model: ModelInfo | null }>('/ml/model');
  return data;
}

export async function analyzeWithMl(jobId: string): Promise<MlAnalyzeResponse> {
  const { data } = await api.post<MlAnalyzeResponse>('/ml/analyze', { jobId });
  return data;
}

export async function searchScannerSymbols(q: string): Promise<ScannerSymbolSearchResponse> {
  const { data } = await api.get<ScannerSymbolSearchResponse>('/scanner/symbols/search', {
    params: { q },
  });
  return data;
}

export async function getScannerOptions(): Promise<ScannerOptionsResponse> {
  const { data } = await api.get<ScannerOptionsResponse>('/scanner/options');
  return data;
}

export async function startScanner(request: ScannerRunRequest): Promise<ScannerStartResponse> {
  const { data } = await api.post<ScannerStartResponse>('/scanner/run', request);
  return data;
}

export async function getScannerStatus(jobId: string): Promise<ScannerStatusResponse> {
  const { data } = await api.get<ScannerStatusResponse>('/scanner/status', { params: { jobId } });
  return data;
}

export async function getScannerResults(jobId: string): Promise<ScannerResultsResponse> {
  const { data } = await api.get<ScannerResultsResponse>('/scanner/results', { params: { jobId } });
  return data;
}

export function getScannerExportCsvUrl(jobId: string): string {
  return `/api/scanner/export/csv?jobId=${encodeURIComponent(jobId)}`;
}

export default api;
