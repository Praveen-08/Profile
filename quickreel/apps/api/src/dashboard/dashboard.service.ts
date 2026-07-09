import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";

const RECENT_RENDER_LIMIT = 8;
const FAVOURITE_STYLE_LIMIT = 5;

/**
 * A single aggregation endpoint for the Home Dashboard: recent reels,
 * in-flight renders, storage usage, favourite styles, and top-line
 * analytics, in one round trip rather than the web app fanning out to
 * five separate list endpoints on every dashboard load.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get(userId: string) {
    const projects = await this.prisma.client.project.findMany({ where: { userId }, select: { id: true } });
    const projectIds = projects.map((p) => p.id);

    const [recentRenders, activeRenders, versions, imageSizeAgg, renderSizeAgg, brandKit] = await Promise.all([
      this.prisma.client.render.findMany({
        where: { projectId: { in: projectIds }, status: "COMPLETE" },
        orderBy: { completedAt: "desc" },
        take: RECENT_RENDER_LIMIT,
        include: { project: { select: { id: true, title: true, address: true } }, version: { include: { style: true } } },
      }),
      this.prisma.client.render.findMany({
        where: { projectId: { in: projectIds }, status: { in: ["QUEUED", "RESOLVING_EDL", "RENDERING", "MUXING", "UPLOADING"] } },
        orderBy: { createdAt: "desc" },
        include: { project: { select: { id: true, title: true, address: true } } },
      }),
      this.prisma.client.projectVersion.findMany({
        where: { projectId: { in: projectIds }, styleId: { not: null } },
        select: { styleId: true, style: { select: { name: true, slug: true } } },
      }),
      this.prisma.client.projectImage.aggregate({
        where: { projectId: { in: projectIds } },
        _sum: { fileSizeBytes: true },
      }),
      this.prisma.client.render.aggregate({
        where: { projectId: { in: projectIds } },
        _sum: { outputFileSizeBytes: true },
      }),
      this.prisma.client.brandKit.findFirst({ where: { userId, isDefault: true } }),
    ]);

    const styleCounts = new Map<string, { name: string; slug: string; count: number }>();
    for (const v of versions) {
      if (!v.styleId || !v.style) continue;
      const entry = styleCounts.get(v.styleId) ?? { name: v.style.name, slug: v.style.slug, count: 0 };
      entry.count += 1;
      styleCounts.set(v.styleId, entry);
    }
    const favouriteStyles = [...styleCounts.values()].sort((a, b) => b.count - a.count).slice(0, FAVOURITE_STYLE_LIMIT);

    const totalRenders = await this.prisma.client.render.count({ where: { projectId: { in: projectIds } } });
    const completedRenders = await this.prisma.client.render.count({
      where: { projectId: { in: projectIds }, status: "COMPLETE" },
    });

    return {
      recentReels: recentRenders.map((r) => ({
        renderId: r.id,
        projectId: r.project.id,
        title: r.project.title || r.project.address || "Untitled Listing",
        styleName: r.version.style?.name ?? null,
        outputUrl: r.outputStorageKey ? this.storage.adapter.getObjectUrl(r.outputStorageKey) : null,
        outputDurationSec: r.outputDurationSec,
        overallScore: (r.scoreJson as { overallScore?: number } | null)?.overallScore ?? null,
        completedAt: r.completedAt,
      })),
      renderingStatus: activeRenders.map((r) => ({
        renderId: r.id,
        projectId: r.project.id,
        title: r.project.title || r.project.address || "Untitled Listing",
        status: r.status,
      })),
      storage: {
        imagesBytes: imageSizeAgg._sum.fileSizeBytes ?? 0,
        rendersBytes: renderSizeAgg._sum.outputFileSizeBytes ?? 0,
      },
      favouriteStyles,
      analytics: {
        totalProjects: projectIds.length,
        totalRenders,
        completedRenders,
      },
      brandKit,
    };
  }
}
