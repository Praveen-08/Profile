# Pricing Strategy

Two distinct pricing surfaces to keep separate (don't conflate them in planning docs):

1. **PK Visuals shoot pricing** — service-based, quote-on-enquiry, published range
   $350–$1,300+ (`Brand/Pricing.md`). Real, cash-generating today.
2. **Listing Launch subscription pricing** — not yet built. `listing-launch-os/README.md`
   confirms "No file storage, no queue, no Stripe integration yet — deliberately, per the MVP
   scope." This is the Stage 3 commercialization step in the roadmap.

## Roadmap guidance on SaaS pricing (from the master plan)
For any new internal tool being evaluated for productisation, ask: "Would another photographer
pay $29/month? $49/month? $99/month?" If yes, don't keep it internal-only — design it to be
multi-tenant from the start rather than retrofitting later. `listing-launch-os`'s Supabase schema
already uses per-`user_id` row-level security, which is the right foundation for this.

## Open decisions
- Listing Launch tier structure (feature gating across Win/Launch/Manage modules — see
  `Software/Listing Launch.md`)
- Whether QuickReel ships as a Listing Launch module or a separate subscription
- Currency/market (NZD-only vs multi-currency for international expansion, roadmap Phase 8)
