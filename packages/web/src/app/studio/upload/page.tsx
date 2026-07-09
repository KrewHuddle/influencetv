"use client";
import { useCallback, useRef, useState } from "react";
import { AxiosError } from "axios";
import { X, RotateCcw, CheckCircle2, FileVideo } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const CONCURRENCY = 2; // parallel uploads

const VIDEO_TYPES = ["episode", "movie", "clip", "live_recording"] as const;
const RATINGS = ["G", "PG", "PG-13", "TV-14", "TV-MA"] as const;

type ItemStatus = "queued" | "uploading" | "done" | "failed";

interface QueueItem {
  id: string;
  file: File;
  title: string;
  description: string;
  genre: string;
  tags: string;
  type: (typeof VIDEO_TYPES)[number];
  rating: (typeof RATINGS)[number];
  status: ItemStatus;
  progress: number;
  error?: string;
}

const titleFromFilename = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

let nextId = 0;

export default function UploadPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  // Bulk "apply to all" defaults
  const [allGenre, setAllGenre] = useState("");
  const [allType, setAllType] = useState<(typeof VIDEO_TYPES)[number]>("episode");
  const [allRating, setAllRating] = useState<(typeof RATINGS)[number]>("PG");
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;

  const patch = useCallback((id: string, p: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const addFiles = (list: FileList | null) => {
    setPickError(null);
    if (!list?.length) return;
    const rejected: string[] = [];
    const fresh: QueueItem[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        rejected.push(`${f.name} — unsupported type`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        rejected.push(`${f.name} — over 4 GB`);
        continue;
      }
      fresh.push({
        id: `q${nextId++}`,
        file: f,
        title: titleFromFilename(f.name),
        description: "",
        genre: allGenre,
        tags: "",
        type: allType,
        rating: allRating,
        status: "queued",
        progress: 0,
      });
    }
    if (rejected.length) setPickError(rejected.join(" · "));
    setItems((prev) => [...prev, ...fresh]);
  };

  const uploadOne = async (item: QueueItem): Promise<void> => {
    patch(item.id, { status: "uploading", progress: 0, error: undefined });
    const form = new FormData();
    form.append("video", item.file);
    form.append("title", item.title || item.file.name);
    if (item.description) form.append("description", item.description);
    if (item.genre) form.append("genre", item.genre);
    if (item.tags) form.append("tags", item.tags);
    form.append("type", item.type);
    form.append("rating", item.rating);
    try {
      await api.post("/api/uploads/video", form, {
        headers: { "Content-Type": "multipart/form-data" },
        // Big files take minutes — the global 10s axios timeout would abort
        // the upload mid-stream. No timeout; the server enforces limits.
        timeout: 0,
        onUploadProgress: (e) =>
          patch(item.id, {
            progress: Math.round((e.loaded / (e.total ?? 1)) * 100),
          }),
      });
      patch(item.id, { status: "done", progress: 100 });
    } catch (err) {
      const detail =
        err instanceof AxiosError
          ? (err.response?.data as { error?: { message?: string } } | undefined)
              ?.error?.message
          : undefined;
      patch(item.id, {
        status: "failed",
        error: detail ?? "Upload failed — check your connection.",
      });
    }
  };

  const startQueue = async () => {
    if (running) return;
    setRunning(true);
    // Simple worker pool over the live queue. State updates flush async, so
    // claims are tracked synchronously in a Set to stop two workers grabbing
    // the same item.
    const claimed = new Set<string>();
    const pull = (): QueueItem | undefined =>
      itemsRef.current.find((i) => i.status === "queued" && !claimed.has(i.id));
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (let next = pull(); next; next = pull()) {
        claimed.add(next.id);
        await uploadOne(next);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    const done = itemsRef.current.filter((i) => i.status === "done").length;
    const failed = itemsRef.current.filter((i) => i.status === "failed").length;
    toast({
      title: `${done} upload${done === 1 ? "" : "s"} started`,
      description: failed
        ? `${failed} failed — retry from the list.`
        : "Processing will begin shortly.",
      variant: failed ? "error" : "default",
    });
  };

  const applyToAll = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.status === "queued"
          ? { ...i, genre: allGenre || i.genre, type: allType, rating: allRating }
          : i
      )
    );
  };

  const queued = items.filter((i) => i.status === "queued").length;
  const uploading = items.filter((i) => i.status === "uploading").length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <h1 className="mb-1 font-display text-2xl">Upload Videos</h1>
      <p className="mb-6 text-sm text-itv-muted">
        Add multiple files, set metadata per video, then start the queue. Each
        video transcodes automatically after upload.
      </p>

      {/* picker */}
      <label
        className="grid h-32 cursor-pointer place-items-center rounded-xl border border-dashed border-itv-border2 text-center text-sm text-itv-muted hover:border-itv-magenta-border"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span>
          Drop or select videos (MP4/MOV/MKV/AVI · up to 4 GB each ·
          multi-select supported)
        </span>
      </label>
      {pickError && <p className="mt-2 text-sm text-itv-live">{pickError}</p>}

      {/* apply-to-all bar */}
      {items.length > 1 && (
        <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-itv-border bg-itv-surface p-4">
          <div className="min-w-40 flex-1">
            <Input
              label="Genre (all)"
              value={allGenre}
              onChange={(e) => setAllGenre(e.target.value)}
              placeholder="Drama"
            />
          </div>
          <MetaSelect
            label="Type (all)"
            value={allType}
            options={VIDEO_TYPES}
            onChange={(v) => setAllType(v as (typeof VIDEO_TYPES)[number])}
          />
          <MetaSelect
            label="Rating (all)"
            value={allRating}
            options={RATINGS}
            onChange={(v) => setAllRating(v as (typeof RATINGS)[number])}
          />
          <Button variant="subtle" size="sm" onClick={applyToAll}>
            Apply to queued
          </Button>
        </div>
      )}

      {/* queue */}
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-itv-border bg-itv-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileVideo size={16} className="shrink-0 text-itv-magenta" />
                <span className="truncate text-xs text-itv-muted">
                  {item.file.name} · {(item.file.size / 1e6).toFixed(1)} MB
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.status === "done" && (
                  <span className="flex items-center gap-1 text-xs text-itv-success">
                    <CheckCircle2 size={14} /> Processing
                  </span>
                )}
                {item.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => patch(item.id, { status: "queued", error: undefined })}
                  >
                    <RotateCcw size={13} /> Retry
                  </Button>
                )}
                {(item.status === "queued" || item.status === "failed") && (
                  <button
                    aria-label="Remove from queue"
                    onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                    className="grid h-9 w-9 place-items-center text-itv-faint hover:text-itv-text"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {item.status === "uploading" && (
              <div className="mt-3">
                <ProgressBar value={item.progress} label={`Uploading ${item.file.name}`} />
                <p className="mt-1 font-mono text-[11px] tabular-nums text-itv-faint">
                  {item.progress}%
                </p>
              </div>
            )}
            {item.error && <p className="mt-2 text-xs text-itv-live">{item.error}</p>}

            {item.status === "queued" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input
                  label="Title"
                  value={item.title}
                  onChange={(e) => patch(item.id, { title: e.target.value })}
                />
                <Input
                  label="Genre"
                  value={item.genre}
                  onChange={(e) => patch(item.id, { genre: e.target.value })}
                  placeholder="Drama"
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Description"
                    value={item.description}
                    onChange={(e) => patch(item.id, { description: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <Input
                  label="Tags (comma-separated)"
                  value={item.tags}
                  onChange={(e) => patch(item.id, { tags: e.target.value })}
                  placeholder="finale, live, behind-the-scenes"
                />
                <div className="flex gap-3">
                  <MetaSelect
                    label="Type"
                    value={item.type}
                    options={VIDEO_TYPES}
                    onChange={(v) =>
                      patch(item.id, { type: v as (typeof VIDEO_TYPES)[number] })
                    }
                  />
                  <MetaSelect
                    label="Rating"
                    value={item.rating}
                    options={RATINGS}
                    onChange={(v) =>
                      patch(item.id, { rating: v as (typeof RATINGS)[number] })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="mt-6 flex items-center gap-4">
          <Button onClick={startQueue} disabled={running || queued === 0} isLoading={running}>
            {running
              ? `Uploading ${uploading} of ${queued + uploading}…`
              : `Upload ${queued} video${queued === 1 ? "" : "s"}`}
          </Button>
          <span className="text-xs text-itv-faint">
            {CONCURRENCY} at a time · keep this page open until uploads finish
          </span>
        </div>
      )}
    </div>
  );
}

function MetaSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-itv-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-itv-border bg-itv-surface px-3 py-2.5 text-sm text-itv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-itv-magenta"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
