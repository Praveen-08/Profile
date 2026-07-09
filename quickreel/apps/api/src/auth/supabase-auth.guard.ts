import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { verifySupabaseJwt } from "./supabase-jwt.js";

export interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string };
}

/**
 * The sole authorization boundary in this system: apps/web never talks to
 * Postgres directly, so RLS is not the enforcement layer here (see
 * packages/database's schema comment) — every controller that touches
 * user data applies this guard and filters by `req.user.id` explicitly.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length);
    try {
      const user = await verifySupabaseJwt(token);
      (request as AuthenticatedRequest).user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : "Invalid token");
    }
  }
}
