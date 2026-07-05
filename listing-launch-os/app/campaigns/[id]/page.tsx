import { AppNav } from "@/components/app/AppNav";
import { OutputPack } from "@/components/campaign/OutputPack";
import { RetryGenerateButton } from "@/components/campaign/RetryGenerateButton";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { campaignFromRow, TARGET_BUYER_LABELS, TONE_LABELS, type CampaignOutputRow, type CampaignRow } from "@/lib/types";
import { propertyFactsList } from "@/lib/utils";
import { notFound } from "next/navigation";

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

  const campaign = campaignFromRow(row as CampaignRow);

  const { data: outputRows } = await supabase
    .from("campaign_outputs")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("user_id", user.id);

  const outputs: Record<string, string> = {};
  ((outputRows as CampaignOutputRow[]) || []).forEach((r) => {
    outputs[r.section_key] = r.content;
  });

  const hasOutputs = Object.keys(outputs).length > 0;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl">{campaign.address}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {campaign.suburb} · {campaign.propertyType}
            {propertyFactsList(campaign).length ? ` · ${propertyFactsList(campaign).join(", ")}` : ""}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-gold-dark">
            {TARGET_BUYER_LABELS[campaign.targetBuyer]} · {TONE_LABELS[campaign.tone]} tone
          </p>
        </div>

        {hasOutputs ? (
          <OutputPack campaignId={campaign.id} userId={user.id} campaign={campaign} outputs={outputs} />
        ) : (
          <Card className="flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">Generation hasn't completed for this campaign</p>
            <p className="max-w-sm text-sm text-ink/60">
              This can happen if generation failed right after the campaign was created. Retry below.
            </p>
            <RetryGenerateButton campaignId={campaign.id} />
          </Card>
        )}
      </main>
    </>
  );
}
