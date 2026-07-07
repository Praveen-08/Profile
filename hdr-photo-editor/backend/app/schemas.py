from datetime import datetime

from pydantic import BaseModel

from app.models import GroupStatus, ProcessingStatus


class PhotoOut(BaseModel):
    id: str
    filename: str
    thumbnail_url: str | None
    capture_time: datetime | None
    shutter_speed: float | None
    iso: int | None
    aperture: float | None
    exposure_compensation: float | None
    camera_model: str | None
    brightness_ev: float
    group_id: str | None

    class Config:
        from_attributes = True


class GroupOut(BaseModel):
    id: str
    number: int
    status: GroupStatus
    manual_status_override: bool
    processing_status: ProcessingStatus
    processing_error: str | None
    capture_time_start: datetime | None
    capture_time_end: datetime | None
    photo_count: int
    photos: list[PhotoOut]
    output_url: str | None
    output_thumbnail_url: str | None
    before_preview_url: str | None

    class Config:
        from_attributes = True


class ProjectOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    group_range_seconds: float
    photo_count: int
    group_count: int

    class Config:
        from_attributes = True


class RerunGroupingRequest(BaseModel):
    range_seconds: float | None = None
    preset: str | None = None  # tight | normal | loose | very_loose


class SplitGroupRequest(BaseModel):
    photo_ids: list[str]  # photos to move into a brand-new group


class MergeGroupsRequest(BaseModel):
    group_ids: list[str]  # 2+ groups to combine into one


class MovePhotoRequest(BaseModel):
    photo_id: str
    target_group_id: str | None = None  # None => create a new group


class RemovePhotoRequest(BaseModel):
    photo_id: str
