"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";
import { MARKETING_PACKAGE_LABELS, MARKETING_PACKAGES, type MarketingPackage } from "@/lib/marketingPackages";
import {
  MEETING_SALE_METHOD_LABELS,
  MEETING_TONE_LABELS,
  MEETING_TYPE_LABELS,
  VENDOR_CONCERN_LABELS,
  VENDOR_MOTIVATION_LABELS,
  VENDOR_PERSONALITY_LABELS,
  VENDOR_PRIORITY_LABELS,
  type AgentMeetingPlaybookFormData,
  type MeetingSaleMethod,
  type MeetingTone,
  type MeetingType,
  type VendorConcern,
  type VendorMotivation,
  type VendorPersonality,
  type VendorPriority,
} from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PROPERTY_TYPES = [
  "House",
  "Townhouse",
  "Apartment",
  "Unit",
  "Section / Land",
  "Lifestyle property",
  "Multi-unit / block",
];

export interface MeetingPlaybookFormDefaults {
  agentName?: string;
  agencyName?: string;
  agentPhone?: string;
  agentEmail?: string;
}

export function MeetingPlaybookForm({ defaults }: { defaults: MeetingPlaybookFormDefaults }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AgentMeetingPlaybookFormData>({
    meetingType: "appraisal",
    propertyAddress: "",
    suburb: "",
    propertyType: PROPERTY_TYPES[0],
    estimatedValueRange: "",
    saleMethod: undefined,
    meetingDateTime: "",
    vendorName: "",
    vendorMotivation: undefined,
    vendorPriority: undefined,
    vendorConcerns: [],
    vendorPersonality: undefined,
    keyStrengths: "",
    knownWeaknesses: "",
    renovations: "",
    amenities: "",
    schoolZoneNotes: "",
    limBuildingReportNotes: "",
    disclosureItems: "",
    claimsToVerify: "",
    agentName: defaults.agentName || "",
    agencyName: defaults.agencyName || "",
    agentPhone: defaults.agentPhone || "",
    agentEmail: defaults.agentEmail || "",
    agentStrengths: "",
    recentSales: "",
    testimonials: "",
    whyChooseAgent: "",
    tone: "professional",
    preferredPackage: undefined,
    photographyCost: "",
    videoCost: "",
    floorPlanCost: "",
    droneCost: "",
    twilightCost: "",
    portalUpgradeCost: "",
    socialAdBudget: "",
    printSignageCost: "",
    totalBudget: "",
  });

  function update<K extends keyof AgentMeetingPlaybookFormData>(key: K, value: AgentMeetingPlaybookFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleConcern(concern: VendorConcern) {
    setForm((prev) => {
      const current = prev.vendorConcerns || [];
      const next = current.includes(concern) ? current.filter((c) => c !== concern) : [...current, concern];
      return { ...prev, vendorConcerns: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    const { data: playbook, error: insertError } = await supabase
      .from("agent_meeting_playbooks")
      .insert({
        user_id: user.id,
        meeting_type: form.meetingType,
        property_address: form.propertyAddress,
        suburb: form.suburb,
        form_data: form,
      })
      .select()
      .single();

    if (insertError || !playbook) {
      setError(insertError?.message || "Could not create meeting playbook.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/agent-meeting-playbooks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbookId: playbook.id }),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.error || "Playbook was created but generation failed. You can retry from its page.");
      router.push(`/meeting-playbooks/${playbook.id}`);
      return;
    }

    router.push(`/meeting-playbooks/${playbook.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Meeting details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Meeting type"
            required
            value={form.meetingType}
            onChange={(e) => update("meetingType", e.target.value as MeetingType)}
          >
            {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Meeting date/time"
            hint="Optional"
            value={form.meetingDateTime}
            onChange={(e) => update("meetingDateTime", e.target.value)}
          />
          <Input
            label="Property address"
            required
            value={form.propertyAddress}
            onChange={(e) => update("propertyAddress", e.target.value)}
          />
          <Input label="Suburb" required value={form.suburb} onChange={(e) => update("suburb", e.target.value)} />
          <Select
            label="Property type"
            required
            value={form.propertyType}
            onChange={(e) => update("propertyType", e.target.value)}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            label="Estimated value range"
            hint="Optional — e.g. $900k - $1.05m"
            value={form.estimatedValueRange}
            onChange={(e) => update("estimatedValueRange", e.target.value)}
          />
          <Select
            label="Sale method being considered"
            value={form.saleMethod || ""}
            onChange={(e) => update("saleMethod", (e.target.value || undefined) as MeetingSaleMethod | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(MEETING_SALE_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Vendor name"
            hint="Optional"
            value={form.vendorName}
            onChange={(e) => update("vendorName", e.target.value)}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Vendor situation</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Vendor motivation"
            value={form.vendorMotivation || ""}
            onChange={(e) => update("vendorMotivation", (e.target.value || undefined) as VendorMotivation | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(VENDOR_MOTIVATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Vendor priority"
            value={form.vendorPriority || ""}
            onChange={(e) => update("vendorPriority", (e.target.value || undefined) as VendorPriority | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(VENDOR_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Vendor personality/tone"
            value={form.vendorPersonality || ""}
            onChange={(e) => update("vendorPersonality", (e.target.value || undefined) as VendorPersonality | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(VENDOR_PERSONALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">Vendor concerns</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {Object.entries(VENDOR_CONCERN_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5 text-sm text-ink/80">
                <input
                  type="checkbox"
                  checked={(form.vendorConcerns || []).includes(value as VendorConcern)}
                  onChange={() => toggleConcern(value as VendorConcern)}
                  className="rounded border-ink/30 text-gold focus:ring-gold"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Property context</h2>
        <Textarea label="Key strengths" value={form.keyStrengths} onChange={(e) => update("keyStrengths", e.target.value)} />
        <Textarea
          label="Known weaknesses or risks"
          value={form.knownWeaknesses}
          onChange={(e) => update("knownWeaknesses", e.target.value)}
        />
        <Textarea label="Renovations/upgrades" value={form.renovations} onChange={(e) => update("renovations", e.target.value)} />
        <Textarea label="Nearby amenities" value={form.amenities} onChange={(e) => update("amenities", e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label="School zone notes"
            hint="Optional"
            value={form.schoolZoneNotes}
            onChange={(e) => update("schoolZoneNotes", e.target.value)}
          />
          <Textarea
            label="LIM/building report notes"
            hint="Optional"
            value={form.limBuildingReportNotes}
            onChange={(e) => update("limBuildingReportNotes", e.target.value)}
          />
        </div>
        <Textarea
          label="Disclosure or property issues to clarify"
          value={form.disclosureItems}
          onChange={(e) => update("disclosureItems", e.target.value)}
        />
        <Textarea
          label="Claims to verify before marketing"
          value={form.claimsToVerify}
          onChange={(e) => update("claimsToVerify", e.target.value)}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Agent positioning</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Agent name" value={form.agentName} onChange={(e) => update("agentName", e.target.value)} />
          <Input label="Agency name" value={form.agencyName} onChange={(e) => update("agencyName", e.target.value)} />
          <Input label="Agent phone" value={form.agentPhone} onChange={(e) => update("agentPhone", e.target.value)} />
          <Input label="Agent email" type="email" value={form.agentEmail} onChange={(e) => update("agentEmail", e.target.value)} />
        </div>
        <Textarea label="Agent strengths" value={form.agentStrengths} onChange={(e) => update("agentStrengths", e.target.value)} />
        <Textarea
          label="Recent relevant sales"
          hint="Optional"
          value={form.recentSales}
          onChange={(e) => update("recentSales", e.target.value)}
        />
        <Textarea
          label="Testimonials/proof points"
          hint="Optional"
          value={form.testimonials}
          onChange={(e) => update("testimonials", e.target.value)}
        />
        <Textarea label="Why choose this agent" value={form.whyChooseAgent} onChange={(e) => update("whyChooseAgent", e.target.value)} />
        <Select label="Preferred tone" required value={form.tone} onChange={(e) => update("tone", e.target.value as MeetingTone)}>
          {Object.entries(MEETING_TONE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Marketing package advisor</h2>
        <p className="text-sm text-ink/60">
          These are editable NZ-style templates, not fixed promises — leave the package blank to let Listing Launch
          recommend one based on the vendor situation.
        </p>
        <Select
          label="Preferred package"
          value={form.preferredPackage || ""}
          onChange={(e) => update("preferredPackage", (e.target.value || undefined) as MarketingPackage | undefined)}
        >
          <option value="">Let Listing Launch recommend</option>
          {Object.entries(MARKETING_PACKAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-3">
          {MARKETING_PACKAGES.map((pkg) => (
            <div key={pkg.key} className="rounded-lg border border-ink/10 p-3 text-xs text-ink/60">
              <p className="mb-1 font-medium text-ink">{pkg.label}</p>
              <ul className="space-y-0.5">
                {pkg.inclusions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink/50">
          Costs vary by agency, region, and provider — leave any field blank and the generated cost script will
          advise confirming exact costs before presenting to the vendor.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Photography cost" hint="Optional" value={form.photographyCost} onChange={(e) => update("photographyCost", e.target.value)} />
          <Input label="Video cost" hint="Optional" value={form.videoCost} onChange={(e) => update("videoCost", e.target.value)} />
          <Input label="Floor plan cost" hint="Optional" value={form.floorPlanCost} onChange={(e) => update("floorPlanCost", e.target.value)} />
          <Input label="Drone/aerial cost" hint="Optional" value={form.droneCost} onChange={(e) => update("droneCost", e.target.value)} />
          <Input label="Twilight cost" hint="Optional" value={form.twilightCost} onChange={(e) => update("twilightCost", e.target.value)} />
          <Input label="Portal upgrade cost" hint="Optional" value={form.portalUpgradeCost} onChange={(e) => update("portalUpgradeCost", e.target.value)} />
          <Input label="Social ad budget" hint="Optional" value={form.socialAdBudget} onChange={(e) => update("socialAdBudget", e.target.value)} />
          <Input label="Print/signage cost" hint="Optional" value={form.printSignageCost} onChange={(e) => update("printSignageCost", e.target.value)} />
          <Input label="Total recommended budget" hint="Optional" value={form.totalBudget} onChange={(e) => update("totalBudget", e.target.value)} />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Generating your meeting playbook…" : "Generate meeting playbook"}
        </Button>
      </div>
    </form>
  );
}
