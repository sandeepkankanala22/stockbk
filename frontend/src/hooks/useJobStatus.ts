import { useQuery } from '@tanstack/react-query';
import { getJobStatus } from '../services/api';
import type { JobStatus, StatusResponse } from '../types';

export function useJobStatus(jobId: string | null, enabled: boolean) {
  return useQuery<StatusResponse>({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as JobStatus | undefined;
      if (status === 'completed' || status === 'failed') return false;
      return 1000;
    },
  });
}
