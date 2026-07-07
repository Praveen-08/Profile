"""Tests for the RAW-file code paths that don't require a real, decodable
camera RAW file (which can't be reasonably fabricated in a test environment --
a valid Bayer RAW needs real CFA/color-matrix data). These cover extension
detection, the exifread tag-parsing helpers, and that RAW files dispatch to
the exifread path instead of piexif.
"""

from unittest.mock import patch

from app.exif_utils import _exifread_int, _exifread_ratio, extract_exif
from app.image_processing.raw_decode import RAW_EXTENSIONS, is_raw


def test_is_raw_detects_common_vendor_extensions():
    for ext in [".cr2", ".CR2", ".nef", ".arw", ".dng", ".raf", ".rw2", ".orf", ".pef", ".srw"]:
        assert is_raw(f"/tmp/photo{ext}"), f"{ext} should be detected as RAW"


def test_is_raw_rejects_standard_formats():
    for ext in [".jpg", ".jpeg", ".png", ".tif", ".tiff"]:
        assert not is_raw(f"/tmp/photo{ext}")


def test_raw_extensions_cover_major_camera_brands():
    # Canon, Nikon, Sony, Fuji, Panasonic, Olympus, Adobe/universal, Pentax, Samsung
    expected = {".cr2", ".cr3", ".nef", ".arw", ".raf", ".rw2", ".orf", ".dng", ".pef", ".srw"}
    assert expected == RAW_EXTENSIONS


class _FakeRatio:
    def __init__(self, num, den):
        self.num = num
        self.den = den


class _FakeTag:
    """Mimics exifread's IfdTag shape closely enough for our parsing helpers."""

    def __init__(self, values, str_value=None):
        self.values = values
        self._str_value = str_value if str_value is not None else str(values)

    def __str__(self):
        return self._str_value


def test_exifread_ratio_parses_fake_ratio_tag():
    tag = _FakeTag([_FakeRatio(1, 125)])
    assert _exifread_ratio(tag) == (1, 125)


def test_exifread_ratio_falls_back_to_str_int():
    tag = _FakeTag([100], str_value="100")
    # values[0] is a plain int (no .num/.den) -> AttributeError -> str() fallback
    assert _exifread_ratio(tag) == (100, 1)


def test_exifread_ratio_none_for_missing_tag():
    assert _exifread_ratio(None) is None


def test_exifread_int_parses_iso():
    tag = _FakeTag([400])
    assert _exifread_int(tag) == 400


def test_exifread_int_none_for_missing_tag():
    assert _exifread_int(None) is None


def test_raw_extension_dispatches_to_exifread_not_piexif(tmp_path):
    fake_raw = tmp_path / "bracket.dng"
    fake_raw.write_bytes(b"not a real dng, just here to exercise dispatch")

    with patch("app.exif_utils._extract_via_exifread") as mock_exifread, patch(
        "app.exif_utils._extract_via_piexif"
    ) as mock_piexif, patch("app.exif_utils.raw_dimensions", return_value=(100, 100)):
        mock_exifread.return_value = (
            "2026:05:01 14:30:00", None, (1, 125), (8, 1), 200, None, "Canon EOS R5"
        )
        result = extract_exif(str(fake_raw))

    mock_exifread.assert_called_once()
    mock_piexif.assert_not_called()
    assert result.camera_model == "Canon EOS R5"
    assert result.iso == 200
    assert result.shutter_speed == 1 / 125
