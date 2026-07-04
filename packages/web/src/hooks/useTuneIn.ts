"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

export interface NowPlaying {
  title: string;
  hlsUrl: string | null;
  thumbnail: string | null;
  elapsedSeconds: number;
  remainingSeconds: number;
}

/** Fetch a channel's current program for tune-in sync (seek offset). */
export function useTuneIn(channelId: string | null) {
  const { data, error, isLoading } = useSWR<{ item: NowPlaying | null }>(
    channelId ? `/api/channels/${channelId}/now-playing` : null,
    swrFetcher,
    { refreshInterval: 30_000 }
  );

  return {
    currentItem: data?.item ?? null,
    elapsedSeconds: data?.item?.elapsedSeconds ?? 0,
    isLive: Boolean(data?.item),
    isLoading,
    error,
  };
}
