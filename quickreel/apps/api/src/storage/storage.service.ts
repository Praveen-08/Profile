import { Injectable } from "@nestjs/common";
import { createStorageAdapterFromEnv, type StorageAdapter } from "@quickreel/storage";

@Injectable()
export class StorageService {
  readonly adapter: StorageAdapter = createStorageAdapterFromEnv();
}
