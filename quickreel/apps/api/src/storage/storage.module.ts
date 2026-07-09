import { Global, Module } from "@nestjs/common";
import { LocalStorageController } from "./local-storage.controller.js";
import { StorageService } from "./storage.service.js";

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
