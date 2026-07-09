-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'UPLOADING', 'ANALYZING', 'READY', 'QUEUED', 'RENDERING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('EXTERIOR_FRONT', 'EXTERIOR_REAR', 'EXTERIOR_GENERAL', 'DRONE', 'LIVING_ROOM', 'KITCHEN', 'DINING', 'MASTER_BEDROOM', 'BEDROOM', 'BATHROOM', 'ENSUITE', 'LAUNDRY', 'HALLWAY', 'OFFICE', 'OUTDOOR', 'POOL', 'DECK', 'VIEWS', 'TWILIGHT', 'NIGHT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MusicVibe" AS ENUM ('LUXURY_PIANO', 'EPIC_CINEMATIC', 'MODERN_ELECTRONIC', 'CORPORATE', 'DEEP_HOUSE', 'ACOUSTIC', 'LIFESTYLE', 'AMBIENT', 'HIGH_ENERGY', 'MOTIVATIONAL');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RESOLVING_EDL', 'RENDERING', 'MUXING', 'UPLOADING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "companyName" TEXT,
    "avatarUrl" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "address" TEXT,
    "bedCount" INTEGER,
    "bathCount" INTEGER,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "reelLengthSec" INTEGER,
    "styleId" UUID,
    "musicTrackId" UUID,
    "hookArchetype" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "orderIndex" INTEGER,
    "roomType" "RoomType",
    "roomConfidence" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "perceptualHash" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" UUID,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "isSecondHero" BOOLEAN NOT NULL DEFAULT false,
    "heroScore" DOUBLE PRECISION,
    "analysisJson" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "styles" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "vibe" "MusicVibe" NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "genre" TEXT,
    "mood" TEXT,
    "bpm" DOUBLE PRECISION NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "buildUpSec" DOUBLE PRECISION,
    "dropSec" DOUBLE PRECISION,
    "manualDropSec" DOUBLE PRECISION,
    "outroSec" DOUBLE PRECISION,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "beatGridJson" JSONB,
    "beatGridVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renders" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "bullJobId" TEXT,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "edlJson" JSONB,
    "outputStorageKey" TEXT,
    "outputDurationSec" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "project_images_projectId_idx" ON "project_images"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "styles_slug_key" ON "styles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "music_tracks_slug_key" ON "music_tracks"("slug");

-- CreateIndex
CREATE INDEX "music_tracks_vibe_idx" ON "music_tracks"("vibe");

-- CreateIndex
CREATE INDEX "renders_projectId_idx" ON "renders"("projectId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "music_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "project_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renders" ADD CONSTRAINT "renders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
