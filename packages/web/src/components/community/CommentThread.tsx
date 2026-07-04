export interface CommentNode {
  id: string;
  body: string;
  author_name?: string | null;
  created_at: string;
  replies?: CommentNode[];
}

function Comment({ comment, depth }: { comment: CommentNode; depth: number }) {
  return (
    <div
      className="border-l border-apex pl-3"
      style={{ marginLeft: depth ? 12 : 0 }}
    >
      <p className="text-xs text-[color:var(--text-muted)]">
        {comment.author_name ?? "Member"} ·{" "}
        {new Date(comment.created_at).toLocaleDateString()}
      </p>
      <p className="mb-2 text-sm text-[color:var(--text-secondary)]">
        {comment.body}
      </p>
      {comment.replies?.map((r) => (
        <Comment key={r.id} comment={r} depth={depth + 1} />
      ))}
    </div>
  );
}

export function CommentThread({ comments }: { comments: CommentNode[] }) {
  if (!comments.length)
    return (
      <p className="text-sm text-[color:var(--text-muted)]">No comments yet.</p>
    );
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <Comment key={c.id} comment={c} depth={0} />
      ))}
    </div>
  );
}
