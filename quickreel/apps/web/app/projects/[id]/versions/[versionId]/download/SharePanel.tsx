"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { api, type ShareLinkSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${token}`;
}

export function SharePanel({
  token,
  projectId,
  renderId,
  initialShareLinks,
}: {
  token: string;
  projectId: string;
  renderId: string;
  initialShareLinks: ShareLinkSummary[];
}) {
  const [links, setLinks] = useState(initialShareLinks);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    try {
      const link = await api.createShareLink(token, projectId, renderId);
      setLinks((prev) => [link, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function copy(link: ShareLinkSummary) {
    await navigator.clipboard.writeText(shareUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Client Sharing</h2>
      <p className="mb-4 text-xs text-muted">A beautiful, no-login preview page a client can watch, approve, and comment on.</p>

      <Button size="sm" variant="secondary" onClick={create} disabled={creating} className="w-full">
        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        Create Share Link
      </Button>

      {links.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted">{shareUrl(link.token)}</span>
              <button onClick={() => copy(link)} className="flex-shrink-0 text-accent hover:underline">
                {copiedId === link.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
