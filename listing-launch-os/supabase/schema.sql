-- Listing Launch OS — Supabase schema
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

  status text not null default 'draft', -- draft | generated | archived

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_user_id_idx on public.campaigns(user_id);

-- ---------------------------------------------------------------------------
-- campaign_outputs: one row per generated section, keyed by section_key
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_outputs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  section_key text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, section_key)
);

create index if not exists campaign_outputs_campaign_id_idx on public.campaign_outputs(campaign_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is locked to its owning user
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.brand_voice_settings enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_outputs enable row level security;

drop policy if exists "user_profiles_owner" on public.user_profiles;
create policy "user_profiles_owner" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "brand_voice_owner" on public.brand_voice_settings;
create policy "brand_voice_owner" on public.brand_voice_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaigns_owner" on public.campaigns;
create policy "campaigns_owner" on public.campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaign_outputs_owner" on public.campaign_outputs;
create policy "campaign_outputs_owner" on public.campaign_outputs
  for all using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_outputs.campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_outputs.campaign_id and c.user_id = auth.uid()
    )
  );

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
