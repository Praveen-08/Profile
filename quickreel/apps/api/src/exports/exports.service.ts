import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ExportPlatform, ExportResolution } from "@quickreel/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import { QueueService } from "../queue/queue.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import type { CreateExportDto } from "./dto/create-export.dto.js";

/**
 * Instagram Reel / TikTok / Facebook Reel / YouTube Shorts all consume the
 * same 1080x1920 master at 1080p — an HD_1080P "export" is just a labeled
 * pointer at the existing render output, resolved instantly with no queue
 * round-trip. UHD_4K is the one real re-render (apps/worker's
 * export-render.processor.ts, scale=2), so only that path touches the
 * export queue.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly projects: ProjectsService,
  ) {}

  private async getOwnedRender(userId: string, projectId: string, renderId: string) {
    await this.projects.getOwnedProject(userId, projectId);
    const render = await this.prisma.client.render.findFirst({ where: { id: renderId, projectId } });
    if (!render) throw new NotFoundException("Render not found on this project");
    return render;
  }

  private withUrl<T extends { outputStorageKey: string | null }>(exportRow: T) {
    return {
      ...exportRow,
      outputUrl: exportRow.outputStorageKey ? this.storage.adapter.getObjectUrl(exportRow.outputStorageKey) : null,
    };
  }

  async create(userId: string, projectId: string, renderId: string, dto: CreateExportDto) {
    const render = await this.getOwnedRender(userId, projectId, renderId);
    if (render.status !== "COMPLETE" || !render.outputStorageKey) {
      throw new BadRequestException("Render must be complete before exporting");
    }

    const platform = dto.platform as ExportPlatform;
    const resolution = dto.resolution as ExportResolution;

    if (resolution === "HD_1080P") {
      const exportRow = await this.prisma.client.renderExport.create({
        data: {
          renderId,
          platform,
          resolution,
          status: "COMPLETE",
          outputStorageKey: render.outputStorageKey,
          completedAt: new Date(),
        },
      });
      return this.withUrl(exportRow);
    }

    const exportRow = await this.prisma.client.renderExport.create({
      data: { renderId, platform, resolution, status: "QUEUED" },
    });
    await this.queue.enqueueExport({ exportId: exportRow.id });
    return this.withUrl(exportRow);
  }

  async list(userId: string, projectId: string, renderId: string) {
    await this.getOwnedRender(userId, projectId, renderId);
    const exportRows = await this.prisma.client.renderExport.findMany({
      where: { renderId },
      orderBy: { createdAt: "desc" },
    });
    return exportRows.map((e) => this.withUrl(e));
  }
}
