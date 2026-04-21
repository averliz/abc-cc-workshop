'use client';
import { memo } from 'react';
import { styleFor } from '@/lib/source-style';
import { relative } from '@/lib/time';
import type { SignalEventDTO } from '@/lib/schema';
import { cn } from '@/lib/utils';

export const FeedCard = memo(function FeedCard({
  signal,
  onClick,
}: {
  signal: SignalEventDTO;
  onClick: () => void;
}) {
  const style = styleFor(signal.source_type);
  const Icon = style.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="feed-card"
      data-signal-id={signal.id}
      className={cn(
        'block w-full text-left border-l-4 border border-border bg-card px-4 py-3 mx-2 my-1 rounded-md',
        'hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
        style.borderClass,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        <span className="font-medium">{style.label}</span>
        <span>·</span>
        <span className="truncate">{signal.source_id}</span>
        <span className="ml-auto whitespace-nowrap">{relative(signal.ingested_at)}</span>
      </div>
      {signal.title && (
        <div className="mt-1 truncate text-sm font-semibold text-foreground">
          {signal.title}
        </div>
      )}
      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {signal.content}
      </div>
    </button>
  );
});
