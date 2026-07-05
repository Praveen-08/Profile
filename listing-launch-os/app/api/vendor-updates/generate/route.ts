import { generateVendorUpdateSections } from "@/lib/ai/generate";
import { VENDOR_UPDATE_SECTION_KEYS, sectionsToGenerate } from "@/lib/vendorUpdateSections";
import { createClient } from "@/lib/supabase/server";
import { vendorUpdateFromRow, type CampaignRow, type VendorUpdateContext, type VendorUpdateRow } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const vendorUpdateId: string | undefined = body?.vendorUpdateId;
  const requestedSections: string[] | undefined = body?.sections;

  if (!vendorUpdateId) {
    return NextResponse.json({ error: "vendorUpdateId is required." }, { status: 400 });
  }

  // Explicit user_id filter in addition to RLS on every fetch/update below.
  const { data: vendorUpdateRow, error: fetchError } = await supabase
    .from("vendor_updates")
    .select("*")
    .eq("id", vendorUpdateId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !vendorUpdateRow) {
    return NextResponse.json({ error: "Vendor update not found." }, { status: 404 });
  }

  const vendorUpdate = vendorUpdateFromRow(vendorUpdateRow as VendorUpdateRow);

  const { data: campaignRow, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", vendorUpdate.campaignId)
    .eq("user_id", user.id)
    .single();

  if (campaignError || !campaignRow) {
    return NextResponse.json({ error: "Associated campaign not found." }, { status: 404 });
  }

  const campaign = campaignRow as CampaignRow;
  const context: VendorUpdateContext = {
    ...vendorUpdate.formData,
    address: campaign.address,
    suburb: campaign.suburb,
    propertyType: campaign.property_type,
    agentName: campaign.agent_name ?? undefined,
    agencyName: campaign.agency_name ?? undefined,
    agentPhone: campaign.agent_phone ?? undefined,
    agentEmail: campaign.agent_email ?? undefined,
  };

  const sectionKeys = requestedSections?.length
    ? requestedSections.filter((key) => VENDOR_UPDATE_SECTION_KEYS.includes(key))
    : sectionsToGenerate(vendorUpdate.formData);

  if (sectionKeys.length === 0) {
    return NextResponse.json({ error: "No valid sections requested." }, { status: 400 });
  }

  let generated: Record<string, string>;
  try {
    generated = await generateVendorUpdateSections(sectionKeys, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const mergedOutput = { ...vendorUpdate.generatedOutput, ...generated };

  const { error: updateError } = await supabase
    .from("vendor_updates")
    .update({ generated_output: mergedOutput })
    .eq("id", vendorUpdateId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ outputs: generated });
}
