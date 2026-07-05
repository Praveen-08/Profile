import type { CampaignInput, VendorUpdateContext } from "../types";
import { getSectionPrompt } from "../prompts/sections";
import { getVendorUpdateSectionPrompt } from "../prompts/vendorUpdate";
import { generatePlaceholder } from "./placeholder";
import { generateVendorUpdatePlaceholder } from "./vendorUpdatePlaceholder";
import { generateWithClaude } from "./anthropic";

export type AiMode = "placeholder" | "live";

export function getAiMode(): AiMode {
  return process.env.AI_MODE === "live" ? "live" : "placeholder";
}

export async function generateSection(sectionKey: string, input: CampaignInput): Promise<string> {
  const mode = getAiMode();

  if (mode === "placeholder") {
    return generatePlaceholder(sectionKey, input);
  }

  const { system, user } = getSectionPrompt(sectionKey, input);
  return generateWithClaude(system, user);
}

export async function generateSections(
  sectionKeys: string[],
  input: CampaignInput
): Promise<Record<string, string>> {
  const results = await Promise.all(
    sectionKeys.map(async (key) => [key, await generateSection(key, input)] as const)
  );
  return Object.fromEntries(results);
}

export async function generateVendorUpdateSection(sectionKey: string, input: VendorUpdateContext): Promise<string> {
  const mode = getAiMode();

  if (mode === "placeholder") {
    return generateVendorUpdatePlaceholder(sectionKey, input);
  }

  const { system, user } = getVendorUpdateSectionPrompt(sectionKey, input);
  return generateWithClaude(system, user);
}

export async function generateVendorUpdateSections(
  sectionKeys: string[],
  input: VendorUpdateContext
): Promise<Record<string, string>> {
  const results = await Promise.all(
    sectionKeys.map(async (key) => [key, await generateVendorUpdateSection(key, input)] as const)
  );
  return Object.fromEntries(results);
}
