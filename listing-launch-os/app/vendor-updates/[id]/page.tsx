import { AppNav } from "@/components/app/AppNav";
import { RetryVendorUpdateButton } from "@/components/vendor-update/RetryVendorUpdateButton";
import { VendorUpdateOutputView } from "@/components/vendor-update/VendorUpdateOutputView";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { VENDOR_UPDATE_TYPE_LABELS, vendorUpdateFromRow, type CampaignRow, type VendorUpdateRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VendorUpdateOutputPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Explicit user_id filter in addition to RLS.
  const { data: row } = await supabase
    .from("vendor_updates")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!row) notFound();

  const vendorUpdate = vendorUpdateFromRow(row as VendorUpdateRow);

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("address, suburb")
    .eq("id", vendorUpdate.campaignId)
    .eq("user_id", user.id)
    .single();

  const campaign = campaignRow as Pick<CampaignRow, "address" | "suburb"> | null;
  const hasOutputs = Object.keys(vendorUpdate.generatedOutput).length > 0;

  return (
    <>
      <AppNav active="vendor-updates" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-2xl">{campaign ? `${campaign.address}, ${campaign.suburb}` : "Vendor update"}</h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-gold-dark">
            {VENDOR_UPDATE_TYPE_LABELS[vendorUpdate.updateType]}
          </p>
        </div>

        {hasOutputs ? (
          <VendorUpdateOutputView
            vendorUpdateId={vendorUpdate.id}
            userId={user.id}
            formData={vendorUpdate.formData}
            outputs={vendorUpdate.generatedOutput}
          />
        ) : (
          <Card className="flex flex-col items-center gap-4 p-16 text-center">
            <p className="font-serif text-xl">Generation hasn't completed for this update</p>
            <p className="max-w-sm text-sm text-ink/60">
              This can happen if generation failed right after the update was created. Retry below.
            </p>
            <RetryVendorUpdateButton vendorUpdateId={vendorUpdate.id} />
          </Card>
        )}
      </main>
    </>
  );
}
