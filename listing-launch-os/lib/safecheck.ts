import type { CampaignInput } from "./types";
import { sectionMeta } from "./sections";
import { COMMON_TYPO_FIXES, extractAreaNumber } from "./formatCampaignData";

export type RiskLevel = "low" | "medium" | "high";

export interface SafeCheckIssue {
  sectionKey: string;
  sectionLabel: string;
  riskLevel: RiskLevel;
  issue: string;
  reason: string;
  saferAlternative: string;
}

export interface SafeCheckResult {
  issues: SafeCheckIssue[];
  summary: Record<RiskLevel, number>;
  disclaimer: string;
  noIssuesMessage: string;
}

export const SAFECHECK_DISCLAIMER =
  "Review all copy before publishing. The agent remains responsible for accuracy. This is a marketing review assistant, not legal advice.";

export const SAFECHECK_NO_ISSUES_MESSAGE =
  "No major compliance risks detected, but review all copy against confirmed property facts before publishing.";

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

interface AlwaysFlag {
  pattern: RegExp;
  riskLevel: RiskLevel;
  issue: string;
  reason: string;
  alternative: string;
}

// Phrases that are risky in NZ real estate marketing regardless of what the
// agent supplied — these are always flagged when found.
const ALWAYS_FLAG: AlwaysFlag[] = [
  {
    pattern: /guaranteed\s+returns?/i,
    riskLevel: "high",
    issue: "Guaranteed return",
    reason: "NZ real estate advertising rules prohibit guaranteed investment or return claims.",
    alternative: "potential for growth over time (without a guarantee)",
  },
  {
    pattern: /\bguaranteed\b/i,
    riskLevel: "high",
    issue: '"Guaranteed"',
    reason: "Guarantees about price, timing, or outcome can't be backed and are a common source of misrepresentation complaints.",
    alternative: "Remove, or rephrase without a guarantee (e.g. \"expected\", \"likely\").",
  },
  {
    pattern: /best\s+investment/i,
    riskLevel: "high",
    issue: '"Best investment"',
    reason: "Unsupported superlative investment claim.",
    alternative: "an investment opportunity worth considering",
  },
  {
    pattern: /\bbest\b/i,
    riskLevel: "medium",
    issue: '"Best"',
    reason: "Unsupported superlative unless the form specifically backs it up.",
    alternative: "Remove, or replace with a specific, factual detail.",
  },
  {
    pattern: /\bperfect\b/i,
    riskLevel: "medium",
    issue: '"Perfect"',
    reason: "Unsupported superlative unless the form specifically backs it up.",
    alternative: "Remove, or replace with a specific, factual detail.",
  },
  {
    pattern: /\bno\s+issues\b/i,
    riskLevel: "high",
    issue: '"No issues"',
    reason: "Implies a clean bill of health the agent cannot verify without a full building report.",
    alternative: "in good overall condition (subject to standard due diligence)",
  },
  {
    pattern: /\bwaterproof\b/i,
    riskLevel: "high",
    issue: '"Waterproof"',
    reason: "A building-defect claim that can't be verified without specialist inspection — a common source of misrepresentation complaints.",
    alternative: "well-maintained exterior (subject to standard building report)",
  },
  {
    pattern: /leak[\s-]?free/i,
    riskLevel: "high",
    issue: '"Leak-free"',
    reason: "A building-defect claim that can't be verified without specialist inspection.",
    alternative: "no known leaks (subject to standard building report)",
  },
  {
    pattern: /school\s+zone\s+guaranteed|guaranteed\s+school\s+zone/i,
    riskLevel: "high",
    issue: "Guaranteed school zone",
    reason: "Zoning and enrolment can change and are not something an agent can guarantee.",
    alternative: "within the [suburb] school zone (confirm current zoning with the Ministry of Education)",
  },
  {
    pattern: /won'?t\s+(?:last|stay\s+on\s+the\s+market\s+(?:for\s+)?long)/i,
    riskLevel: "high",
    issue: "Unsupported urgency claim",
    reason: "Claims like \"won't last\" or \"won't stay on the market long\" can't be backed up and read as pressure tactics.",
    alternative: "Remove, or use a genuine, time-bound fact instead (e.g. a confirmed open home or deadline sale date).",
  },
  {
    pattern: /close\s+to\s+everything/i,
    riskLevel: "medium",
    issue: '"Close to everything"',
    reason: "A vague, unverifiable claim — name the specific amenities instead.",
    alternative: "Replace with the specific amenities entered in the form.",
  },
];

interface ConditionalFlag {
  pattern: RegExp;
  riskLevel: RiskLevel;
  issue: string;
  reason: string;
  alternative: string;
  isSupported: (input: CampaignInput) => boolean;
}

// Phrases that are only risky when the form data doesn't back them up.
const CONDITIONAL_FLAGS: ConditionalFlag[] = [
  {
    pattern: /fully\s+renovated/i,
    riskLevel: "medium",
    issue: '"Fully renovated"',
    reason: "Only use this if the renovations you entered describe a full renovation — otherwise it overstates the work done.",
    alternative: "recently updated, or name the specific renovated areas",
    isSupported: (input) => !!input.renovations && /\bfull(y)?\b/i.test(input.renovations),
  },
  {
    pattern: /recently\s+upgraded/i,
    riskLevel: "medium",
    issue: '"Recently upgraded"',
    reason: "No renovations/upgrades were entered in the form to support this claim.",
    alternative: "Remove, or add the specific upgrade to the form's renovations field.",
    isSupported: (input) => !!input.renovations,
  },
  {
    pattern: /subdivision\s+potential/i,
    riskLevel: "high",
    issue: "Subdivision potential",
    reason: "Subdivision potential wasn't provided in the property form — this could mislead buyers about what's actually possible on this title.",
    alternative: "remove, or add subdivision details to the form so this claim is supported",
    isSupported: (input) => /subdivision/i.test(`${input.notes || ""} ${input.keyFeatures || ""}`),
  },
  {
    pattern: /development\s+potential/i,
    riskLevel: "high",
    issue: "Development potential",
    reason: "Development potential wasn't provided in the property form — this could mislead buyers about what's actually possible on this title.",
    alternative: "remove, or add development details to the form so this claim is supported",
    isSupported: (input) => /development/i.test(`${input.notes || ""} ${input.keyFeatures || ""}`),
  },
  {
    pattern: /high\s+yield/i,
    riskLevel: "high",
    issue: "High yield",
    reason: "No rental/yield notes were provided to support this claim.",
    alternative: "add rental/yield notes to the form, or remove the yield claim",
    isSupported: (input) => !!input.rentalYieldNotes,
  },
  {
    pattern: /\bzoned for\b|\bschool zone\b/i,
    riskLevel: "high",
    issue: "Unsupported school zone claim",
    reason: "No school zone notes were provided — zoning claims must be confirmed before publishing.",
    alternative: "remove, or add school zone notes to the form so this can be confirmed",
    isSupported: (input) => !!input.schoolZoneNotes,
  },
  {
    pattern: /family\s+home/i,
    riskLevel: "medium",
    issue: '"Family home" framing',
    reason: "The property profile (2 bedrooms or fewer) may not clearly support family-home framing — consider a broader buyer angle.",
    alternative: "well suited to first-home buyers, professionals, downsizers, or investors",
    isSupported: (input) => !(typeof input.bedrooms === "number" && input.bedrooms <= 2),
  },
];

const GENERIC_SUPERLATIVES = /\b(unbeatable|unmatched|flawless|ultimate|unrivalled|unrivaled|best in|number one|#1)\b/gi;

const NUMERIC_CHECKS: Array<{ regex: RegExp; formKey: "bedrooms" | "bathrooms" | "garages"; label: string }> = [
  { regex: /(\d+)\s*[- ]?(?:bed\s?rooms?|beds?)\b/gi, formKey: "bedrooms", label: "bedrooms" },
  { regex: /(\d+)\s*[- ]?(?:bath\s?rooms?|baths?)\b/gi, formKey: "bathrooms", label: "bathrooms" },
  { regex: /(\d+)\s*[- ]?(?:car\s?parks?|garages?)\b/gi, formKey: "garages", label: "car parks" },
];

const MISSING_M2_PATTERN = /\b(\d{2,4})\s*(?:sqm|sq\s?m|square\s?met(?:re|er)s?)\b/gi;

const PLACE_SUFFIX = /(Park|School|Mall|Centre|Center|Beach|Reserve|Village|Station|Market|Library|Zoo|Stadium|University|College|Domain|Marina|Wharf)$/;
const PROPER_NOUN_PHRASE = /\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,3})\b/g;
const COMMON_EXCLUSIONS = new Set([
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Trade Me",
  "New Zealand",
  "NZ",
  "CTA",
  "Auckland",
]);

function findAlwaysAndConditionalFlags(text: string, input: CampaignInput): Array<{ match: string; flag: AlwaysFlag }> {
  const results: Array<{ match: string; flag: AlwaysFlag }> = [];

  for (const flag of ALWAYS_FLAG) {
    const match = text.match(flag.pattern);
    if (match) results.push({ match: match[0], flag });
  }

  for (const flag of CONDITIONAL_FLAGS) {
    const match = text.match(flag.pattern);
    if (match && !flag.isSupported(input)) {
      results.push({ match: match[0], flag });
    }
  }

  return results;
}

function findUnsupportedAmenities(text: string, input: CampaignInput): string[] {
  const providedAmenities = (input.amenities || "").toLowerCase();
  const knownPlaces = [input.address, input.suburb, input.agentName, input.agencyName]
    .filter(Boolean)
    .map((s) => (s as string).toLowerCase());

  const found = new Set<string>();
  const matches = text.matchAll(PROPER_NOUN_PHRASE);
  for (const m of matches) {
    const phrase = m[1];
    if (COMMON_EXCLUSIONS.has(phrase)) continue;
    if (!PLACE_SUFFIX.test(phrase)) continue;
    const lower = phrase.toLowerCase();
    if (providedAmenities.includes(lower)) continue;
    if (knownPlaces.some((p) => p.includes(lower) || lower.includes(p))) continue;
    found.add(phrase);
  }
  return Array.from(found);
}

/**
 * Flags land/floor area mentioned with exact wording ("450m²", no
 * "approximately") when the campaign's area wording is "exact" but that
 * specific figure hasn't been marked verified. Never flags "approximately"
 * wording — that's always safe regardless of the verified flags.
 */
function findUnverifiedExactArea(
  text: string,
  input: CampaignInput
): Array<{ label: string; number: string }> {
  if ((input.areaWording || "approximate") !== "exact") return [];

  const checks: Array<{ raw?: string; verified?: boolean; label: string }> = [
    { raw: input.landSize, verified: input.landAreaVerified, label: "land" },
    { raw: input.floorArea, verified: input.floorAreaVerified, label: "floor" },
  ];

  const found: Array<{ label: string; number: string }> = [];
  for (const check of checks) {
    if (!check.raw || check.verified) continue;
    const number = extractAreaNumber(check.raw);
    if (!number) continue;
    const exactMention = new RegExp(`(?<!approximately\\s)\\b${number}\\s*m²`, "i");
    if (exactMention.test(text)) found.push({ label: check.label, number });
  }
  return found;
}

function findTypos(text: string): Array<{ typo: string; fix: string }> {
  const found: Array<{ typo: string; fix: string }> = [];
  for (const [typo, fix] of Object.entries(COMMON_TYPO_FIXES)) {
    if (new RegExp(`\\b${typo}\\b`, "i").test(text)) {
      found.push({ typo, fix });
    }
  }
  return found;
}

export function runSafeCheck(outputs: Record<string, string>, input: CampaignInput): SafeCheckResult {
  const issues: SafeCheckIssue[] = [];

  for (const [sectionKey, content] of Object.entries(outputs)) {
    if (!content) continue;
    const sectionLabel = sectionMeta(sectionKey)?.label || sectionKey;

    for (const { match, flag } of findAlwaysAndConditionalFlags(content, input)) {
      issues.push({
        sectionKey,
        sectionLabel,
        riskLevel: flag.riskLevel,
        issue: `${flag.issue} ("${match}")`,
        reason: flag.reason,
        saferAlternative: flag.alternative,
      });
    }

    const superlativeMatches = content.match(GENERIC_SUPERLATIVES);
    if (superlativeMatches) {
      for (const m of new Set(superlativeMatches.map((s) => s.toLowerCase()))) {
        issues.push({
          sectionKey,
          sectionLabel,
          riskLevel: "medium",
          issue: `Unsupported superlative ("${m}")`,
          reason: "Superlative claims like this need specific supporting evidence in the property form.",
          saferAlternative: "Remove, or replace with a specific, factual detail.",
        });
      }
    }

    for (const check of NUMERIC_CHECKS) {
      const formValue = input[check.formKey];
      if (!formValue) continue;
      for (const m of content.matchAll(check.regex)) {
        const mentioned = Number(m[1]);
        if (mentioned !== formValue) {
          issues.push({
            sectionKey,
            sectionLabel,
            riskLevel: "high",
            issue: `Unsupported factual claim ("${m[0]}")`,
            reason: `This doesn't match the ${formValue} ${check.label} entered in the property form.`,
            saferAlternative: `Update to match the ${formValue} ${check.label} from your form data.`,
          });
        }
      }
    }

    for (const m of content.matchAll(MISSING_M2_PATTERN)) {
      const wording = input.areaWording || "approximate";
      issues.push({
        sectionKey,
        sectionLabel,
        riskLevel: "low",
        issue: `Missing m² unit ("${m[0]}")`,
        reason: "Measurements should use the m² symbol consistently, not \"sqm\" or \"sq m\".",
        saferAlternative: wording === "exact" ? `${m[1]}m²` : `approximately ${m[1]}m²`,
      });
    }

    for (const { label, number } of findUnverifiedExactArea(content, input)) {
      issues.push({
        sectionKey,
        sectionLabel,
        riskLevel: "medium",
        issue: `Exact ${label} area wording without verification ("${number}m²")`,
        reason: `Area wording is set to "exact" but the ${label} area figure hasn't been marked verified — exact figures should only be used once confirmed.`,
        saferAlternative: `approximately ${number}m²`,
      });
    }

    for (const { typo, fix } of findTypos(content)) {
      issues.push({
        sectionKey,
        sectionLabel,
        riskLevel: "high",
        issue: `Spelling error ("${typo}")`,
        reason: "This looks like a typo — proofread before publishing.",
        saferAlternative: `Correct to "${fix}".`,
      });
    }

    for (const place of findUnsupportedAmenities(content, input)) {
      issues.push({
        sectionKey,
        sectionLabel,
        riskLevel: input.amenities ? "low" : "medium",
        issue: `Possible unsupported amenity or place name ("${place}")`,
        reason: "This place name isn't in the amenities you provided — verify it's accurate before publishing.",
        saferAlternative: "Remove it, or add it to the form's nearby amenities field if it's correct.",
      });
    }
  }

  issues.sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]);

  const summary: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) summary[issue.riskLevel]++;

  return { issues, summary, disclaimer: SAFECHECK_DISCLAIMER, noIssuesMessage: SAFECHECK_NO_ISSUES_MESSAGE };
}
