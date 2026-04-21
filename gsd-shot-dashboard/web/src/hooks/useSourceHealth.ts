'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SourceHealthResponse } from '@/lib/schema';

export function useSourceHealth() {
  return useQuery({
    queryKey: ['sources', 'health'],
    queryFn: async () => SourceHealthResponse.parse(await api.sourceHealth()),
    refetchInterval: 10_000,
    staleTime: 9_000,
    retry: 1,
  });
}
