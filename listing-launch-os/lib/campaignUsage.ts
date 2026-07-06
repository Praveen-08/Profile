import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, hasReachedCampaignLimit, type Plan } from "./plans";

export interface CampaignUsage {
  plan: Plan;
  count: number;
  limitReached: boolean;
}

/**
 * Single source of truth for "how many campaigns has this user used", read
 * fresh from Supabase on every call — never from local/session storage or
 * client state. `campaigns` is the primary count (a row there means the
 * campaign counts, even if generation/save failed afterwards); the distinct
 * campaign_ids in `campaign_outputs` are checked too as a defensive
 * fallback, so a campaign is never undercounted if the two ever disagree.
 */
export async function getCampaignUsage(
  supabase: SupabaseClient,
  userId: string,
  options: { excludeCampaignId?: string } = {}
): Promise<CampaignUsage> {
  const { excludeCampaignId } = options;

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (excludeCampaignId) campaignsQuery = campaignsQuery.neq("id", excludeCampaignId);

  let outputsQuery = supabase.from("campaign_outputs").select("campaign_id").eq("user_id", userId);
  if (excludeCampaignId) outputsQuery = outputsQuery.neq("campaign_id", excludeCampaignId);

  const [{ data: profile }, { count: campaignCount }, { data: outputRows }] = await Promise.all([
    supabase.from("user_profiles").select("plan").eq("user_id", userId).maybeSingle(),
    campaignsQuery,
    outputsQuery,
  ]);

  const outputCampaignIds = new Set(((outputRows as { campaign_id: string }[] | null) || []).map((r) => r.campaign_id));
  const count = Math.max(campaignCount ?? 0, outputCampaignIds.size);

  const plan = getPlan(profile?.plan as string | undefined);
  return { plan, count, limitReached: hasReachedCampaignLimit(plan.id, count) };
}
