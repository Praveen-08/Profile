import { generateSections } from "@/lib/ai/generate";
import { SECTION_KEYS } from "@/lib/sections";
import { createClient } from "@/lib/supabase/server";
import { campaignFromRow, type CampaignRow } from "@/lib/types";
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
  const campaignId: string | undefined = body?.campaignId;
  const requestedSections: string[] | undefined = body?.sections;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
  }

  // Explicit user_id filter in addition to RLS: this fetch can only ever
  // return a campaign owned by the authenticated user.
  const { data: row, error: fetchError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const campaign = campaignFromRow(row as CampaignRow);
  const sectionKeys = requestedSections?.length
    ? requestedSections.filter((key) => SECTION_KEYS.includes(key))
    : SECTION_KEYS;

  if (sectionKeys.length === 0) {
    return NextResponse.json({ error: "No valid sections requested." }, { status: 400 });
  }

  let generated: Record<string, string>;
  try {
    generated = await generateSections(sectionKeys, campaign);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const upserts = Object.entries(generated).map(([sectionKey, content]) => ({
    campaign_id: campaignId,
    user_id: user.id,
    section_key: sectionKey,
    content,
  }));

  const { error: upsertError } = await supabase
    .from("campaign_outputs")
    .upsert(upserts, { onConflict: "campaign_id,section_key" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (!requestedSections?.length) {
    // Explicit user_id filter in addition to RLS on the update as well.
    await supabase.from("campaigns").update({ status: "generated" }).eq("id", campaignId).eq("user_id", user.id);
  }

  return NextResponse.json({ outputs: generated });
}
