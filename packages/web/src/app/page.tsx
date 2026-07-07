"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Zap, Info } from "lucide-react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import { Rail } from "@/components/ui/Rail";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";

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
  progress?: number; // 0–1, continue-watching
}
interface CreatorSummary {
  username: string;
  name: string;
  tagline: string;
  live?: boolean;
  patron?: boolean;
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

const ROW_CONTINUE: VideoSummary[] = mkRow(
  ["The Last Broadcast — Ep 4", "Midnight Cypher", "Studio Sessions: Nova", "The Come Up — Ep 2", "Culture Desk Live", "Open Mic Finals"],
  ["Influence Drama", "Mars", "Nova King", "D. Cole", "Influence TV", "Ava Reyes"]
).map((v, i) => ({ ...v, progress: [0.72, 0.31, 0.55, 0.18, 0.9, 0.44][i] }));

const ROW_FORYOU = mkRow(
  ["Backstage: Making the Finale", "Live Shopping Recap", "Neighborhood Heroes", "Sound & Vision", "The Blend: Morning Set", "Creators Roundtable"],
  ["Ava Reyes", "Influence TV", "Jhene B", "Nova King", "The Blend", "Influence TV"],
  undefined,
  true
);
const ROW_LEARN = mkRow(
  ["Camera Basics", "Editing 101", "Growth Playbook", "On-Camera Presence", "Monetize Your Channel", "Landing Brand Deals"],
  ["Influence Academy"],
  (i) => `S1 · ${8 + i} EP`
);

const MOCK_CREATORS: CreatorSummary[] = [
  // First two are real seeded creators — their hubs show live data.
  { username: "novafields", name: "Nova Fields", tagline: "Drama · Live TV · Shop", live: true, patron: true },
  { username: "rexmarlow", name: "Rex Marlow", tagline: "News · Talk", patron: true },
  { username: "marsonair", name: "Mars", tagline: "Late-night · Cypher", live: true },
  { username: "theblend", name: "The Blend", tagline: "Morning show", patron: true },
  { username: "dcole", name: "D. Cole", tagline: "Docuseries" },
  { username: "jheneb", name: "Jhene B", tagline: "Lifestyle · Shop" },
];

/* ------------------------------------------------------------------ format */
const kfmt = (n?: number | null) =>
  !n ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

/* ------------------------------------------------------------------ flash sale countdown */
function FlashCountdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);
  const label =
    left <= 0
      ? "ENDED"
      : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <span className="font-mono text-2xl font-black tabular-nums tracking-[2px] text-itv-magenta">
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ live channel card */
function LiveCard({ c }: { c: ChannelSummary }) {
  return (
    <Link href={`/live/${c.slug}`} className="w-[260px] shrink-0 snap-start">
      <Card interactive className="overflow-hidden">
        <div className="relative aspect-video bg-itv-surface3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.thumbnail_url || "/placeholder.svg"}
            alt={c.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Badge tone="live">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
              Live
            </Badge>
            {c.live_shop_active && <Badge tone="magenta">Shop</Badge>}
          </div>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-semibold text-itv-text">
            {c.current_show ?? c.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-itv-muted">
            CH {c.number ?? "—"} · {c.name}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-itv-faint">
            {kfmt(c.viewer_count)} watching
          </p>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ VOD card */
function VodCard({ v }: { v: VideoSummary }) {
  return (
    <Link href={`/watch/${v.id}`} className="w-[220px] shrink-0 snap-start">
      <Card interactive className="overflow-hidden">
        <div className="relative aspect-video bg-itv-surface3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.thumbnail_url || "/placeholder.svg"}
            alt={v.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {v.is_patron && (
            <span className="absolute right-2 top-2">
              <Badge tone="gold">Patron</Badge>
            </span>
          )}
          {v.badge && (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
              {v.badge}
            </span>
          )}
          {v.progress != null && (
            <div className="absolute inset-x-0 bottom-0">
              <ProgressBar value={v.progress * 100} className="h-1 rounded-none" />
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-itv-text">
            {v.title}
          </p>
          <p className="mt-1 truncate text-xs text-itv-muted">
            {v.creator_name} · {kfmt(v.view_count)} views
          </p>
        </div>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ creator spotlight card */
function CreatorCard({ c }: { c: CreatorSummary }) {
  return (
    <Link href={`/creator/${c.username}`} className="w-[180px] shrink-0 snap-start">
      <Card interactive className="flex flex-col items-center p-4 text-center">
        <Avatar
          name={c.name}
          size="lg"
          ring={c.live ? "live" : c.patron ? "gold" : "magenta"}
        />
        <p className="mt-3 truncate text-sm font-semibold text-itv-text">{c.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-itv-muted">{c.tagline}</p>
        <div className="mt-2 flex gap-1">
          {c.live && <Badge tone="live">Live</Badge>}
          {c.patron && <Badge tone="gold">Patron</Badge>}
        </div>
        <span className="mt-3 text-xs font-medium text-itv-magenta">View Hub →</span>
      </Card>
    </Link>
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
    <div className="mx-auto max-w-[1400px] space-y-8 pb-12">
      {/* ---------------------------------------------------------- HERO */}
      <section className="relative h-[300px] overflow-hidden md:h-[420px]">
        <div className="absolute inset-0 bg-gradient-to-br from-itv-bg via-itv-surface to-itv-surface" />
        <div className="absolute inset-y-0 right-0 w-3/5">
          {featured?.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featured.thumbnail_url}
              alt={featured.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(700px 460px at 68% 38%, rgba(217,70,239,0.4), transparent 66%)",
              }}
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-itv-bg via-itv-bg/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-itv-bg to-transparent" />

        <div className="absolute bottom-0 left-0 z-10 flex max-w-md flex-col p-6 md:p-10">
          <div className="flex items-center gap-2">
            <Badge tone="live">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
              Live
            </Badge>
            <span className="text-xs uppercase tracking-widest text-itv-muted">
              CH {featured?.number ?? "04"} · {featured?.name ?? "Influence Drama"}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-black leading-[1.05] tracking-tight text-itv-text md:text-5xl">
            {featured?.current_show ?? "The Last Broadcast"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-itv-muted">
            Season finale streaming live across the network — plus on-demand,
            creators, courses, and live shopping in one place.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={featured ? `/live/${featured.slug}` : "/live"}
              className="inline-flex items-center gap-2 rounded-md bg-itv-magenta px-5 py-2.5 text-sm font-medium text-white transition-[background-color,box-shadow] hover:bg-itv-magenta-strong hover:shadow-glow-magenta"
            >
              <Play size={15} fill="currentColor" /> Watch Now
            </Link>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-md border border-itv-border bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-itv-text transition-colors hover:bg-white/[0.12]"
            >
              <Info size={15} /> More Info
            </Link>
            <span className="font-mono text-xs tabular-nums text-itv-faint">
              {kfmt(featured?.viewer_count ?? 12480)} watching
            </span>
          </div>
        </div>
      </section>

      <div className="space-y-8 px-4">
        {/* -------------------------------------------------------- LIVE NOW */}
        <Rail title="Live Now" href="/live">
          {live.map((c) => (
            <LiveCard key={c.id} c={c} />
          ))}
        </Rail>

        {/* -------------------------------------------------------- FLASH SALE */}
        <Card
          tone="surface2"
          className="flex items-center justify-between p-4 ring-1 ring-inset ring-itv-magenta-border"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-itv-magenta">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-itv-magenta">
                Flash Sale · Live on Influence Drama
              </p>
              <p className="text-sm font-semibold text-itv-text">
                Finale Merch Drop — up to 40% off
              </p>
            </div>
          </div>
          <Link href="/shop" className="text-right">
            <FlashCountdown seconds={8 * 60 + 42} />
            <p className="text-[11px] text-itv-faint">tap to shop</p>
          </Link>
        </Card>

        {/* -------------------------------------------------------- CONTINUE */}
        <Rail title="Continue Watching" href="/browse">
          {ROW_CONTINUE.map((v) => (
            <VodCard key={v.id} v={v} />
          ))}
        </Rail>

        {/* -------------------------------------------------------- FOR YOU */}
        <Rail title="For You" href="/browse">
          {forYou.map((v) => (
            <VodCard key={v.id} v={v} />
          ))}
        </Rail>

        {/* -------------------------------------------------------- CREATORS */}
        <Rail title="Creator Spotlight" href="/browse">
          {MOCK_CREATORS.map((c) => (
            <CreatorCard key={c.username} c={c} />
          ))}
        </Rail>

        {/* -------------------------------------------------------- LEARN */}
        <Rail title="Learn from Creators" href="/training">
          {ROW_LEARN.map((v) => (
            <VodCard key={v.id} v={v} />
          ))}
        </Rail>

        {/* -------------------------------------------------------- LEADERBOARD */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-itv-border px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-itv-muted">
              Community Leaderboard
            </span>
            <Link
              href="/community"
              className="text-xs font-medium text-itv-magenta hover:underline"
            >
              Join Community →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {leaders.map((l, i) => (
              <div
                key={l.user}
                className={`px-4 py-3 ${i % 2 === 0 ? "border-r border-itv-border" : ""} ${
                  i < 2 ? "border-b border-itv-border sm:border-b-0" : ""
                } ${i === 2 ? "sm:border-r" : ""}`}
              >
                <Badge tone={i === 0 ? "gold" : "magenta"}>{l.rank}</Badge>
                <p className="mt-1.5 text-sm font-bold text-itv-text">{l.user}</p>
                <p className="font-mono text-[11px] tabular-nums text-itv-faint">
                  {l.pts}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
