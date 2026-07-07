from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.grouping import (
    GROUPING_PRESETS,
    apply_auto_grouping,
    merge_groups,
    move_photo,
    split_group,
)
from app.models import Group, Project
from app.schemas import (
    GroupOut,
    MergeGroupsRequest,
    MovePhotoRequest,
    RemovePhotoRequest,
    RerunGroupingRequest,
    SplitGroupRequest,
)
from app.serializers import serialize_group

router = APIRouter(prefix="/api/projects/{project_id}/groups", tags=["groups"])


def _get_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[GroupOut])
def list_groups(project_id: str, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    groups = (
        db.query(Group)
        .filter(Group.project_id == project_id)
        .order_by(Group.number)
        .all()
    )
    return [serialize_group(g) for g in groups]


@router.post("/rerun", response_model=list[GroupOut])
def rerun_auto_grouping(project_id: str, body: RerunGroupingRequest, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)

    range_seconds = body.range_seconds
    if range_seconds is None and body.preset:
        if body.preset not in GROUPING_PRESETS:
            raise HTTPException(status_code=400, detail=f"Unknown preset '{body.preset}'")
        range_seconds = GROUPING_PRESETS[body.preset]
    if range_seconds is None:
        range_seconds = project.group_range_seconds
    if range_seconds <= 0:
        raise HTTPException(status_code=400, detail="range_seconds must be positive")

    groups = apply_auto_grouping(db, project_id, range_seconds)
    return [serialize_group(g) for g in groups]


@router.post("/{group_id}/split", response_model=list[GroupOut])
def split_group_endpoint(project_id: str, group_id: str, body: SplitGroupRequest, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    try:
        original, new_group = split_group(db, group_id, body.photo_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [serialize_group(original), serialize_group(new_group)]


@router.post("/merge", response_model=GroupOut)
def merge_groups_endpoint(project_id: str, body: MergeGroupsRequest, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    try:
        merged = merge_groups(db, body.group_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return serialize_group(merged)


@router.post("/move-photo", response_model=list[GroupOut])
def move_photo_endpoint(project_id: str, body: MovePhotoRequest, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    try:
        move_photo(db, body.photo_id, body.target_group_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    groups = (
        db.query(Group)
        .filter(Group.project_id == project_id)
        .order_by(Group.number)
        .all()
    )
    return [serialize_group(g) for g in groups]


@router.post("/{group_id}/remove-photo", response_model=list[GroupOut])
def remove_photo_endpoint(project_id: str, group_id: str, body: RemovePhotoRequest, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    group = db.get(Group, group_id)
    if group is None or group.project_id != project_id:
        raise HTTPException(status_code=404, detail="Group not found")
    if not any(p.id == body.photo_id for p in group.photos):
        raise HTTPException(status_code=400, detail="Photo is not in this group")

    try:
        move_photo(db, body.photo_id, target_group_id=None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    groups = (
        db.query(Group)
        .filter(Group.project_id == project_id)
        .order_by(Group.number)
        .all()
    )
    return [serialize_group(g) for g in groups]
