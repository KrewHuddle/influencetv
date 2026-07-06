"use client";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnail_url?: string | null;
  access_level: string;
  lesson_count: number;
  enrollment_count: number;
  creator_name?: string | null;
}

export default function TrainingPage() {
  const { data } = useSWR<{ courses: Course[] }>("/api/courses", swrFetcher, { shouldRetryOnError: false });
  const courses = data?.courses ?? [];

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Training</h1>
      <p className="mb-6 text-[12px] text-white/[0.55]">
        Structured courses from Influence creators — lessons, progress, and completion.
      </p>

      {courses.length === 0 ? (
        <div className="border border-itv-border bg-itv-surface p-8 text-center">
          <p className="text-sm text-white/[0.55]">No courses published yet.</p>
          <Link href="/studio/courses" className="mt-2 inline-block text-[12px] font-semibold text-itv-magenta">
            Create a course in Studio →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.slug}`} className="group border border-itv-border bg-itv-surface transition-colors hover:border-itv-magenta-border">
              <div className="relative aspect-video overflow-hidden bg-itv-surface3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail_url || "/placeholder.svg"} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute right-2 top-2 bg-itv-magenta px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[1px] text-white">
                  {c.access_level}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-bold">{c.title}</p>
                <p className="mt-1 text-[11px] text-white/[0.45]">
                  {c.creator_name ?? "Influence"} · {c.lesson_count} lessons · {c.enrollment_count} enrolled
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
