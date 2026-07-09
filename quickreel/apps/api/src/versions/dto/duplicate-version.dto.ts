import { IsOptional, IsString } from "class-validator";

export class DuplicateVersionDto {
  @IsOptional()
  @IsString()
  name?: string;
}
