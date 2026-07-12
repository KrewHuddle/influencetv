"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

interface Props {
  hlsUrl: string;
  posterUrl?: string;
  startOffset?: number;
  autoPlay?: boolean;
  onTimeUpdate?: (t: number) => void;
  /** When set, requests a VOD pre-roll ad and plays it before the content. */
  vodVideoId?: string;
}

interface VodAd {
  hlsUrl: string | null;
  durationSeconds: number;
  advertiserName: string | null;
}

export function VideoPlayer({
  hlsUrl,
  posterUrl,
  startOffset,
  autoPlay = true,
  onTimeUpdate,
  vodVideoId,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Autoplay is muted (browsers block sound-on autoplay); surface an unmute affordance.
  const [muted, setMuted] = useState(false);
  // Set when even muted autoplay is rejected — show a tap-to-play overlay.
  const [blocked, setBlocked] = useState(false);
  const [adPaused, setAdPaused] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  // Ad state. adResolved gates content load until we know whether a pre-roll runs.
  const [adResolved, setAdResolved] = useState(!vodVideoId);
  const [adPhase, setAdPhase] = useState(false);
  const [ad, setAd] = useState<VodAd | null>(null);

  // Resolve the pre-roll once on mount (only for VOD).
  useEffect(() => {
    if (!vodVideoId) return;
    let cancelled = false;
    apiGet<{ preroll: VodAd | null }>(`/api/ads/vod?videoId=${vodVideoId}`)
      .then((r) => {
        if (cancelled) return;
        if (r.preroll?.hlsUrl) {
          setAd(r.preroll);
          setAdPhase(true);
        }
        setAdResolved(true);
      })
      .catch(() => !cancelled && setAdResolved(true));
    return () => {
      cancelled = true;
    };
  }, [vodVideoId]);

  const activeSrc = !adResolved ? null : adPhase ? ad?.hlsUrl ?? hlsUrl : hlsUrl;
  const activeSeek = adPhase ? 0 : startOffset;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;
    setError(null);
    setLoading(true);
    setBlocked(false);

    const applyOffset = () => {
      setLoading(false);
      if (activeSeek && activeSeek > 0) video.currentTime = activeSeek;
      // Always autoplay the ad; content honours the prop (or plays after an ad).
      if (autoPlay || adPhase) {
        // Sound-on autoplay is blocked by browsers — start muted and offer unmute.
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => setBlocked(true));
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(activeSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(["Auto", ...data.levels.map((l) => `${l.height}p`)]);
        applyOffset();
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else {
            setLoading(false);
            setError("Playback error");
          }
        }
      });
      return () => hls.destroy();
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeSrc;
      video.addEventListener("loadedmetadata", applyOffset, { once: true });
    }
    return undefined;
  }, [activeSrc, activeSeek, autoPlay, adPhase]);

  // When the pre-roll ends, switch to the content.
  const handleEnded = () => {
    if (adPhase) {
      setAdPhase(false);
      setAdPaused(false);
    }
  };

  const setLevel = (idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx - 1; // -1 = auto
  };

  const unmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
  };

  const resumeBlocked = () => {
    const video = videoRef.current;
    if (!video) return;
    // User gesture — safe to play with sound.
    video.muted = false;
    setMuted(false);
    void video
      .play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  };

  const toggleAdPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      setAdPaused(false);
    } else {
      video.pause();
      setAdPaused(true);
    }
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    if (hlsRef.current) hlsRef.current.startLoad();
    else if (videoRef.current) videoRef.current.load();
  };

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        poster={adPhase ? undefined : posterUrl}
        controls={!adPhase}
        playsInline
        className="h-full w-full"
        onEnded={handleEnded}
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        aria-label="Video player"
      />

      {adPhase && (
        <div className="absolute left-3 top-3 flex items-center gap-2 bg-itv-accent px-2 py-1 text-[11px] font-extrabold uppercase tracking-[1px] text-itv-bg">
          Ad{ad?.advertiserName ? ` · ${ad.advertiserName}` : ""}
        </div>
      )}

      {/* Ad phase hides native controls — keep pause reachable (WCAG 2.2.2). */}
      {adPhase && !blocked && (
        <button
          onClick={toggleAdPause}
          aria-label={adPaused ? "Play ad" : "Pause ad"}
          className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          {adPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      )}

      {/* Unmute affordance while auto-muted. */}
      {muted && !blocked && !error && (
        <button
          onClick={unmute}
          aria-label="Unmute"
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-black/80"
        >
          <VolumeX size={14} /> Tap to unmute
        </button>
      )}
      {!muted && adPhase && !blocked && (
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
          <Volume2 size={16} />
        </span>
      )}

      {loading && !error && (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Autoplay fully blocked — explicit tap-to-play. */}
      {blocked && !error && (
        <button
          onClick={resumeBlocked}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/50"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-itv-accent text-itv-bg shadow-glow-accent">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      )}

      {!adPhase && levels.length > 1 && (
        <select
          aria-label="Quality"
          onChange={(e) => setLevel(Number(e.target.value))}
          className="absolute bottom-3 right-3 rounded-sm bg-black/70 px-2 py-1 text-xs text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-itv-accent"
        >
          {levels.map((l, i) => (
            <option key={l} value={i}>
              {l}
            </option>
          ))}
        </select>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-itv-live">{error}</p>
            <Button variant="subtle" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
