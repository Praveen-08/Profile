"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, Upload } from "lucide-react";
import { WATERMARK_POSITIONS } from "@quickreel/shared";
import { api, type BrandKitSummary } from "@/lib/api";
import { uploadBrandAsset } from "@/lib/upload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FIELD_LABEL: Record<string, string> = {
  name: "Kit name",
  agencyName: "Agency name",
  contactPhone: "Phone",
  contactEmail: "Email",
  contactWebsite: "Website",
};

function TextField({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
    />
  );
}

function AssetUploadRow({
  label,
  kind,
  url,
  token,
  kitId,
  onUploaded,
}: {
  label: string;
  kind: "logo" | "outro" | "watermark";
  url: string | null;
  token: string;
  kitId: string;
  onUploaded: (kit: BrandKitSummary) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const kit = await uploadBrandAsset(token, kitId, kind, file);
      onUploaded(kit);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-black">
            <Image src={url} alt={label} fill className="object-contain" unoptimized />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-muted">
            <Upload className="h-4 w-4" />
          </div>
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Upload"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

export function BrandKitEditor({
  token,
  kit,
  onChanged,
  onDeleted,
}: {
  token: string;
  kit: BrandKitSummary;
  onChanged: (kit: BrandKitSummary) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function save(patch: Partial<BrandKitSummary>) {
    const updated = await api.updateBrandKit(token, kit.id, patch);
    onChanged(updated);
  }

  async function remove() {
    if (!confirm(`Delete brand kit "${kit.name}"?`)) return;
    setDeleting(true);
    try {
      await api.deleteBrandKit(token, kit.id);
      onDeleted(kit.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">{FIELD_LABEL.name}</label>
          <TextField value={kit.name} placeholder="Default" onSave={(name) => save({ name })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">{FIELD_LABEL.agencyName}</label>
          <TextField value={kit.agencyName ?? ""} placeholder="Acme Realty" onSave={(agencyName) => save({ agencyName })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">{FIELD_LABEL.contactPhone}</label>
          <TextField value={kit.contactPhone ?? ""} placeholder="(555) 010-0100" onSave={(contactPhone) => save({ contactPhone })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">{FIELD_LABEL.contactEmail}</label>
          <TextField value={kit.contactEmail ?? ""} placeholder="hello@agency.com" onSave={(contactEmail) => save({ contactEmail })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">{FIELD_LABEL.contactWebsite}</label>
          <TextField value={kit.contactWebsite ?? ""} placeholder="agency.com" onSave={(contactWebsite) => save({ contactWebsite })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Watermark position</label>
          <select
            value={kit.watermarkPosition}
            onChange={(e) => save({ watermarkPosition: e.target.value })}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent/50"
          >
            {WATERMARK_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-muted">Primary color</label>
          <input
            type="color"
            value={kit.primaryColor ?? "#d4af37"}
            onChange={(e) => save({ primaryColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-xl border border-border bg-surface"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Secondary color</label>
          <input
            type="color"
            value={kit.secondaryColor ?? "#0a0a0a"}
            onChange={(e) => save({ secondaryColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-xl border border-border bg-surface"
          />
        </div>
      </div>

      <div className="space-y-2">
        <AssetUploadRow label="Logo" kind="logo" url={kit.logoUrl} token={token} kitId={kit.id} onUploaded={onChanged} />
        <AssetUploadRow label="Outro background" kind="outro" url={kit.outroUrl} token={token} kitId={kit.id} onUploaded={onChanged} />
        <AssetUploadRow label="Watermark" kind="watermark" url={kit.watermarkUrl} token={token} kitId={kit.id} onUploaded={onChanged} />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <label className={cn("flex items-center gap-2 text-sm", kit.isDefault ? "text-accent" : "text-muted")}>
          <input
            type="checkbox"
            checked={kit.isDefault}
            onChange={(e) => save({ isDefault: e.target.checked })}
            className="h-4 w-4 accent-[--color-accent]"
          />
          Default brand kit
        </label>
        <Button size="sm" variant="destructive" onClick={remove} disabled={deleting}>
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </Card>
  );
}
