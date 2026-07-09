"use client";

import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { api, type SharePageData } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SharePageClient({ token, initialData }: { token: string; initialData: SharePageData }) {
  const [data, setData] = useState(initialData);
  const [approverName, setApproverName] = useState("");
  const [approving, setApproving] = useState(false);
  const [commentName, setCommentName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function approve() {
    if (!approverName.trim()) return;
    setApproving(true);
    try {
      const link = await api.approveSharePage(token, approverName.trim());
      setData((prev) => ({ ...prev, approvedAt: link.approvedAt, approvedByName: link.approvedByName }));
    } finally {
      setApproving(false);
    }
  }

  async function postComment() {
    if (!commentName.trim() || !commentBody.trim()) return;
    setPosting(true);
    try {
      const comment = await api.postShareComment(token, commentName.trim(), commentBody.trim());
      setData((prev) => ({ ...prev, comments: [...prev.comments, comment] }));
      setCommentBody("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-semibold">
          {data.project.title || data.project.address || "Untitled Listing"}
        </h1>
        <div className="mx-auto mt-6 aspect-[9/16] w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-black">
          {data.render.outputUrl && (
            <video src={data.render.outputUrl} controls playsInline className="h-full w-full object-contain" />
          )}
        </div>
        {data.render.outputUrl && (
          <a href={data.render.outputUrl} download className="mt-4 inline-block text-sm text-accent hover:underline">
            Download MP4
          </a>
        )}
      </div>

      <Card className="p-6">
        {data.approvedAt ? (
          <div className="flex items-center gap-2 text-sm text-accent">
            <Check className="h-4 w-4" /> Approved by {data.approvedByName}
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Approve this reel</h2>
            <div className="flex gap-2">
              <input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Your name"
                className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
              />
              <Button onClick={approve} disabled={approving || !approverName.trim()}>
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Comments</h2>
        {data.comments.length === 0 ? (
          <p className="text-sm text-muted">No comments yet.</p>
        ) : (
          <div className="mb-4 space-y-3">
            {data.comments.map((c) => (
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

        <div className="space-y-2">
          <input
            value={commentName}
            onChange={(e) => setCommentName(e.target.value)}
            placeholder="Your name"
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
          />
          <div className="flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && postComment()}
              placeholder="Leave feedback…"
              className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
            />
            <Button onClick={postComment} disabled={posting || !commentName.trim() || !commentBody.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
