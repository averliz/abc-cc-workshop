'use client';
import { experimental_streamedQuery as streamedQuery, useQuery } from '@tanstack/react-query';
import { SignalEventDTO } from '@/lib/schema';

const MAX_CACHE = 5000;
const SSE_URL = '/api/stream';

async function* sseIterator(signal: AbortSignal): AsyncIterable<SignalEventDTO[]> {
  const es = new EventSource(SSE_URL, { withCredentials: true });
  const queue: SignalEventDTO[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  let lastError: unknown = null;

  const onSignal = (e: MessageEvent) => {
    try {
      const parsed = SignalEventDTO.parse(JSON.parse(e.data));
      queue.push(parsed);
      wake?.();
      wake = null;
    } catch (err) {
      console.warn('SSE payload failed zod parse', err);
    }
  };
  const onError = (e: Event) => {
    // EventSource auto-reconnects on network blips; a permanent error sets readyState=CLOSED
    if (es.readyState === EventSource.CLOSED) {
      lastError = e;
      done = true;
      wake?.();
      wake = null;
    }
  };

  es.addEventListener('signal', onSignal as EventListener);
  es.addEventListener('error', onError as EventListener);

  const abortHandler = () => {
    done = true;
    es.close();
    wake?.();
    wake = null;
  };
  signal.addEventListener('abort', abortHandler, { once: true });

  try {
    while (!done) {
      if (queue.length === 0) {
        await new Promise<void>((r) => {
          wake = r;
        });
        continue;
      }
      yield queue.splice(0);
    }
    if (lastError) throw lastError;
  } finally {
    es.removeEventListener('signal', onSignal as EventListener);
    es.removeEventListener('error', onError as EventListener);
    signal.removeEventListener('abort', abortHandler);
    es.close();
  }
}

export function useSignalStream() {
  return useQuery<SignalEventDTO[]>({
    queryKey: ['signals', 'stream'],
    queryFn: streamedQuery({
      streamFn: ({ signal }) => sseIterator(signal),
      refetchMode: 'append',
      reducer: (acc: SignalEventDTO[], chunk: SignalEventDTO[]) => {
        // newest-first; dedupe on id to protect against Last-Event-ID replay overlap
        const seen = new Set(acc.map((s) => s.id));
        const fresh = chunk.filter((s) => !seen.has(s.id));
        return [...fresh, ...acc].slice(0, MAX_CACHE);
      },
      initialValue: [] as SignalEventDTO[],
    }),
    staleTime: Infinity,
    retry: false,
  });
}
