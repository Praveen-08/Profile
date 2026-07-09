-- Run this ONCE against your real Supabase project's SQL editor (or via
-- `supabase db execute`) — NOT via `pnpm db:migrate`.
--
-- Why this lives outside Prisma's migration history: it creates a trigger
-- on `auth.users`, a schema Supabase owns and Prisma never touches. Our
-- local dev Postgres (infra/docker-compose.yml) has no `auth` schema at
-- all — Supabase auth only exists once you point DATABASE_URL at an actual
-- Supabase project's Postgres connection string. Until then, `profiles`
-- rows simply won't be created and apps/api's SupabaseAuthGuard has
-- nothing to verify against — that's expected in local-only dev.
--
-- Idempotent: safe to re-run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, "createdAt", "updatedAt")
  values (new.id, new.email, now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
