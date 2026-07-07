"use client";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Notice {
  id: string;
  reporter_name: string | null;
  claimed_work_title: string | null;
  infringing_content_url: string | null;
  status: string;
  received_at: string;
}

export default function AdminDmcaPage() {
  const { data, mutate } = useSWR<{ items: Notice[] }>(
    "/api/admin/dmca?limit=25",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const act = async (id: string, action: "remove" | "restore" | "reject") => {
    await api.patch(`/api/admin/dmca/${id}/action`, { action });
    void mutate();
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 font-display text-2xl">DMCA Notices</h1>
      <div className="space-y-2">
        {(data?.items ?? []).map((n) => (
          <div key={n.id} className="rounded-lg border border-itv-border bg-itv-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{n.claimed_work_title ?? "Untitled claim"}</p>
                <p className="text-xs text-itv-muted">
                  {n.reporter_name} · {new Date(n.received_at).toLocaleDateString()}
                </p>
              </div>
              <Badge>{n.status}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" className="text-xs text-itv-magenta" onClick={() => act(n.id, "remove")}>Remove Content</Button>
              <Button variant="ghost" className="text-xs" onClick={() => act(n.id, "restore")}>Restore</Button>
              <Button variant="ghost" className="text-xs" onClick={() => act(n.id, "reject")}>Reject Notice</Button>
            </div>
          </div>
        ))}
        {!data?.items?.length && <p className="text-sm text-itv-muted">No notices.</p>}
      </div>
    </div>
  );
}
