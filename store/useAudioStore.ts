"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AudioState = {
  isMuted: boolean;
  toggleMuted: () => void;
  setMuted: (muted: boolean) => void;
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set: (partial: Partial<AudioState> | ((state: AudioState) => Partial<AudioState>)) => void) => ({
      isMuted: true,
      toggleMuted: () => set((state: AudioState) => ({ isMuted: !state.isMuted })),
      setMuted: (muted: boolean) => set({ isMuted: muted }),
    }),
    {
      name: "velmere-audio-preference-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
