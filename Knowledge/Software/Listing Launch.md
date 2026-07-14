# Listing Launch

Located at `listing-launch-os/`. "One property form. Every listing campaign asset." NZ real
estate agent SaaS with three modules:

1. **Win the Listing** — coming soon, not built yet.
2. **Launch the Listing** — built. Enter property details once → full Listing Launch Pack:
   descriptions, social captions, reel scripts, vendor/buyer emails, 7-day posting plan, plus a
   built-in **SafeCheck** compliance review, all tabbed on the output page.
3. **Manage the Campaign** — built. Converts open-home/campaign activity into a **Vendor Update**
   report (email, SMS, feedback summaries, next steps) from one form.

## Stack
Next.js 14 (App Router, TypeScript) + Tailwind + Supabase (auth + Postgres, RLS) + Claude API
(`@anthropic-ai/sdk`) + Vercel. Deliberately no file storage, queue, or Stripe yet (MVP scope).

## Two generation modes
- `AI_MODE=placeholder` (default) — free, template-based generation using real property fields,
  zero API cost, good enough to demo/test the whole flow.
- `AI_MODE=live` — real Claude generation (`ANTHROPIC_MODEL=claude-haiku-4-5-20251001` by
  default; swap to Sonnet once charging for it).

## Where the compliance/tone logic lives
- `lib/prompts/system.ts` — shared compliance system prompt (see `Brand/Tone.md` for the actual
  rules: NZ English, no invented facts, no superlatives, no investment guarantees,
  "approximately" for measurements, per-agent "words to avoid").
- `lib/prompts/sections.ts` — one instruction per output section; this is the file to edit to
  change what gets generated.
- `lib/ai/generate.ts` — mode switch between placeholder/live.
- `app/api/generate/route.ts` — the only server route touching Claude; auth-checks + filters by
  `user_id` (RLS is the backstop, not the only check).

## Data model
See `Database.md`. App routes/screens: see `Screens.md`.
