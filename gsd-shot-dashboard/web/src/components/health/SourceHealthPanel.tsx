'use client';
import { useSourceHealth } from '@/hooks/useSourceHealth';
import { SourceHealthRow } from './SourceHealthRow';

export function SourceHealthPanel() {
  const { data, isLoading, isError, error } = useSourceHealth();
  return (
    <aside
      data-testid="source-health-panel"
      className="w-80 shrink-0 border-l border-border bg-background/50 p-4 overflow-auto"
      aria-label="Source health"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Sources
      </h2>
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {isError && (
        <div role="alert" className="text-sm text-destructive">
          Error: {String((error as Error)?.message ?? error)}
        </div>
      )}
      {data && (
        <ul className="space-y-2">
          {data.sources.map((s) => (
            <SourceHealthRow key={s.source_id} s={s} />
          ))}
          {data.sources.length === 0 && (
            <li className="text-sm text-muted-foreground">No sources configured.</li>
          )}
        </ul>
      )}
    </aside>
  );
}
