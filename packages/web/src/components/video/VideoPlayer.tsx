"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Props {
  hlsUrl: string;
  posterUrl?: string;
  startOffset?: number;
  autoPlay?: boolean;
  onTimeUpdate?: (t: number) => void;
}

export function VideoPlayer({
  hlsUrl,
  posterUrl,
  startOffset,
  autoPlay = true,
  onTimeUpdate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    const applyOffset = () => {
      if (startOffset && startOffset > 0) video.currentTime = startOffset;
      if (autoPlay) void video.play().catch(() => undefined);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
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

    // Native HLS (Safari).
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", applyOffset, { once: true });
    }
    return undefined;
  }, [hlsUrl, startOffset, autoPlay]);

  const setLevel = (idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx - 1; // -1 = auto
  };

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        poster={posterUrl}
        controls
        playsInline
        className="h-full w-full"
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
        aria-label="Video player"
      />
      {levels.length > 1 && (
        <select
          aria-label="Quality"
          onChange={(e) => setLevel(Number(e.target.value))}
          className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs text-white"
        >
          {levels.map((l, i) => (
            <option key={l} value={i}>
              {l}
            </option>
          ))}
        </select>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 text-sm text-apex-red">
          {error}
        </div>
      )}
    </div>
  );
}
