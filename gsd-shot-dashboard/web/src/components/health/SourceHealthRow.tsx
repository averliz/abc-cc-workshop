'use client';
import { styleFor } from '@/lib/source-style';
import { relative } from '@/lib/time';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SourceHealthDTO } from '@/lib/schema';

// status values: healthy | degraded | failed
const STATUS_CLASS: Record<SourceHealthDTO['status'], string> = {
  healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  failed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export function SourceHealthRow({ s }: { s: SourceHealthDTO }) {
  const style = styleFor(s.source_type);
  const Icon = style.icon;
  return (
    <li
      data-testid="health-row"
      data-source-id={s.source_id}
      className="rounded-md border border-border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden />
        <span className="truncate text-sm font-medium">{s.source_id}</span>
        <Badge
          data-testid="health-status"
          data-status={s.status}
          className={cn('ml-auto border', STATUS_CLASS[s.status])}
        >
          {s.status}
        </Badge>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
        <dt>Last fetch</dt>
        <dd data-testid="health-last-fetch">
          {s.last_fetch_at ? relative(s.last_fetch_at) : '—'}
        </dd>
        <dt>Errors (1h)</dt>
        <dd data-testid="health-error-count">{s.error_count_1h}</dd>
        <dt>Items/min</dt>
        <dd data-testid="health-throughput">{s.throughput_per_min.toFixed(1)}</dd>
        {s.last_error && (
          <>
            <dt className="col-span-2 pt-1 text-destructive">Last error</dt>
            <dd
              className="col-span-2 truncate text-destructive"
              title={s.last_error}
            >
              {s.last_error}
            </dd>
          </>
        )}
      </dl>
    </li>
  );
}
