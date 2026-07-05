import type { CampaignInput } from "../types";
import { getSectionPrompt } from "../prompts/sections";
import { generatePlaceholder } from "./placeholder";
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
