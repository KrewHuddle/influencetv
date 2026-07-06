"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Zap } from "lucide-react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";

/* ------------------------------------------------------------------ types */
interface ChannelSummary {
  id: string;
  name: string;
  slug: string;
  status?: string;
  number?: number | null;
  current_show?: string | null;
  viewer_count?: number | null;
  thumbnail_url?: string | null;
  live_shop_active?: boolean;
  progress?: number | null;
}
interface VideoSummary {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  creator_name?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
  is_patron?: boolean;
  badge?: string;
}

/* ------------------------------------------------------------------ mock fallbacks (endpoints not yet wired) */
const MOCK_LIVE: ChannelSummary[] = [
  { id: "m1", name: "Influence Drama", slug: "drama", number: 4, current_show: "The Last Broadcast", viewer_count: 12480, live_shop_active: true },
  { id: "m2", name: "Influence News", slug: "news", number: 7, current_show: "Evening Desk", viewer_count: 6120 },
  { id: "m3", name: "Influence Ent.", slug: "ent", number: 11, current_show: "Late Set", viewer_count: 3940 },
  { id: "m4", name: "Culture 24", slug: "culture", number: 2, current_show: "Open Mic", viewer_count: 2210 },
  { id: "m5", name: "The Blend", slug: "blend", number: 19, current_show: "Morning Blend", viewer_count: 1180 },
];
const mkRow = (
  titles: string[],
  creators: string[],
  badge?: (i: number) => string,
  patron = false
): VideoSummary[] =>
  titles.map((t, i) => ({
    id: `${t}-${i}`.replace(/[^a-z0-9]+/gi, "").slice(0, 28).toLowerCase(),
    title: t,
    creator_name: creators[i % creators.length],
    duration_seconds: 240 + i * 173 + t.length * 7,
    view_count: 8200 + i * 7400 + t.length * 311,
    is_patron: patron && i % 3 === 0,
    badge: badge?.(i),
  }));

// Distinct content per section (fixes duplicate-placeholder bug).
const ROW_CONTINUE = mkRow(
  ["The Last Broadcast — Ep 4", "Midnight Cypher", "Studio Sessions: Nova", "The Come Up — Ep 2", "Culture Desk Live", "Open Mic Finals"],
  ["Influence Drama", "Mars", "Nova King", "D. Cole", "Influence TV", "Ava Reyes"],
  (i) => `${8 + i * 3} min left`
);
const ROW_FORYOU = mkRow(
  ["Backstage: Making the Finale", "Live Shopping Recap", "Neighborhood Heroes", "Sound & Vision", "The Blend: Morning Set", "Creators Roundtable"],
  ["Ava Reyes", "Influence TV", "Jhene B", "Nova King", "The Blend", "Influence TV"],
  undefined,
  true
);
const ROW_TRAINING = mkRow(
  ["Camera Basics", "Editing 101", "Growth Playbook", "On-Camera Presence", "Monetize Your Channel", "Landing Brand Deals"],
  ["Influence Academy"],
  (i) => `S1 · ${8 + i} EP`
);
const ROW_NEWS = mkRow(
  ["Evening Desk: Top Stories", "Market Watch", "City Hall Recap", "The Weekend Brief", "Culture Report", "Late Brief"],
  ["Influence News"],
  (i) => `${2 + i}h ago`
);

/* ------------------------------------------------------------------ format */
const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const mins = (s?: number | null) => (s ? `${Math.round(s / 60)} min` : "");

/* ------------------------------------------------------------------ flash sale countdown */
function FlashCountdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);
  if (left <= 0)
    return <span className="font-mono text-[22px] font-black tracking-[2px] text-itv-magenta">ENDED</span>;
  const m = Math.floor(left / 60);
  const s = left % 60;
  return (
    <span className="font-mono text-[22px] font-black tracking-[2px] text-itv-magenta">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ------------------------------------------------------------------ portrait card (live) */
function Pcard({ c }: { c: ChannelSummary }) {
  const watching = c.progress != null;
  return (
    <Link href={`/live/${c.slug}`} className="w-[108px] shrink-0 cursor-pointer">
      <div
        className={`relative h-[152px] w-[108px] overflow-hidden border bg-itv-surface3 ${
          watching ? "border-itv-magenta" : "border-white/[0.06]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.thumbnail_url || "/placeholder.svg"}
          alt={c.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-itv-magenta shadow-[0_0_0_2px_rgba(217,70,239,0.3)]" />
        {c.live_shop_active && (
          <span className="absolute right-2 top-2 bg-white px-[5px] py-[2px] text-[7px] font-black text-itv-bg">
            SHOP
          </span>
        )}
        {watching && (
          <span
            className="absolute bottom-0 left-0 h-[2px] bg-itv-magenta"
            style={{ width: `${Math.round((c.progress ?? 0) * 100)}%` }}
          />
        )}
      </div>
      <p className="mb-[2px] mt-[6px] text-[10px] font-bold leading-[1.2] text-itv-text">{c.name}</p>
      <p className="flex items-center gap-1 text-[9px] text-white/[0.35]">
        <span className="h-1 w-1 rounded-full bg-itv-magenta" />
        {kfmt(c.viewer_count)} live
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ landscape card (VOD) */
function Tcard({ v }: { v: VideoSummary }) {
  return (
    <Link href={`/watch/${v.id}`} className="w-[148px] shrink-0 cursor-pointer">
      <div className="relative h-[84px] w-[148px] overflow-hidden bg-itv-surface3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.thumbnail_url || "/placeholder.svg"}
          alt={v.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {v.is_patron && (
          <span className="absolute right-1.5 top-1.5 bg-itv-magenta px-1 py-[2px] text-[7px] font-extrabold text-white">
            PATRON
          </span>
        )}
        {v.badge && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/75 px-1 py-[2px] font-mono text-[8px] text-white/80">
            {v.badge}
          </span>
        )}
      </div>
      <p className="mb-[3px] mt-[6px] line-clamp-2 text-[11px] font-bold leading-[1.3] text-itv-text">{v.title}</p>
      <p className="text-[10px] text-white/[0.38]">
        {v.creator_name} · {kfmt(v.view_count)} views
      </p>
    </Link>
  );
}

/* ------------------------------------------------------------------ row wrapper */
function Row({ label, href = "/browse", children }: { label: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-[22px]">
      <div className="flex items-center justify-between px-5">
        <h2 className="text-[13px] font-extrabold text-itv-white">{label}</h2>
        <Link href={href} className="text-[10px] font-semibold uppercase tracking-[0.5px] text-itv-magenta">
          See All →
        </Link>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pt-3">{children}</div>
    </section>
  );
}

/* ================================================================== page */
export default function HomePage() {
  const { data: chData } = useSWR<{ channels: ChannelSummary[] }>("/api/channels", swrFetcher, { shouldRetryOnError: false });
  const { data: fyData } = useSWR<{ items: VideoSummary[] }>("/api/browse?sort=new", swrFetcher, { shouldRetryOnError: false });
  const { data: lbData } = useSWR<{ leaders: Array<{ level_name: string; display_name?: string; username?: string; total_points: number }> }>(
    "/api/community/leaderboard?limit=4",
    swrFetcher,
    { shouldRetryOnError: false }
  );

  const liveReal = (chData?.channels ?? []).filter((c) => c.status === "active");
  const live = liveReal.length ? liveReal : MOCK_LIVE;
  const forYou = fyData?.items?.length ? fyData.items : ROW_FORYOU;
  const featured = live[0];

  const leaders =
    lbData?.leaders?.length
      ? lbData.leaders.map((l) => ({
          rank: l.level_name,
          user: l.username ? `@${l.username}` : l.display_name ?? "member",
          pts: `${l.total_points.toLocaleString()} pts`,
        }))
      : [
          { rank: "Legend", user: "@marsonair", pts: "48,210 pts" },
          { rank: "Insider", user: "@navahoney", pts: "31,540 pts" },
          { rank: "Superfan", user: "@dcole", pts: "22,880 pts" },
          { rank: "Fan", user: "@theblend", pts: "14,120 pts" },
        ];

  return (
    <div className="pb-8">
      {/* HERO */}
      <section
        className="relative h-[260px] overflow-hidden md:h-[320px]"
        style={{ background: "linear-gradient(90deg,#0d0d0d,#1a0a1a)" }}
      >
        {/* artwork right half */}
        <div className="absolute inset-y-0 right-0 w-3/5">
          {featured?.thumbnail_url ? (
            <Image src={featured.thumbnail_url} alt={featured.name} fill sizes="60vw" className="object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "radial-gradient(600px 400px at 70% 40%, rgba(217,70,239,0.35), transparent 65%)" }}
            />
          )}
        </div>
        {/* fades */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,#0d0d0d 30%,transparent 65%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-[120px]" style={{ background: "linear-gradient(transparent,#0d0d0d)" }} />

        {/* content bottom-left */}
        <div className="absolute bottom-0 left-0 z-10 flex max-w-[380px] flex-col p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-itv-magenta px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[2px] text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
            <span className="text-[10px] uppercase tracking-[1px] text-white/50">
              CH {featured?.number ?? "04"} · {featured?.name ?? "Influence Drama"}
            </span>
          </div>
          <h1 className="mb-[6px] mt-2 text-[30px] font-black leading-[1.05] tracking-[-0.5px]">
            {featured?.current_show ?? "The Last Broadcast"}
          </h1>
          <p className="mb-4 text-[12px] leading-[1.5] text-white/55">
            Season finale streaming live across the network — plus VOD, creators, and live shopping in one place.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={featured ? `/live/${featured.slug}` : "/live"}
              className="flex items-center gap-1.5 bg-white px-[18px] py-[9px] text-[12px] font-extrabold text-black hover:brightness-90"
            >
              <Play size={13} fill="currentColor" /> Watch Now
            </Link>
            <Link
              href="/live"
              className="bg-white/[0.15] px-[18px] py-[9px] text-[12px] font-extrabold text-white hover:bg-white/25"
            >
              More Info
            </Link>
            <span className="text-[12px] text-white/40">{kfmt(featured?.viewer_count ?? 12480)} watching</span>
          </div>
        </div>
      </section>

      {/* ROWS */}
      <Row label="🔴 Live Now" href="/live">
        {live.map((c) => <Pcard key={c.id} c={c} />)}
      </Row>

      {/* FLASH SALE BAR */}
      <div
        className="mx-5 mt-5 flex items-center justify-between p-3 px-4"
        style={{ background: "#150515", border: "1px solid rgba(217,70,239,0.25)" }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center bg-itv-magenta">
            <Zap size={16} className="text-white" fill="currentColor" />
          </div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[2px] text-itv-magenta">
              Flash Sale · Live on Influence Drama
            </p>
            <p className="text-[12px] font-bold text-white">Finale Merch Drop — up to 40% off</p>
          </div>
        </div>
        <div className="text-right">
          <FlashCountdown seconds={8 * 60 + 42} />
          <p className="text-[9px] text-white/[0.35]">tap to shop</p>
        </div>
      </div>

      <Row label="Continue Watching">{ROW_CONTINUE.map((v) => <Tcard key={v.id} v={v} />)}</Row>
      <Row label="For You">{forYou.map((v) => <Tcard key={v.id} v={v} />)}</Row>
      <Row label="Training Series" href="/training">{ROW_TRAINING.map((v) => <Tcard key={v.id} v={v} />)}</Row>
      <Row label="Breaking News" href="/news">{ROW_NEWS.map((v) => <Tcard key={v.id} v={v} />)}</Row>

      {/* COMMUNITY LEADERBOARD */}
      <div className="mx-5 mt-5 border border-white/[0.07]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-[14px] py-[10px]">
          <span className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-white/40">
            Community Leaderboard
          </span>
          <Link href="/community" className="text-[11px] font-bold text-itv-magenta">
            Join Community →
          </Link>
        </div>
        <div className="flex">
          {leaders.map((l, i) => (
            <div
              key={l.user}
              className={`flex-1 px-[14px] py-[10px] ${i < leaders.length - 1 ? "border-r border-white/[0.07]" : ""}`}
            >
              <p className="text-[8px] font-extrabold uppercase tracking-[1.5px] text-itv-magenta">{l.rank}</p>
              <p className="text-[11px] font-extrabold text-white">{l.user}</p>
              <p className="text-[10px] text-white/[0.35]">{l.pts}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
