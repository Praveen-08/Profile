from datetime import datetime, timedelta

from app.grouping import PhotoStub, auto_group_photos
from app.models import GroupStatus

BASE = datetime(2026, 1, 1, 12, 0, 0)


def stub(id_, seconds_offset, ev):
    return PhotoStub(id=id_, capture_time=BASE + timedelta(seconds=seconds_offset), brightness_ev=ev)


def test_groups_within_range_and_sorts_darkest_to_brightest():
    photos = [
        stub("bright", 0.6, ev=2.0),
        stub("dark", 0.0, ev=-2.0),
        stub("mid", 0.3, ev=0.0),
    ]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert len(results) == 1
    assert results[0].photo_ids == ["dark", "mid", "bright"]
    assert results[0].status == GroupStatus.HDR_READY


def test_gap_larger_than_range_starts_new_group():
    photos = [
        stub("a", 0, ev=0),
        stub("b", 1, ev=1),
        stub("c", 10, ev=0),
    ]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert len(results) == 2
    assert results[0].photo_ids == ["a", "b"]
    assert results[1].photo_ids == ["c"]


def test_single_photo_group_is_single_edit():
    results = auto_group_photos([stub("solo", 0, ev=0)], range_seconds=3.0)
    assert results[0].status == GroupStatus.SINGLE_EDIT


def test_five_photo_group_is_hdr_ready():
    photos = [stub(str(i), i * 0.4, ev=i) for i in range(5)]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert len(results) == 1
    assert results[0].status == GroupStatus.HDR_READY


def test_two_photo_group_needs_review():
    photos = [stub("a", 0, ev=0), stub("b", 0.5, ev=1)]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert results[0].status == GroupStatus.NEEDS_REVIEW


def test_four_photo_group_needs_review():
    photos = [stub(str(i), i * 0.3, ev=i) for i in range(4)]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert results[0].status == GroupStatus.NEEDS_REVIEW


def test_more_than_five_needs_review():
    photos = [stub(str(i), i * 0.3, ev=i) for i in range(6)]
    results = auto_group_photos(photos, range_seconds=3.0)
    assert results[0].status == GroupStatus.NEEDS_REVIEW


def test_adjustable_range_changes_grouping():
    photos = [stub("a", 0, ev=0), stub("b", 4, ev=1), stub("c", 8, ev=2)]
    tight = auto_group_photos(photos, range_seconds=1.0)
    assert len(tight) == 3

    loose = auto_group_photos(photos, range_seconds=5.0)
    assert len(loose) == 1


def test_untimed_photos_become_their_own_needs_review_groups():
    photos = [stub("a", 0, ev=0), PhotoStub(id="no-exif", capture_time=None, brightness_ev=0)]
    results = auto_group_photos(photos, range_seconds=3.0)
    statuses = {tuple(r.photo_ids): r.status for r in results}
    assert statuses[("no-exif",)] == GroupStatus.NEEDS_REVIEW
