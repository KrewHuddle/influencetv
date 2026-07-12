"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Radio } from "lucide-react";
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

/* Dropout-style hero: the network channel plays full-bleed at the top of
 * Home — mobile keeps the natural 16:9 frame, desktop crops to fill ~the
 * whole viewport (VideoPlayer `fill`). Info + CTAs overlay the lower-left
 * on a gradient; the overlay is pointer-events-none (links opt back in) so
 * the player's own controls stay clickable through it. Playback pauses
 * (player unmounts) when the tab is hidden or the hero scrolls away —
 * tune-in offset re-syncs on return. */

const HERO_BOX =
  "relative w-full overflow-hidden bg-black aspect-video lg:aspect-auto lg:h-[85svh]";

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

  /* loading: quiet full-bleed shimmer, same box as the live state */
  if (isLoading && !data) {
    return (
      <section className={HERO_BOX}>
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-itv-surface via-itv-surface2 to-itv-surface bg-[length:200%_100%]" />
      </section>
    );
  }

  /* fallback: no live channel (or no stream URL) — full-bleed artwork hero */
  if (!channel) {
    return (
      <section className={HERO_BOX}>
        <div className="absolute inset-0 bg-gradient-to-br from-itv-bg via-itv-surface to-itv-surface" />
        <div
          className="absolute inset-y-0 right-0 w-3/5"
          style={{
            background:
              "radial-gradient(700px 460px at 68% 38%, color-mix(in oklch, var(--itv-accent) 32%, transparent), transparent 66%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-itv-bg via-itv-bg/35 to-transparent px-4 pb-10 pt-24 lg:px-10 lg:pb-14">
          <span className="text-xs uppercase tracking-widest text-itv-muted">
            Influence TV Network
          </span>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-black leading-[1.05] tracking-tight text-itv-text lg:text-5xl">
            Live TV, creators, and shopping — one network
          </h1>
          <div className="mt-5">
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-md bg-itv-accent px-5 py-2.5 text-sm font-semibold text-itv-bg transition-[background-color,box-shadow] hover:bg-itv-accent-strong hover:shadow-glow-accent"
            >
              <Play size={15} fill="currentColor" /> Browse Live TV
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className={HERO_BOX}>
      {playing && mountOffset !== null ? (
        <VideoPlayer
          fill
          hlsUrl={channel.hls_output_url!}
          posterUrl={channel.thumbnail_url ?? undefined}
          startOffset={mountOffset}
        />
      ) : channel.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.thumbnail_url}
          alt={channel.name}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : null}

      {/* dropout-style lower-left overlay; pointer-events-none so the
          player's mute/unmute/quality controls stay clickable through it */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-itv-bg via-itv-bg/35 to-transparent px-4 pb-16 pt-24 lg:px-10 lg:pb-20">
        <div className="flex items-center gap-2.5">
          <Badge tone="live">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
            Live
          </Badge>
          <span className="text-xs uppercase tracking-widest text-itv-muted">
            CH {channel.number ?? "—"} · {channel.name}
          </span>
          {channel.viewer_count != null && (
            <span className="font-mono text-xs tabular-nums text-itv-faint">
              {kfmt(channel.viewer_count)} watching
            </span>
          )}
        </div>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-black leading-[1.05] tracking-tight text-itv-text lg:text-5xl">
          {showTitle ?? channel.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 lg:mt-5">
          <Link
            href={`/live/${channel.slug}`}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-itv-accent px-5 py-2.5 text-sm font-semibold text-itv-bg transition-[background-color,box-shadow] hover:bg-itv-accent-strong hover:shadow-glow-accent"
          >
            <Play size={15} fill="currentColor" /> Watch Live
          </Link>
          <Link
            href="/live"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-itv-border bg-itv-surface2/80 px-5 py-2.5 text-sm font-medium text-itv-text backdrop-blur transition-colors hover:bg-itv-surface3"
          >
            <Radio size={15} /> All Channels
          </Link>
        </div>
      </div>
    </section>
  );
}
