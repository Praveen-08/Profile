"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { api, type BrandKitSummary } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandKitEditor } from "./BrandKitEditor";

export function BrandKitClient({ token, initialBrandKits }: { token: string; initialBrandKits: BrandKitSummary[] }) {
  const [kits, setKits] = useState(initialBrandKits);
  const [selectedId, setSelectedId] = useState<string | null>(initialBrandKits[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  async function createKit() {
    setCreating(true);
    try {
      const kit = await api.createBrandKit(token, { name: `Brand Kit ${kits.length + 1}` });
      setKits((prev) => [...prev, kit]);
      setSelectedId(kit.id);
    } finally {
      setCreating(false);
    }
  }

  function updateKitInList(kit: BrandKitSummary) {
    setKits((prev) => prev.map((k) => (k.id === kit.id ? kit : k)));
  }

  function removeKitFromList(id: string) {
    setKits((prev) => prev.filter((k) => k.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  const selected = kits.find((k) => k.id === selectedId) ?? null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Brand Kit</h1>
          <p className="mt-1 text-muted">
            Your logo, colors, fonts, outro, and watermark — applied automatically to every reel you generate.
          </p>
        </div>
        <Button onClick={createKit} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Brand Kit
        </Button>
      </div>

      {kits.length === 0 ? (
        <Card className="p-12 text-center text-muted">No brand kits yet — create one above.</Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {kits.map((kit) => (
            <button
              key={kit.id}
              onClick={() => setSelectedId(kit.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
                selectedId === kit.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:border-accent/40",
              )}
            >
              {kit.name}
              {kit.isDefault && <Badge>default</Badge>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <BrandKitEditor token={token} kit={selected} onChanged={updateKitInList} onDeleted={removeKitFromList} />
      )}
    </div>
  );
}
