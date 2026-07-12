"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface AdminVideo {
  id: string;
  title: string;
  status: string;
  creator_name: string | null;
  view_count: number;
}

const TABS = ["all", "processing", "ready", "rejected"];

export default function AdminContentPage() {
  const [tab, setTab] = useState("all");
  const { data, mutate } = useSWR<{ items: AdminVideo[] }>(
    `/api/admin/videos?limit=25${tab !== "all" ? `&status=${tab}` : ""}`,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const act = async (id: string, action: "approve" | "reject") => {
    await api.patch(`/api/admin/videos/${id}/${action}`, action === "reject" ? { reason: "policy" } : {});
    void mutate();
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 font-display text-2xl">Content Library</h1>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs capitalize ${
              tab === t ? "bg-itv-accent text-itv-bg" : "border border-itv-border text-itv-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {(data?.items ?? []).map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-itv-border bg-itv-surface p-3">
            <div>
              <p className="text-sm">{v.title}</p>
              <p className="text-xs text-itv-muted">{v.creator_name} · {v.view_count} views</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{v.status}</Badge>
              <Button variant="ghost" className="text-xs" onClick={() => act(v.id, "approve")}>Approve</Button>
              <Button variant="ghost" className="text-xs text-itv-accent" onClick={() => act(v.id, "reject")}>Reject</Button>
            </div>
          </div>
        ))}
        {!data?.items?.length && <p className="text-sm text-itv-muted">Nothing here.</p>}
      </div>
    </div>
  );
}
