"use client";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Channel {
  id: string;
  name: string;
  slug: string;
  status: string;
}
interface Heartbeat {
  channelId: string;
  running: boolean;
  itemId: string | null;
  lastSeenMs: number | null;
}

export default function AdminPlayoutPage() {
  const { toast } = useToast();
  const { data: chData } = useSWR<{ channels: Channel[] }>("/api/admin/channels", swrFetcher, { shouldRetryOnError: false });
  const { data: stData, mutate } = useSWR<{ channels: Heartbeat[] }>(
    "/api/admin/playout/status",
    swrFetcher,
    { shouldRetryOnError: false, refreshInterval: 5000 }
  );

  const channels = chData?.channels ?? [];
  const beats = new Map((stData?.channels ?? []).map((h) => [h.channelId, h]));

  const control = async (id: string, action: string) => {
    try {
      if (action === "kill") await api.post(`/api/admin/channels/${id}/kill`);
      else await api.post(`/api/admin/channels/${id}/playout`, { action });
      toast({ title: `Sent: ${action}` });
      setTimeout(() => void mutate(), 1500);
    } catch {
      toast({ title: `Failed: ${action}`, variant: "error" });
    }
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Playout Control</h1>
      <p className="mb-6 text-[12px] text-white/[0.45]">
        Live status is reported by the playout process via Redis heartbeats (refreshes every 5s).
      </p>

      <div className="space-y-2">
        {channels.map((c) => {
          const hb = beats.get(c.id);
          const live = hb?.running && (hb.lastSeenMs ?? 99999) < 30000;
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${live ? "bg-itv-magenta" : "bg-white/25"}`} />
                <div>
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-white/[0.45]">
                    {live ? "on air" : "offline"}
                    {hb?.lastSeenMs != null ? ` · seen ${Math.round(hb.lastSeenMs / 1000)}s ago` : " · no heartbeat"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(["start", "restart", "stop"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => control(c.id, a)}
                    className="border border-itv-border px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] hover:bg-white/[0.06]"
                  >
                    {a}
                  </button>
                ))}
                <button
                  onClick={() => control(c.id, "kill")}
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white"
                  style={{ background: "#FF3333" }}
                >
                  Kill
                </button>
              </div>
            </div>
          );
        })}
        {!channels.length && <p className="text-sm text-white/[0.42]">No channels.</p>}
      </div>
    </div>
  );
}
