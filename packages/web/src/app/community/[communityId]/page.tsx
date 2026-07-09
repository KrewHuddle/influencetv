"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Check } from "lucide-react";
import { swrFetcher, apiPost } from "@/lib/api";
import { PostCard, type PostSummary } from "@/components/community/PostCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

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
  const router = useRouter();
  const { toast } = useToast();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<CommunityData>(
    `/api/community/${communityId}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  async function join() {
    setJoining(true);
    try {
      await apiPost(`/api/community/${communityId}/join`, {});
      setJoined(true);
      toast({ title: "Joined community" });
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      if (e.response?.status === 401) {
        router.push("/login");
        return;
      }
      toast({
        title: e.response?.data?.error?.message ?? "Couldn't join community",
        variant: "error",
      });
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-itv-text">
            {data?.community?.name ?? "Community"}
          </h1>
          <p className="text-sm text-itv-muted">
            {data?.community?.member_count ?? 0} members
          </p>
        </div>
        <Button className="text-xs" disabled={joining || joined} onClick={join}>
          {joined ? (
            <>
              <Check size={14} /> Joined
            </>
          ) : joining ? (
            "Joining…"
          ) : (
            "Join"
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-itv-border py-12 text-center">
          <p className="text-sm text-itv-muted">Couldn&apos;t load this community.</p>
          <Button variant="subtle" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      ) : (data?.posts?.length ?? 0) > 0 ? (
        <div className="space-y-3">
          {data!.posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <p className="text-sm text-itv-muted">No posts yet.</p>
      )}
    </div>
  );
}
