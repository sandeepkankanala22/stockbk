import { useMutation } from '@tanstack/react-query';
import { uploadFile } from '../services/api';
import type { UploadResponse } from '../types';

export function useUpload() {
  return useMutation<UploadResponse, Error, File>({
    mutationFn: uploadFile,
  });
}
