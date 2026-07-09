import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { VersionsModule } from "./versions/versions.module.js";
import { BrandKitsModule } from "./brand-kits/brand-kits.module.js";
import { CommentsModule } from "./comments/comments.module.js";
import { ShareLinksModule } from "./share-links/share-links.module.js";
import { ExportsModule } from "./exports/exports.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    QueueModule,
    CatalogModule,
    ProjectsModule,
    VersionsModule,
    BrandKitsModule,
    CommentsModule,
    ShareLinksModule,
    ExportsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
