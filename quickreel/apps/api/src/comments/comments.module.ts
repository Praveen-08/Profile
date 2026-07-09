import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module.js";
import { CommentsController } from "./comments.controller.js";
import { CommentsService } from "./comments.service.js";

@Module({
  imports: [ProjectsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
