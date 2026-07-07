from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.exif_utils import extract_exif
from app.grouping import apply_auto_grouping
from app.image_processing.raw_decode import RAW_EXTENSIONS
from app.models import Photo, Project
from app.schemas import GroupOut, ProjectOut
from app.storage import generate_thumbnail, save_upload
from app.serializers import serialize_group

router = APIRouter(prefix="/api/projects", tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"} | RAW_EXTENSIONS


@router.post("", response_model=ProjectOut)
def create_project(name: str = "Untitled Project", db: Session = Depends(get_db)):
    project = Project(name=name, group_range_seconds=settings.default_group_range_seconds)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [_project_out(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_out(project)


@router.post("/{project_id}/upload", response_model=list[GroupOut])
async def upload_photos(
    project_id: str,
    files: list[UploadFile],
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    for upload_file in files:
        ext = ("." + upload_file.filename.rsplit(".", 1)[-1].lower()) if "." in upload_file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            continue

        data = await upload_file.read()
        stored_path = save_upload(project_id, upload_file.filename, data)
        thumb_path = generate_thumbnail(stored_path, project_id)
        exif = extract_exif(str(stored_path))

        photo = Photo(
            project_id=project_id,
            filename=upload_file.filename,
            stored_path=str(stored_path),
            thumbnail_path=str(thumb_path),
            capture_time=exif.capture_time,
            shutter_speed=exif.shutter_speed,
            iso=exif.iso,
            aperture=exif.aperture,
            exposure_compensation=exif.exposure_compensation,
            camera_model=exif.camera_model,
            brightness_ev=exif.brightness_ev,
            width=exif.width,
            height=exif.height,
            raw_exif=exif.raw,
        )
        db.add(photo)

    db.commit()

    groups = apply_auto_grouping(db, project_id, project.group_range_seconds)
    return [serialize_group(g) for g in groups]


def _project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        created_at=project.created_at,
        group_range_seconds=project.group_range_seconds,
        photo_count=len(project.photos),
        group_count=len(project.groups),
    )
