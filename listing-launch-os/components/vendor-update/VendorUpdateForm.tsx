"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";
import {
  VENDOR_UPDATE_TONE_LABELS,
  VENDOR_UPDATE_TYPE_LABELS,
  type VendorUpdateFormData,
  type VendorUpdateTone,
  type VendorUpdateType,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CampaignOption {
  id: string;
  address: string;
  suburb: string;
}

export function VendorUpdateForm({
  campaigns,
  defaultCampaignId,
}: {
  campaigns: CampaignOption[];
  defaultCampaignId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState(defaultCampaignId || campaigns[0]?.id || "");
  const [form, setForm] = useState<VendorUpdateFormData>({
    updateType: "post_open_home",
    enquiries: undefined,
    openHomeGroups: undefined,
    buyerFeedbackSummary: "",
    positiveFeedback: "",
    concerns: "",
    priceFeedback: "",
    offersOrInterest: "",
    onlineViews: "",
    socialActivity: "",
    recommendedNextStep: "",
    agentNotes: "",
    tone: "confident",
  });

  function update<K extends keyof VendorUpdateFormData>(key: K, value: VendorUpdateFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!campaignId) {
      setError("Select a campaign/listing first.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    const { data: vendorUpdate, error: insertError } = await supabase
      .from("vendor_updates")
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        update_type: form.updateType,
        form_data: form,
      })
      .select()
      .single();

    if (insertError || !vendorUpdate) {
      setError(insertError?.message || "Could not create vendor update.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/vendor-updates/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorUpdateId: vendorUpdate.id }),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error || "Vendor update was created but generation failed. You can retry from its page.");
      router.push(`/vendor-updates/${vendorUpdate.id}`);
      return;
    }

    router.push(`/vendor-updates/${vendorUpdate.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Campaign &amp; update type</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Campaign / listing" required value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.length === 0 && <option value="">No campaigns yet</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.address} — {c.suburb}
              </option>
            ))}
          </Select>
          <Select
            label="Update type"
            required
            value={form.updateType}
            onChange={(e) => update("updateType", e.target.value as VendorUpdateType)}
          >
            {Object.entries(VENDOR_UPDATE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Campaign activity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Number of enquiries"
            type="number"
            min={0}
            hint="Leave blank rather than guess — the update will speak generally instead."
            value={form.enquiries ?? ""}
            onChange={(e) => update("enquiries", e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            label="Number of open-home groups"
            type="number"
            min={0}
            value={form.openHomeGroups ?? ""}
            onChange={(e) => update("openHomeGroups", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <Textarea
          label="Buyer feedback summary"
          value={form.buyerFeedbackSummary}
          onChange={(e) => update("buyerFeedbackSummary", e.target.value)}
        />
        <Textarea
          label="Positive feedback"
          value={form.positiveFeedback}
          onChange={(e) => update("positiveFeedback", e.target.value)}
        />
        <Textarea label="Concerns / objections" value={form.concerns} onChange={(e) => update("concerns", e.target.value)} />
        <Textarea
          label="Price feedback"
          hint="Only what buyers actually said — kept as hedged feedback, never stated as fact."
          value={form.priceFeedback}
          onChange={(e) => update("priceFeedback", e.target.value)}
        />
        <Textarea
          label="Offers or serious interest"
          value={form.offersOrInterest}
          onChange={(e) => update("offersOrInterest", e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Online views/clicks"
            hint="Optional"
            value={form.onlineViews}
            onChange={(e) => update("onlineViews", e.target.value)}
          />
          <Input
            label="Social media activity"
            hint="Optional"
            value={form.socialActivity}
            onChange={(e) => update("socialActivity", e.target.value)}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Recommendation &amp; tone</h2>
        <Textarea
          label="Recommended next step"
          value={form.recommendedNextStep}
          onChange={(e) => update("recommendedNextStep", e.target.value)}
        />
        <Textarea label="Agent notes" value={form.agentNotes} onChange={(e) => update("agentNotes", e.target.value)} />
        <Select label="Tone" required value={form.tone} onChange={(e) => update("tone", e.target.value as VendorUpdateTone)}>
          {Object.entries(VENDOR_UPDATE_TONE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting || campaigns.length === 0}>
          {submitting ? "Generating vendor update…" : "Generate vendor update"}
        </Button>
      </div>
    </form>
  );
}
