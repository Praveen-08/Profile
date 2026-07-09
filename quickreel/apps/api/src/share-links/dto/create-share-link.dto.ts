import { IsUUID } from "class-validator";

export class CreateShareLinkDto {
  @IsUUID()
  renderId!: string;
}
