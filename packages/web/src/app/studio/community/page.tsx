"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Studio {
  community: { memberCount: number; postCount: number };
}

export default function StudioCommunityPage() {
  const { data } = useSWR<Studio>("/api/creators/studio", swrFetcher, {
    shouldRetryOnError: false,
  });

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Community</h1>
      <div className="grid grid-cols-2 gap-4 md:max-w-md">
        <div className="rounded-lg border border-apex bg-apex-gray-900 p-4">
          <p className="text-xs uppercase text-[color:var(--text-muted)]">Members</p>
          <p className="mt-2 font-display text-2xl">{data?.community.memberCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-apex bg-apex-gray-900 p-4">
          <p className="text-xs uppercase text-[color:var(--text-muted)]">Posts</p>
          <p className="mt-2 font-display text-2xl">{data?.community.postCount ?? 0}</p>
        </div>
      </div>
      <p className="mt-6 text-sm text-[color:var(--text-muted)]">
        Post announcements and manage members from your community page.
      </p>
    </div>
  );
}
