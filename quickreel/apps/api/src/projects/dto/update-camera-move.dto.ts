import { IsIn, IsOptional } from "class-validator";
import { CAMERA_MOVE_TYPES } from "@quickreel/shared";

export class UpdateCameraMoveDto {
  /** Omit or null to clear the override and let the AI decide again. */
  @IsOptional()
  @IsIn(CAMERA_MOVE_TYPES)
  cameraMoveOverride?: string | null;
}
