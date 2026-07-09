import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { CommentsService } from "../comments/comments.service.js";
import type { CreateShareLinkDto } from "./dto/create-share-link.dto.js";
import type { ApproveShareLinkDto, PostShareCommentDto } from "./dto/public-share.dto.js";

function generateToken(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Client Sharing: a public, unauthenticated preview/approval page for one
 * Render. The token is the only credential — no QuickReel account is
 * required to view, approve, or comment. Owner-side management (create/
 * list/revoke) stays behind SupabaseAuthGuard in ShareLinksController; the
 * public methods here (getByToken/approve/postComment) are called from
 * PublicShareController, which has no guard at all.
 */
@Injectable()
export class ShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly projects: ProjectsService,
    private readonly comments: CommentsService,
  ) {}

  async create(userId: string, projectId: string, dto: CreateShareLinkDto) {
    await this.projects.getOwnedProject(userId, projectId);
    const render = await this.prisma.client.render.findFirst({ where: { id: dto.renderId, projectId } });
    if (!render) throw new NotFoundException("Render not found on this project");
    if (render.status !== "COMPLETE") throw new BadRequestException("Only a completed render can be shared");

    return this.prisma.client.shareLink.create({
      data: { projectId, renderId: dto.renderId, token: generateToken() },
    });
  }

  async list(userId: string, projectId: string) {
    await this.projects.getOwnedProject(userId, projectId);
    return this.prisma.client.shareLink.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  }

  async remove(userId: string, projectId: string, shareLinkId: string): Promise<void> {
    await this.projects.getOwnedProject(userId, projectId);
    const link = await this.prisma.client.shareLink.findFirst({ where: { id: shareLinkId, projectId } });
    if (!link) throw new NotFoundException("Share link not found");
    await this.prisma.client.shareLink.delete({ where: { id: shareLinkId } });
  }

  private async getActiveByToken(token: string) {
    const link = await this.prisma.client.shareLink.findUnique({
      where: { token },
      include: { project: true, render: true },
    });
    if (!link) throw new NotFoundException("This share link doesn't exist or has been revoked");
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new NotFoundException("This share link has expired");
    }
    return link;
  }

  async getByToken(token: string) {
    const link = await this.getActiveByToken(token);
    const comments = await this.prisma.client.comment.findMany({
      where: { renderId: link.renderId },
      orderBy: { createdAt: "asc" },
    });

    return {
      token: link.token,
      approvedAt: link.approvedAt,
      approvedByName: link.approvedByName,
      project: { title: link.project.title, address: link.project.address },
      render: {
        id: link.render.id,
        status: link.render.status,
        outputUrl: link.render.outputStorageKey ? this.storage.adapter.getObjectUrl(link.render.outputStorageKey) : null,
        outputDurationSec: link.render.outputDurationSec,
      },
      comments,
    };
  }

  async approve(token: string, dto: ApproveShareLinkDto) {
    const link = await this.getActiveByToken(token);
    return this.prisma.client.shareLink.update({
      where: { id: link.id },
      data: { approvedAt: new Date(), approvedByName: dto.approvedByName },
    });
  }

  async postComment(token: string, dto: PostShareCommentDto) {
    const link = await this.getActiveByToken(token);
    return this.comments.create(
      link.projectId,
      { renderId: link.renderId, body: dto.body },
      { authorUserId: null, authorName: dto.authorName },
    );
  }
}
