"use client";
import useSWR from "swr";
import Link from "next/link";
import { Users } from "lucide-react";
import { swrFetcher } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Spinner";

interface Community {
  id: string;
  name: string;
  description?: string | null;
  member_count?: number | null;
  post_count?: number | null;
}

const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export default function CommunityIndexPage() {
  const { data, error, isLoading, mutate } = useSWR<{ communities: Community[] }>(
    "/api/communities",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const communities = data?.communities ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-itv-text">Community</h1>
      <p className="mb-6 text-sm text-itv-muted">
        Join the conversation around channels and creators.
      </p>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-itv-border py-12 text-center">
          <p className="text-sm text-itv-muted">Couldn&apos;t load communities.</p>
          <Button variant="subtle" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      ) : communities.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <Link key={c.id} href={`/community/${c.id}`}>
              <Card interactive className="h-full p-5">
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-md bg-itv-magenta-dim text-itv-magenta">
                  <Users size={16} />
                </div>
                <h2 className="font-semibold text-itv-text">{c.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-itv-muted">{c.description}</p>
                <p className="mt-3 font-mono text-[11px] tabular-nums text-itv-faint">
                  {kfmt(c.member_count)} members · {kfmt(c.post_count)} posts
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-itv-border py-12 text-center text-sm text-itv-muted">
          No communities yet.
        </p>
      )}
    </div>
  );
}
