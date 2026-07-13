# User Journey

## PK Visuals client (agent/vendor) — as built today
`book.html` enquiry form → email/manual confirmation → shoot happens → manual edit/delivery →
`thank-you.html` after form submit. No automation between these steps yet (roadmap Phase 4 "Book
Shoot" and "Deliver Project" buttons are the target state — see `Business/Sales.md`).

## Listing Launch agent — as built today
Sign up (`/login`, Supabase email/password, email confirmation can be disabled for local testing)
→ land on `/dashboard` → set brand voice in `/settings` → create a campaign at
`/campaigns/new` (property details entered once) → generated Listing Launch Pack appears tabbed
on `/campaigns/[id]` (descriptions, captions, reel scripts, emails, 7-day plan, SafeCheck review)
→ regenerate individual sections as needed → later, log open-home activity via
`/vendor-updates/new` → generated Vendor Update report on `/vendor-updates/[id]`.

Gaps vs the full vision: no "Win the Listing" module yet, no billing/subscription step (sign-up
is free/unmetered today), no team/multi-user support within one agency account.

## QuickReel — as built today
Per `quickreel/README.md`: upload photos → pick length/style/music vibe → AI Director Engine
builds a beat-synced EDL → Remotion renders → preview in web app → download. Auth via Supabase
JWT through the NestJS API.
