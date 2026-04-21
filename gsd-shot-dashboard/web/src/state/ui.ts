import { create } from 'zustand';
import type { SignalEventDTO } from '@/lib/schema';

type UIStore = {
  isPaused: boolean;
  togglePaused: () => void;
  selected: SignalEventDTO | null;
  select: (s: SignalEventDTO | null) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  isPaused: false,
  togglePaused: () => set((s) => ({ isPaused: !s.isPaused })),
  selected: null,
  select: (s) => set({ selected: s }),
}));
