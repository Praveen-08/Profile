import { Controller, Get, Query } from "@nestjs/common";
import { CAMERA_MOVEMENT_CATALOG } from "@quickreel/camera-engine";
import { CatalogService } from "./catalog.service.js";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("styles")
  listStyles() {
    return this.catalog.listStyles();
  }

  @Get("music-tracks")
  listMusicTracks(@Query("vibe") vibe?: string) {
    return this.catalog.listMusicTracks(vibe);
  }

  /** For the timeline-editing "replace movement" picker — every movement's type/label/description. */
  @Get("camera-movements")
  listCameraMovements() {
    return Object.values(CAMERA_MOVEMENT_CATALOG).map((def) => ({
      type: def.type,
      label: def.label,
      description: def.description,
      preferredRoomTypes: def.preferredRoomTypes,
    }));
  }
}
