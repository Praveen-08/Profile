import { IsString, Matches } from "class-validator";

export class PresignImageDto {
  @IsString()
  filename!: string;

  @IsString()
  @Matches(/^image\/(jpeg|jpg|png|webp)$/, { message: "contentType must be an image/jpeg, image/png, or image/webp" })
  contentType!: string;
}
