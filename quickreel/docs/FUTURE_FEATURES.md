# Future Features — Architecture Only

This document is the deliberate extension-point map for ten features the
product spec calls out as **future work**: AI Voiceover, Auto Captions,
Listing Description Generator, Property Website Generator, Brochure
Generator, Floor Plan Integration, CRM Integration, Social Media Scheduler,
Property Analytics, and Vendor Reports.

None of these are implemented. Each section below names the exact seam in
the current architecture where the feature would attach, and the shape its
data would take, so a future build can slot in without restructuring what
exists today. This mirrors the pattern already used for genuinely deferred
work in this repo (e.g. Stripe billing, explicitly out of scope for the
first milestone).

## AI Voiceover

**Seam:** `EditDecisionListSchema.audio` (`packages/shared/src/edl.ts`)
already models one audio layer (the music track) with a `volumeCurve`. A
voiceover would be a second, independent audio layer — add
`voiceover: { trackStorageKey, script, volumeCurve } | null` alongside
`audio`, and a `packages/video-engine/src/components` layer analogous to
`AtmosphericEffectLayer` that adds a second `<Audio>` element in
`Composition.tsx`, ducking the music track's `volumeCurve` under it.
Script generation itself would be a new `packages/voiceover-engine`
package (TTS provider call + timing alignment to clip boundaries), called
from `apps/worker`'s render-video processor the same way `beat-engine` is
called today — before `resolveEDL()`, since the voiceover's duration
constrains clip timing just as the beat grid does.

## Auto Captions

**Seam:** `TextOverlaySchema` (`packages/shared/src/edl.ts`) already
models timed on-screen text with position/animation/style tokens. Captions
are the same shape at a different cadence — word-level or phrase-level
`TextOverlay` entries with `kind` extended to include `"CAPTION"`, driven
by either the voiceover script's word timings (if AI Voiceover ships
first) or a speech-to-text pass over the final audio mix. Rendering reuses
`packages/video-engine/src/components/TextOverlayLayer.tsx` as-is — no new
render component needed, only a new overlay-generation source feeding the
same `EDLClip.textOverlays` array that hook/CTA/logo text already fills
via `apps/worker/src/lib/text-overlays.ts`.

## Listing Description Generator

**Seam:** Independent of the render pipeline — a text-generation feature
that reads a `Project`'s existing fields (`title`, `address`, `bedCount`,
`bathCount`) plus the AI Director Engine's own room-classification output
(`ProjectImage.roomType`, `ProjectImage.analysisJson`) already computed
during analysis. Would be a new NestJS module
(`apps/api/src/listing-descriptions`) with an LLM call and a new
`ListingDescription` Prisma model (`projectId`, `body`, `tone`,
`createdAt`) — no changes needed to the AI Director Engine or render
pipeline, since it only *reads* analysis output that already exists.

## Property Website Generator

**Seam:** A packaging/export feature that reuses existing published
assets (`Render.outputStorageKey`, `ProjectImage.storageKey`, and — once
built — Listing Description text) rather than generating anything new.
Natural shape: a new `PropertyWebsite` model (`projectId`, `slug`,
`publishedAt`) plus a public Next.js route (`apps/web/app/site/[slug]`)
analogous to the public `/share/[token]` route added in this phase —
same "token/slug is the only credential" pattern as `ShareLink`, just
rendering a full page instead of a single video preview.

## Brochure Generator

**Seam:** A PDF-rendering feature over the same data Property Website
Generator would use (photos, listing description, agent brand kit). The
`BrandKit` model (`packages/database/prisma/schema.prisma`) already
carries everything a brochure layout needs — logo, colors, fonts, contact
details — so this is the one future feature with zero new brand-identity
modeling required. Likely implementation: a headless-Chromium HTML-to-PDF
render (same Chromium binary already available in this environment for
Remotion, see `packages/video-engine/README.md`) driven by a new
`apps/worker` processor, output stored via the existing `StorageAdapter`
interface (`packages/storage`).

## Floor Plan Integration

**Seam:** An additional `ProjectImage`-like asset type that isn't a
photograph — would need `ProjectImage.assetType` (`"PHOTO" | "FLOOR_PLAN"`)
so floor plans upload through the existing presign/complete flow
(`ProjectsService.presignImage`/`completeImage`) but are excluded from
`packages/vision`'s room-classification pass and `packages/story-engine`'s
dedup/ordering (both assume photographs). Camera-engine's motion vocabulary
doesn't apply to a floor plan — it would get a dedicated, much simpler
"pan across" treatment in `packages/video-engine`, selected by
`assetType` rather than `roomType`.

## CRM Integration

**Seam:** Outbound webhook/API-push feature triggered off events this
system already emits internally: analysis complete
(`AnalyzeProjectJobResult`), render complete (`RenderVideoJobResult`),
share-link approved (`ShareLink.approvedAt` transition in
`ShareLinksService.approve`). Natural shape: a new `packages/queue` queue
(`crm-sync-queue`) and `apps/worker` processor subscribing to the same
job-completion points the existing processors already report through,
plus a new `CrmConnection` model (`userId`, `provider`, `credentials`,
scoped per-user like `BrandKit`).

## Social Media Scheduler

**Seam:** A queuing/publishing feature over `RenderExport` — once an
export exists in a platform-ready format (`Render Export.platform`,
`.resolution`; see `packages/database/prisma/schema.prisma`), scheduling
is "call platform X's publish API at time T with this file." Shape: a new
`ScheduledPost` model (`renderExportId`, `platform`, `scheduledAt`,
`status`) and `apps/worker` processor, reusing `RenderExport.outputUrl`
resolution exactly as `ExportsService` does today — no changes to the
export pipeline itself.

## Property Analytics

**Seam:** Aggregation over data this system already collects but doesn't
yet surface per-property: `ShareLink` views/approvals, `Comment` counts,
`Render.scoreJson` (AI Reel Score) trends across a property's versions.
The `DashboardService` (`apps/api/src/dashboard`) already establishes the
"one aggregation endpoint" pattern this would extend — a
`GET /projects/:id/analytics` endpoint following the same shape, plus
(only if view-level tracking is wanted) a lightweight `ShareLinkView`
model recording token/timestamp on each public `/share/:token` GET in
`PublicShareController`.

## Vendor Reports

**Seam:** A scheduled/on-demand rollup across a user's projects — total
reels produced, average AI Reel Score, storage used, brand kit usage —
i.e. `DashboardService.get()`'s aggregation logic run over a date range
and rendered to PDF/CSV instead of JSON for a UI. No new data model
required; this is a reporting view over `Project`/`Render`/`ProjectVersion`
that already exist, exported via the same HTML-to-PDF path Brochure
Generator would establish.

## Common infrastructure these all share

- **Storage**: every feature above stores its output through the existing
  `StorageAdapter` interface (`packages/storage`) — local disk in dev, R2
  in production — never a new storage integration.
- **Queues**: any async generation work follows the existing
  `packages/queue` pattern (`createXQueue`/`createXWorker` pair), not a
  new job system.
- **Auth boundary**: anything scoped to a user reuses `SupabaseAuthGuard`
  and `req.user.id` filtering exactly as every module in `apps/api` does
  today; anything public reuses the token-is-the-credential pattern
  established by `ShareLink`.
- **Feature modules**: each would land as its own NestJS module
  (controller + service + DTOs), matching every module added in this
  phase (`versions`, `brand-kits`, `comments`, `share-links`, `exports`,
  `dashboard`) — never folded into an existing unrelated module.
