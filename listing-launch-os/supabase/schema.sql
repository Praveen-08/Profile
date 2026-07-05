-- Listing Launch — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses "if not exists" / "create or replace" where possible.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- user_profiles: one row per authenticated user (agent identity + defaults)
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agent_name text,
  agency_name text,
  phone text,
  default_cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- brand_voice_settings: saved tone + signature phrasing per user
-- ---------------------------------------------------------------------------
create table if not exists public.brand_voice_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  default_tone text not null default 'simple_professional',
  signature_phrases text,
  compliance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- campaigns: one row per property listing launch
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- property details
  address text not null,
  suburb text not null,
  property_type text not null,
  bedrooms integer,
  bathrooms integer,
  garages integer,
  land_size text,
  floor_area text,
  key_features text,
  renovations text,
  amenities text,

  -- campaign framing
  target_buyer text not null,
  tone text not null,
  cta text,
  notes text,

  -- attribution (defaults from user_profiles, editable per campaign)
  agent_name text,
  agency_name text,

  -- NZ-specific listing details
  sale_method text,
  ownership_type text,
  school_zone_notes text,
  lim_building_report_notes text,
  rental_yield_notes text,
  words_to_avoid text,
  open_home_date_time text,
  agent_phone text,
  agent_email text,

  status text not null default 'draft', -- draft | generated | archived

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_user_id_idx on public.campaigns(user_id);

-- Adds NZ-specific columns to a pre-existing campaigns table from an earlier
-- version of this schema. No-ops on a fresh install (columns already exist).
alter table public.campaigns add column if not exists sale_method text;
alter table public.campaigns add column if not exists ownership_type text;
alter table public.campaigns add column if not exists school_zone_notes text;
alter table public.campaigns add column if not exists lim_building_report_notes text;
alter table public.campaigns add column if not exists rental_yield_notes text;
alter table public.campaigns add column if not exists words_to_avoid text;
alter table public.campaigns add column if not exists open_home_date_time text;
alter table public.campaigns add column if not exists agent_phone text;
alter table public.campaigns add column if not exists agent_email text;

-- ---------------------------------------------------------------------------
-- campaign_outputs: one row per generated section, keyed by section_key
-- user_id is denormalized from campaigns.user_id so every query and RLS
-- check can filter directly on it without a join.
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_outputs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, section_key)
);

-- Backfills user_id on a pre-existing campaign_outputs table. No-op on a
-- fresh install (column already exists and is populated on insert).
alter table public.campaign_outputs add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.campaign_outputs co
  set user_id = c.user_id
  from public.campaigns c
  where co.campaign_id = c.id and co.user_id is null;
alter table public.campaign_outputs alter column user_id set not null;

create index if not exists campaign_outputs_campaign_id_idx on public.campaign_outputs(campaign_id);
create index if not exists campaign_outputs_user_id_idx on public.campaign_outputs(user_id);

-- ---------------------------------------------------------------------------
-- vendor_updates: "Manage the Campaign" module — one row per vendor update
-- report (post-open-home, weekly, price feedback, low enquiry, offer update).
-- form_data holds what the agent entered; generated_output holds the
-- generated sections (email, SMS, summaries, next steps), keyed by section.
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  update_type text not null,
  form_data jsonb not null default '{}'::jsonb,
  generated_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_updates_user_id_idx on public.vendor_updates(user_id);
create index if not exists vendor_updates_campaign_id_idx on public.vendor_updates(campaign_id);

-- ---------------------------------------------------------------------------
-- agent_meeting_playbooks: "Win the Listing" module — one row per
-- appraisal/vendor-pitch/listing-presentation meeting prep pack. campaign_id
-- is nullable because a playbook is often created before any campaign
-- exists (the agent hasn't won the listing yet).
-- ---------------------------------------------------------------------------
create table if not exists public.agent_meeting_playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  meeting_type text not null,
  property_address text not null,
  suburb text not null,
  form_data jsonb not null default '{}'::jsonb,
  generated_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_meeting_playbooks_user_id_idx on public.agent_meeting_playbooks(user_id);
create index if not exists agent_meeting_playbooks_campaign_id_idx on public.agent_meeting_playbooks(campaign_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is locked to its owning user.
-- Application code additionally filters every query by the authenticated
-- user's id explicitly (defense in depth) — RLS is the backstop, not the
-- only line of defense.
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.brand_voice_settings enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_outputs enable row level security;
alter table public.vendor_updates enable row level security;
alter table public.agent_meeting_playbooks enable row level security;

drop policy if exists "user_profiles_owner" on public.user_profiles;
create policy "user_profiles_owner" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "brand_voice_owner" on public.brand_voice_settings;
create policy "brand_voice_owner" on public.brand_voice_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaigns_owner" on public.campaigns;
create policy "campaigns_owner" on public.campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Simple, direct column check (no join) now that campaign_outputs carries
-- its own user_id.
drop policy if exists "campaign_outputs_owner" on public.campaign_outputs;
create policy "campaign_outputs_owner" on public.campaign_outputs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vendor_updates_owner" on public.vendor_updates;
create policy "vendor_updates_owner" on public.vendor_updates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "agent_meeting_playbooks_owner" on public.agent_meeting_playbooks;
create policy "agent_meeting_playbooks_owner" on public.agent_meeting_playbooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.user_profiles;
create trigger set_updated_at before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.brand_voice_settings;
create trigger set_updated_at before update on public.brand_voice_settings
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at before update on public.campaigns
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.campaign_outputs;
create trigger set_updated_at before update on public.campaign_outputs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.vendor_updates;
create trigger set_updated_at before update on public.vendor_updates
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.agent_meeting_playbooks;
create trigger set_updated_at before update on public.agent_meeting_playbooks
  for each row execute procedure public.set_updated_at();
