import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { REEL_LENGTH_OPTIONS } from "@quickreel/shared";

export class CreateVersionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(REEL_LENGTH_OPTIONS)
  reelLengthSec?: number;

  @IsOptional()
  @IsUUID()
  styleId?: string;

  @IsOptional()
  @IsUUID()
  musicTrackId?: string;

  @IsOptional()
  @IsString()
  hookArchetype?: string;

  @IsOptional()
  @IsUUID()
  brandKitId?: string;
}
