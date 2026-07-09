import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { DashboardService } from "./dashboard.service.js";

interface RequestUser {
  id: string;
  email?: string;
}

@Controller("dashboard")
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.dashboard.get(user.id);
  }
}
