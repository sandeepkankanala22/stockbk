import { useMutation } from '@tanstack/react-query';
import { analyzeWithMl, getModelInfo } from '../services/api';

export function useModelInfo(enabled = true) {
  return useMutation({
    mutationFn: () => getModelInfo(),
    mutationKey: ['modelInfo'],
    ...(enabled ? {} : {}),
  });
}

export function useMlAnalyze() {
  return useMutation({
    mutationFn: (jobId: string) => analyzeWithMl(jobId),
  });
}
