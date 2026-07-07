import { Badge } from "@/components/ui/Badge";

export function LiveBadge() {
  return (
    <Badge tone="live">
      <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-itv-live" />
      Live
    </Badge>
  );
}
