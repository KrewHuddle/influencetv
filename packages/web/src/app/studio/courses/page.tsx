"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Course {
  id: string; title: string; slug: string; access_level: string;
  is_published: boolean; lesson_count: number; enrollment_count: number;
}

export default function StudioCoursesPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<{ courses: Course[] }>("/api/courses/me/authored", swrFetcher, { shouldRetryOnError: false });
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState("free");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/courses", { title, accessLevel: access });
      toast({ title: "Course created" });
      setTitle("");
      void mutate();
    } catch {
      toast({ title: "Failed (creator role required)", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (c: Course) => {
    await api.patch(`/api/courses/${c.id}`, { isPublished: !c.is_published });
    void mutate();
  };

  const courses = data?.courses ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <h1 className="mb-6 text-[22px] font-black">Courses</h1>

      <div className="mb-8 space-y-2">
        {courses.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-itv-border bg-itv-surface p-3">
            <div>
              <Link href={`/studio/courses/${c.slug}`} className="text-sm font-bold hover:text-itv-magenta">{c.title}</Link>
              <p className="text-[11px] text-white/[0.45]">
                {c.access_level} · {c.lesson_count} lessons · {c.enrollment_count} enrolled
              </p>
            </div>
            <button
              onClick={() => togglePublish(c)}
              className="px-3 py-1 text-[11px] font-bold uppercase tracking-[1px]"
              style={c.is_published ? { background: "#D946EF", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              {c.is_published ? "Published" : "Draft"}
            </button>
          </div>
        ))}
        {!courses.length && <p className="text-sm text-white/[0.42]">No courses yet. Create one below.</p>}
      </div>

      <form onSubmit={create} className="space-y-4 border border-itv-border bg-itv-surface p-5">
        <h2 className="text-[13px] font-extrabold">New Course</h2>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-white/[0.55]">Access</span>
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value)}
            className="w-full rounded-[4px] border border-itv-border bg-itv-surface2 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-itv-magenta"
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="ultra">Ultra</option>
          </select>
        </label>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create Course"}</Button>
      </form>
    </div>
  );
}
