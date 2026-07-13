# Roadmap

2–3 year master plan (from the strategy conversation this knowledge base was built from):

```
PK Visuals → Automate Everything → Build Internal Software → Perfect Workflow →
Launch Listing Launch SaaS → AI Video Platform → AI Marketing Platform → International Expansion
```

## Where the repo actually is against this plan (as of 2026-07-13)

| Roadmap stage | Status | Evidence |
|---|---|---|
| PK Visuals (the real business) | **Live** | Root site + `pkvisuals/` |
| Automate Everything (Phase 4 buttons) | **Not started** | No booking/delivery automation found |
| Build Internal Software | **In progress** | `hdr-photo-editor/` (MVP), `listing-launch-os/` |
| Perfect Workflow / PK OS (Phase 3) | **Not started** | No dashboard code found |
| Launch Listing Launch SaaS | **In progress, pre-billing** | `listing-launch-os/` MVP built, Stripe/multi-user deferred |
| AI Video Platform (Phase 7) | **In progress, substantial** | `quickreel/` — full monorepo, AI Director Engine, multiple render packages already built |
| AI Marketing Platform | **Not started as software** | Concept only, no dedicated tool yet |
| International Expansion | **Not started** | Site is Auckland/NZ-specific throughout |

Notably, `quickreel/` (Phase 7) is already further along than `Software/Roadmap.md`'s stage
ordering would suggest — the AI Video Platform work is running ahead of finishing Listing Launch's
core SaaS mechanics (billing, multi-user). Worth a deliberate call on sequencing: either finish
Listing Launch's commercialization basics before investing further in QuickReel depth, or treat
QuickReel as a Listing Launch module from day one so the two don't need re-merging later
(`Software/Database.md` flags this as the first structural fork to resolve).

## Recommended time split (from the strategy conversation)
80% of software development time on Listing Launch (the scalable asset), 20% on PK Visuals
marketing (today's cash flow) — so features built for PK Visuals graduate into Listing Launch
once proven, instead of the two competing for attention.

See `Future Features.md` for the unbuilt Stage 2/3/Phase 5 items, and `Knowledge/Brand/` +
`Knowledge/Real Estate/` for the domain knowledge every AI tool in this ecosystem should share.
