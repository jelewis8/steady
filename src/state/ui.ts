import { create } from 'zustand';
import type { Undo } from '../data/repo';

export interface Toast {
  id: number;
  message: string;
  undo?: Undo;
  tone?: 'info' | 'reminder';
}

interface UIState {
  toasts: Toast[];
  quickLogOpen: boolean;
  locked: boolean;
  seizureTimerOpen: boolean;
  suggestSafeMode: boolean;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setQuickLog: (open: boolean) => void;
  setLocked: (locked: boolean) => void;
  setSeizureTimer: (open: boolean) => void;
  setSuggestSafeMode: (v: boolean) => void;
}

let nextId = 1;

/**
 * Toasts never auto-dismiss (blueprint §2.1 #5: "nothing expires, nothing auto-dismisses").
 * We keep at most three so the stack never grows unbounded.
 */
export const useUI = create<UIState>((set) => ({
  toasts: [],
  quickLogOpen: false,
  locked: false,
  seizureTimerOpen: false,
  suggestSafeMode: false,
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: nextId++ }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setQuickLog: (quickLogOpen) => set({ quickLogOpen }),
  setLocked: (locked) => set({ locked }),
  setSeizureTimer: (seizureTimerOpen) => set({ seizureTimerOpen }),
  setSuggestSafeMode: (suggestSafeMode) => set({ suggestSafeMode }),
}));

export const toast = (message: string, undo?: Undo) => useUI.getState().pushToast({ message, undo });
