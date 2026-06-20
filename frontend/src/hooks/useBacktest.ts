import { useMutation } from '@tanstack/react-query';
import { startBacktest } from '../services/api';
import type { BacktestRequest, BacktestStartResponse } from '../types';

export function useBacktest() {
  return useMutation<BacktestStartResponse, Error, BacktestRequest>({
    mutationFn: startBacktest,
  });
}
