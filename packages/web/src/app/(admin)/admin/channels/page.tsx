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

  const setStatus = async (c: Channel, status: string) => {
    await api.patch(`/api/admin/channels/${c.id}`, { status });
    void mutate();
  };
  const kill = async (c: Channel) => {
    await api.post(`/api/admin/channels/${c.id}/kill`);
    toast({ title: "Kill signal sent" });
    void mutate();
  };

  const channels = data?.channels ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Channels</h1>

      <div className="mb-8 space-y-2">
        {channels.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
            <div>
              <p className="text-sm font-bold">{c.name} <span className="text-white/[0.4]">/{c.slug}</span></p>
              <p className="text-[11px] text-white/[0.45]">{c.genre ?? "—"} · {c.status} · {c.viewer_count} viewers</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStatus(c, c.status === "active" ? "offline" : "active")} className="border border-itv-border px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] hover:bg-white/[0.06]">
                {c.status === "active" ? "Set offline" : "Set active"}
              </button>
              <button onClick={() => kill(c)} className="px-3 py-1 text-[11px] font-bold uppercase tracking-[1px] text-white" style={{ background: "#FF3333" }}>Kill</button>
            </div>
          </div>
        ))}
        {!channels.length && <p className="text-sm text-white/[0.42]">No channels.</p>}
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
