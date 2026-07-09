import { IsIn, IsOptional, IsString, IsUUID, ValidateIf } from "class-validator";
import { REEL_LENGTH_OPTIONS } from "@quickreel/shared";

export class UpdateVersionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(REEL_LENGTH_OPTIONS)
  reelLengthSec?: number;

  @IsOptional()
  @ValidateIf((o) => o.styleId !== null)
  @IsUUID()
  styleId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.musicTrackId !== null)
  @IsUUID()
  musicTrackId?: string | null;

  @IsOptional()
  @IsString()
  hookArchetype?: string;

  @IsOptional()
  @ValidateIf((o) => o.brandKitId !== null)
  @IsUUID()
  brandKitId?: string | null;
}
