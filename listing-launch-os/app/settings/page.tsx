import { AppNav } from "@/components/app/AppNav";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/plans";
import type { Tone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: brandVoice }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("brand_voice_settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <>
      <AppNav active="settings" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-ink/60">Your profile and brand voice, reused across every campaign.</p>
        <div className="mt-8">
          <SettingsForm
            defaults={{
              userId: user.id,
              agentName: profile?.agent_name || undefined,
              agencyName: profile?.agency_name || undefined,
              phone: profile?.phone || undefined,
              defaultCta: profile?.default_cta || undefined,
              defaultTone: (brandVoice?.default_tone as Tone) || undefined,
              signaturePhrases: brandVoice?.signature_phrases || undefined,
              complianceNotes: brandVoice?.compliance_notes || undefined,
              plan: (profile?.plan as PlanId) || undefined,
            }}
          />
        </div>
      </main>
    </>
  );
}
