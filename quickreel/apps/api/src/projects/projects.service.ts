import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createSeededRng, type CameraMoveType } from "@quickreel/shared";
import { buildCameraMove, createUsageCounts, selectCameraMove } from "@quickreel/camera-engine";
import { getStyleBySlug } from "@quickreel/style-engine";
import type { CameraMoveType as PrismaCameraMoveType } from "@quickreel/database";
import { QUEUE_NAMES } from "@quickreel/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { QueueService } from "../queue/queue.service.js";
import type { CreateProjectDto } from "./dto/create-project.dto.js";
import type { UpdateProjectDto } from "./dto/update-project.dto.js";
import type { PresignImageDto } from "./dto/presign-image.dto.js";
import type { CompleteImageDto } from "./dto/complete-image.dto.js";
import type { UpdateCameraMoveDto } from "./dto/update-camera-move.dto.js";

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

  async getOwnedProject(userId: string, projectId: string) {
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
        versions: {
          orderBy: { createdAt: "desc" },
          include: {
            style: true,
            musicTrack: true,
            brandKit: true,
            renders: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!project) throw new NotFoundException("Project not found");

    return {
      ...project,
      images: project.images.map((img) => ({ ...img, url: this.storage.adapter.getObjectUrl(img.storageKey) })),
      versions: project.versions.map((v) => ({
        ...v,
        latestRender: v.renders[0]
          ? {
              ...v.renders[0],
              outputUrl: v.renders[0].outputStorageKey ? this.storage.adapter.getObjectUrl(v.renders[0].outputStorageKey) : null,
            }
          : null,
        renders: undefined,
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
        fileSizeBytes: dto.fileSizeBytes,
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

  /**
   * Timeline-editing preview: what movement would each clip get *right now*,
   * before any render exists, for a given version's style. Uses the exact
   * same seeded selection (packages/camera-engine) apps/worker's
   * resolve-edl.ts uses at render time, seeded off projectId rather than
   * renderId specifically so this preview and the eventual render agree —
   * see resolve-edl.ts's comment on that seed choice. cameraMoveOverride is
   * project-wide (stored on ProjectImage), so it applies the same way
   * across every version of the project.
   */
  async getCameraMovesPreview(userId: string, projectId: string, styleSlug: string) {
    await this.getOwnedProject(userId, projectId);
    const images = await this.prisma.client.projectImage.findMany({
      where: { projectId, isDuplicate: false },
      orderBy: { orderIndex: "asc" },
    });

    const styleConfig = getStyleBySlug(styleSlug);
    if (!styleConfig) throw new BadRequestException(`No style-engine config for slug "${styleSlug}"`);

    const rng = createSeededRng(`${projectId}:camera`);
    const usageCounts = createUsageCounts();

    return images
      .filter((img) => img.roomType !== null)
      .map((img) => {
        const override = img.cameraMoveOverride as CameraMoveType | null;
        const camera = override
          ? (() => {
              usageCounts[override] = (usageCounts[override] ?? 0) + 1;
              return buildCameraMove(override, styleConfig);
            })()
          : selectCameraMove({ roomType: img.roomType!, style: styleConfig, rng, usageCounts });

        return {
          imageId: img.id,
          roomType: img.roomType,
          movementType: camera.type,
          isOverride: override !== null,
        };
      });
  }

  /** Sets (or clears, via null/undefined) the timeline-editing "replace movement" override for one image. */
  async setCameraMoveOverride(userId: string, projectId: string, imageId: string, dto: UpdateCameraMoveDto) {
    await this.getOwnedProject(userId, projectId);
    const image = await this.prisma.client.projectImage.findFirst({ where: { id: imageId, projectId } });
    if (!image) throw new NotFoundException("Image not found");

    return this.prisma.client.projectImage.update({
      where: { id: imageId },
      data: { cameraMoveOverride: (dto.cameraMoveOverride ?? null) as PrismaCameraMoveType | null },
    });
  }
}
