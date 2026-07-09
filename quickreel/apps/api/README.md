# @quickreel/api

NestJS REST API. Auth boundary: `SupabaseAuthGuard` verifies the bearer
token via the Supabase project's JWKS endpoint (RS256) — see
`src/auth/supabase-jwt.ts`. Legacy Supabase projects still on HS256
shared-secret signing are not supported by this guard as written; swap in
a `passport-jwt` HS256 strategy if you're on one.

apps/web never queries Postgres directly, so **RLS is not the enforcement
boundary** for this schema — every service method in `projects.service.ts`
filters explicitly by `req.user.id`. See `packages/database/schema.prisma`'s
header comment for the full rationale.

`STORAGE_DRIVER=local`'s upload endpoint
(`PUT /local-storage/upload/:path*`) is a passthrough, not a real presigned
URL — it has no per-request signature, so it's gated behind the same
`SupabaseAuthGuard` as everything else rather than left open like a real
presigned PUT would be. Swapping to `STORAGE_DRIVER=r2` gets you real,
unauthenticated presigned URLs.
