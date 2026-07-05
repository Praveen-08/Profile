import { AppNav } from "@/components/app/AppNav";
import { OutputPack } from "@/components/campaign/OutputPack";
import { RetryGenerateButton } from "@/components/campaign/RetryGenerateButton";
import { GeneratedBanner } from "@/components/campaign/GeneratedBanner";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { normalizeCampaignInput } from "@/lib/formatCampaignData";
import {
  campaignFromRow,
  TARGET_BUYER_LABELS,
  TONE_LABELS,
  VENDOR_UPDATE_TYPE_LABELS,
  type CampaignOutputRow,
  type CampaignRow,
  type VendorUpdateType,
} from "@/lib/types";
import { propertyFactsList } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function CampaignOutputPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Explicit user_id filter in addition to RLS: never trust the row id alone.
  const { data: row } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!row) notFound();

  const rawCampaign = campaignFromRow(row as CampaignRow);
  // Normalised for display and for generation — title-cased address/suburb/
  // amenities, consistent m² units, a readable open-home time — without
  // rewriting what the agent actually typed in the database.
  const campaign = normalizeCampaignInput(rawCampaign);

  const { data: outputRows } = await supabase
    .from("campaign_outputs")
    .select("*")
    .eq("campaign_id", rawCampaign.id)
    .eq("user_id", user.id);

  const outputs: Record<string, string> = {};
  ((outputRows as CampaignOutputRow[]) || []).forEach((r) => {
    outputs[r.section_key] = r.content;
  });

  const hasOutputs = Object.keys(outputs).length > 0;

  const { data: vendorUpdateRows } = await supabase
    .from("vendor_updates")
    .select("id, update_type, created_at")
    .eq("campaign_id", rawCampaign.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const vendorUpdates = (
    (vendorUpdateRows as { id: string; update_type: VendorUpdateType; created_at: string }[]) || []
  ).map((v) => ({
    id: v.id,
    label: VENDOR_UPDATE_TYPE_LABELS[v.update_type],
    createdAt: v.created_at,
  }));

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Suspense>
          <GeneratedBanner />
        </Suspense>
        <div className="mb-8">
          <h1 className="font-serif text-2xl">
            {campaign.address}, {campaign.suburb}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {campaign.propertyType}
            {propertyFactsList(campaign).length ? ` · ${propertyFactsList(campaign).join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-gold-dark">
            {TARGET_BUYER_LABELS[campaign.targetBuyer]} · {TONE_LABELS[campaign.tone]} tone
          </p>
        </div>

        {hasOutputs ? (
          <OutputPack
            campaignId={rawCampaign.id}
            userId={user.id}
            campaign={campaign}
            outputs={outputs}
            vendorUpdates={vendorUpdates}
          />
        ) : (
          <Card className="flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">No campaign pack generated yet</p>
            <p className="max-w-sm text-sm text-ink/60">
              Generate the full launch pack for this campaign — descriptions, social posts, reels, open-home
              content, and more.
            </p>
            <RetryGenerateButton campaignId={rawCampaign.id} label="Generate campaign pack" />
          </Card>
        )}
      </main>
    </>
  );
}
