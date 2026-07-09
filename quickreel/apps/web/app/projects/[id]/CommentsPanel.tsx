"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { api, type CommentSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CommentsPanel({
  token,
  projectId,
  initialComments,
}: {
  token: string;
  projectId: string;
  initialComments: CommentSummary[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const comment = await api.createComment(token, projectId, { body: body.trim() });
      setComments((prev) => [...prev, comment]);
      setBody("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Comments</h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.</p>
      ) : (
        <div className="mb-4 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
          placeholder="Leave a note on this project…"
          className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
        />
        <Button size="md" onClick={post} disabled={posting || !body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
