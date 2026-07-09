import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { CreateVersionDto } from "./dto/create-version.dto.js";
import { DuplicateVersionDto } from "./dto/duplicate-version.dto.js";
import { SmartRegenerateDto } from "./dto/smart-regenerate.dto.js";
import { UpdateVersionDto } from "./dto/update-version.dto.js";
import { VersionsService } from "./versions.service.js";

interface RequestUser {
  id: string;
  email?: string;
}

/** Nested under a project — see packages/database's ProjectVersion doc comment for the Version Engine's data-model rationale. */
@Controller("projects/:projectId/versions")
@UseGuards(SupabaseAuthGuard)
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Body() dto: CreateVersionDto) {
    return this.versions.create(user.id, projectId, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string) {
    return this.versions.list(user.id, projectId);
  }

  @Get(":versionId")
  findOne(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Param("versionId") versionId: string) {
    return this.versions.findOne(user.id, projectId, versionId);
  }

  @Patch(":versionId")
  update(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Body() dto: UpdateVersionDto,
  ) {
    return this.versions.update(user.id, projectId, versionId, dto);
  }

  @Delete(":versionId")
  remove(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Param("versionId") versionId: string) {
    return this.versions.remove(user.id, projectId, versionId);
  }

  @Post(":versionId/duplicate")
  duplicate(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Body() dto: DuplicateVersionDto,
  ) {
    return this.versions.duplicate(user.id, projectId, versionId, dto);
  }

  @Post(":versionId/smart-regenerate")
  smartRegenerate(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
    @Body() dto: SmartRegenerateDto,
  ) {
    return this.versions.smartRegenerate(user.id, projectId, versionId, dto);
  }

  @Get(":versionId/camera-moves-preview")
  getCameraMovesPreview(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.versions.getCameraMovesPreview(user.id, projectId, versionId);
  }

  @Post(":versionId/renders")
  createRender(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.versions.createRender(user.id, projectId, versionId);
  }

  @Get(":versionId/renders")
  listRenders(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.versions.listRenders(user.id, projectId, versionId);
  }

  @Get(":versionId/renders/latest")
  latestRender(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("versionId") versionId: string,
  ) {
    return this.versions.latestRender(user.id, projectId, versionId);
  }
}
