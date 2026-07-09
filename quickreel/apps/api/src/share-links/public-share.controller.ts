import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ShareLinksService } from "./share-links.service.js";
import { ApproveShareLinkDto, PostShareCommentDto } from "./dto/public-share.dto.js";

/** No SupabaseAuthGuard — the share token itself is the credential. Mounted at /share, separate from the owner-side /projects/:id/share-links routes. */
@Controller("share")
export class PublicShareController {
  constructor(private readonly shareLinks: ShareLinksService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.shareLinks.getByToken(token);
  }

  @Post(":token/approve")
  approve(@Param("token") token: string, @Body() dto: ApproveShareLinkDto) {
    return this.shareLinks.approve(token, dto);
  }

  @Post(":token/comments")
  postComment(@Param("token") token: string, @Body() dto: PostShareCommentDto) {
    return this.shareLinks.postComment(token, dto);
  }
}
