"use client";

import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveCampaignButton({
  campaignId,
  userId,
  outputs,
}: {
  campaignId: string;
  userId: string;
  outputs: Record<string, string>;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setErrorMessage(null);

    const supabase = createClient();
    const upserts = Object.entries(outputs)
      .filter(([, content]) => content)
      .map(([sectionKey, content]) => ({
        campaign_id: campaignId,
        user_id: userId,
        section_key: sectionKey,
        content,
      }));

    if (upserts.length === 0) {
      setStatus("idle");
      return;
    }

    const { error } = await supabase
      .from("campaign_outputs")
      .upsert(upserts, { onConflict: "campaign_id,section_key" });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save Campaign"}
      </Button>
      {status === "saved" && <span className="text-sm text-gold-dark">Campaign saved</span>}
      {status === "error" && <span className="text-sm text-red-600">Save failed: {errorMessage}</span>}
    </div>
  );
}
