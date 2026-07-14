# Future Features

Pulled from the master roadmap's Stage 2/3 and Phase 5 concepts — none of these are built yet:

## Stage 2 — Differentiate
- AI Script Generator (expand existing ChatGPT-based scripting into a proper tool)
- AI Video Generator (QuickReel already covers a large chunk of this — see `quickreel/`)
- AI Marketing Generator (daily hooks/reels/captions/blog/email brief, see `Business/Marketing.md`)
- AI Photo Assistant (composition/quality guidance — `vision` package in QuickReel is adjacent
  prior art, see `Real Estate/Composition.md`)

## Stage 3 — Commercialize
- Listing Launch SaaS billing (Stripe — explicitly deferred per `listing-launch-os/README.md`)
- Multi-user / team support per agency account
- White-label branding for agencies/brokerages
- "Win the Listing" module (listed in Listing Launch's 3-module structure, unbuilt)

## Phase 5 — Specialized GPT ecosystem (not code, but worth tracking as a deliverable)
CEO GPT, PK Visuals Marketing GPT, Real Estate Script GPT, Sales GPT, SEO GPT, Editing GPT,
Product Manager GPT, QA GPT — each sharing the same brand/pricing/tone knowledge base
(`Knowledge/Brand/`), each with a distinct role. None of these have been formally set up as
custom GPTs yet as of this file's writing; that's an external ChatGPT-side task, not a code task.

## Phase 3 — PK OS
Internal daily-ops dashboard, not started. See `Software/Screens.md` for the proposed widget
list and the recommendation to build it on Listing Launch's existing Supabase/auth pattern.
