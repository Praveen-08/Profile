# Listing Launch

*One property form. Every listing campaign asset.*

A focused web app for real estate agents: enter a property's details once, get a complete
**Listing Launch Pack** — descriptions, social captions, reel scripts, vendor/buyer emails, a
7-day posting plan, and a built-in **SafeCheck** compliance review — organised into tabs on the
output page.

Built lean on purpose: Next.js + Tailwind + Supabase + the Claude API, deployable on free/low-cost
tiers, with a **placeholder mode** so you can build and demo the whole product without spending
anything on AI calls.

## Stack

- **Next.js 14** (App Router, TypeScript) — UI + API routes
- **Tailwind CSS** — styling
- **Supabase** — auth (email/password) + Postgres database, free tier is enough for MVP testing
- **Claude API** (`@anthropic-ai/sdk`) — generation, only called in `live` mode
- **Vercel** — deployment, free tier is enough for MVP testing

No file storage, no queue, no Stripe integration yet — deliberately, per the MVP scope.

## 1. Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates
   `user_profiles`, `brand_voice_settings`, `campaigns`, `campaign_outputs`, and locks every table down
   with row-level security so users can only ever see their own data.
3. In **Authentication > Providers**, email/password is enabled by default. For faster local testing,
   you can turn off "Confirm email" under **Authentication > Settings** so sign-up logs you straight in
   (turn it back on before giving real agents access).
4. Copy your **Project URL** and **anon public key** from **Project Settings > API**.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AI_MODE=placeholder        # or "live" once you're ready to spend on real generations
ANTHROPIC_API_KEY=...      # only required when AI_MODE=live
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

**Placeholder mode is the default.** It generates real, property-specific copy from templates —
using the actual address, suburb, features, tone, etc. you entered — with zero API cost. This is
enough to fully test the product flow and demo it to agents. Flip `AI_MODE=live` and add an
Anthropic API key when you're ready for real AI-generated copy. Haiku is the default model because
it's the lowest-cost option that's still strong at this kind of structured marketing copy; swap in
a Sonnet model via `ANTHROPIC_MODEL` once you're charging for it and want higher-end phrasing.

## 3. Run locally

```bash
cd listing-launch-os
npm install
npm run dev
```

Visit `http://localhost:3000`. Sign up, then create a campaign from the dashboard — with
`AI_MODE=placeholder` this costs nothing and works fully offline from Anthropic (Supabase still
needs network access).

## 4. Deploy

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the `listing-launch-os` directory as a project in [Vercel](https://vercel.com) (set the
   **Root Directory** to `listing-launch-os` when creating the project).
3. Add the same environment variables from `.env.local` in the Vercel project settings.
4. Deploy. Vercel's free tier is sufficient for internal use and early agent demos.

## How generation works

- `lib/prompts/system.ts` — the shared compliance system prompt (NZ English, no invented facts,
  no unsupported superlatives, no guaranteed investment claims, "approximately" for measurements,
  never uses the agent's "words to avoid").
- `lib/prompts/sections.ts` — one instruction per output section, combined with the property
  context to form the full prompt sent to Claude.
- `lib/ai/placeholder.ts` — the free template-based generator (`AI_MODE=placeholder`). Uses the
  same NZ-specific fields (sale method, ownership, open home date/time, agent contact, words to
  avoid) as live mode.
- `lib/ai/anthropic.ts` — the real Claude API call (`AI_MODE=live`).
- `lib/ai/generate.ts` — picks between the two based on `AI_MODE`, so nothing else in the app needs
  to know which mode is active.
- `app/api/generate/route.ts` — the only server route that talks to Claude. It authenticates the
  user, loads their campaign (filtered by `id` **and** `user_id` — RLS is the backstop, not the
  only check), generates either the full pack or a single requested section (used by the
  "Regenerate" button), and upserts results into `campaign_outputs`.

To edit what gets generated, change the per-section instruction strings in
`lib/prompts/sections.ts` — no other code needs to change.

## SafeCheck

`lib/safecheck.ts` is a free, rule-based scanner (no extra API calls) that reviews every generated
section for wording that's risky under NZ real estate advertising standards: guaranteed
returns/yield, "best investment", unverified building claims ("waterproof", "leak-free", "no
issues"), guaranteed school zones, "fully renovated"/"subdivision potential"/"development
potential"/"high yield" claims not backed by the form data, unsupported superlatives, factual
mismatches (e.g. a bedroom count in the copy that doesn't match the form), and place names that
don't appear in the amenities you entered. Each flag has a risk level, a plain-English reason, and
safer replacement wording. It's surfaced as its own tab on the output page and always shows the
disclaimer: *"Review all copy before publishing. The agent remains responsible for accuracy. This
is a marketing review assistant, not legal advice."*

## Security notes

- Every table (`campaigns`, `campaign_outputs`, `user_profiles`, `brand_voice_settings`) has RLS
  locking rows to `auth.uid()`.
- On top of RLS, every query in application code that fetches, updates, or upserts campaign or
  output data explicitly filters by the authenticated user's id (`.eq("user_id", user.id)`) —
  see `app/api/generate/route.ts`, `app/dashboard/page.tsx`, `app/campaigns/[id]/page.tsx`, and
  `components/campaign/OutputSection.tsx`. `campaign_outputs` carries its own denormalized
  `user_id` column (copied from the parent campaign at insert time) specifically so this can be a
  direct column filter instead of relying on a join.
- `SettingsForm` re-fetches the authenticated user id at submit time rather than trusting a prop,
  so a tampered client can't upsert settings under a different user id.

## Product structure

- `/` — landing page
- `/login` — combined login/signup
- `/dashboard` — saved campaigns
- `/campaigns/new` — guided property form → generates the full pack
- `/campaigns/[id]` — the output pack, organised into tabs: Portal Copy, Social Posts, Reels &
  Video, Open Home, Email & Follow-up, Vendor Updates, Campaign Timeline, and SafeCheck. Copy,
  edit + save, and regenerate per section; print/export the whole pack.
- `/settings` — agent profile + brand voice defaults, reused on every new campaign

## Testing with real estate agents

1. **Placeholder-mode demo first.** Walk 2-3 agents through creating a campaign with a real listing
   they've worked on. You'll immediately see which sections feel generic vs. useful — that's your
   signal for which prompt instructions in `lib/prompts/sections.ts` need sharpening before you
   spend on live generations.
2. **Switch one real listing to `AI_MODE=live`** and compare the same property's placeholder vs.
   live output side by side with the agent. Ask specifically: would you copy-paste this as-is, or
   what would you change? Feed that back into the prompts.
3. **Watch what they edit, not just what they say.** The Edit box on the output page is the most
   honest feedback signal — sections agents rewrite heavily need prompt work; sections they copy
   as-is are working.
4. **Price anchor test.** Show the pricing section and ask directly: at $29/$79/$149 a month, would
   you pay for this today? Don't build Stripe until you've heard "yes" from a few of them.
5. Keep a running list of missing fields or property types agents hit (e.g. cross-lease, unit
   title, lifestyle blocks) — that's your v2 backlog, not v1 scope.

## Deliberately not in v1

- Stripe / billing (pricing section says "coming soon")
- PDF export (browser print-to-PDF covers it)
- Team accounts / multi-user agencies
- File/photo storage
- Saved multiple brand voices per user (one default voice per user for now)
- Direct publishing integrations (Trade Me, realestate.co.nz, OneRoof, Facebook/Instagram) — the app
  produces copy for you to paste into those platforms, it doesn't post to them
