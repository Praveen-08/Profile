import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";
import { BrandKitsService } from "./brand-kits.service.js";
import { CreateBrandKitDto } from "./dto/create-brand-kit.dto.js";
import { UpdateBrandKitDto } from "./dto/update-brand-kit.dto.js";
import { CompleteBrandAssetDto, PresignBrandAssetDto } from "./dto/asset.dto.js";

interface RequestUser {
  id: string;
  email?: string;
}

@Controller("brand-kits")
@UseGuards(SupabaseAuthGuard)
export class BrandKitsController {
  constructor(private readonly brandKits: BrandKitsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBrandKitDto) {
    return this.brandKits.create(user.id, user.email, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.brandKits.list(user.id);
  }

  @Get("default")
  getDefault(@CurrentUser() user: RequestUser) {
    return this.brandKits.getDefault(user.id);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.brandKits.findOne(user.id, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateBrandKitDto) {
    return this.brandKits.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.brandKits.remove(user.id, id);
  }

  @Post(":id/assets/presign")
  presignAsset(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: PresignBrandAssetDto) {
    return this.brandKits.presignAsset(user.id, id, dto);
  }

  @Post(":id/assets/complete")
  completeAsset(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: CompleteBrandAssetDto) {
    return this.brandKits.completeAsset(user.id, id, dto);
  }
}
