import { AppNav } from "@/components/app/AppNav";
import { CampaignForm } from "@/components/campaign/CampaignForm";
import { CampaignLimitPrompt } from "@/components/plans/CampaignLimitPrompt";
import { createClient } from "@/lib/supabase/server";
import { hasReachedCampaignLimit } from "@/lib/plans";
import type { Tone } from "@/lib/types";

export default async function NewCampaignPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: brandVoice }, { count: campaignCount }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user?.id).maybeSingle(),
    supabase.from("brand_voice_settings").select("*").eq("user_id", user?.id).maybeSingle(),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", user?.id ?? ""),
  ]);

  const limitReached = hasReachedCampaignLimit(profile?.plan, campaignCount ?? 0);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl">New campaign</h1>
        <p className="mt-1 text-sm text-ink/60">
          Fill in what you know — leave the rest blank and we'll keep the copy general rather than guessing.
        </p>
        <div className="mt-8">
          {limitReached ? (
            <CampaignLimitPrompt />
          ) : (
            <CampaignForm
              defaults={{
                agentName: profile?.agent_name || undefined,
                agencyName: profile?.agency_name || undefined,
                agentPhone: profile?.phone || undefined,
                agentEmail: user?.email || undefined,
                defaultCta: profile?.default_cta || undefined,
                defaultTone: (brandVoice?.default_tone as Tone) || undefined,
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}
