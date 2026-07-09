import { IsIn } from "class-validator";
import { SMART_REGENERATE_DIRECTIVES } from "@quickreel/shared";

export class SmartRegenerateDto {
  @IsIn(SMART_REGENERATE_DIRECTIVES)
  directive!: string;
}
