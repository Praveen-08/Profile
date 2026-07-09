import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module.js";
import { VersionsController } from "./versions.controller.js";
import { VersionsService } from "./versions.service.js";

@Module({
  imports: [ProjectsModule],
  controllers: [VersionsController],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}
