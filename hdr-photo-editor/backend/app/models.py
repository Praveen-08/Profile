import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class GroupStatus(str, enum.Enum):
    HDR_READY = "HDR_READY"
    SINGLE_EDIT = "SINGLE_EDIT"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ProcessingStatus(str, enum.Enum):
    PENDING = "PENDING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, default="Untitled Project")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    group_range_seconds: Mapped[float] = mapped_column(Float, default=3.0)

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    groups: Mapped[list["Group"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    number: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[GroupStatus] = mapped_column(
        Enum(GroupStatus), default=GroupStatus.NEEDS_REVIEW
    )
    manual_status_override: Mapped[bool] = mapped_column(default=False)

    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), default=ProcessingStatus.PENDING
    )
    processing_error: Mapped[str | None] = mapped_column(String, nullable=True)

    output_path: Mapped[str | None] = mapped_column(String, nullable=True)
    output_thumbnail_path: Mapped[str | None] = mapped_column(String, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="groups")
    photos: Mapped[list["Photo"]] = relationship(
        back_populates="group", order_by="Photo.brightness_ev"
    )

    @property
    def capture_time_start(self) -> datetime | None:
        times = [p.capture_time for p in self.photos if p.capture_time]
        return min(times) if times else None

    @property
    def capture_time_end(self) -> datetime | None:
        times = [p.capture_time for p in self.photos if p.capture_time]
        return max(times) if times else None


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id"), nullable=True)

    filename: Mapped[str] = mapped_column(String)
    stored_path: Mapped[str] = mapped_column(String)
    thumbnail_path: Mapped[str | None] = mapped_column(String, nullable=True)

    capture_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    shutter_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    iso: Mapped[int | None] = mapped_column(Integer, nullable=True)
    aperture: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_compensation: Mapped[float | None] = mapped_column(Float, nullable=True)
    camera_model: Mapped[str | None] = mapped_column(String, nullable=True)

    # Combined relative-exposure value used to sort darkest -> brightest.
    brightness_ev: Mapped[float] = mapped_column(Float, default=0.0)

    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    raw_exif: Mapped[dict] = mapped_column(JSON, default=dict)

    project: Mapped["Project"] = relationship(back_populates="photos")
    group: Mapped["Group"] = relationship(back_populates="photos")
