"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, ArrowUpRight } from "lucide-react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { useTuneIn } from "@/hooks/useTuneIn";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Badge } from "@/components/ui/Badge";

interface HeroChannel {
  id: string;
  name: string;
  slug: string;
  status?: string;
  number?: number | null;
  current_show?: string | null;
  viewer_count?: number | null;
  thumbnail_url?: string | null;
  hls_output_url?: string | null;
}

const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/* The network channel plays at the top of Home instead of a static hero.
 * Player width is capped so its 16:9 height stays ~half the viewport; the
 * info strip sits BELOW the video so VideoPlayer's own controls (unmute /
 * quality) keep the whole frame. Playback pauses (player unmounts) when the
 * tab is hidden or the hero scrolls away — tune-in offset re-syncs on return. */
export function LiveHero() {
  const { data, isLoading } = useSWR<{ channels: HeroChannel[] }>(
    "/api/channels",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const channel =
    (data?.channels ?? []).find(
      (c) => c.status === "active" && c.hls_output_url
    ) ?? null;
  const {
    currentItem,
    elapsedSeconds,
    isLoading: tuneLoading,
  } = useTuneIn(channel?.id ?? null);

  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // re-runs when the live branch mounts (the early-return branches don't
  // carry the ref, so a mount-only effect would observe nothing)
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [channel?.id]);

  const playing = Boolean(channel) && inView && tabVisible;

  // Freeze the tune-in offset for the lifetime of one player mount:
  // VideoPlayer's source effect depends on startOffset, so feeding it the
  // 30s-polling elapsedSeconds would rebuild the stream every refresh.
  const [mountOffset, setMountOffset] = useState<number | null>(null);
  useEffect(() => {
    if (playing && !tuneLoading && mountOffset === null) {
      setMountOffset(elapsedSeconds);
    } else if (!playing && mountOffset !== null) {
      setMountOffset(null);
    }
  }, [playing, tuneLoading, elapsedSeconds, mountOffset]);

  const showTitle = currentItem?.title ?? channel?.current_show ?? null;

  /* loading: quiet charcoal band, no layout shift into either state */
  if (isLoading && !data) {
    return (
      <section className="w-full bg-black">
        <div className="mx-auto aspect-video w-full max-w-[calc(56vh*1.7778)] animate-shimmer bg-gradient-to-r from-itv-surface via-itv-surface2 to-itv-surface bg-[length:200%_100%]" />
      </section>
    );
  }

  /* fallback: no live channel (or no stream URL) — static artwork hero */
  if (!channel) {
    return (
      <section className="relative h-[300px] overflow-hidden md:h-[400px]">
        <div className="absolute inset-0 bg-gradient-to-br from-itv-bg via-itv-surface to-itv-surface" />
        <div
          className="absolute inset-y-0 right-0 w-3/5"
          style={{
            background:
              "radial-gradient(700px 460px at 68% 38%, color-mix(in oklch, var(--itv-accent) 32%, transparent), transparent 66%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-itv-bg via-itv-bg/85 to-transparent" />
        <div className="absolute bottom-0 left-0 z-10 flex max-w-md flex-col p-6 md:p-10">
          <span className="text-xs uppercase tracking-widest text-itv-muted">
            Influence TV Network
          </span>
          <h1 className="mt-3 font-display text-3xl font-black leading-[1.05] tracking-tight text-itv-text md:text-5xl">
            Live TV, creators, and shopping — one network
          </h1>
          <div className="mt-5">
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-md bg-itv-accent px-5 py-2.5 text-sm font-medium text-itv-bg transition-[background-color,box-shadow] hover:bg-itv-accent-strong hover:shadow-glow-accent"
            >
              <Play size={15} fill="currentColor" /> Browse Live TV
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="w-full bg-black">
      {/* width-capped so 16:9 height ≈ top half of the viewport; letterboxed
          gutters on ultra-wide stay pure black */}
      <div className="mx-auto w-full max-w-[calc(56vh*1.7778)]">
        {playing && mountOffset !== null ? (
          <VideoPlayer
            hlsUrl={channel.hls_output_url!}
            posterUrl={channel.thumbnail_url ?? undefined}
            startOffset={mountOffset}
          />
        ) : (
          <div className="relative aspect-video w-full bg-black">
            {channel.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.thumbnail_url}
                alt={channel.name}
                className="h-full w-full object-cover opacity-60"
              />
            ) : null}
          </div>
        )}
      </div>

      {/* info strip below the frame — never fights the player's controls */}
      <div className="mx-auto flex w-full max-w-[calc(56vh*1.7778)] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 lg:px-0">
        <Badge tone="live">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
          Live
        </Badge>
        <span className="text-xs uppercase tracking-widest text-itv-muted">
          CH {channel.number ?? "—"} · {channel.name}
        </span>
        {showTitle && (
          <span className="font-display text-sm font-bold text-itv-text">
            {showTitle}
          </span>
        )}
        {channel.viewer_count != null && (
          <span className="font-mono text-xs tabular-nums text-itv-faint">
            {kfmt(channel.viewer_count)} watching
          </span>
        )}
        <Link
          href={`/live/${channel.slug}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-itv-accent transition-colors hover:text-itv-accent-strong"
        >
          Open channel <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
