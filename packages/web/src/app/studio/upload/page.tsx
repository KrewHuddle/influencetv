"use client";
import { useState } from "react";
import { AxiosError } from "axios";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

export default function UploadPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const pickFile = (f: File | null) => {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFile(null);
      setFileError("Unsupported file type. Use MP4, MOV, MKV, or AVI.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setFileError("File is too large. Maximum size is 4 GB.");
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
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
    } catch (err) {
      // Keep the file staged so retry works.
      const detail =
        err instanceof AxiosError
          ? (err.response?.data as { error?: { message?: string } } | undefined)?.error
              ?.message
          : undefined;
      toast({
        title: "Upload failed",
        description: detail ?? "Check your connection and try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-6">
      <h1 className="mb-6 font-display text-2xl">Upload Video</h1>
      <form onSubmit={submit} className="space-y-5">
        <label className="grid h-40 cursor-pointer place-items-center rounded-xl border border-dashed border-itv-border2 text-center text-sm text-itv-muted hover:border-itv-magenta-border">
          <input
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span>{file.name} · {(file.size / 1e6).toFixed(1)} MB</span>
          ) : (
            <span>Drop or select a video (MP4/MOV/MKV/AVI, up to 4 GB)</span>
          )}
        </label>
        {fileError && <p className="text-sm text-itv-live">{fileError}</p>}

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
