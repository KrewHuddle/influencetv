"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, swrFetcher } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Module { id: string; title: string; position: number }
interface Lesson { id: string; module_id: string | null; title: string; is_preview: boolean; position: number }
interface Detail {
  course: { id: string; title: string; slug: string; is_published: boolean; lesson_count: number };
  modules: Module[];
  lessons: Lesson[];
}

export default function CourseBuilderPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { toast } = useToast();
  const { data, mutate } = useSWR<Detail>(`/api/courses/${slug}`, swrFetcher, { shouldRetryOnError: false });

  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonModule, setLessonModule] = useState("");
  const [videoId, setVideoId] = useState("");
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  if (!data) return <div className="px-6 py-10 text-sm text-itv-faint">Loading…</div>;
  const { course, modules, lessons } = data;

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/api/courses/${course.id}/modules`, { title: moduleTitle, position: modules.length });
    setModuleTitle("");
    void mutate();
  };

  const addLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/courses/${course.id}/lessons`, {
        title: lessonTitle,
        moduleId: lessonModule || undefined,
        videoId: videoId || undefined,
        content: content || undefined,
        isPreview,
        position: lessons.length,
      });
      toast({ title: "Lesson added" });
      setLessonTitle("");
      setVideoId("");
      setContent("");
      void mutate();
    } catch {
      toast({ title: "Failed to add lesson", variant: "error" });
    }
  };

  const publish = async () => {
    await api.patch(`/api/courses/${course.id}`, { isPublished: !course.is_published });
    void mutate();
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black">{course.title}</h1>
          <p className="text-[11px] text-itv-faint">{course.lesson_count} lessons · {course.is_published ? "published" : "draft"}</p>
        </div>
        <Button variant={course.is_published ? "ghost" : "primary"} onClick={publish}>
          {course.is_published ? "Unpublish" : "Publish"}
        </Button>
      </div>

      {/* curriculum */}
      <div className="mb-8 space-y-4">
        {modules.map((m) => (
          <div key={m.id} className="border border-itv-border bg-itv-surface">
            <p className="border-b border-itv-border px-4 py-2 text-[12px] font-extrabold">{m.title}</p>
            {lessons.filter((l) => l.module_id === m.id).map((l) => (
              <p key={l.id} className="px-4 py-2 text-[13px] text-itv-text">
                {l.title}{l.is_preview ? " · preview" : ""}
              </p>
            ))}
          </div>
        ))}
        {lessons.filter((l) => !l.module_id).length > 0 && (
          <div className="border border-itv-border bg-itv-surface">
            <p className="border-b border-itv-border px-4 py-2 text-[12px] font-extrabold">Ungrouped</p>
            {lessons.filter((l) => !l.module_id).map((l) => (
              <p key={l.id} className="px-4 py-2 text-[13px] text-itv-text">{l.title}{l.is_preview ? " · preview" : ""}</p>
            ))}
          </div>
        )}
        {!lessons.length && <p className="text-sm text-itv-faint">No lessons yet.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* add module */}
        <form onSubmit={addModule} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Add Module</h2>
          <Input label="Module title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} required />
          <Button type="submit" className="w-full">Add Module</Button>
        </form>

        {/* add lesson */}
        <form onSubmit={addLesson} className="space-y-3 border border-itv-border bg-itv-surface p-4">
          <h2 className="text-[13px] font-extrabold">Add Lesson</h2>
          <Input label="Lesson title" value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} required />
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-itv-muted">Module</span>
            <select value={lessonModule} onChange={(e) => setLessonModule(e.target.value)} className="w-full rounded-[4px] border border-itv-border bg-itv-surface2 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-itv-magenta">
              <option value="">Ungrouped</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <Input label="Video ID (optional)" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-itv-muted">Text content (optional)</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="w-full rounded-[4px] border border-itv-border bg-itv-surface2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-itv-magenta" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} /> Free preview
          </label>
          <Button type="submit" className="w-full">Add Lesson</Button>
        </form>
      </div>
    </div>
  );
}
