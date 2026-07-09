import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateCommentDto {
  @IsOptional()
  @IsUUID()
  renderId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
