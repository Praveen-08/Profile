import type { CampaignInput } from "./types";
import { formatFloorArea, formatLandArea } from "./formatCampaignData";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Human-readable one-line summary of the facts we actually have, skipping anything not provided. */
export function propertyFactsList(input: CampaignInput): string[] {
  const facts: string[] = [];
  if (input.bedrooms) facts.push(`${input.bedrooms} bedroom${input.bedrooms === 1 ? "" : "s"}`);
  if (input.bathrooms) facts.push(`${input.bathrooms} bathroom${input.bathrooms === 1 ? "" : "s"}`);
  if (input.garages) facts.push(`${input.garages} car park${input.garages === 1 ? "" : "s"}`);
  const land = formatLandArea(input);
  if (land) facts.push(`${land} land`);
  const floor = formatFloorArea(input);
  if (floor) facts.push(`${floor} floor area`);
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
