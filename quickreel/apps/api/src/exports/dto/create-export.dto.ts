import { IsIn } from "class-validator";
import { EXPORT_PLATFORMS, EXPORT_RESOLUTIONS } from "@quickreel/shared";

export class CreateExportDto {
  @IsIn(EXPORT_PLATFORMS)
  platform!: string;

  @IsIn(EXPORT_RESOLUTIONS)
  resolution!: string;
}
