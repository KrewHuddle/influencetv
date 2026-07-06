"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { apiGet } from "@/lib/api";

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

    const applyOffset = () => {
      if (activeSeek && activeSeek > 0) video.currentTime = activeSeek;
      // Always autoplay the ad; content honours the prop (or plays after an ad).
      if (autoPlay || adPhase) void video.play().catch(() => undefined);
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
          else setError("Playback error");
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
    if (adPhase) setAdPhase(false);
  };

  const setLevel = (idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx - 1; // -1 = auto
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
        <div className="absolute left-3 top-3 flex items-center gap-2 bg-itv-magenta px-2 py-1 text-[10px] font-extrabold uppercase tracking-[1px] text-white">
          Ad{ad?.advertiserName ? ` · ${ad.advertiserName}` : ""}
        </div>
      )}

      {!adPhase && levels.length > 1 && (
        <select
          aria-label="Quality"
          onChange={(e) => setLevel(Number(e.target.value))}
          className="absolute bottom-3 right-3 rounded-[2px] bg-black/70 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-itv-magenta"
        >
          {levels.map((l, i) => (
            <option key={l} value={i}>
              {l}
            </option>
          ))}
        </select>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 text-sm text-itv-magenta">
          {error}
        </div>
      )}
    </div>
  );
}
