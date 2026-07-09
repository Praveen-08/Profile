# QuickReel AI

Automatic cinematic real estate reel generation from professionally edited
photographs. Upload photos, pick a length/style/music vibe, and the **AI
Director Engine** builds a beat-synced 1080x1920 video: it never alters a
pixel of the source photos — only camera motion, transitions, and typography
are synthesized.

## Monorepo layout

```
apps/
  web/          Next.js 14 App Router — auth, dashboard, upload, AI Preview, download
  api/          NestJS — REST API, Supabase JWT auth guard, enqueues jobs
  worker/       BullMQ processors — orchestrates the AI Director Engine into an EDL, drives Remotion
  ai-service/   Python/FastAPI — librosa beat detection (the one genuinely Python-only surface)
packages/
  shared/           Zod contracts: EDL, BeatGrid, StyleConfig, enums, queue payloads
  database/         Prisma schema + client
  storage/          StorageAdapter: local disk (dev) / Cloudflare R2 (prod)
  vision/           Room classification + photo quality scoring (OpenAI Vision + heuristic fallback)
  story-engine/     Dedup, hero detection, cinematic story ordering
  camera-engine/    ~18 camera movement catalog + per-room selection
  transition-engine/ Room-relationship-aware transition selection
  hook-engine/      Opening-sequence (first 2 seconds) generation and ranking
  timing-engine/    Reel-length -> clip-count -> beat-duration allocation
  music-engine/     10-vibe music catalog + track selection
  beat-engine/      Beat-grid math: snapping/quantizing clips to beats and bars
  video-engine/     Remotion composition consuming the EDL
  queue/            Shared BullMQ queue/job-payload types
  config/           Shared eslint/tsconfig
infra/
  docker-compose.yml   Local Postgres + Redis
```

## The AI Director Engine

This is the core, deliberately over-invested feature: a set of small,
isolated, pure-logic packages (`story-engine`, `camera-engine`,
`transition-engine`, `hook-engine`, `timing-engine`, `music-engine`,
`beat-engine`) that each make one class of editorial decision and compose
into a single `EditDecisionList` (see `packages/shared/src/edl.ts`). Every
engine is rule-based today but designed so a trained model can replace any
one engine's internals without changing its interface or anything downstream.

## Local development

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm music:synthesize   # generates placeholder (non-copyrighted) click-track audio
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:4000 · AI service: http://localhost:8000

See `.env.example` for the full list of adapters and what happens when
optional credentials (Supabase, OpenAI, R2) are absent.
