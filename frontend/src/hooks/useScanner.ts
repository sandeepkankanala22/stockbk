import { useMutation, useQuery } from '@tanstack/react-query';
import type { ScannerRunRequest } from '../types';
import {
  getScannerOptions,
  getScannerResults,
  getScannerStatus,
  searchScannerSymbols,
  startScanner,
} from '../services/api';

export function useScannerOptions() {
  return useQuery({
    queryKey: ['scanner-options'],
    queryFn: getScannerOptions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSymbolSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['scanner-symbol-search', trimmed],
    queryFn: () => searchScannerSymbols(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useStartScanner() {
  return useMutation({
    mutationFn: (request: ScannerRunRequest) => startScanner(request),
  });
}

export function useScannerJob(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['scanner-status', jobId],
    queryFn: () => getScannerStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 1500;
    },
  });
}

export function useScannerResults(jobId: string | null, fetch: boolean) {
  return useQuery({
    queryKey: ['scanner-results', jobId],
    queryFn: () => getScannerResults(jobId!),
    enabled: fetch && !!jobId,
  });
}
