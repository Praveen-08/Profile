/**
 * Generates the placeholder music library: short, non-copyrighted
 * click-track/tone-bed audio for every entry in MUSIC_TRACK_CATALOG,
 * matching each track's declared BPM/energy/structure exactly. This gives
 * packages/beat-engine (via apps/ai-service's librosa endpoint) real audio
 * to analyze end-to-end. Swap the storage objects at the same keys for
 * licensed tracks later — nothing else in the system needs to change.
 *
 * Run: pnpm music:synthesize
 */
import { encode } from "wav-encoder";
import { createStorageAdapterFromEnv } from "@quickreel/storage";
import type { MusicVibe } from "@quickreel/shared";
import { MUSIC_TRACK_CATALOG } from "../src/catalog.js";
import type { MusicTrackDef } from "../src/types.js";

const SAMPLE_RATE = 44100;

interface VibeSound {
  rootFreq: number;
  isMajor: boolean;
  clickHz: number;
  clickProminence: number;
  padProminence: number;
}

const VIBE_SOUND: Record<MusicVibe, VibeSound> = {
  LUXURY_PIANO: { rootFreq: 220, isMajor: false, clickHz: 900, clickProminence: 0.35, padProminence: 1.1 },
  EPIC_CINEMATIC: { rootFreq: 110, isMajor: false, clickHz: 130, clickProminence: 0.9, padProminence: 1.0 },
  MODERN_ELECTRONIC: { rootFreq: 130.81, isMajor: true, clickHz: 1400, clickProminence: 0.85, padProminence: 0.7 },
  CORPORATE: { rootFreq: 196, isMajor: true, clickHz: 800, clickProminence: 0.6, padProminence: 0.8 },
  DEEP_HOUSE: { rootFreq: 146.83, isMajor: false, clickHz: 100, clickProminence: 0.95, padProminence: 0.8 },
  ACOUSTIC: { rootFreq: 196, isMajor: true, clickHz: 700, clickProminence: 0.4, padProminence: 0.9 },
  LIFESTYLE: { rootFreq: 174.61, isMajor: true, clickHz: 1000, clickProminence: 0.65, padProminence: 0.75 },
  AMBIENT: { rootFreq: 110, isMajor: false, clickHz: 500, clickProminence: 0.1, padProminence: 1.2 },
  HIGH_ENERGY: { rootFreq: 196, isMajor: true, clickHz: 1600, clickProminence: 1.0, padProminence: 0.65 },
  MOTIVATIONAL: { rootFreq: 174.61, isMajor: true, clickHz: 1100, clickProminence: 0.75, padProminence: 0.85 },
};

const MAJOR_THIRD = Math.pow(2, 4 / 12);
const MINOR_THIRD = Math.pow(2, 3 / 12);
const FIFTH = Math.pow(2, 7 / 12);

function energyEnvelope(t: number, track: MusicTrackDef): number {
  let env = 0.55 + track.energy * 0.45;

  if (track.buildUpSec !== null && track.dropSec !== null) {
    if (t < track.buildUpSec) {
      env *= 0.55 + 0.45 * (t / track.buildUpSec);
    } else if (t >= track.dropSec && t < track.dropSec + 1.5) {
      env *= 1.35;
    }
  }

  if (track.outroSec !== null && t > track.outroSec) {
    const fade = Math.min(1, (t - track.outroSec) / Math.max(0.5, track.durationSec - track.outroSec));
    env *= 1 - fade * 0.85;
  }

  return env;
}

function synthesizeTrack(track: MusicTrackDef): Float32Array {
  const sound = VIBE_SOUND[track.vibe];
  const totalSamples = Math.round(track.durationSec * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  const thirdRatio = sound.isMajor ? MAJOR_THIRD : MINOR_THIRD;

  // Sustained harmonic pad (root + third + fifth), amplitude follows the track's energy envelope.
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = energyEnvelope(t, track);
    const pad =
      (Math.sin(2 * Math.PI * sound.rootFreq * t) +
        0.7 * Math.sin(2 * Math.PI * sound.rootFreq * thirdRatio * t) +
        0.5 * Math.sin(2 * Math.PI * sound.rootFreq * FIFTH * t)) /
      2.2;
    buffer[i]! += pad * env * sound.padProminence * 0.5;
  }

  // Percussive click on every beat at the declared BPM — the real signal librosa.beat.beat_track detects.
  const beatIntervalSec = 60 / track.bpm;
  const burstLenSamples = Math.round(0.09 * SAMPLE_RATE);
  for (let beatTime = 0; beatTime < track.durationSec; beatTime += beatIntervalSec) {
    const startSample = Math.round(beatTime * SAMPLE_RATE);
    const env = energyEnvelope(beatTime, track);
    for (let j = 0; j < burstLenSamples && startSample + j < totalSamples; j++) {
      const decay = Math.exp(-j / (burstLenSamples * 0.28));
      const tone = Math.sin(2 * Math.PI * sound.clickHz * (j / SAMPLE_RATE));
      const noise = Math.random() * 2 - 1;
      const sample = (tone * 0.75 + noise * 0.25) * decay;
      buffer[startSample + j]! += sample * env * sound.clickProminence * 0.6;
    }
  }

  let peak = 0;
  for (const s of buffer) peak = Math.max(peak, Math.abs(s));
  if (peak > 0) {
    const scale = 0.9 / peak;
    for (let i = 0; i < buffer.length; i++) buffer[i]! *= scale;
  }

  return buffer;
}

async function main() {
  const storage = createStorageAdapterFromEnv();

  for (const track of MUSIC_TRACK_CATALOG) {
    const samples = synthesizeTrack(track);
    const wavArrayBuffer = await encode({ sampleRate: SAMPLE_RATE, channelData: [samples] });
    await storage.putObject(`music-library/${track.filename}`, Buffer.from(wavArrayBuffer), "audio/wav");
    console.log(`Synthesized music-library/${track.filename} (${track.durationSec}s, ${track.bpm} BPM, ${track.vibe})`);
  }

  console.log(`Done — ${MUSIC_TRACK_CATALOG.length} tracks written.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
