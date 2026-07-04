import { VideoCard, type VideoSummary } from "./VideoCard";

export function VideoRow({
  title,
  videos,
}: {
  title: string;
  videos: VideoSummary[];
}) {
  if (!videos.length) return null;
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-display text-sm tracking-wide">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => (
          <div key={v.id} className="w-64 shrink-0">
            <VideoCard video={v} />
          </div>
        ))}
      </div>
    </section>
  );
}
