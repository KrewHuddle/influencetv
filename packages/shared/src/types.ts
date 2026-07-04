// ─── Apex shared domain types ───

export type UserRole =
  | "viewer_free"
  | "viewer_premium"
  | "viewer_ultra"
  | "creator"
  | "seller"
  | "moderator"
  | "channel_manager"
  | "super_admin";

export type SubscriptionPlan = "free" | "premium" | "ultra";

export type VideoStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "rejected";

export type VideoType =
  | "episode"
  | "movie"
  | "clip"
  | "live_recording"
  | "youtube_embed";

export type ChannelStatus = "active" | "offline" | "maintenance" | "error";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type ContentRating = "G" | "PG" | "PG-13" | "TV-14" | "TV-MA";

export type PostType =
  | "discussion"
  | "announcement"
  | "poll"
  | "episode_thread"
  | "clip";

export type PayoutStatus = "pending" | "processing" | "paid" | "failed";

export type DmcaStatus =
  | "received"
  | "under_review"
  | "actioned"
  | "counter_noticed"
  | "resolved"
  | "rejected";

export type StrikeSeverity = "warning" | "minor" | "major" | "permanent";

// ─── API envelope ───
export interface ApiError {
  message: string;
  code: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

// ─── Role hierarchy (higher = more privileged) ───
export const ROLE_RANK: Record<UserRole, number> = {
  viewer_free: 0,
  viewer_premium: 1,
  viewer_ultra: 2,
  creator: 3,
  seller: 3,
  moderator: 4,
  channel_manager: 4,
  super_admin: 5,
};

export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  premium: 1,
  ultra: 2,
};

export const DEVICE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 1,
  premium: 3,
  ultra: 6,
};
