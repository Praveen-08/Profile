import { STYLE_CATALOG } from "@quickreel/style-engine";
import { MUSIC_TRACK_CATALOG } from "@quickreel/music-engine";
import { PrismaClient } from "../generated/client/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${STYLE_CATALOG.length} styles...`);
  for (const [index, s] of STYLE_CATALOG.entries()) {
    await prisma.style.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, name: s.name, description: s.description, sortOrder: index, isActive: true },
      update: { name: s.name, description: s.description, sortOrder: index, isActive: true },
    });
  }

  console.log(`Seeding ${MUSIC_TRACK_CATALOG.length} music tracks...`);
  for (const t of MUSIC_TRACK_CATALOG) {
    await prisma.musicTrack.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        vibe: t.vibe,
        title: t.title,
        storageKey: `music-library/${t.filename}`,
        genre: t.genre,
        mood: t.mood,
        bpm: t.bpm,
        energy: t.energy,
        buildUpSec: t.buildUpSec,
        dropSec: t.dropSec,
        manualDropSec: t.dropSec,
        outroSec: t.outroSec,
        durationSec: t.durationSec,
        isActive: true,
      },
      update: {
        vibe: t.vibe,
        title: t.title,
        storageKey: `music-library/${t.filename}`,
        genre: t.genre,
        mood: t.mood,
        bpm: t.bpm,
        energy: t.energy,
        buildUpSec: t.buildUpSec,
        dropSec: t.dropSec,
        outroSec: t.outroSec,
        durationSec: t.durationSec,
        isActive: true,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
