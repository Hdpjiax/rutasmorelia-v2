'use client';

import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastStore {
  items: ToastItem[];
  push: (input: Omit<ToastItem, 'id' | 'createdAt'> & { durationMs?: number }) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push: ({ durationMs = 4200, ...input }) => {
    const id = `toast-${++counter}-${Date.now()}`;
    const item: ToastItem = { ...input, id, createdAt: Date.now() };
    set({ items: [...get().items, item] });
    if (durationMs > 0) {
      window.setTimeout(() => get().dismiss(id), durationMs);
    }
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export function toast(
  message: string,
  variant: ToastVariant = 'info',
  title?: string
) {
  useToastStore.getState().push({ message, variant, title });
}