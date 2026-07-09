import { IsString, MaxLength, MinLength } from "class-validator";

export class ApproveShareLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  approvedByName!: string;
}

export class PostShareCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  authorName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
