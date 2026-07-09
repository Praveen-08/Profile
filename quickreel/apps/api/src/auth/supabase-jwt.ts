import jwt from "jsonwebtoken";
import jwksClient, { type JwksClient } from "jwks-rsa";

export interface SupabaseJwtPayload {
  id: string;
  email?: string;
}

let cachedClient: JwksClient | null = null;

function getJwksClient(): JwksClient {
  if (cachedClient) return cachedClient;

  const jwksUri = process.env.SUPABASE_JWKS_URL || deriveJwksUrl(process.env.SUPABASE_URL);
  if (!jwksUri) {
    throw new Error(
      "Cannot verify Supabase JWT: neither SUPABASE_JWKS_URL nor SUPABASE_URL is configured.",
    );
  }
  cachedClient = jwksClient({ jwksUri, cache: true, cacheMaxAge: 60 * 60 * 1000 });
  return cachedClient;
}

function deriveJwksUrl(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined;
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
}

/**
 * Verifies a Supabase-issued access token via its project's JWKS endpoint
 * (RS256, asymmetric — the default for new Supabase projects). Survives
 * Supabase's own key rotation with zero redeploys, since the public key is
 * fetched (and cached) at verification time rather than baked into config.
 * Projects still on legacy HS256 shared-secret signing would need a
 * different verification strategy — not implemented here, see
 * apps/api/README.md.
 */
export function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  return new Promise((resolve, reject) => {
    const client = getJwksClient();

    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      if (!header.kid) {
        callback(new Error("JWT header missing 'kid'"));
        return;
      }
      client.getSigningKey(header.kid, (err, key) => {
        if (err || !key) {
          callback(err ?? new Error("Unable to resolve signing key"));
          return;
        }
        callback(null, key.getPublicKey());
      });
    };

    jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
      if (err || !decoded || typeof decoded === "string") {
        reject(err ?? new Error("Invalid token payload"));
        return;
      }
      const payload = decoded as jwt.JwtPayload;
      if (!payload.sub) {
        reject(new Error("Token missing 'sub'"));
        return;
      }
      resolve({ id: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined });
    });
  });
}
