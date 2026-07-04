"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { PostCard, type PostSummary } from "@/components/community/PostCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";

interface CommunityData {
  community: { name: string; description?: string | null; member_count?: number };
  posts: PostSummary[];
}

export default function CommunityPage({
  params,
}: {
  params: { communityId: string };
}) {
  const { communityId } = params;
  const { data, isLoading } = useSWR<CommunityData>(
    `/api/community/${communityId}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{data?.community?.name ?? "Community"}</h1>
          <p className="text-sm text-[color:var(--text-secondary)]">
            {data?.community?.member_count ?? 0} members
          </p>
        </div>
        <Button className="text-xs">Join</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (data?.posts?.length ?? 0) > 0 ? (
        <div className="space-y-3">
          {data!.posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">No posts yet.</p>
      )}
    </div>
  );
}
