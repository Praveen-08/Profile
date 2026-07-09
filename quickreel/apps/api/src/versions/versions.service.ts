import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  QUEUE_NAMES,
  SMART_REGENERATE_DIRECTIVE_LABELS,
  type ReelLengthSec,
  type SmartRegenerateDirective,
} from "@quickreel/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { QueueService } from "../queue/queue.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import type { CreateVersionDto } from "./dto/create-version.dto.js";
import type { UpdateVersionDto } from "./dto/update-version.dto.js";
import type { DuplicateVersionDto } from "./dto/duplicate-version.dto.js";
import type { SmartRegenerateDto } from "./dto/smart-regenerate.dto.js";
import { adjustReelLength, DIRECTIVE_STYLE_SLUG } from "./smart-regenerate-deltas.js";

const VERSION_INCLUDE = { style: true, musicTrack: true, brandKit: true } as const;

/**
 * The Version Engine: one Project's photos, unlimited render configurations.
 * Every render targets a ProjectVersion (style/music/hook/reel length/brand
 * kit) rather than the Project directly — "Luxury", "Instagram", "Fast",
 * "Twilight" cuts of the same listing are four ProjectVersion rows, never a
 * second upload.
 */
@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly projects: ProjectsService,
  ) {}

  private async getOwnedVersion(userId: string, projectId: string, versionId: string) {
    await this.projects.getOwnedProject(userId, projectId);
    const version = await this.prisma.client.projectVersion.findFirst({
      where: { id: versionId, projectId },
      include: VERSION_INCLUDE,
    });
    if (!version) throw new NotFoundException("Version not found");
    return version;
  }

  async create(userId: string, projectId: string, dto: CreateVersionDto) {
    await this.projects.getOwnedProject(userId, projectId);
    const existingCount = await this.prisma.client.projectVersion.count({ where: { projectId } });

    return this.prisma.client.projectVersion.create({
      data: {
        projectId,
        name: dto.name?.trim() || `Version ${existingCount + 1}`,
        reelLengthSec: dto.reelLengthSec,
        styleId: dto.styleId,
        musicTrackId: dto.musicTrackId,
        hookArchetype: dto.hookArchetype,
        brandKitId: dto.brandKitId,
      },
      include: VERSION_INCLUDE,
    });
  }

  async list(userId: string, projectId: string) {
    await this.projects.getOwnedProject(userId, projectId);
    const versions = await this.prisma.client.projectVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { ...VERSION_INCLUDE, renders: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    return versions.map((v) => ({
      ...v,
      latestRender: v.renders[0] ? this.withOutputUrl(v.renders[0]) : null,
      renders: undefined,
    }));
  }

  async findOne(userId: string, projectId: string, versionId: string) {
    return this.getOwnedVersion(userId, projectId, versionId);
  }

  async update(userId: string, projectId: string, versionId: string, dto: UpdateVersionDto) {
    await this.getOwnedVersion(userId, projectId, versionId);
    return this.prisma.client.projectVersion.update({
      where: { id: versionId },
      data: dto,
      include: VERSION_INCLUDE,
    });
  }

  async remove(userId: string, projectId: string, versionId: string): Promise<void> {
    await this.getOwnedVersion(userId, projectId, versionId);
    await this.prisma.client.projectVersion.delete({ where: { id: versionId } });
  }

  /** "Create Another Version" — clones config (style/music/hook/length/brand kit), never re-touches the shared photo set. */
  async duplicate(userId: string, projectId: string, versionId: string, dto: DuplicateVersionDto) {
    const source = await this.getOwnedVersion(userId, projectId, versionId);
    return this.prisma.client.projectVersion.create({
      data: {
        projectId,
        name: dto.name?.trim() || `${source.name} copy`,
        reelLengthSec: source.reelLengthSec,
        styleId: source.styleId,
        musicTrackId: source.musicTrackId,
        hookArchetype: source.hookArchetype,
        brandKitId: source.brandKitId,
        parentVersionId: source.id,
      },
      include: VERSION_INCLUDE,
    });
  }

  /**
   * "Make Faster" / "More Cinematic" / "Luxury" / "Minimal" / "More
   * Emotional" / "Higher Energy" — clones the source version with a
   * directive-driven style + reel-length delta (see
   * smart-regenerate-deltas.ts), then immediately kicks off a render for
   * the new version so the user doesn't have to separately hit Generate.
   */
  async smartRegenerate(userId: string, projectId: string, versionId: string, dto: SmartRegenerateDto) {
    const source = await this.getOwnedVersion(userId, projectId, versionId);
    const directive = dto.directive as SmartRegenerateDirective;

    const targetSlug = DIRECTIVE_STYLE_SLUG[directive];
    const targetStyle = await this.prisma.client.style.findUnique({ where: { slug: targetSlug } });
    if (!targetStyle) throw new BadRequestException(`No style catalog entry for slug "${targetSlug}"`);

    const reelLengthSec = adjustReelLength(directive, source.reelLengthSec as ReelLengthSec | null);

    const newVersion = await this.prisma.client.projectVersion.create({
      data: {
        projectId,
        name: `${source.name} — ${SMART_REGENERATE_DIRECTIVE_LABELS[directive]}`,
        reelLengthSec,
        styleId: targetStyle.id,
        musicTrackId: source.musicTrackId,
        hookArchetype: source.hookArchetype,
        brandKitId: source.brandKitId,
        parentVersionId: source.id,
        regenerateDirective: directive,
      },
      include: VERSION_INCLUDE,
    });

    if (!newVersion.musicTrackId) {
      return { version: newVersion, render: null };
    }

    const { render } = await this.createRender(userId, projectId, newVersion.id);
    return { version: newVersion, render };
  }

  async getCameraMovesPreview(userId: string, projectId: string, versionId: string) {
    const version = await this.getOwnedVersion(userId, projectId, versionId);
    if (!version.style) throw new BadRequestException("Select a style before previewing camera movements");
    return this.projects.getCameraMovesPreview(userId, projectId, version.style.slug);
  }

  async createRender(userId: string, projectId: string, versionId: string) {
    const version = await this.getOwnedVersion(userId, projectId, versionId);
    if (!version.reelLengthSec || !version.styleId || !version.musicTrackId) {
      throw new BadRequestException("Select a reel length, style, and music track before generating");
    }

    const project = await this.projects.getOwnedProject(userId, projectId);
    if (project.status !== "READY" && project.status !== "COMPLETE" && project.status !== "FAILED") {
      throw new BadRequestException(`Project is not ready to render (status: ${project.status})`);
    }

    const render = await this.prisma.client.render.create({ data: { projectId, versionId, status: "QUEUED" } });
    const jobId = await this.queue.enqueueRender({ projectId, renderId: render.id });
    await this.prisma.client.render.update({ where: { id: render.id }, data: { bullJobId: jobId } });
    await this.prisma.client.project.update({ where: { id: projectId }, data: { status: "QUEUED" } });

    return { render, queue: QUEUE_NAMES.RENDER, jobId };
  }

  async listRenders(userId: string, projectId: string, versionId: string) {
    await this.getOwnedVersion(userId, projectId, versionId);
    const renders = await this.prisma.client.render.findMany({ where: { versionId }, orderBy: { createdAt: "desc" } });
    return renders.map((r) => this.withOutputUrl(r));
  }

  async latestRender(userId: string, projectId: string, versionId: string) {
    await this.getOwnedVersion(userId, projectId, versionId);
    const render = await this.prisma.client.render.findFirst({ where: { versionId }, orderBy: { createdAt: "desc" } });
    if (!render) throw new NotFoundException("No renders yet for this version");
    return this.withOutputUrl(render);
  }

  private withOutputUrl<T extends { outputStorageKey: string | null }>(render: T) {
    return {
      ...render,
      outputUrl: render.outputStorageKey ? this.storage.adapter.getObjectUrl(render.outputStorageKey) : null,
    };
  }
}
