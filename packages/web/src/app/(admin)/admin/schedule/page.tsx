"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Channel { id: string; name: string }
interface Item {
  id: string; title: string; start_time: string; end_time: string;
  is_ad_break: boolean; is_filler: boolean; video_id: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const iso = (local: string) => (local ? new Date(local).toISOString() : "");
const hm = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function AdminSchedulePage() {
  const { toast } = useToast();
  const { data: chData } = useSWR<{ channels: Channel[] }>("/api/admin/channels", swrFetcher, { shouldRetryOnError: false });
  const channels = chData?.channels ?? [];
  const [channelId, setChannelId] = useState("");
  const [date, setDate] = useState(today());
  const active = channelId || channels[0]?.id || "";

  const { data: schData, mutate } = useSWR<{ items: Item[] }>(
    active ? `/api/channels/${active}/schedule?date=${date}` : null,
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const [videoId, setVideoId] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [aStart, setAStart] = useState("");
  const [aEnd, setAEnd] = useState("");

  const addProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/channels/${active}/schedule`, { videoId, startTime: iso(pStart), endTime: iso(pEnd) });
      toast({ title: "Program scheduled" });
      setVideoId(""); void mutate();
    } catch {
      toast({ title: "Failed (overlap or video not ready)", variant: "error" });
    }
  };
  const addAdBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/channels/${active}/schedule`, { isAdBreak: true, startTime: iso(aStart), endTime: iso(aEnd) });
      toast({ title: "Ad break scheduled" });
      void mutate();
    } catch {
      toast({ title: "Failed (overlap)", variant: "error" });
    }
  };
  const del = async (id: string) => {
    try {
      await api.delete(`/api/schedule/${id}`);
      void mutate();
    } catch {
      toast({ title: "Only future items can be removed", variant: "error" });
    }
  };

  const items = schData?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Programming</h1>
      <p className="mb-5 text-[12px] text-white/[0.45]">Schedule programs and ad breaks per channel. Ad breaks are filled live by the ad engine.</p>

      <div className="mb-5 flex flex-wrap gap-3">
        <select value={active} onChange={(e) => setChannelId(e.target.value)} className="border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-magenta">
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-magenta" />
      </div>

      <div className="mb-8 border border-itv-border">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border-b border-itv-border px-4 py-2.5 text-[13px] last:border-b-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-white/[0.5]">{hm(it.start_time)}–{hm(it.end_time)}</span>
              <span className={it.is_ad_break ? "font-bold text-itv-magenta" : "font-medium"}>
                {it.is_ad_break ? "● AD BREAK" : it.title}
              </span>
            </div>
            <button onClick={() => del(it.id)} className="text-[11px] text-white/[0.5] hover:text-itv-live">remove</button>
          </div>
        ))}
        {!items.length && <p className="p-4 text-sm text-white/[0.42]">Nothing scheduled for this day.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={addProgram} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Schedule Program</h2>
          <Input label="Video ID (ready)" value={videoId} onChange={(e) => setVideoId(e.target.value)} required />
          <Input label="Start" type="datetime-local" value={pStart} onChange={(e) => setPStart(e.target.value)} required />
          <Input label="End" type="datetime-local" value={pEnd} onChange={(e) => setPEnd(e.target.value)} required />
          <Button type="submit" className="w-full">Add Program</Button>
        </form>
        <form onSubmit={addAdBreak} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Schedule Ad Break</h2>
          <Input label="Start" type="datetime-local" value={aStart} onChange={(e) => setAStart(e.target.value)} required />
          <Input label="End" type="datetime-local" value={aEnd} onChange={(e) => setAEnd(e.target.value)} required />
          <Button type="submit" variant="ghost" className="w-full">Add Ad Break</Button>
        </form>
      </div>
    </div>
  );
}
