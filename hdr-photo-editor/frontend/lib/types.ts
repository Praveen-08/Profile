export type GroupStatus = "HDR_READY" | "SINGLE_EDIT" | "NEEDS_REVIEW";

export type ProcessingStatus = "PENDING" | "QUEUED" | "PROCESSING" | "DONE" | "FAILED";

export interface Photo {
  id: string;
  filename: string;
  thumbnail_url: string | null;
  capture_time: string | null;
  shutter_speed: number | null;
  iso: number | null;
  aperture: number | null;
  exposure_compensation: number | null;
  camera_model: string | null;
  brightness_ev: number;
  group_id: string | null;
}

export interface Group {
  id: string;
  number: number;
  status: GroupStatus;
  manual_status_override: boolean;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  capture_time_start: string | null;
  capture_time_end: string | null;
  photo_count: number;
  photos: Photo[];
  output_url: string | null;
  output_thumbnail_url: string | null;
  before_preview_url: string | null;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  group_range_seconds: number;
  photo_count: number;
  group_count: number;
}

export type GroupingPreset = "tight" | "normal" | "loose" | "very_loose" | "custom";

export const GROUPING_PRESET_SECONDS: Record<Exclude<GroupingPreset, "custom">, number> = {
  tight: 1,
  normal: 3,
  loose: 5,
  very_loose: 10,
};
