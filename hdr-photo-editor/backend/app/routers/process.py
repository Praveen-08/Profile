import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from rq import Queue
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Group, GroupStatus, ProcessingStatus, Project
from app.redis_conn import get_redis, redis_available
from app.schemas import GroupOut
from app.serializers import serialize_group
from app.worker import process_group_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}", tags=["process"])


def _get_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _queue_group(project_id: str, group_id: str, background_tasks: BackgroundTasks) -> None:
    """Enqueue via Redis/RQ when available; otherwise fall back to an
    in-process background task so the app still works without Redis running
    locally. Production deployments should always run the RQ worker.
    """
    if redis_available():
        queue = Queue(settings.rq_queue_name, connection=get_redis())
        queue.enqueue(process_group_job, project_id, group_id)
    else:
        logger.warning("Redis unavailable; processing group %s inline instead of via RQ.", group_id)
        background_tasks.add_task(process_group_job, project_id, group_id)


@router.post("/groups/{group_id}/process", response_model=GroupOut)
def process_group(
    project_id: str,
    group_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    group = db.get(Group, group_id)
    if group is None or group.project_id != project_id:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.status == GroupStatus.NEEDS_REVIEW:
        raise HTTPException(
            status_code=400,
            detail="This group needs manual review (split/merge/move) before it can be processed.",
        )

    group.processing_status = ProcessingStatus.QUEUED
    db.commit()
    db.refresh(group)

    _queue_group(project_id, group_id, background_tasks)
    return serialize_group(group)


@router.post("/process-all", response_model=list[GroupOut])
def process_all_groups(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _get_project(db, project_id)
    groups = (
        db.query(Group)
        .filter(
            Group.project_id == project_id,
            Group.status.in_([GroupStatus.HDR_READY, GroupStatus.SINGLE_EDIT]),
            Group.processing_status.in_([ProcessingStatus.PENDING, ProcessingStatus.FAILED]),
        )
        .all()
    )

    for group in groups:
        group.processing_status = ProcessingStatus.QUEUED
    db.commit()

    for group in groups:
        _queue_group(project_id, group.id, background_tasks)

    all_groups = (
        db.query(Group)
        .filter(Group.project_id == project_id)
        .order_by(Group.number)
        .all()
    )
    return [serialize_group(g) for g in all_groups]


@router.get("/groups/{group_id}", response_model=GroupOut)
def get_group_status(project_id: str, group_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if group is None or group.project_id != project_id:
        raise HTTPException(status_code=404, detail="Group not found")
    return serialize_group(group)
