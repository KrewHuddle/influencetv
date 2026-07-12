"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

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

  // Two-step kill confirmation + in-flight tracking.
  const [confirmKillId, setConfirmKillId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const control = async (id: string, action: string) => {
    setBusyKey(`${id}:${action}`);
    try {
      if (action === "kill") await api.post(`/api/admin/channels/${id}/kill`);
      else await api.post(`/api/admin/channels/${id}/playout`, { action });
      toast({ title: `Sent: ${action}` });
      setTimeout(() => void mutate(), 1500);
    } catch {
      toast({ title: `Failed: ${action}`, variant: "error" });
    } finally {
      setBusyKey(null);
      if (action === "kill") setConfirmKillId(null);
    }
  };

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Playout Control</h1>
      <p className="mb-6 text-[12px] text-itv-muted">
        Live status is reported by the playout process via Redis heartbeats (refreshes every 5s).
      </p>

      <div className="space-y-2">
        {channels.map((c) => {
          const hb = beats.get(c.id);
          const live = hb?.running && (hb.lastSeenMs ?? 99999) < 30000;
          const killBusy = busyKey === `${c.id}:kill`;
          const confirming = confirmKillId === c.id;
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${live ? "bg-itv-accent" : "bg-itv-faint"}`} />
                <div>
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-itv-muted">
                    {live ? "on air" : "offline"}
                    {hb?.lastSeenMs != null ? ` · seen ${Math.round(hb.lastSeenMs / 1000)}s ago` : " · no heartbeat"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(["start", "restart", "stop"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => control(c.id, a)}
                    disabled={busyKey === `${c.id}:${a}`}
                    className="border border-itv-border px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-itv-text hover:bg-itv-hover disabled:pointer-events-none disabled:opacity-40"
                  >
                    {a}
                  </button>
                ))}
                {confirming ? (
                  <>
                    <button
                      onClick={() => control(c.id, "kill")}
                      disabled={killBusy}
                      className="bg-itv-live px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white disabled:pointer-events-none disabled:opacity-40"
                    >
                      {killBusy ? "Killing…" : `Confirm kill ${c.name}?`}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Cancel kill of ${c.name}`}
                      onClick={() => setConfirmKillId(null)}
                      disabled={killBusy}
                    >
                      ✕
                    </Button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmKillId(c.id)}
                    className="bg-itv-live px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white"
                  >
                    Kill
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!channels.length && <p className="text-sm text-itv-muted">No channels.</p>}
      </div>
    </div>
  );
}
