"""EXIF extraction for bracketed real-estate photos.

Uses piexif because it gives raw, uncooked access to the standard EXIF IFDs
(rationals as (numerator, denominator) tuples) which is what we need to do
our own exposure-value math for sorting/grouping.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime

import piexif
from PIL import Image


@dataclass
class ExifData:
    capture_time: datetime | None = None
    shutter_speed: float | None = None  # seconds
    iso: int | None = None
    aperture: float | None = None  # f-number
    exposure_compensation: float | None = None  # EV stops
    camera_model: str | None = None
    width: int | None = None
    height: int | None = None
    brightness_ev: float = 0.0
    raw: dict = field(default_factory=dict)


def _rational_to_float(value) -> float | None:
    if value is None:
        return None
    try:
        num, den = value
        if den == 0:
            return None
        return num / den
    except (TypeError, ValueError):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


def _parse_datetime(raw_dt: bytes | str | None, subsec: bytes | str | None) -> datetime | None:
    if not raw_dt:
        return None
    if isinstance(raw_dt, bytes):
        raw_dt = raw_dt.decode(errors="ignore")
    raw_dt = raw_dt.strip().rstrip("\x00")
    if not raw_dt:
        return None
    try:
        dt = datetime.strptime(raw_dt, "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None

    if subsec:
        if isinstance(subsec, bytes):
            subsec = subsec.decode(errors="ignore")
        subsec = "".join(ch for ch in subsec if ch.isdigit())
        if subsec:
            micros = int(subsec.ljust(6, "0")[:6])
            dt = dt.replace(microsecond=micros)
    return dt


def _compute_brightness_ev(
    shutter_speed: float | None,
    aperture: float | None,
    iso: int | None,
    exposure_compensation: float | None,
) -> float:
    """Higher score == brighter exposure. Used to sort darkest -> brightest.

    Derived from EV100 = log2(N^2 / t) - log2(ISO/100); we negate it (and add
    exposure compensation) so the score increases with scene brightness,
    which lets brackets be sorted with a plain ascending sort.
    """
    score = 0.0
    if shutter_speed and shutter_speed > 0:
        score += math.log2(shutter_speed)
    if aperture and aperture > 0:
        score -= 2 * math.log2(aperture)
    if iso and iso > 0:
        score += math.log2(iso / 100.0)
    if exposure_compensation:
        score += exposure_compensation
    return score


def extract_exif(path: str) -> ExifData:
    result = ExifData()

    try:
        with Image.open(path) as img:
            result.width, result.height = img.size
    except Exception:
        pass

    try:
        exif_dict = piexif.load(path)
    except Exception:
        exif_dict = {"0th": {}, "Exif": {}, "1st": {}, "GPS": {}}

    zeroth = exif_dict.get("0th", {}) or {}
    exif_ifd = exif_dict.get("Exif", {}) or {}

    raw_dt = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal) or zeroth.get(
        piexif.ImageIFD.DateTime
    )
    subsec = exif_ifd.get(piexif.ExifIFD.SubSecTimeOriginal) or exif_ifd.get(
        piexif.ExifIFD.SubSecTime
    )
    result.capture_time = _parse_datetime(raw_dt, subsec)

    result.shutter_speed = _rational_to_float(exif_ifd.get(piexif.ExifIFD.ExposureTime))
    result.aperture = _rational_to_float(exif_ifd.get(piexif.ExifIFD.FNumber))

    iso_raw = exif_ifd.get(piexif.ExifIFD.ISOSpeedRatings)
    if isinstance(iso_raw, (list, tuple)) and iso_raw:
        iso_raw = iso_raw[0]
    result.iso = int(iso_raw) if iso_raw else None

    result.exposure_compensation = _rational_to_float(
        exif_ifd.get(piexif.ExifIFD.ExposureBiasValue)
    )

    model_raw = zeroth.get(piexif.ImageIFD.Model)
    if isinstance(model_raw, bytes):
        model_raw = model_raw.decode(errors="ignore").strip().rstrip("\x00")
    result.camera_model = model_raw or None

    result.brightness_ev = _compute_brightness_ev(
        result.shutter_speed,
        result.aperture,
        result.iso,
        result.exposure_compensation,
    )

    result.raw = {
        "shutter_speed": result.shutter_speed,
        "aperture": result.aperture,
        "iso": result.iso,
        "exposure_compensation": result.exposure_compensation,
        "camera_model": result.camera_model,
        "capture_time": result.capture_time.isoformat() if result.capture_time else None,
    }

    return result
