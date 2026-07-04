"use client";
import { usePlayerStore } from "@/store/playerStore";

/** Thin accessor over the global player store. */
export function usePlayer() {
  const state = usePlayerStore();
  return {
    ...state,
    play: () => state.set({ isPlaying: true }),
    pause: () => state.set({ isPlaying: false }),
    setVolume: (volume: number) => state.set({ volume, isMuted: volume === 0 }),
    toggleMute: () => state.set({ isMuted: !state.isMuted }),
    setQuality: (quality: string) => state.set({ quality }),
  };
}
