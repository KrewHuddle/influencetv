"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Channel {
  id: string; name: string; slug: string; genre?: string | null;
  status: string; viewer_count: number; requires_premium: boolean;
}

export default function AdminChannelsPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<{ channels: Channel[] }>("/api/admin/channels", swrFetcher, { shouldRetryOnError: false });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [genre, setGenre] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/admin/channels", { name, slug, genre: genre || undefined });
      toast({ title: "Channel created" });
      setName(""); setSlug(""); setGenre("");
      void mutate();
    } catch {
      toast({ title: "Failed (slug must be unique)", variant: "error" });
    }
  };

  const [killConfirm, setKillConfirm] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setStatus = async (c: Channel, status: string) => {
    setBusyId(c.id);
    try {
      await api.patch(`/api/admin/channels/${c.id}`, { status });
      void mutate();
    } catch {
      toast({ title: "Couldn't update channel", variant: "error" });
    } finally {
      setBusyId(null);
    }
  };
  const kill = async (c: Channel) => {
    setBusyId(c.id);
    try {
      await api.post(`/api/admin/channels/${c.id}/kill`);
      toast({ title: "Kill signal sent" });
      void mutate();
    } catch {
      toast({ title: "Kill failed", variant: "error" });
    } finally {
      setBusyId(null);
      setKillConfirm(null);
    }
  };

  const channels = data?.channels ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Channels</h1>

      <div className="mb-8 space-y-2">
        {channels.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
            <div>
              <p className="text-sm font-bold">{c.name} <span className="text-itv-faint">/{c.slug}</span></p>
              <p className="text-[11px] text-itv-faint">{c.genre ?? "—"} · {c.status} · {c.viewer_count} viewers</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus(c, c.status === "active" ? "offline" : "active")}
                disabled={busyId === c.id}
                className="border border-itv-border px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] hover:bg-itv-hover disabled:opacity-40"
              >
                {c.status === "active" ? "Set offline" : "Set active"}
              </button>
              {killConfirm === c.id ? (
                <>
                  <button
                    onClick={() => kill(c)}
                    disabled={busyId === c.id}
                    className="bg-itv-live px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white disabled:opacity-40"
                  >
                    Confirm kill {c.name}?
                  </button>
                  <button
                    onClick={() => setKillConfirm(null)}
                    aria-label="Cancel kill"
                    className="border border-itv-border px-2 py-1 text-[11px] font-bold text-itv-muted hover:bg-itv-hover"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setKillConfirm(c.id)}
                  className="bg-itv-live px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white"
                >
                  Kill
                </button>
              )}
            </div>
          </div>
        ))}
        {!channels.length && <p className="text-sm text-itv-faint">No channels.</p>}
      </div>

      <form onSubmit={create} className="max-w-lg space-y-3 border border-itv-border bg-itv-surface p-5">
        <h2 className="text-[13px] font-extrabold">New Channel</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))} required />
        <Input label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
        <Button type="submit" className="w-full">Create Channel</Button>
      </form>
    </div>
  );
}
