"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PillFilter } from "@/components/ui/PillFilter";
import { CreatorLink } from "@/components/video/VideoCard";

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
  creator_username?: string | null;
}

export default function TrainingPage() {
  const { data } = useSWR<{ courses: Course[] }>("/api/courses", swrFetcher, {
    shouldRetryOnError: false,
  });
  const [access, setAccess] = useState("all");
  const courses = (data?.courses ?? []).filter(
    (c) => access === "all" || c.access_level === access
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-itv-text">Learn</h1>
      <p className="mb-5 text-sm text-itv-muted">
        Structured courses from Influence creators — lessons, progress, and completion.
      </p>

      <PillFilter
        className="mb-6"
        options={[
          { value: "all", label: "All" },
          { value: "free", label: "Free" },
          { value: "premium", label: "Premium" },
          { value: "ultra", label: "Ultra" },
        ]}
        value={access}
        onChange={setAccess}
      />

      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-itv-border p-8 text-center">
          <p className="text-sm text-itv-muted">No courses here yet.</p>
          <Link
            href="/studio/courses"
            className="mt-2 inline-block text-sm font-semibold text-itv-magenta"
          >
            Create a course in Studio →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id}>
              <Link href={`/courses/${c.slug}`} className="group block">
                <Card interactive className="overflow-hidden">
                  <div className="relative aspect-video bg-itv-surface3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.thumbnail_url || "/placeholder.svg"}
                      alt={c.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2">
                      <Badge tone={c.access_level === "free" ? "success" : "gold"}>
                        {c.access_level}
                      </Badge>
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-itv-text">{c.title}</p>
                    <p className="mt-1 text-xs text-itv-muted">
                      {c.lesson_count} lessons · {c.enrollment_count} enrolled
                    </p>
                  </div>
                </Card>
              </Link>
              <p className="mt-1 px-1 text-xs text-itv-muted">
                <CreatorLink name={c.creator_name} username={c.creator_username} />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
