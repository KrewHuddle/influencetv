import { MessageSquare, Heart, Pin } from "lucide-react";
import { formatCount } from "@/lib/constants";
import { Card } from "@/components/ui/Card";

export interface PostSummary {
  id: string;
  title?: string | null;
  body: string;
  type: string;
  author_name?: string | null;
  like_count?: number | null;
  comment_count?: number | null;
  is_pinned?: boolean;
  created_at: string;
}

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-itv-faint">
        {post.is_pinned && <Pin size={12} className="text-itv-accent" />}
        <span className="text-itv-muted">{post.author_name ?? "Member"}</span>
        <span>·</span>
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
      </div>
      {post.title && <h3 className="mb-1 font-semibold text-itv-text">{post.title}</h3>}
      <p className="line-clamp-3 text-sm text-itv-muted">{post.body}</p>
      <div className="mt-3 flex gap-4 text-xs text-itv-faint">
        <span className="inline-flex items-center gap-1">
          <Heart size={13} /> {formatCount(post.like_count)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={13} /> {formatCount(post.comment_count)}
        </span>
      </div>
    </Card>
  );
}
