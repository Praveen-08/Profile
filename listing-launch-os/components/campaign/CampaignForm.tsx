"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";
import {
  OWNERSHIP_TYPE_LABELS,
  SALE_METHOD_LABELS,
  TARGET_BUYER_LABELS,
  TONE_LABELS,
  type CampaignInput,
  type OwnershipType,
  type SaleMethod,
  type TargetBuyer,
  type Tone,
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

export interface CampaignFormDefaults {
  agentName?: string;
  agencyName?: string;
  agentPhone?: string;
  agentEmail?: string;
  defaultCta?: string;
  defaultTone?: Tone;
}

export function CampaignForm({ defaults }: { defaults: CampaignFormDefaults }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CampaignInput>({
    address: "",
    suburb: "",
    propertyType: PROPERTY_TYPES[0],
    bedrooms: undefined,
    bathrooms: undefined,
    garages: undefined,
    landSize: "",
    floorArea: "",
    keyFeatures: "",
    renovations: "",
    amenities: "",
    targetBuyer: "family",
    tone: defaults.defaultTone || "simple_professional",
    cta: defaults.defaultCta || "",
    notes: "",
    agentName: defaults.agentName || "",
    agencyName: defaults.agencyName || "",
    saleMethod: undefined,
    ownershipType: undefined,
    schoolZoneNotes: "",
    limBuildingReportNotes: "",
    rentalYieldNotes: "",
    wordsToAvoid: "",
    openHomeDateTime: "",
    agentPhone: defaults.agentPhone || "",
    agentEmail: defaults.agentEmail || "",
  });

  function update<K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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

    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        address: form.address,
        suburb: form.suburb,
        property_type: form.propertyType,
        bedrooms: form.bedrooms || null,
        bathrooms: form.bathrooms || null,
        garages: form.garages || null,
        land_size: form.landSize || null,
        floor_area: form.floorArea || null,
        key_features: form.keyFeatures || null,
        renovations: form.renovations || null,
        amenities: form.amenities || null,
        target_buyer: form.targetBuyer,
        tone: form.tone,
        cta: form.cta || null,
        notes: form.notes || null,
        agent_name: form.agentName || null,
        agency_name: form.agencyName || null,
        sale_method: form.saleMethod || null,
        ownership_type: form.ownershipType || null,
        school_zone_notes: form.schoolZoneNotes || null,
        lim_building_report_notes: form.limBuildingReportNotes || null,
        rental_yield_notes: form.rentalYieldNotes || null,
        words_to_avoid: form.wordsToAvoid || null,
        open_home_date_time: form.openHomeDateTime || null,
        agent_phone: form.agentPhone || null,
        agent_email: form.agentEmail || null,
      })
      .select()
      .single();

    if (insertError || !campaign) {
      setError(insertError?.message || "Could not create campaign.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Campaign was created but generation failed. You can retry from the campaign page.");
      router.push(`/campaigns/${campaign.id}`);
      return;
    }

    router.push(`/campaigns/${campaign.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Property details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Property address"
            required
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="14 Fenwick Avenue"
          />
          <Input
            label="Suburb"
            required
            value={form.suburb}
            onChange={(e) => update("suburb", e.target.value)}
            placeholder="Mount Eden"
          />
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
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Bedrooms"
              type="number"
              min={0}
              value={form.bedrooms ?? ""}
              onChange={(e) => update("bedrooms", e.target.value ? Number(e.target.value) : undefined)}
            />
            <Input
              label="Bathrooms"
              type="number"
              min={0}
              value={form.bathrooms ?? ""}
              onChange={(e) => update("bathrooms", e.target.value ? Number(e.target.value) : undefined)}
            />
            <Input
              label="Car parks"
              type="number"
              min={0}
              value={form.garages ?? ""}
              onChange={(e) => update("garages", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <Input
            label="Land size"
            hint="e.g. 450m² — we'll add 'approximately' automatically"
            value={form.landSize}
            onChange={(e) => update("landSize", e.target.value)}
            placeholder="450m²"
          />
          <Input
            label="Floor area"
            hint="e.g. 180m²"
            value={form.floorArea}
            onChange={(e) => update("floorArea", e.target.value)}
            placeholder="180m²"
          />
        </div>
        <Textarea
          label="Key features"
          hint="Comma-separated — only what's true. Nothing here won't be invented elsewhere."
          value={form.keyFeatures}
          onChange={(e) => update("keyFeatures", e.target.value)}
          placeholder="Renovated kitchen, north-facing living, off-street parking"
        />
        <Textarea
          label="Renovations or upgrades"
          value={form.renovations}
          onChange={(e) => update("renovations", e.target.value)}
          placeholder="New roof (2022), repainted throughout"
        />
        <Textarea
          label="Nearby amenities"
          value={form.amenities}
          onChange={(e) => update("amenities", e.target.value)}
          placeholder="Mount Eden Village, Eden Park, motorway on-ramp"
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Campaign framing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Target buyer"
            required
            value={form.targetBuyer}
            onChange={(e) => update("targetBuyer", e.target.value as TargetBuyer)}
          >
            {Object.entries(TARGET_BUYER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Tone" required value={form.tone} onChange={(e) => update("tone", e.target.value as Tone)}>
            {Object.entries(TONE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Call to action"
          value={form.cta}
          onChange={(e) => update("cta", e.target.value)}
          placeholder="Contact Jane today to arrange a private viewing"
        />
        <Textarea
          label="Optional notes"
          hint="Anything else worth including — school zone, recent sale context, vendor motivation, etc."
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">NZ listing details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Sale method"
            value={form.saleMethod || ""}
            onChange={(e) => update("saleMethod", (e.target.value || undefined) as SaleMethod | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(SALE_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Ownership / property note"
            value={form.ownershipType || ""}
            onChange={(e) => update("ownershipType", (e.target.value || undefined) as OwnershipType | undefined)}
          >
            <option value="">Not set</option>
            {Object.entries(OWNERSHIP_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Open home date/time"
            hint="Optional — e.g. Saturday 11:00am - 11:30am"
            value={form.openHomeDateTime}
            onChange={(e) => update("openHomeDateTime", e.target.value)}
            placeholder="Saturday 11:00am - 11:30am"
          />
        </div>
        <Textarea
          label="School zone notes"
          hint="Optional — only what you can confirm. Never guaranteed in generated copy."
          value={form.schoolZoneNotes}
          onChange={(e) => update("schoolZoneNotes", e.target.value)}
        />
        <Textarea
          label="LIM / building report notes"
          hint="Optional"
          value={form.limBuildingReportNotes}
          onChange={(e) => update("limBuildingReportNotes", e.target.value)}
        />
        <Textarea
          label="Rental / yield notes"
          hint="Optional — required before any yield claim can be made in generated copy"
          value={form.rentalYieldNotes}
          onChange={(e) => update("rentalYieldNotes", e.target.value)}
        />
        <Textarea
          label="Words or claims to avoid"
          hint="Comma-separated — these will never appear in generated copy"
          value={form.wordsToAvoid}
          onChange={(e) => update("wordsToAvoid", e.target.value)}
          placeholder="e.g. luxury, stunning"
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-serif text-lg">Attribution</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Agent name"
            value={form.agentName}
            onChange={(e) => update("agentName", e.target.value)}
          />
          <Input
            label="Agency name"
            value={form.agencyName}
            onChange={(e) => update("agencyName", e.target.value)}
          />
          <Input
            label="Agent phone"
            value={form.agentPhone}
            onChange={(e) => update("agentPhone", e.target.value)}
          />
          <Input
            label="Agent email"
            type="email"
            value={form.agentEmail}
            onChange={(e) => update("agentEmail", e.target.value)}
          />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Generating your launch pack…" : "Generate launch pack"}
        </Button>
      </div>
    </form>
  );
}
