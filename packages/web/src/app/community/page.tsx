"use client";
import useSWR from "swr";
import Link from "next/link";
import { swrFetcher } from "@/lib/api";

interface Community {
  id: string;
  name: string;
  description?: string | null;
  member_count?: number | null;
}

export default function CommunityIndexPage() {
  const { data } = useSWR<{ communities: Community[] }>(
    "/api/communities",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const communities = data?.communities ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Communities</h1>
      {communities.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <Link
              key={c.id}
              href={`/community/${c.id}`}
              className="rounded-lg border border-apex bg-apex-gray-900 p-5 hover:border-white/20"
            >
              <h2 className="font-medium">{c.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-[color:var(--text-secondary)]">
                {c.description}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--text-muted)]">No communities yet.</p>
      )}
    </div>
  );
}
