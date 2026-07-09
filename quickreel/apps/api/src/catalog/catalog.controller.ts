import { Controller, Get, Query } from "@nestjs/common";
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
}
