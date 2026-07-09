"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SMART_REGENERATE_DIRECTIVES, SMART_REGENERATE_DIRECTIVE_LABELS, type SmartRegenerateDirective } from "@quickreel/shared";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SmartRegeneratePanel({
  token,
  projectId,
  versionId,
}: {
  token: string;
  projectId: string;
  versionId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<SmartRegenerateDirective | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function regenerate(directive: SmartRegenerateDirective) {
    setPending(directive);
    setError(null);
    try {
      const { version } = await api.smartRegenerate(token, projectId, versionId, directive);
      router.push(`/projects/${projectId}/versions/${version.id}/render`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Smart Regenerate failed");
      setPending(null);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Smart Regenerate</h2>
      <p className="mb-4 text-xs text-muted">
        The AI changes only what&apos;s required and renders a new version — your photos are never re-uploaded.
      </p>
      <div className="flex flex-wrap gap-2">
        {SMART_REGENERATE_DIRECTIVES.map((directive) => (
          <Button
            key={directive}
            size="sm"
            variant="secondary"
            onClick={() => regenerate(directive)}
            disabled={pending !== null}
          >
            {pending === directive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {SMART_REGENERATE_DIRECTIVE_LABELS[directive]}
          </Button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </Card>
  );
}
