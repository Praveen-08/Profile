import type { CampaignInput } from "./types";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function withApprox(value: string): string {
  return /approx/i.test(value) ? value : `approximately ${value}`;
}

/** Human-readable one-line summary of the facts we actually have, skipping anything not provided. */
export function propertyFactsList(input: CampaignInput): string[] {
  const facts: string[] = [];
  if (input.bedrooms) facts.push(`${input.bedrooms} bedroom${input.bedrooms === 1 ? "" : "s"}`);
  if (input.bathrooms) facts.push(`${input.bathrooms} bathroom${input.bathrooms === 1 ? "" : "s"}`);
  if (input.garages) facts.push(`${input.garages} car park${input.garages === 1 ? "" : "s"}`);
  if (input.landSize) facts.push(`${withApprox(input.landSize)} land`);
  if (input.floorArea) facts.push(`${withApprox(input.floorArea)} floor area`);
  return facts;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
