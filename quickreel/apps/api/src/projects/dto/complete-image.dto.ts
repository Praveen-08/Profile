import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CompleteImageDto {
  @IsString()
  storageKey!: string;

  @IsString()
  originalFilename!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  fileSizeBytes?: number;
}
