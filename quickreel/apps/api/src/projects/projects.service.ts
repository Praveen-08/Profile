import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { QUEUE_NAMES } from "@quickreel/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { QueueService } from "../queue/queue.service.js";
import type { CreateProjectDto } from "./dto/create-project.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import type { PresignImageDto } from "./dto/presign-image.dto.js";
import type { CompleteImageDto } from "./dto/complete-image.dto.js";

export const MIN_PROJECT_IMAGES = 5;
export const MAX_PROJECT_IMAGES = 30;

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  private async getOwnedProject(userId: string, projectId: string) {
    const project = await this.prisma.client.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.userId !== userId) throw new ForbiddenException("You do not have access to this project");
    return project;
  }

  async create(userId: string, email: string | undefined, dto: CreateProjectDto) {
    await this.prisma.ensureProfile(userId, email);
    return this.prisma.client.project.create({
      data: {
        userId,
        title: dto.title,
        address: dto.address,
        bedCount: dto.bedCount,
        bathCount: dto.bathCount,
        status: "DRAFT",
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.client.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneForUser(userId: string, projectId: string) {
    await this.getOwnedProject(userId, projectId);
    const project = await this.prisma.client.project.findUnique({
      where: { id: projectId },
      include: {
        images: { orderBy: [{ orderIndex: "asc" }, { uploadedAt: "asc" }] },
        style: true,
        musicTrack: true,
        renders: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    return {
      ...project,
      images: project.images.map((img) => ({ ...img, url: this.storage.adapter.getObjectUrl(img.storageKey) })),
      renders: project.renders.map((r) => ({
        ...r,
        outputUrl: r.outputStorageKey ? this.storage.adapter.getObjectUrl(r.outputStorageKey) : null,
      })),
    };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.getOwnedProject(userId, projectId);
    return this.prisma.client.project.update({ where: { id: projectId }, data: dto });
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await this.getOwnedProject(userId, projectId);
    const images = await this.prisma.client.projectImage.findMany({ where: { projectId } });
    await Promise.allSettled(images.map((img) => this.storage.adapter.deleteObject(img.storageKey)));
    await this.prisma.client.project.delete({ where: { id: projectId } });
  }

  async presignImage(userId: string, projectId: string, dto: PresignImageDto) {
    await this.getOwnedProject(userId, projectId);
    const existingCount = await this.prisma.client.projectImage.count({ where: { projectId } });
    if (existingCount >= MAX_PROJECT_IMAGES) {
      throw new BadRequestException(`Projects are limited to ${MAX_PROJECT_IMAGES} images`);
    }

    const storageKey = `projects/${projectId}/images/${randomUUID()}-${sanitizeFilename(dto.filename)}`;
    const upload = await this.storage.adapter.getPresignedUploadUrl(storageKey, dto.contentType);
    return { storageKey, upload };
  }

  async completeImage(userId: string, projectId: string, dto: CompleteImageDto) {
    const project = await this.getOwnedProject(userId, projectId);
    const existingCount = await this.prisma.client.projectImage.count({ where: { projectId } });
    if (existingCount >= MAX_PROJECT_IMAGES) {
      throw new BadRequestException(`Projects are limited to ${MAX_PROJECT_IMAGES} images`);
    }

    const image = await this.prisma.client.projectImage.create({
      data: {
        projectId,
        storageKey: dto.storageKey,
        originalFilename: dto.originalFilename,
        width: dto.width,
        height: dto.height,
        orderIndex: existingCount,
      },
    });

    if (project.status === "DRAFT") {
      await this.prisma.client.project.update({ where: { id: projectId }, data: { status: "UPLOADING" } });
    }

    return { ...image, url: this.storage.adapter.getObjectUrl(image.storageKey) };
  }

  async removeImage(userId: string, projectId: string, imageId: string): Promise<void> {
    await this.getOwnedProject(userId, projectId);
    const image = await this.prisma.client.projectImage.findFirst({ where: { id: imageId, projectId } });
    if (!image) throw new NotFoundException("Image not found");
    await this.storage.adapter.deleteObject(image.storageKey).catch(() => undefined);
    await this.prisma.client.projectImage.delete({ where: { id: imageId } });
  }

  async analyze(userId: string, projectId: string) {
    await this.getOwnedProject(userId, projectId);
    const imageCount = await this.prisma.client.projectImage.count({ where: { projectId } });
    if (imageCount < MIN_PROJECT_IMAGES) {
      throw new BadRequestException(`Upload at least ${MIN_PROJECT_IMAGES} images before analyzing`);
    }

    await this.prisma.client.project.update({ where: { id: projectId }, data: { status: "ANALYZING" } });
    const jobId = await this.queue.enqueueAnalysis({ projectId });
    return { queue: QUEUE_NAMES.ANALYSIS, jobId };
  }

  async createRender(userId: string, projectId: string) {
    const project = await this.getOwnedProject(userId, projectId);
    if (!project.reelLengthSec || !project.styleId || !project.musicTrackId) {
      throw new BadRequestException("Select a reel length, style, and music track before generating");
    }
    if (project.status !== "READY" && project.status !== "COMPLETE" && project.status !== "FAILED") {
      throw new BadRequestException(`Project is not ready to render (status: ${project.status})`);
    }

    const render = await this.prisma.client.render.create({ data: { projectId, status: "QUEUED" } });
    const jobId = await this.queue.enqueueRender({ projectId, renderId: render.id });
    await this.prisma.client.render.update({ where: { id: render.id }, data: { bullJobId: jobId } });
    await this.prisma.client.project.update({ where: { id: projectId }, data: { status: "QUEUED" } });

    return render;
  }

  async latestRender(userId: string, projectId: string) {
    await this.getOwnedProject(userId, projectId);
    const render = await this.prisma.client.render.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!render) throw new NotFoundException("No renders yet for this project");
    return {
      ...render,
      outputUrl: render.outputStorageKey ? this.storage.adapter.getObjectUrl(render.outputStorageKey) : null,
    };
  }

  async listRenders(userId: string, projectId: string) {
    await this.getOwnedProject(userId, projectId);
    return this.prisma.client.render.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  }
}
