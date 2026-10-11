"use client";

import { create } from "zustand";

export interface AssistantDraft {
  /** Increments per request so the same question can be prefilled twice. */
  id: number;
  text: string;
}

interface AssistantState {
  isOpen: boolean;
  /** Question to place in the chat input when the assistant opens. */
  draft: AssistantDraft | null;
  open: (draft?: string) => void;
  close: () => void;
  toggle: () => void;
}

export const useAssistantStore = create<AssistantState>()((set, get) => ({
  isOpen: false,
  draft: null,
  open: (draft) => {
    const text = draft?.trim();
    set({
      isOpen: true,
      draft: text ? { id: (get().draft?.id ?? 0) + 1, text } : get().draft
    });
  },
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen })
}));
