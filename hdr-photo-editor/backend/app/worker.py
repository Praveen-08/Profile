"""RQ job(s). Run the worker with:

    python -m app.worker

which starts an RQ worker listening on settings.rq_queue_name against
settings.redis_url. Jobs are enqueued from app/routers/process.py.
"""

from __future__ import annotations

from app.config import settings
from app.database import SessionLocal
from app.image_processing.hdr_merge import process_hdr_group, process_single_image
from app.models import Group, GroupStatus, ProcessingStatus
from app.storage import save_processed_jpeg, save_processed_thumbnail


def process_group_job(project_id: str, group_id: str) -> None:
    """Runs in the RQ worker process (or inline as a fallback -- see
    app/routers/process.py). Opens its own DB session since it may run in a
    different process than the API server.
    """
    db = SessionLocal()
    try:
        group = db.get(Group, group_id)
        if group is None or group.project_id != project_id:
            return

        group.processing_status = ProcessingStatus.PROCESSING
        group.processing_error = None
        db.commit()

        photos_sorted = sorted(group.photos, key=lambda p: p.brightness_ev)
        paths = [p.stored_path for p in photos_sorted]

        try:
            if group.status == GroupStatus.HDR_READY:
                result = process_hdr_group(paths)
            elif group.status == GroupStatus.SINGLE_EDIT:
                result = process_single_image(paths[0])
            else:
                raise ValueError(
                    "Group is marked 'Needs Review' and must be corrected "
                    "(split/merge/move) before processing."
                )

            output_path = save_processed_jpeg(result, project_id, f"group_{group.number}_{group.id[:8]}")
            thumb_path = save_processed_thumbnail(result, project_id, f"group_{group.number}_{group.id[:8]}")

            group.output_path = str(output_path)
            group.output_thumbnail_path = str(thumb_path)
            group.processing_status = ProcessingStatus.DONE
            db.commit()
        except Exception as exc:  # noqa: BLE001 - persist failure to the DB for the UI
            group.processing_status = ProcessingStatus.FAILED
            group.processing_error = str(exc)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    from redis import Redis
    from rq import Queue, Worker

    conn = Redis.from_url(settings.redis_url)
    queue = Queue(settings.rq_queue_name, connection=conn)
    worker = Worker([queue], connection=conn)
    worker.work()
