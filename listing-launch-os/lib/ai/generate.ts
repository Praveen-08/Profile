import type { AgentMeetingPlaybookFormData, CampaignInput, VendorUpdateContext } from "../types";
import { getSectionPrompt } from "../prompts/sections";
import { getVendorUpdateSectionPrompt } from "../prompts/vendorUpdate";
import { agentMeetingPlaybookPrompt } from "../prompts/agentMeetingPlaybook";
import { PK_SECTION_KEYS, pkScriptAssistantPrompt } from "../prompts/pkScriptAssistantPrompt";
import { generatePlaceholder } from "./placeholder";
import { generateVendorUpdatePlaceholder } from "./vendorUpdatePlaceholder";
import { generateMeetingPlaybookPlaceholder } from "./agentMeetingPlaybookPlaceholder";
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

  // The 10 reel/social sections use the PK Script Assistant style (short-form
  // video scriptwriting technique) instead of the general listing-copy prompt.
  const { system, user } = PK_SECTION_KEYS.includes(sectionKey)
    ? pkScriptAssistantPrompt(sectionKey, input)
    : getSectionPrompt(sectionKey, input);
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

/**
 * Reusable entry point for the PK-style Reels & Video / Social Posts
 * outputs (10 sections). Generation for these keys already routes through
 * generateSection/generateSections automatically (see above), so this is a
 * convenience wrapper for generating just that set — e.g. a future "redo
 * all reels & social" action — without touching the rest of the pack.
 */
export async function generatePkStyleSocialAndReels(input: CampaignInput): Promise<Record<string, string>> {
  return generateSections(PK_SECTION_KEYS, input);
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

export async function generateMeetingPlaybookSection(
  sectionKey: string,
  input: AgentMeetingPlaybookFormData
): Promise<string> {
  const mode = getAiMode();

  if (mode === "placeholder") {
    return generateMeetingPlaybookPlaceholder(sectionKey, input);
  }

  const { system, user } = agentMeetingPlaybookPrompt(sectionKey, input);
  return generateWithClaude(system, user);
}

export async function generateMeetingPlaybookSections(
  sectionKeys: string[],
  input: AgentMeetingPlaybookFormData
): Promise<Record<string, string>> {
  const results = await Promise.all(
    sectionKeys.map(async (key) => [key, await generateMeetingPlaybookSection(key, input)] as const)
  );
  return Object.fromEntries(results);
}
