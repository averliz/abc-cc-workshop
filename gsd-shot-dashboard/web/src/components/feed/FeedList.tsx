'use client';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSignalStream } from '@/hooks/useSignalStream';
import { useUIStore } from '@/state/ui';
import { FeedCard } from './FeedCard';
import { PauseStreamToggle } from './PauseStreamToggle';
import type { SignalEventDTO } from '@/lib/schema';

export function FeedList() {
  const { data = [], isLoading, isError, error } = useSignalStream();
  const parentRef = useRef<HTMLDivElement>(null);
  const select = useUIStore((s) => s.select);
  const isPaused = useUIStore((s) => s.isPaused);

  // Freeze the visible list while paused (D-03): capture the list length at the moment
  // of pausing via a stable ref.
  const frozenRef = useRef<SignalEventDTO[] | null>(null);
  if (isPaused && frozenRef.current === null) frozenRef.current = data;
  if (!isPaused && frozenRef.current !== null) frozenRef.current = null;
  const items = frozenRef.current ?? data;

  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (i) => items[i].id,
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="text-sm text-muted-foreground" data-testid="feed-count">
          {items.length} signal{items.length === 1 ? '' : 's'}
          {isPaused ? ' · paused' : ''}
        </div>
        <PauseStreamToggle />
      </div>
      {isError && (
        <div role="alert" className="px-4 py-2 text-sm text-destructive">
          Stream error: {String((error as Error)?.message ?? error)}
        </div>
      )}
      <div
        ref={parentRef}
        data-testid="feed-scroller"
        className="flex-1 overflow-auto"
      >
        {items.length === 0 && !isLoading && (
          <div className="p-8 text-center text-muted-foreground">
            Waiting for signals…
          </div>
        )}
        <div
          style={{ height: v.getTotalSize(), width: '100%', position: 'relative' }}
        >
          {v.getVirtualItems().map((row) => (
            <div
              key={row.key}
              ref={v.measureElement}
              data-index={row.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <FeedCard
                signal={items[row.index]}
                onClick={() => select(items[row.index])}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
