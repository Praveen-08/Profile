# Database

## Listing Launch (`listing-launch-os/supabase/schema.sql`)
Supabase Postgres, every table locked to its owner via row-level security (`user_id` filter).
Tables:
- `user_profiles`
- `brand_voice_settings`
- `campaigns`
- `campaign_outputs`
- `vendor_updates`

Schema is idempotent (`create table if not exists`) — safe to re-run against an existing DB.

## QuickReel (`quickreel/packages/database/prisma`)
Separate Prisma schema + client, plus its own `supabase/` config — QuickReel is a distinct
database from Listing Launch's, not shared. If/when these products merge into one Listing Launch
platform with a QuickReel module (roadmap Phase 6/7), this is the first structural decision to
resolve: one shared Supabase project with a shared `user_id`/auth model, or federated auth across
two databases.

## hdr-photo-editor
No database layer found — backend (`hdr-photo-editor/backend/`) is FastAPI with local
`storage/`, no persistent DB. Fine for an internal single-user tool; would need one before any
multi-tenant SaaS use.
