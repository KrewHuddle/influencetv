import { create } from "zustand";

interface PlayerState {
  isPlaying: boolean;
  currentChannelId: string | null;
  currentVideoId: string | null;
  volume: number;
  isMuted: boolean;
  quality: string;
  set: (patch: Partial<Omit<PlayerState, "set">>) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  currentChannelId: null,
  currentVideoId: null,
  volume: 1,
  isMuted: false,
  quality: "auto",
  set: (patch) => set(patch),
}));
