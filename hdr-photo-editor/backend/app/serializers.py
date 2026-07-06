from pathlib import Path

from app.config import settings
from app.models import Group, Photo
from app.schemas import GroupOut, PhotoOut


def _media_url(path: str | None, base_dir: Path, prefix: str) -> str | None:
    if not path:
        return None
    rel = Path(path).relative_to(base_dir)
    return f"/media/{prefix}/{rel.as_posix()}"


def photo_thumbnail_url(photo: Photo) -> str | None:
    return _media_url(photo.thumbnail_path, settings.thumbnails_dir, "thumbnails")


def serialize_photo(photo: Photo) -> PhotoOut:
    return PhotoOut(
        id=photo.id,
        filename=photo.filename,
        thumbnail_url=photo_thumbnail_url(photo),
        capture_time=photo.capture_time,
        shutter_speed=photo.shutter_speed,
        iso=photo.iso,
        aperture=photo.aperture,
        exposure_compensation=photo.exposure_compensation,
        camera_model=photo.camera_model,
        brightness_ev=photo.brightness_ev,
        group_id=photo.group_id,
    )


def serialize_group(group: Group) -> GroupOut:
    photos_sorted = sorted(group.photos, key=lambda p: p.brightness_ev)
    before_photo = photos_sorted[len(photos_sorted) // 2] if photos_sorted else None

    return GroupOut(
        id=group.id,
        number=group.number,
        status=group.status,
        manual_status_override=group.manual_status_override,
        processing_status=group.processing_status,
        processing_error=group.processing_error,
        capture_time_start=group.capture_time_start,
        capture_time_end=group.capture_time_end,
        photo_count=len(group.photos),
        photos=[serialize_photo(p) for p in photos_sorted],
        output_url=_media_url(group.output_path, settings.processed_dir, "processed"),
        output_thumbnail_url=_media_url(
            group.output_thumbnail_path, settings.thumbnails_dir, "thumbnails"
        ),
        before_preview_url=photo_thumbnail_url(before_photo) if before_photo else None,
    )
