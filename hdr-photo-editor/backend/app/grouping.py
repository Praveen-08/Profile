"""Auto-grouping of bracketed photos by EXIF capture time.

Pure functions here operate on plain dataclasses so the algorithm is easy to
unit test without a database. `apply_auto_grouping` wires it up to the ORM.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Group, GroupStatus, Photo, Project

GROUPING_PRESETS = {
    "tight": 1.0,
    "normal": 3.0,
    "loose": 5.0,
    "very_loose": 10.0,
}

# Group-size -> status rules (requirements 9-11).
HDR_READY_SIZES = {3, 5}
SINGLE_EDIT_SIZES = {1}


@dataclass
class PhotoStub:
    id: str
    capture_time: datetime | None
    brightness_ev: float = 0.0


@dataclass
class GroupResult:
    photo_ids: list[str]
    status: GroupStatus


def classify_group_status(size: int) -> GroupStatus:
    if size in SINGLE_EDIT_SIZES:
        return GroupStatus.SINGLE_EDIT
    if size in HDR_READY_SIZES:
        return GroupStatus.HDR_READY
    return GroupStatus.NEEDS_REVIEW


def auto_group_photos(photos: list[PhotoStub], range_seconds: float) -> list[GroupResult]:
    """Group photos by capture time proximity, sort each group darkest->brightest.

    Photos missing a capture_time are each placed into their own
    "Needs Review" group at the end, since they cannot be reliably clustered.
    """
    timed = [p for p in photos if p.capture_time is not None]
    untimed = [p for p in photos if p.capture_time is None]

    timed.sort(key=lambda p: p.capture_time)

    clusters: list[list[PhotoStub]] = []
    current: list[PhotoStub] = []
    prev_time: datetime | None = None

    for photo in timed:
        if current and prev_time is not None:
            gap = (photo.capture_time - prev_time).total_seconds()
            if gap > range_seconds:
                clusters.append(current)
                current = []
        current.append(photo)
        prev_time = photo.capture_time

    if current:
        clusters.append(current)

    results: list[GroupResult] = []
    for cluster in clusters:
        cluster_sorted = sorted(cluster, key=lambda p: p.brightness_ev)
        results.append(
            GroupResult(
                photo_ids=[p.id for p in cluster_sorted],
                status=classify_group_status(len(cluster_sorted)),
            )
        )

    for photo in untimed:
        results.append(GroupResult(photo_ids=[photo.id], status=GroupStatus.NEEDS_REVIEW))

    return results


def apply_auto_grouping(db: Session, project_id: str, range_seconds: float) -> list[Group]:
    """Recompute groups for a project from scratch and persist them.

    This discards any manual split/merge/move edits, matching the "Re-run
    Auto Grouping" action in the review UI.
    """
    photos = db.query(Photo).filter(Photo.project_id == project_id).all()
    stubs = [PhotoStub(id=p.id, capture_time=p.capture_time, brightness_ev=p.brightness_ev) for p in photos]

    results = auto_group_photos(stubs, range_seconds)

    # Wipe existing groups for this project.
    db.query(Group).filter(Group.project_id == project_id).delete()
    db.query(Photo).filter(Photo.project_id == project_id).update({Photo.group_id: None})
    db.flush()

    photos_by_id = {p.id: p for p in photos}
    new_groups: list[Group] = []
    for idx, result in enumerate(results, start=1):
        group = Group(project_id=project_id, number=idx, status=result.status)
        db.add(group)
        db.flush()  # assign group.id
        for photo_id in result.photo_ids:
            photos_by_id[photo_id].group_id = group.id
        new_groups.append(group)

    project = db.get(Project, project_id)
    project.group_range_seconds = range_seconds

    db.commit()
    return new_groups


def recompute_group_status(db: Session, group: Group) -> None:
    """Re-derive a group's status from its current photo count (used after
    manual split/merge/move edits)."""
    group.status = classify_group_status(len(group.photos))
    group.manual_status_override = True


def _next_group_number(db: Session, project_id: str) -> int:
    max_number = (
        db.query(Group.number)
        .filter(Group.project_id == project_id)
        .order_by(Group.number.desc())
        .first()
    )
    return (max_number[0] if max_number else 0) + 1


def create_group_from_photos(db: Session, project_id: str, photo_ids: list[str]) -> Group:
    group = Group(
        project_id=project_id,
        number=_next_group_number(db, project_id),
        status=GroupStatus.NEEDS_REVIEW,
    )
    db.add(group)
    db.flush()

    photos = db.query(Photo).filter(Photo.id.in_(photo_ids)).all()
    for photo in photos:
        photo.group = group
    db.flush()

    recompute_group_status(db, group)
    db.commit()
    db.refresh(group)
    return group


def split_group(db: Session, group_id: str, photo_ids: list[str]) -> tuple[Group, Group]:
    """Move `photo_ids` out of their current group into a brand-new group.
    Returns (original_group, new_group)."""
    original = db.get(Group, group_id)
    if original is None:
        raise ValueError("Group not found")
    if len(photo_ids) >= len(original.photos):
        raise ValueError("Cannot split every photo out of a group; nothing would remain")

    new_group = Group(
        project_id=original.project_id,
        number=_next_group_number(db, original.project_id),
        status=GroupStatus.NEEDS_REVIEW,
    )
    db.add(new_group)
    db.flush()

    for photo in db.query(Photo).filter(Photo.id.in_(photo_ids)).all():
        photo.group = new_group

    db.flush()
    db.refresh(original)
    recompute_group_status(db, original)
    recompute_group_status(db, new_group)
    db.commit()
    db.refresh(original)
    db.refresh(new_group)
    return original, new_group


def merge_groups(db: Session, group_ids: list[str]) -> Group:
    """Combine 2+ groups into the first group in the list; the rest are deleted."""
    if len(group_ids) < 2:
        raise ValueError("Select at least two groups to merge")

    groups = [db.get(Group, gid) for gid in group_ids]
    if any(g is None for g in groups):
        raise ValueError("One or more groups not found")

    target, rest = groups[0], groups[1:]
    for group in rest:
        for photo in list(group.photos):
            photo.group = target
        db.delete(group)

    db.flush()
    db.refresh(target)
    recompute_group_status(db, target)
    db.commit()
    db.refresh(target)
    return target


def move_photo(db: Session, photo_id: str, target_group_id: str | None) -> Photo:
    """Move a single photo to `target_group_id`, or to a brand-new group if None."""
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ValueError("Photo not found")

    source_group = db.get(Group, photo.group_id) if photo.group_id else None

    if target_group_id is None:
        new_group = Group(
            project_id=photo.project_id,
            number=_next_group_number(db, photo.project_id),
            status=GroupStatus.SINGLE_EDIT,
        )
        db.add(new_group)
        db.flush()
        photo.group = new_group
    else:
        target_group = db.get(Group, target_group_id)
        if target_group is None:
            raise ValueError("Target group not found")
        photo.group = target_group
        db.flush()
        db.refresh(target_group)
        recompute_group_status(db, target_group)

    db.flush()
    if source_group is not None:
        db.refresh(source_group)
        if len(source_group.photos) == 0:
            db.delete(source_group)
        else:
            recompute_group_status(db, source_group)

    db.commit()
    db.refresh(photo)
    return photo


def remove_photo_to_own_group(db: Session, photo_id: str) -> Photo:
    """Requirement: 'remove photo from group' -- pulls it into its own
    Single Edit group rather than deleting the upload."""
    return move_photo(db, photo_id, target_group_id=None)
