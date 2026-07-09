import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { ExportsService } from "./exports.service.js";
import { CreateExportDto } from "./dto/create-export.dto.js";

interface RequestUser {
  id: string;
  email?: string;
}

@Controller("projects/:projectId/renders/:renderId/exports")
@UseGuards(SupabaseAuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("renderId") renderId: string,
    @Body() dto: CreateExportDto,
  ) {
    return this.exports.create(user.id, projectId, renderId, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Param("renderId") renderId: string) {
    return this.exports.list(user.id, projectId, renderId);
  }
}
