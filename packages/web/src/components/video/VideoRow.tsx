import { VideoCard, type VideoSummary } from "./VideoCard";
import { Rail } from "@/components/ui/Rail";

export function VideoRow({
  title,
  href,
  videos,
}: {
  title: string;
  href?: string;
  videos: VideoSummary[];
}) {
  if (!videos.length) return null;
  return (
    <Rail title={title} href={href}>
      {videos.map((v) => (
        <div key={v.id} className="w-64 shrink-0 snap-start">
          <VideoCard video={v} />
        </div>
      ))}
    </Rail>
  );
}
