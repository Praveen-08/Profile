import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, ProcessingStatus, Project

router = APIRouter(prefix="/api/projects/{project_id}", tags=["export"])


def _get_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/groups/{group_id}/download")
def download_group(project_id: str, group_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if group is None or group.project_id != project_id:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.processing_status != ProcessingStatus.DONE or not group.output_path:
        raise HTTPException(status_code=400, detail="This group has not been processed yet")

    filename = f"group-{group.number:02d}-edited.jpg"
    return FileResponse(group.output_path, media_type="image/jpeg", filename=filename)


@router.get("/export")
def export_all(project_id: str, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    groups = (
        db.query(Group)
        .filter(Group.project_id == project_id, Group.processing_status == ProcessingStatus.DONE)
        .order_by(Group.number)
        .all()
    )
    if not groups:
        raise HTTPException(status_code=400, detail="No processed images are ready to export yet")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for group in groups:
            output_path = Path(group.output_path)
            if output_path.exists():
                zf.write(output_path, arcname=f"group-{group.number:02d}-edited.jpg")
    buffer.seek(0)

    headers = {"Content-Disposition": "attachment; filename=hdr-export.zip"}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)
