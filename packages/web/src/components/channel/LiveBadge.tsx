export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-apex-red/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-apex-red">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-apex-red" />
      Live
    </span>
  );
}
