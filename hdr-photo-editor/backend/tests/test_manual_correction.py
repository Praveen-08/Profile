"""Regression tests for manual group correction (split/merge/move).

These exercise the ORM against a real (in-memory) database because the bug
they guard against -- photos silently vanishing during merge -- only shows
up when SQLAlchemy actually flushes the session, not with plain dataclasses.
"""

from app.grouping import (
    apply_auto_grouping,
    create_group_from_photos,
    merge_groups,
    move_photo,
    split_group,
)
from app.models import Group, GroupStatus, Photo
from tests.conftest import make_photo


def _create_group(db_session, project_id, photo_ids, status=GroupStatus.NEEDS_REVIEW):
    group = Group(project_id=project_id, number=1, status=status)
    db_session.add(group)
    db_session.flush()
    for pid in photo_ids:
        photo = db_session.get(Photo, pid)
        photo.group = group
    db_session.commit()
    return group


def test_merge_groups_preserves_every_photo(db_session, project):
    p1 = make_photo(db_session, project.id, brightness_ev=-1, filename="a.jpg")
    p2 = make_photo(db_session, project.id, brightness_ev=0, filename="b.jpg")
    p3 = make_photo(db_session, project.id, brightness_ev=1, filename="c.jpg")

    group_a = _create_group(db_session, project.id, [p1.id, p2.id])
    group_b = _create_group(db_session, project.id, [p3.id])

    merged = merge_groups(db_session, [group_a.id, group_b.id])

    db_session.refresh(merged)
    photo_ids_in_merged = {p.id for p in merged.photos}
    assert photo_ids_in_merged == {p1.id, p2.id, p3.id}

    # The source group should really be gone, not just emptied.
    assert db_session.get(Group, group_b.id) is None

    # And every photo should genuinely point at the surviving group in the DB.
    for pid in (p1.id, p2.id, p3.id):
        photo = db_session.get(Photo, pid)
        assert photo.group_id == merged.id

    # 3 photos merged -> should be reclassified HDR_READY.
    assert merged.status == GroupStatus.HDR_READY


def test_move_photo_to_existing_group_and_source_cleanup(db_session, project):
    p1 = make_photo(db_session, project.id, brightness_ev=-1, filename="a.jpg")
    p2 = make_photo(db_session, project.id, brightness_ev=0, filename="b.jpg")
    solo = make_photo(db_session, project.id, brightness_ev=1, filename="solo.jpg")

    group_a = _create_group(db_session, project.id, [p1.id, p2.id])
    group_solo = _create_group(db_session, project.id, [solo.id], status=GroupStatus.SINGLE_EDIT)

    move_photo(db_session, solo.id, group_a.id)

    db_session.refresh(group_a)
    assert {p.id for p in group_a.photos} == {p1.id, p2.id, solo.id}
    assert db_session.get(Group, group_solo.id) is None

    moved = db_session.get(Photo, solo.id)
    assert moved.group_id == group_a.id


def test_split_group_moves_only_selected_photos(db_session, project):
    p1 = make_photo(db_session, project.id, brightness_ev=-1, filename="a.jpg")
    p2 = make_photo(db_session, project.id, brightness_ev=0, filename="b.jpg")
    p3 = make_photo(db_session, project.id, brightness_ev=1, filename="c.jpg")
    group = _create_group(db_session, project.id, [p1.id, p2.id, p3.id])

    original, new_group = split_group(db_session, group.id, [p3.id])

    assert {p.id for p in original.photos} == {p1.id, p2.id}
    assert {p.id for p in new_group.photos} == {p3.id}
    assert new_group.status == GroupStatus.SINGLE_EDIT


def test_rerun_auto_grouping_does_not_lose_photos(db_session, project):
    for i in range(5):
        make_photo(db_session, project.id, brightness_ev=i, filename=f"p{i}.jpg")

    groups = apply_auto_grouping(db_session, project.id, range_seconds=3.0)
    total_photos = sum(len(g.photos) for g in groups)
    assert total_photos == 5
