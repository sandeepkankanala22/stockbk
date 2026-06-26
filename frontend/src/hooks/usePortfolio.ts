import { useMutation } from '@tanstack/react-query';
import { simulateBacktestPortfolio, simulatePortfolio } from '../services/api';
import type { BacktestPortfolioRequest, PortfolioSimRequest } from '../types';

export function useBacktestPortfolioSimulation() {
  return useMutation({
    mutationFn: (request: BacktestPortfolioRequest) => simulateBacktestPortfolio(request),
  });
}

export function usePortfolioSimulation() {
  return useMutation({
    mutationFn: (request: PortfolioSimRequest) => simulatePortfolio(request),
  });
}
