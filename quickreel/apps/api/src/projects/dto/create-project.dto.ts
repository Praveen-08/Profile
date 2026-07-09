import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateProjectDto {
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
}
