import { Injectable } from "@nestjs/common";
import { MusicVibeSchema } from "@quickreel/shared";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listStyles() {
    return this.prisma.client.style.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  listMusicTracks(vibe?: string) {
    const parsedVibe = vibe ? MusicVibeSchema.safeParse(vibe) : undefined;
    return this.prisma.client.musicTrack.findMany({
      where: {
        isActive: true,
        ...(parsedVibe?.success ? { vibe: parsedVibe.data } : {}),
      },
      orderBy: { title: "asc" },
    });
  }
}
