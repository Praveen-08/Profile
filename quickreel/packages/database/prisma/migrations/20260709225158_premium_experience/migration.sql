/*
  Warnings:

  - You are about to drop the column `hookArchetype` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `musicTrackId` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `reelLengthSec` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `styleId` on the `projects` table. All the data in the column will be lost.
  - Added the required column `versionId` to the `renders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WatermarkPosition" AS ENUM ('TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'CENTER');

-- CreateEnum
CREATE TYPE "SmartRegenerateDirective" AS ENUM ('MAKE_FASTER', 'MORE_CINEMATIC', 'LUXURY', 'MINIMAL', 'MORE_EMOTIONAL', 'HIGHER_ENERGY');

-- CreateEnum
CREATE TYPE "ExportPlatform" AS ENUM ('INSTAGRAM_REEL', 'TIKTOK', 'FACEBOOK_REEL', 'YOUTUBE_SHORTS');

-- CreateEnum
CREATE TYPE "ExportResolution" AS ENUM ('HD_1080P', 'UHD_4K');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED');

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_musicTrackId_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_styleId_fkey";

-- AlterTable
ALTER TABLE "project_images" ADD COLUMN     "fileSizeBytes" INTEGER;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "hookArchetype",
DROP COLUMN "musicTrackId",
DROP COLUMN "reelLengthSec",
DROP COLUMN "styleId";

-- AlterTable
ALTER TABLE "renders" ADD COLUMN     "outputFileSizeBytes" INTEGER,
ADD COLUMN     "scoreJson" JSONB,
ADD COLUMN     "versionId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "brand_kits" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "agencyName" TEXT,
    "logoStorageKey" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "outroStorageKey" TEXT,
    "watermarkStorageKey" TEXT,
    "watermarkPosition" "WatermarkPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactWebsite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_versions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reelLengthSec" INTEGER,
    "styleId" UUID,
    "musicTrackId" UUID,
    "hookArchetype" TEXT,
    "brandKitId" UUID,
    "parentVersionId" UUID,
    "regenerateDirective" "SmartRegenerateDirective",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_exports" (
    "id" UUID NOT NULL,
    "renderId" UUID NOT NULL,
    "platform" "ExportPlatform" NOT NULL,
    "resolution" "ExportResolution" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "outputStorageKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "render_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "renderId" UUID,
    "authorUserId" UUID,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "renderId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_kits_userId_idx" ON "brand_kits"("userId");

-- CreateIndex
CREATE INDEX "project_versions_projectId_idx" ON "project_versions"("projectId");

-- CreateIndex
CREATE INDEX "render_exports_renderId_idx" ON "render_exports"("renderId");

-- CreateIndex
CREATE INDEX "comments_projectId_idx" ON "comments"("projectId");

-- CreateIndex
CREATE INDEX "comments_renderId_idx" ON "comments"("renderId");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_projectId_idx" ON "share_links"("projectId");

-- CreateIndex
CREATE INDEX "renders_versionId_idx" ON "renders"("versionId");

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "music_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renders" ADD CONSTRAINT "renders_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "project_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_exports" ADD CONSTRAINT "render_exports_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "renders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "renders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "renders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
