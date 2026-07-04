import { create } from "zustand";

interface PlayerState {
  currentChannelId: string | null;
  currentVideoId: string | null;
  isPlaying: boolean;
  volume: number;
  set: (patch: Partial<Omit<PlayerState, "set">>) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentChannelId: null,
  currentVideoId: null,
  isPlaying: true,
  volume: 1,
  set: (patch) => set(patch),
}));
