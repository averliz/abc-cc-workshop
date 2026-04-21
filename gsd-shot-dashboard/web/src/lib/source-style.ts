import { Rss, MessageSquare, Hash, Send, Code2, Globe } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type SourceStyle = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  borderClass: string;
  label: string;
};

const STYLES: Record<string, SourceStyle> = {
  rss: { icon: Rss, borderClass: 'border-l-orange-500', label: 'RSS' },
  reddit: { icon: MessageSquare, borderClass: 'border-l-rose-500', label: 'Reddit' },
  hn: { icon: Hash, borderClass: 'border-l-amber-500', label: 'HN' },
  telegram: { icon: Send, borderClass: 'border-l-sky-500', label: 'Telegram' },
  paste: { icon: Code2, borderClass: 'border-l-violet-500', label: 'Paste' },
};
const DEFAULT: SourceStyle = {
  icon: Globe,
  borderClass: 'border-l-zinc-500',
  label: 'Signal',
};

export function styleFor(sourceType: string): SourceStyle {
  return STYLES[sourceType] ?? DEFAULT;
}
