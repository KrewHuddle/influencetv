"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoCard, type VideoSummary } from "@/components/video/VideoCard";
import { Button } from "@/components/ui/Button";

interface CreatorProfile {
  displayName: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  patronTiers?: Array<{ id: string; name: string; price_cents: number; subscriber_count: number }>;
  recentVideos?: VideoSummary[];
}

export default function CreatorPage({
  params,
}: {
  params: { username: string };
}) {
  const { username } = params;
  const { data } = useSWR<CreatorProfile>(
    `/api/users/${username}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-apex-gray-800 text-xl">
          {(data?.displayName ?? username)[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-2xl">{data?.displayName ?? username}</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">@{username}</p>
        </div>
      </div>

      {data?.bio && <p className="mb-8 text-sm text-[color:var(--text-secondary)]">{data.bio}</p>}

      {data?.patronTiers && data.patronTiers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-sm">Become a Patron</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {data.patronTiers.map((t) => (
              <div key={t.id} className="rounded-lg border border-apex bg-apex-gray-900 p-4">
                <h3 className="font-medium">{t.name}</h3>
                <p className="my-2 text-lg">${(t.price_cents / 100).toFixed(2)}/mo</p>
                <p className="mb-3 text-xs text-[color:var(--text-muted)]">
                  {t.subscriber_count} patrons
                </p>
                <Button className="w-full text-xs">Join</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {data?.recentVideos && data.recentVideos.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm">Recent</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {data.recentVideos.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}
    </div>
  );
}
