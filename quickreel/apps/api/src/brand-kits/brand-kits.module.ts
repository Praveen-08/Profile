import { Module } from "@nestjs/common";
import { BrandKitsController } from "./brand-kits.controller.js";
import { BrandKitsService } from "./brand-kits.service.js";

@Module({
  controllers: [BrandKitsController],
  providers: [BrandKitsService],
  exports: [BrandKitsService],
})
export class BrandKitsModule {}
