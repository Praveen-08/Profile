import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { CompleteImageDto } from "./dto/complete-image.dto.js";
import { CreateProjectDto } from "./dto/create-project.dto.js";
import { PresignImageDto } from "./dto/presign-image.dto.js";
import { UpdateCameraMoveDto } from "./dto/update-camera-move.dto.js";
import { UpdateProjectDto } from "./dto/update-project.dto.js";
import { ProjectsService } from "./projects.service.js";

interface RequestUser {
  id: string;
  email?: string;
}

@Controller("projects")
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, user.email, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.projects.findAllForUser(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.projects.findOneForUser(user.id, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.projects.remove(user.id, id);
  }

  @Post(":id/images/presign")
  presignImage(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: PresignImageDto) {
    return this.projects.presignImage(user.id, id, dto);
  }

  @Post(":id/images/complete")
  completeImage(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CompleteImageDto) {
    return this.projects.completeImage(user.id, id, dto);
  }

  @Delete(":id/images/:imageId")
  removeImage(@CurrentUser() user: RequestUser, @Param("id") id: string, @Param("imageId") imageId: string) {
    return this.projects.removeImage(user.id, id, imageId);
  }

  @Post(":id/analyze")
  analyze(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.projects.analyze(user.id, id);
  }

  @Patch(":id/images/:imageId/camera-move")
  setCameraMoveOverride(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @Body() dto: UpdateCameraMoveDto,
  ) {
    return this.projects.setCameraMoveOverride(user.id, id, imageId, dto);
  }
}
