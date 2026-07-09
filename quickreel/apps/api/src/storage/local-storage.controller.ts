import { Controller, Get, NotFoundException, Put, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { StorageService } from "./storage.service.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

function guessMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

function readRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Dev-only passthrough that makes local-disk storage behave like a
 * presigned-URL upload/download endpoint (see LocalDiskAdapter's doc
 * comment). Unlike a real presigned URL, this endpoint has no per-request
 * signature — PUT is therefore gated behind the same SupabaseAuthGuard as
 * every other authenticated route, which is a deliberate trade-off: it
 * sacrifices interface-uniformity with R2 (whose presigned PUT needs no
 * auth header) for actual access control in local dev. GET is public,
 * matching a public storage bucket.
 *
 * Routes use a bare `*` wildcard (captured positionally at `req.params[0]`),
 * not NestJS/Express "named repeating param" syntax like `:path*` — this
 * app's Express 4 bundles path-to-regexp@0.1.x, which only matches a
 * *single* segment for `:name*`. A bare `*` is the version that actually
 * captures multi-segment paths like `music-library/track.wav` here.
 */
@Controller("local-storage")
export class LocalStorageController {
  constructor(private readonly storage: StorageService) {}

  @Put("upload/*")
  @UseGuards(SupabaseAuthGuard)
  async upload(@Req() req: Request): Promise<{ key: string }> {
    const key = req.params[0]!;
    const body = await readRawBody(req);
    await this.storage.adapter.putObject(key, body, req.headers["content-type"] ?? "application/octet-stream");
    return { key };
  }

  @Get("*")
  async download(@Req() req: Request, @Res() res: Response): Promise<void> {
    const key = req.params[0]!;
    try {
      const buffer = await this.storage.adapter.getObjectBuffer(key);
      res.setHeader("Content-Type", guessMimeType(key));
      res.send(buffer);
    } catch {
      throw new NotFoundException(`No object at "${key}"`);
    }
  }
}
