import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module.js";
import { CommentsModule } from "../comments/comments.module.js";
import { ShareLinksController } from "./share-links.controller.js";
import { PublicShareController } from "./public-share.controller.js";
import { ShareLinksService } from "./share-links.service.js";

@Module({
  imports: [ProjectsModule, CommentsModule],
  controllers: [ShareLinksController, PublicShareController],
  providers: [ShareLinksService],
})
export class ShareLinksModule {}
