import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";
import type { CreateBrandKitDto } from "./dto/create-brand-kit.dto.js";
import type { UpdateBrandKitDto } from "./dto/update-brand-kit.dto.js";
import type { BrandAssetKind, CompleteBrandAssetDto, PresignBrandAssetDto } from "./dto/asset.dto.js";

const ASSET_FIELD: Record<BrandAssetKind, "logoStorageKey" | "outroStorageKey" | "watermarkStorageKey"> = {
  logo: "logoStorageKey",
  outro: "outroStorageKey",
  watermark: "watermarkStorageKey",
};

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

/**
 * Each user's saved identity — logo, colors, fonts, outro, watermark,
 * contact details — applied automatically to any ProjectVersion that
 * references it. Exactly one kit per user is `isDefault`; creating or
 * promoting a kit to default un-defaults the rest, so "applied
 * automatically" (per product spec) always has an unambiguous answer.
 */
@Injectable()
export class BrandKitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async getOwned(userId: string, brandKitId: string) {
    const kit = await this.prisma.client.brandKit.findUnique({ where: { id: brandKitId } });
    if (!kit) throw new NotFoundException("Brand kit not found");
    if (kit.userId !== userId) throw new ForbiddenException("You do not have access to this brand kit");
    return kit;
  }

  private withAssetUrls<T extends { logoStorageKey: string | null; outroStorageKey: string | null; watermarkStorageKey: string | null }>(
    kit: T,
  ) {
    return {
      ...kit,
      logoUrl: kit.logoStorageKey ? this.storage.adapter.getObjectUrl(kit.logoStorageKey) : null,
      outroUrl: kit.outroStorageKey ? this.storage.adapter.getObjectUrl(kit.outroStorageKey) : null,
      watermarkUrl: kit.watermarkStorageKey ? this.storage.adapter.getObjectUrl(kit.watermarkStorageKey) : null,
    };
  }

  async list(userId: string) {
    const kits = await this.prisma.client.brandKit.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return kits.map((k) => this.withAssetUrls(k));
  }

  async findOne(userId: string, brandKitId: string) {
    const kit = await this.getOwned(userId, brandKitId);
    return this.withAssetUrls(kit);
  }

  async getDefault(userId: string) {
    const kit = await this.prisma.client.brandKit.findFirst({ where: { userId, isDefault: true } });
    return kit ? this.withAssetUrls(kit) : null;
  }

  async create(userId: string, email: string | undefined, dto: CreateBrandKitDto) {
    await this.prisma.ensureProfile(userId, email);
    const existingCount = await this.prisma.client.brandKit.count({ where: { userId } });
    const isDefault = dto.isDefault ?? existingCount === 0;

    if (isDefault) {
      await this.prisma.client.brandKit.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    const kit = await this.prisma.client.brandKit.create({
      data: {
        userId,
        name: dto.name?.trim() || "Default",
        isDefault,
        agencyName: dto.agencyName,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        fontFamily: dto.fontFamily,
        watermarkPosition: (dto.watermarkPosition as never) ?? undefined,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        contactWebsite: dto.contactWebsite,
      },
    });
    return this.withAssetUrls(kit);
  }

  async update(userId: string, brandKitId: string, dto: UpdateBrandKitDto) {
    await this.getOwned(userId, brandKitId);

    if (dto.isDefault) {
      await this.prisma.client.brandKit.updateMany({
        where: { userId, isDefault: true, id: { not: brandKitId } },
        data: { isDefault: false },
      });
    }

    const kit = await this.prisma.client.brandKit.update({
      where: { id: brandKitId },
      data: { ...dto, watermarkPosition: (dto.watermarkPosition as never) ?? undefined },
    });
    return this.withAssetUrls(kit);
  }

  async remove(userId: string, brandKitId: string): Promise<void> {
    const kit = await this.getOwned(userId, brandKitId);
    for (const key of [kit.logoStorageKey, kit.outroStorageKey, kit.watermarkStorageKey]) {
      if (key) await this.storage.adapter.deleteObject(key).catch(() => undefined);
    }
    await this.prisma.client.brandKit.delete({ where: { id: brandKitId } });
  }

  async presignAsset(userId: string, brandKitId: string, dto: PresignBrandAssetDto) {
    await this.getOwned(userId, brandKitId);
    const storageKey = `brand-kits/${brandKitId}/${dto.kind}/${randomUUID()}-${sanitizeFilename(dto.filename)}`;
    const upload = await this.storage.adapter.getPresignedUploadUrl(storageKey, dto.contentType);
    return { storageKey, upload };
  }

  async completeAsset(userId: string, brandKitId: string, dto: CompleteBrandAssetDto) {
    await this.getOwned(userId, brandKitId);
    const kit = await this.prisma.client.brandKit.update({
      where: { id: brandKitId },
      data: { [ASSET_FIELD[dto.kind]]: dto.storageKey },
    });
    return this.withAssetUrls(kit);
  }
}
