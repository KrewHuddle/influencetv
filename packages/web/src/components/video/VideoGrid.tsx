import { VideoCard, type VideoSummary } from "./VideoCard";

export function VideoGrid({ items }: { items: VideoSummary[] }) {
  if (!items.length) {
    return <p className="text-sm text-white/[0.42]">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}
