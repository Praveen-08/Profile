import { AppNav } from "@/components/app/AppNav";
import { VendorUpdateForm, type CampaignOption } from "@/components/vendor-update/VendorUpdateForm";
import { createClient } from "@/lib/supabase/server";
import type { CampaignRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewVendorUpdatePage({
  searchParams,
}: {
  searchParams: { campaignId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = user
    ? await supabase
        .from("campaigns")
        .select("id, address, suburb")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const campaigns: CampaignOption[] = ((rows as Pick<CampaignRow, "id" | "address" | "suburb">[]) || []).map((c) => ({
    id: c.id,
    address: c.address,
    suburb: c.suburb,
  }));

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl">Create vendor update</h1>
        <p className="mt-1 text-sm text-ink/60">
          Enter what happened this period — leave numbers blank rather than guess, and the update will speak
          generally instead.
        </p>
        {campaigns.length === 0 ? (
          <p className="mt-8 text-sm text-ink/60">
            You need at least one campaign before you can create a vendor update.{" "}
            <a href="/campaigns/new" className="text-gold-dark underline">
              Create a campaign first
            </a>
            .
          </p>
        ) : (
          <div className="mt-8">
            <VendorUpdateForm campaigns={campaigns} defaultCampaignId={searchParams.campaignId} />
          </div>
        )}
      </main>
    </>
  );
}
