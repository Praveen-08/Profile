import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { REEL_LENGTH_OPTIONS } from "@quickreel/shared";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  bedCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  bathCount?: number;

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
}
