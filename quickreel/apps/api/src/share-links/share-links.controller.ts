import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { ShareLinksService } from "./share-links.service.js";
import { CreateShareLinkDto } from "./dto/create-share-link.dto.js";

interface RequestUser {
  id: string;
  email?: string;
}

/** Owner-side management — creating/listing/revoking share links requires a QuickReel session. */
@Controller("projects/:projectId/share-links")
@UseGuards(SupabaseAuthGuard)
export class ShareLinksController {
  constructor(private readonly shareLinks: ShareLinksService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Body() dto: CreateShareLinkDto) {
    return this.shareLinks.create(user.id, projectId, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string) {
    return this.shareLinks.list(user.id, projectId);
  }

  @Delete(":shareLinkId")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("shareLinkId") shareLinkId: string,
  ) {
    return this.shareLinks.remove(user.id, projectId, shareLinkId);
  }
}
