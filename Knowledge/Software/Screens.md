# Screens

## Listing Launch (`listing-launch-os/app/`)
- `/` — landing page (`page.tsx`, marketing components in `components/landing/`)
- `/login` — auth
- `/dashboard` — signed-in home
- `/campaigns`, `/campaigns/new`, `/campaigns/[id]` — Launch the Listing module
- `/vendor-updates`, `/vendor-updates/new`, `/vendor-updates/[id]` — Manage the Campaign module
- `/settings` — brand voice settings
- API: `/api/generate` (campaign generation), `/api/vendor-updates` (vendor update generation)
- No "Win the Listing" screens yet — that module is unbuilt.

## QuickReel (`quickreel/apps/web/`)
Per `quickreel/README.md`: auth, dashboard, upload, AI Preview, download — Next.js 14 App
Router. Supported by `apps/api` (NestJS REST + Supabase JWT auth guard, job enqueue), `apps/worker`
(BullMQ processors driving the AI Director Engine → EDL → Remotion render), `apps/ai-service`
(Python/FastAPI, librosa beat detection).

## hdr-photo-editor (`hdr-photo-editor/frontend`, `hdr-photo-editor/backend`)
Next.js frontend + FastAPI backend, MVP-stage internal tool — screen inventory not yet documented
here, add detail as the tool matures past MVP.

## PK OS (roadmap Phase 3 — not built yet)
Proposed single daily dashboard: Today's Shoots, Today's Weather, Sunset Time, Invoices Due,
Bookings, Editing Queue, Client Messages, Revenue, Instagram, Tasks, AI Suggestions. No code for
this exists yet in the repo — it's the natural Stage-1 "Foundation" build once Listing Launch's
existing auth/Supabase pattern is reused as the base.
