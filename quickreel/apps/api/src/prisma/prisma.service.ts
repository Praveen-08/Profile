import { Injectable } from "@nestjs/common";
import { prisma, type PrismaClient } from "@quickreel/database";

@Injectable()
export class PrismaService {
  readonly client: PrismaClient = prisma;

  /**
   * Defensive upsert for the `profiles` row. In production (a real
   * Supabase-hosted Postgres) the `handle_new_user` trigger
   * (packages/database/supabase/handle_new_user.sql) already creates this
   * row on signup; in local dev without Supabase configured, or on the
   * very first authenticated request racing the trigger, this makes sure
   * a project can still be created against a valid foreign key.
   */
  async ensureProfile(id: string, email: string | undefined): Promise<void> {
    await this.client.profile.upsert({
      where: { id },
      create: { id, email: email ?? "" },
      update: email ? { email } : {},
    });
  }
}
