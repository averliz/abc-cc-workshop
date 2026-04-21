'use client';
import { useUIStore } from '@/state/ui';
import { absolute } from '@/lib/time';
import { styleFor } from '@/lib/source-style';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function ItemDetail() {
  const selected = useUIStore((s) => s.selected);
  const select = useUIStore((s) => s.select);
  const open = selected !== null;
  const style = selected ? styleFor(selected.source_type) : null;

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) select(null);
      }}
    >
      <DrawerContent data-testid="item-detail">
        {selected && style && (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <style.icon className="size-4" aria-hidden /> {selected.title ?? '(untitled)'}
              </DrawerTitle>
              <DrawerDescription>
                {selected.source_id} · {absolute(selected.ingested_at)}
                {selected.author ? ` · by ${selected.author}` : ''}
              </DrawerDescription>
            </DrawerHeader>
            <Separator />
            <div className="space-y-3 px-6 py-4 max-h-[60vh] overflow-auto">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Source timestamp
                </div>
                <div className="text-sm" data-testid="detail-timestamp">
                  {absolute(selected.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Original link
                </div>
                <a
                  data-testid="detail-link"
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-primary underline"
                >
                  {selected.source_url}
                </a>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Content</div>
                <div
                  className="whitespace-pre-wrap text-sm"
                  data-testid="detail-content"
                >
                  {selected.content}
                </div>
              </div>
              {selected.tags.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Tags</div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {selected.tags.map((t) => (
                      <span key={t} className="rounded bg-secondary px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
