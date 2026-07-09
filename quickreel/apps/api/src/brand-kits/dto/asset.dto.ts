import { IsIn, IsString } from "class-validator";

export const BRAND_ASSET_KINDS = ["logo", "outro", "watermark"] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];

export class PresignBrandAssetDto {
  @IsIn(BRAND_ASSET_KINDS)
  kind!: BrandAssetKind;

  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;
}

export class CompleteBrandAssetDto {
  @IsIn(BRAND_ASSET_KINDS)
  kind!: BrandAssetKind;

  @IsString()
  storageKey!: string;
}
