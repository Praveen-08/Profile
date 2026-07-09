import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [PrismaModule, StorageModule, QueueModule, CatalogModule, ProjectsModule],
  controllers: [HealthController],
})
export class AppModule {}
