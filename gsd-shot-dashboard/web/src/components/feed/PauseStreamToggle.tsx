'use client';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/state/ui';

export function PauseStreamToggle() {
  const isPaused = useUIStore((s) => s.isPaused);
  const toggle = useUIStore((s) => s.togglePaused);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      data-testid="pause-toggle"
      aria-pressed={isPaused}
    >
      {isPaused ? (
        <>
          <Play className="size-3.5 mr-1" /> Resume
        </>
      ) : (
        <>
          <Pause className="size-3.5 mr-1" /> Pause
        </>
      )}
    </Button>
  );
}
