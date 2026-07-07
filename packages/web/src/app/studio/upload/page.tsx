"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function UploadPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setProgress(0);
    const form = new FormData();
    form.append("video", file);
    form.append("title", title || file.name);
    try {
      await api.post("/api/uploads/video", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) =>
          setProgress(Math.round((e.loaded / (e.total ?? 1)) * 100)),
      });
      toast({ title: "Upload started", description: "Processing will begin shortly." });
      setFile(null);
      setTitle("");
    } catch {
      toast({ title: "Upload failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Upload Video</h1>
      <form onSubmit={submit} className="space-y-5">
        <label className="grid h-40 cursor-pointer place-items-center rounded-xl border border-dashed border-white/20 text-center text-sm text-itv-muted hover:border-white/40">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span>{file.name} · {(file.size / 1e6).toFixed(1)} MB</span>
          ) : (
            <span>Drop or select a video (MP4/MOV/MKV/AVI)</span>
          )}
        </label>

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

        {busy && (
          <div className="h-2 w-full overflow-hidden rounded bg-itv-surface2">
            <div className="h-full bg-itv-magenta transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <Button type="submit" disabled={!file || busy}>
          {busy ? `Uploading ${progress}%` : "Upload & Process"}
        </Button>
      </form>
    </div>
  );
}
