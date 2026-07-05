"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { TONE_LABELS, type Tone } from "@/lib/types";
import { useState } from "react";

export interface SettingsDefaults {
  userId: string;
  agentName?: string;
  agencyName?: string;
  phone?: string;
  defaultCta?: string;
  defaultTone?: Tone;
  signaturePhrases?: string;
  complianceNotes?: string;
  plan?: PlanId;
}

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const [agentName, setAgentName] = useState(defaults.agentName || "");
  const [agencyName, setAgencyName] = useState(defaults.agencyName || "");
  const [phone, setPhone] = useState(defaults.phone || "");
  const [defaultCta, setDefaultCta] = useState(defaults.defaultCta || "");
  const [defaultTone, setDefaultTone] = useState<Tone>(defaults.defaultTone || "simple_professional");
  const [signaturePhrases, setSignaturePhrases] = useState(defaults.signaturePhrases || "");
  const [complianceNotes, setComplianceNotes] = useState(defaults.complianceNotes || "");
  const [plan, setPlan] = useState<PlanId>(defaults.plan || "free");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();

    // Use the freshly-authenticated user id rather than trusting the prop —
    // defense in depth on top of RLS.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const [{ error: profileError }, { error: brandVoiceError }] = await Promise.all([
      supabase.from("user_profiles").upsert({
        user_id: user.id,
        agent_name: agentName || null,
        agency_name: agencyName || null,
        phone: phone || null,
        default_cta: defaultCta || null,
        plan,
      }),
      supabase.from("brand_voice_settings").upsert(
        {
          user_id: user.id,
          default_tone: defaultTone,
          signature_phrases: signaturePhrases || null,
          compliance_notes: complianceNotes || null,
        },
        { onConflict: "user_id" }
      ),
    ]);

    if (profileError || brandVoiceError) {
      setError(profileError?.message || brandVoiceError?.message || "Could not save settings.");
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Agent profile</h2>
        <p className="text-sm text-ink/60">Used to prefill new campaigns and sign off emails.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Agent name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          <Input label="Agency name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Default call to action"
            value={defaultCta}
            onChange={(e) => setDefaultCta(e.target.value)}
            placeholder="Contact me today to arrange a viewing"
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Plan (simulated)</h2>
        <p className="text-sm text-ink/60">
          There's no billing yet — this switches your plan directly for testing. See{" "}
          <a href="/#pricing" className="text-gold-dark underline">
            plan details
          </a>
          .
        </p>
        <Select label="Plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
          {PLAN_ORDER.map((id) => (
            <option key={id} value={id}>
              {PLANS[id].name}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Brand voice</h2>
        <Select
          label="Default tone"
          value={defaultTone}
          onChange={(e) => setDefaultTone(e.target.value as Tone)}
        >
          {Object.entries(TONE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea
          label="Signature phrases"
          hint="Phrases you like to use often — for your own reference when editing generated copy."
          value={signaturePhrases}
          onChange={(e) => setSignaturePhrases(e.target.value)}
        />
        <Textarea
          label="Compliance notes"
          hint="Anything specific to remind yourself of when editing copy for your agency."
          value={complianceNotes}
          onChange={(e) => setComplianceNotes(e.target.value)}
        />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-gold-dark">Settings saved.</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
