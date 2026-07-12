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
interface ReadyVideo { id: string; title: string; duration_seconds?: number | null }

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
  const [busyProgram, setBusyProgram] = useState(false);
  const [busyAdBreak, setBusyAdBreak] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto-fill
  const { data: vidData } = useSWR<{ items: ReadyVideo[] }>(
    "/api/browse?sort=new&limit=100",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const readyVideos = vidData?.items ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fLoop, setFLoop] = useState(true);
  const [fShuffle, setFShuffle] = useState(false);
  const [fAdEvery, setFAdEvery] = useState("0");
  const [busyFill, setBusyFill] = useState(false);

  const toggleSel = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const autoFill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.length) return;
    setBusyFill(true);
    try {
      const r = await api.post(`/api/channels/${active}/schedule/auto-fill`, {
        videoIds: selected,
        startTime: iso(fStart),
        endTime: iso(fEnd),
        loop: fLoop,
        shuffle: fShuffle,
        adBreakEveryMinutes: Number(fAdEvery),
      });
      const d = r.data?.data ?? {};
      toast({
        title: `Scheduled ${d.programs ?? 0} programs`,
        description: d.adBreaks ? `+ ${d.adBreaks} ad breaks` : undefined,
      });
      setSelected([]);
      void mutate();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast({ title: "Auto-fill failed", description: msg ?? "Try again", variant: "error" });
    } finally {
      setBusyFill(false);
    }
  };

  const addProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyProgram(true);
    try {
      await api.post(`/api/channels/${active}/schedule`, { videoId, startTime: iso(pStart), endTime: iso(pEnd) });
      toast({ title: "Program scheduled" });
      setVideoId(""); void mutate();
    } catch {
      toast({ title: "Failed (overlap or video not ready)", variant: "error" });
    } finally {
      setBusyProgram(false);
    }
  };
  const addAdBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAdBreak(true);
    try {
      await api.post(`/api/channels/${active}/schedule`, { isAdBreak: true, startTime: iso(aStart), endTime: iso(aEnd) });
      toast({ title: "Ad break scheduled" });
      void mutate();
    } catch {
      toast({ title: "Failed (overlap)", variant: "error" });
    } finally {
      setBusyAdBreak(false);
    }
  };
  const del = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/schedule/${id}`);
      void mutate();
    } catch {
      toast({ title: "Only future items can be removed", variant: "error" });
    } finally {
      setDeletingId(null);
      setConfirmDelId(null);
    }
  };

  const items = schData?.items ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Programming</h1>
      <p className="mb-5 text-[12px] text-itv-muted">Schedule programs and ad breaks per channel. Ad breaks are filled live by the ad engine.</p>

      <div className="mb-5 flex flex-wrap gap-3">
        <select value={active} onChange={(e) => setChannelId(e.target.value)} className="border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-accent">
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-accent" />
      </div>

      <div className="mb-8 border border-itv-border">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border-b border-itv-border px-4 py-2.5 text-[13px] last:border-b-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-itv-muted">{hm(it.start_time)}–{hm(it.end_time)}</span>
              <span className={it.is_ad_break ? "flex items-center gap-1.5 font-bold text-itv-accent" : "font-medium"}>
                {it.is_ad_break ? (
                  <>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-itv-live" aria-hidden />
                    AD BREAK
                  </>
                ) : (
                  it.title
                )}
              </span>
            </div>
            {confirmDelId === it.id ? (
              <button
                onClick={() => del(it.id)}
                disabled={deletingId === it.id}
                className="text-[11px] font-bold text-itv-live disabled:pointer-events-none disabled:opacity-40"
              >
                {deletingId === it.id ? "Removing…" : "Confirm remove?"}
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelId(it.id)}
                className="text-[11px] text-itv-muted hover:text-itv-live"
              >
                remove
              </button>
            )}
          </div>
        ))}
        {!items.length && <p className="p-4 text-sm text-itv-muted">Nothing scheduled for this day.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={addProgram} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Schedule Program</h2>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">Video</span>
            <select value={videoId} onChange={(e) => setVideoId(e.target.value)} required className="w-full border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-accent">
              <option value="">Select a ready video…</option>
              {readyVideos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </label>
          <Input label="Start" type="datetime-local" value={pStart} onChange={(e) => setPStart(e.target.value)} required />
          <Input label="End" type="datetime-local" value={pEnd} onChange={(e) => setPEnd(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={busyProgram}>
            {busyProgram ? "Adding…" : "Add Program"}
          </Button>
        </form>
        <form onSubmit={addAdBreak} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Schedule Ad Break</h2>
          <Input label="Start" type="datetime-local" value={aStart} onChange={(e) => setAStart(e.target.value)} required />
          <Input label="End" type="datetime-local" value={aEnd} onChange={(e) => setAEnd(e.target.value)} required />
          <Button type="submit" variant="ghost" className="w-full" disabled={busyAdBreak}>
            {busyAdBreak ? "Adding…" : "Add Ad Break"}
          </Button>
        </form>
      </div>

      {/* Auto-fill: playlist scheduling */}
      <form onSubmit={autoFill} className="mt-6 space-y-4 border border-itv-border bg-itv-surface p-4">
        <div>
          <h2 className="text-[13px] font-extrabold">Auto-fill from playlist</h2>
          <p className="text-[12px] text-itv-muted">Pick videos, set a window — programs are placed back-to-back around existing blocks.</p>
        </div>
        <div className="max-h-56 overflow-y-auto border border-itv-border">
          {readyVideos.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-center gap-3 border-b border-itv-border px-3 py-2 text-[13px] last:border-b-0 hover:bg-itv-hover">
              <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggleSel(v.id)} className="accent-[var(--itv-accent)]" />
              <span className="flex-1 truncate">{v.title}</span>
              {v.duration_seconds ? (
                <span className="font-mono text-[11px] tabular-nums text-itv-faint">{Math.round(v.duration_seconds / 60)} min</span>
              ) : null}
            </label>
          ))}
          {!readyVideos.length && <p className="p-3 text-sm text-itv-muted">No ready videos yet — upload some first.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Start" type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} required />
          <Input label="End" type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} required />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">Ad break every</span>
            <select value={fAdEvery} onChange={(e) => setFAdEvery(e.target.value)} className="w-full border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-accent">
              <option value="0">Off</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
            </select>
          </label>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-itv-text">
              <input type="checkbox" checked={fLoop} onChange={(e) => setFLoop(e.target.checked)} className="accent-[var(--itv-accent)]" /> Loop
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-itv-text">
              <input type="checkbox" checked={fShuffle} onChange={(e) => setFShuffle(e.target.checked)} className="accent-[var(--itv-accent)]" /> Shuffle
            </label>
          </div>
        </div>
        <Button type="submit" disabled={busyFill || !selected.length} isLoading={busyFill}>
          {busyFill ? "Scheduling…" : `Auto-fill ${selected.length} video${selected.length === 1 ? "" : "s"}`}
        </Button>
      </form>
    </div>
  );
}
