"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Lock, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { api, swrFetcher } from "@/lib/api";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Lesson {
  id: string;
  module_id: string | null;
  title: string;
  video_id: string | null;
  content: string | null;
  hls_url: string | null;
  is_preview: boolean;
  position: number;
}
interface Module { id: string; title: string; position: number }
interface Course {
  id: string; title: string; slug: string; description?: string | null;
  creator_name?: string | null; access_level: string; lesson_count: number;
  enrollment_count: number;
}
interface Detail {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
  enrolled: boolean;
  progress: Array<{ lesson_id: string; completed: boolean }>;
}

export default function CoursePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { toast } = useToast();
  const { data, mutate } = useSWR<Detail>(`/api/courses/${slug}`, swrFetcher, { shouldRetryOnError: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const done = useMemo(
    () => new Set((data?.progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id)),
    [data]
  );
  const lessons = data?.lessons ?? [];
  const selected = lessons.find((l) => l.id === selectedId) ?? lessons[0] ?? null;
  const enrolled = data?.enrolled ?? false;

  const enroll = async () => {
    if (!data) return;
    try {
      await api.post(`/api/courses/${data.course.id}/enroll`);
      toast({ title: "Enrolled" });
      void mutate();
    } catch {
      toast({ title: "Upgrade required for this course", variant: "error" });
    }
  };

  const markComplete = async (lessonId: string) => {
    if (!data) return;
    try {
      const res = await api.post(`/api/courses/${data.course.id}/lessons/${lessonId}/progress`, { completed: true });
      if (res.data?.data?.courseComplete) toast({ title: "Course complete! 🎉" });
      void mutate();
    } catch {
      toast({ title: "Enroll to track progress", variant: "error" });
    }
  };

  if (!data) return <div className="px-6 py-10 text-sm text-white/[0.42]">Loading…</div>;

  const { course } = data;
  const completedCount = lessons.filter((l) => done.has(l.id)).length;
  const pct = course.lesson_count ? Math.round((completedCount / course.lesson_count) * 100) : 0;

  // Group lessons under modules; module_id null → "Lessons".
  const groups = [
    ...data.modules.map((m) => ({ id: m.id, title: m.title, items: lessons.filter((l) => l.module_id === m.id) })),
    { id: "_", title: data.modules.length ? "More" : "Lessons", items: lessons.filter((l) => !l.module_id) },
  ].filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-black">{course.title}</h1>
        <p className="mt-1 text-[12px] text-white/[0.55]">
          {course.creator_name ?? "Influence"} · {course.lesson_count} lessons · {course.enrollment_count} enrolled
        </p>
        {course.description && <p className="mt-3 max-w-2xl text-sm text-white/[0.7]">{course.description}</p>}
        {enrolled ? (
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-[11px] text-white/[0.55]">
              <span>{completedCount}/{course.lesson_count} complete</span><span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-itv-surface2">
              <div className="h-full bg-itv-magenta" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <Button className="mt-4" onClick={enroll}>Enroll{course.access_level !== "free" ? ` (${course.access_level})` : ""}</Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* lesson viewer */}
        <div>
          {selected ? (
            <>
              {selected.hls_url ? (
                <VideoPlayer hlsUrl={selected.hls_url} autoPlay={false} />
              ) : selected.content ? (
                <div className="whitespace-pre-line border border-itv-border bg-itv-surface p-5 text-sm text-white/[0.8]">
                  {selected.content}
                </div>
              ) : (
                <div className="grid aspect-video place-items-center border border-itv-border bg-itv-surface text-sm text-white/[0.42]">
                  <div className="text-center">
                    <Lock className="mx-auto mb-2 text-white/40" size={22} />
                    Enroll to unlock this lesson
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold">{selected.title}</h2>
                {enrolled && (selected.hls_url || selected.content) && (
                  <button
                    onClick={() => markComplete(selected.id)}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-itv-magenta"
                  >
                    {done.has(selected.id) ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    {done.has(selected.id) ? "Completed" : "Mark complete"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/[0.42]">No lessons yet.</p>
          )}
        </div>

        {/* curriculum */}
        <aside className="border border-itv-border bg-itv-surface">
          {groups.map((g) => (
            <div key={g.id} className="border-b border-itv-border last:border-b-0">
              <p className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-[1px] text-white/[0.5]">{g.title}</p>
              {g.items.map((l) => {
                const isDone = done.has(l.id);
                const active = selected?.id === l.id;
                const locked = !l.hls_url && !l.content && !l.is_preview;
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] ${active ? "bg-white/[0.06]" : ""} hover:bg-white/[0.04]`}
                  >
                    {locked ? <Lock size={14} className="text-white/35" /> : isDone ? <CheckCircle2 size={14} className="text-itv-magenta" /> : <PlayCircle size={14} className="text-white/55" />}
                    <span className={locked ? "text-white/45" : ""}>{l.title}</span>
                    {l.is_preview && !enrolled && <span className="ml-auto text-[9px] uppercase tracking-[1px] text-itv-magenta">Preview</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length && <p className="p-4 text-sm text-white/[0.42]">Curriculum coming soon.</p>}
        </aside>
      </div>
    </div>
  );
}
