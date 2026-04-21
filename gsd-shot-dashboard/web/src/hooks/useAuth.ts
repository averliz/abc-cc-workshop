'use client';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { UserOut } from '@/lib/schema';

export function useMe() {
  return useQuery<UserOut | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}
