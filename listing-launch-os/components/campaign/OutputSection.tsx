"use client";

import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function OutputSection({
  campaignId,
  sectionKey,
  label,
  initialContent,
}: {
  campaignId: string;
  sectionKey: string;
  label: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, sections: [sectionKey] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Regeneration failed.");
      const newContent = body.outputs?.[sectionKey] ?? content;
      setContent(newContent);
      setDraft(newContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaign_outputs")
      .update({ content: draft })
      .eq("campaign_id", campaignId)
      .eq("section_key", sectionKey);

    if (error) {
      setError(error.message);
    } else {
      setContent(draft);
      setEditing(false);
    }
    setSaving(false);
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-medium">{label}</h3>
        <div className="flex shrink-0 items-center gap-2 no-print">
          <CopyButton text={content} />
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
          {editing ? (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(16, Math.max(4, content.split("\n").length + 1))}
          className="w-full rounded-lg border border-ink/15 px-3.5 py-2.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{content}</p>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
