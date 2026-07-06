import { DEFAULT_AREA_WORDING, type AreaWording, type CampaignInput } from "./types";

/**
 * Normalises raw agent-entered text before it's used for generation or
 * display: title case for address/suburb/amenities, consistent m²
 * formatting, a readable open-home date/time, common typo fixes, and
 * cleaned-up whitespace. Never invents facts — only reformats what was
 * actually entered.
 */

const LOWERCASE_WORDS = new Set(["and", "of", "the", "on", "at"]);

/** Title-cases a string while keeping unit/letter suffixes like "16a" -> "16A" intact. */
export function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return word;
      // Preserve/uppercase a trailing unit letter on a house number, e.g. "16a" -> "16A".
      if (/^\d+[a-z]$/i.test(word)) {
        return word.slice(0, -1) + word.slice(-1).toUpperCase();
      }
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      // Hyphenated words: title-case each segment ("mount-eden" -> "Mount-Eden").
      return lower
        .split("-")
        .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : seg))
        .join("-");
    })
    .join(" ");
}

/** Title-cases a comma-separated list (e.g. amenities), trimming and cleaning each item. */
export function toTitleCaseList(text: string): string {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => toTitleCase(item))
    .join(", ");
}

export const COMMON_TYPO_FIXES: Record<string, string> = {
  buit: "built",
  recieve: "receive",
  seperate: "separate",
  definately: "definitely",
  occured: "occurred",
  untill: "until",
  acheive: "achieve",
  wich: "which",
  teh: "the",
  freindly: "friendly",
  neighbourhoud: "neighbourhood",
};

/** Corrects a small set of common real-estate-copy typos, preserving capitalisation. */
export function correctCommonTypos(text: string): string {
  let result = text;
  for (const [typo, fix] of Object.entries(COMMON_TYPO_FIXES)) {
    result = result.replace(new RegExp(`\\b${typo}\\b`, "gi"), (match) =>
      match[0] === match[0].toUpperCase() ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix
    );
  }
  return result;
}

export function cleanExtraSpaces(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** Extracts the plain numeric figure from a raw measurement ("450", "450m2", "approx 450 sqm") -> "450". */
export function extractAreaNumber(raw?: string): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/([\d,]+(?:\.\d+)?)/);
  return match ? match[1] : undefined;
}

/** Normalises a raw measurement to a bare "450m²" — no wording opinion (see formatArea for that). */
export function formatMeasurement(raw?: string): string | undefined {
  if (!raw) return undefined;
  const number = extractAreaNumber(raw);
  if (!number) return cleanExtraSpaces(raw);
  return `${number}m²`;
}

/**
 * Formats a land/floor area figure for use in generated copy, respecting
 * the campaign's area wording preference:
 * - "approximate": "approximately 450m²"
 * - "exact": "450m²"
 * - "hide_if_unsure": only returned if `verified` is true (otherwise
 *   undefined, so callers omit the area from copy entirely)
 * Never invents a figure — returns undefined if none was supplied.
 */
export function formatArea(raw: string | undefined, wording: AreaWording, verified: boolean): string | undefined {
  const number = extractAreaNumber(raw);
  if (!number) return undefined;
  if (wording === "hide_if_unsure") return verified ? `${number}m²` : undefined;
  if (wording === "exact") return `${number}m²`;
  return `approximately ${number}m²`;
}

/** Convenience wrapper that reads areaWording/verified straight off a CampaignInput. */
export function formatLandArea(input: CampaignInput): string | undefined {
  return formatArea(input.landSize, input.areaWording || DEFAULT_AREA_WORDING, !!input.landAreaVerified);
}

export function formatFloorArea(input: CampaignInput): string | undefined {
  return formatArea(input.floorArea, input.areaWording || DEFAULT_AREA_WORDING, !!input.floorAreaVerified);
}

const DAY_NAMES: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function normaliseTimeToken(token: string, fallbackMeridiem?: string): { hour: string; minute: string; meridiem?: string } {
  const cleaned = token.trim().replace(".", ":");
  const meridiemMatch = cleaned.match(/(am|pm)$/i);
  const meridiem = meridiemMatch ? meridiemMatch[0].toLowerCase() : fallbackMeridiem;
  const numeric = cleaned.replace(/(am|pm)$/i, "").trim();
  const [hour, minute] = numeric.split(":");
  return { hour: hour || "12", minute: minute ? minute.padStart(2, "0") : "00", meridiem };
}

/** Formats a raw open-home date/time string ("sunday 10-10.30") into "Sunday, 10:00–10:30am". */
export function formatOpenHomeDateTime(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const dayMatch = trimmed.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);
  const day = dayMatch ? DAY_NAMES[dayMatch[0].slice(0, 3).toLowerCase()] : undefined;

  const rest = dayMatch ? trimmed.replace(dayMatch[0], "").trim() : trimmed;
  const rangeMatch = rest.match(/(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)?)/i);

  if (!rangeMatch) {
    // Couldn't confidently parse a time range — return a cleaned, capitalised version rather than guessing.
    const cleaned = cleanExtraSpaces(trimmed);
    return day ? `${day}, ${cleaned.replace(dayMatch![0], "").trim()}`.replace(/,\s*$/, "") || day : cleaned;
  }

  const endToken = normaliseTimeToken(rangeMatch[2]);
  const startToken = normaliseTimeToken(rangeMatch[1], endToken.meridiem || "am");
  const meridiem = endToken.meridiem || startToken.meridiem || "am";

  const timeRange = `${startToken.hour}:${startToken.minute}–${endToken.hour}:${endToken.minute}${meridiem}`;
  return day ? `${day}, ${timeRange}` : timeRange;
}

/**
 * Returns a copy of the campaign input with display/generation-facing text
 * fields normalised. Numeric fields, ids, and selections are left untouched.
 */
export function normalizeCampaignInput(input: CampaignInput): CampaignInput {
  return {
    ...input,
    address: input.address ? toTitleCase(correctCommonTypos(input.address)) : input.address,
    suburb: input.suburb ? toTitleCase(correctCommonTypos(input.suburb)) : input.suburb,
    amenities: input.amenities ? toTitleCaseList(correctCommonTypos(input.amenities)) : input.amenities,
    landSize: formatMeasurement(input.landSize) || input.landSize,
    floorArea: formatMeasurement(input.floorArea) || input.floorArea,
    openHomeDateTime: formatOpenHomeDateTime(input.openHomeDateTime) || input.openHomeDateTime,
    keyFeatures: input.keyFeatures ? cleanExtraSpaces(correctCommonTypos(input.keyFeatures)) : input.keyFeatures,
    renovations: input.renovations ? cleanExtraSpaces(correctCommonTypos(input.renovations)) : input.renovations,
    notes: input.notes ? cleanExtraSpaces(correctCommonTypos(input.notes)) : input.notes,
  };
}
