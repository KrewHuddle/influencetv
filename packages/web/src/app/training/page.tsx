"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { VideoGrid } from "@/components/video/VideoGrid";
import type { VideoSummary } from "@/components/video/VideoCard";

const FALLBACK: VideoSummary[] = [
  { id: "tr1", title: "Camera Basics", creator_name: "Influence Academy", duration_seconds: 640, view_count: 18200 },
  { id: "tr2", title: "Editing 101", creator_name: "Influence Academy", duration_seconds: 980, view_count: 24100 },
  { id: "tr3", title: "Growth Playbook", creator_name: "Influence Academy", duration_seconds: 1220, view_count: 40300 },
  { id: "tr4", title: "On-Camera Presence", creator_name: "Influence Academy", duration_seconds: 720, view_count: 15600 },
  { id: "tr5", title: "Monetize Your Channel", creator_name: "Influence Academy", duration_seconds: 1100, view_count: 33800 },
  { id: "tr6", title: "Landing Brand Deals", creator_name: "Influence Academy", duration_seconds: 860, view_count: 21400 },
];

export default function TrainingPage() {
  const { data } = useSWR<{ items: VideoSummary[] }>(
    "/api/browse?category=training",
    swrFetcher,
    { shouldRetryOnError: false }
  );
  const items = data?.items?.length ? data.items : FALLBACK;

  return (
    <div className="px-6 py-6">
      <h1 className="mb-1 text-[22px] font-black">Training</h1>
      <p className="mb-6 text-[12px] text-white/[0.55]">
        Skill-building series for creators — camera, editing, growth, and business.
      </p>
      <VideoGrid items={items} />
    </div>
  );
}
