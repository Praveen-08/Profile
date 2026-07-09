import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import type { CreateCommentDto } from "./dto/create-comment.dto.js";

/**
 * Comments live on a Project, optionally pinned to a specific Render for
 * client-review context. `authorUserId` is set for QuickReel users and left
 * null for guests posting through a ShareLink — see share-links.service.ts's
 * `postGuestComment`, which calls `create` here with a null authorUserId
 * after validating the share token instead of a Supabase session.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.projects.getOwnedProject(userId, projectId);
    return this.prisma.client.comment.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }

  async create(
    projectId: string,
    dto: CreateCommentDto,
    author: { authorUserId: string | null; authorName: string },
  ) {
    if (dto.renderId) {
      const render = await this.prisma.client.render.findFirst({ where: { id: dto.renderId, projectId } });
      if (!render) throw new NotFoundException("Render not found on this project");
    }

    return this.prisma.client.comment.create({
      data: {
        projectId,
        renderId: dto.renderId,
        authorUserId: author.authorUserId,
        authorName: author.authorName,
        body: dto.body,
      },
    });
  }

  async createAsUser(userId: string, userEmail: string | undefined, projectId: string, dto: CreateCommentDto) {
    await this.projects.getOwnedProject(userId, projectId);
    return this.create(projectId, dto, { authorUserId: userId, authorName: userEmail ?? "You" });
  }

  async remove(userId: string, projectId: string, commentId: string): Promise<void> {
    await this.projects.getOwnedProject(userId, projectId);
    const comment = await this.prisma.client.comment.findFirst({ where: { id: commentId, projectId } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorUserId && comment.authorUserId !== userId) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    await this.prisma.client.comment.delete({ where: { id: commentId } });
  }
}
