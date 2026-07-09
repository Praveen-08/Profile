import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { CommentsService } from "./comments.service.js";
import { CreateCommentDto } from "./dto/create-comment.dto.js";

interface RequestUser {
  id: string;
  email?: string;
}

@Controller("projects/:projectId/comments")
@UseGuards(SupabaseAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string) {
    return this.comments.list(user.id, projectId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Param("projectId") projectId: string, @Body() dto: CreateCommentDto) {
    return this.comments.createAsUser(user.id, user.email, projectId, dto);
  }

  @Delete(":commentId")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @Param("commentId") commentId: string,
  ) {
    return this.comments.remove(user.id, projectId, commentId);
  }
}
