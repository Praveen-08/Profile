import type { AtmosphericEffect, RoomType, StyleConfig } from "@quickreel/shared";
import { ROOM_EFFECT_OPTIONS } from "./room-options.js";

/** At most this fraction of eligible clips get an effect at all — "never overuse." */
export const ATMOSPHERIC_FREQUENCY_CAP = 0.4;
/** Deliberately narrow, low range — "extremely subtle." */
const MIN_INTENSITY = 0.06;
const MAX_INTENSITY = 0.16;

export interface SelectAtmosphericEffectInput {
  roomType: RoomType;
  style: StyleConfig;
  rng: () => number;
}

/**
 * Picks at most one atmospheric effect for a clip — never two effects
 * layered on the same shot, and only for styles that opt in
 * (`atmosphericEffectsEnabled`, "luxury only" per product spec). Returns
 * null far more often than not: the frequency cap applies on top of the
 * room-type gate, so even a fully eligible exterior clip in a luxury style
 * only gets an effect ATMOSPHERIC_FREQUENCY_CAP of the time.
 */
export function selectAtmosphericEffect(input: SelectAtmosphericEffectInput): AtmosphericEffect | null {
  if (!input.style.atmosphericEffectsEnabled) return null;

  const options = ROOM_EFFECT_OPTIONS[input.roomType];
  if (!options || options.length === 0) return null;

  if (input.rng() > ATMOSPHERIC_FREQUENCY_CAP) return null;

  const type = options[Math.floor(input.rng() * options.length)]!;
  const intensity = MIN_INTENSITY + input.rng() * (MAX_INTENSITY - MIN_INTENSITY);
  return { type, intensity };
}
