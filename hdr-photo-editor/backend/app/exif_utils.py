"""EXIF extraction for bracketed real-estate photos.

JPEG/PNG/TIFF go through piexif, which gives raw, uncooked access to the
standard EXIF IFDs (rationals as (numerator, denominator) tuples) -- exactly
what we need for our own exposure-value math. Camera RAW files (CR2/NEF/ARW/
DNG/...) don't reliably parse with piexif across vendors, so those go through
`exifread` instead, which is built specifically to handle RAW containers.
Both paths normalize down to the same raw (dt, subsec, shutter, aperture,
iso, exposure_bias, model) tuple before any conversion happens.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime

import exifread
import piexif
from PIL import Image

from app.image_processing.raw_decode import is_raw, raw_dimensions


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


def _extract_via_piexif(path: str) -> tuple:
    try:
        exif_dict = piexif.load(path)
    except Exception:
        exif_dict = {"0th": {}, "Exif": {}, "1st": {}, "GPS": {}}

    zeroth = exif_dict.get("0th", {}) or {}
    exif_ifd = exif_dict.get("Exif", {}) or {}

    raw_dt = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal) or zeroth.get(piexif.ImageIFD.DateTime)
    subsec = exif_ifd.get(piexif.ExifIFD.SubSecTimeOriginal) or exif_ifd.get(
        piexif.ExifIFD.SubSecTime
    )
    shutter = exif_ifd.get(piexif.ExifIFD.ExposureTime)
    aperture = exif_ifd.get(piexif.ExifIFD.FNumber)

    iso_raw = exif_ifd.get(piexif.ExifIFD.ISOSpeedRatings)
    if isinstance(iso_raw, (list, tuple)) and iso_raw:
        iso_raw = iso_raw[0]
    iso = int(iso_raw) if iso_raw else None

    exposure_bias = exif_ifd.get(piexif.ExifIFD.ExposureBiasValue)

    model = zeroth.get(piexif.ImageIFD.Model)
    if isinstance(model, bytes):
        model = model.decode(errors="ignore").strip().rstrip("\x00")

    return raw_dt, subsec, shutter, aperture, iso, exposure_bias, model or None


def _exifread_ratio(tag) -> tuple | None:
    if tag is None:
        return None
    try:
        value = tag.values[0]
        return (value.num, value.den)
    except (AttributeError, IndexError, TypeError):
        try:
            return (int(str(tag)), 1)
        except ValueError:
            return None


def _exifread_int(tag) -> int | None:
    if tag is None:
        return None
    try:
        return int(tag.values[0])
    except (AttributeError, IndexError, TypeError, ValueError):
        try:
            return int(str(tag))
        except ValueError:
            return None


def _extract_via_exifread(path: str) -> tuple:
    with open(path, "rb") as f:
        tags = exifread.process_file(f, details=False)

    def get(*names):
        for name in names:
            if name in tags:
                return tags[name]
        return None

    dt_tag = get("EXIF DateTimeOriginal", "Image DateTime")
    subsec_tag = get("EXIF SubSecTimeOriginal", "EXIF SubSecTime")
    shutter_tag = get("EXIF ExposureTime")
    aperture_tag = get("EXIF FNumber")
    iso_tag = get("EXIF ISOSpeedRatings", "EXIF PhotographicSensitivity")
    bias_tag = get("EXIF ExposureBiasValue")
    model_tag = get("Image Model")

    raw_dt = str(dt_tag) if dt_tag else None
    subsec = str(subsec_tag) if subsec_tag else None
    shutter = _exifread_ratio(shutter_tag)
    aperture = _exifread_ratio(aperture_tag)
    iso = _exifread_int(iso_tag)
    exposure_bias = _exifread_ratio(bias_tag)
    model = str(model_tag).strip() if model_tag else None

    return raw_dt, subsec, shutter, aperture, iso, exposure_bias, model


def extract_exif(path: str) -> ExifData:
    result = ExifData()

    if is_raw(path):
        try:
            result.width, result.height = raw_dimensions(path)
        except Exception:
            pass
        try:
            raw_dt, subsec, shutter, aperture, iso, exposure_bias, model = _extract_via_exifread(path)
        except Exception:
            raw_dt = subsec = shutter = aperture = exposure_bias = model = None
            iso = None
    else:
        try:
            with Image.open(path) as img:
                result.width, result.height = img.size
        except Exception:
            pass
        raw_dt, subsec, shutter, aperture, iso, exposure_bias, model = _extract_via_piexif(path)

    result.capture_time = _parse_datetime(raw_dt, subsec)
    result.shutter_speed = _rational_to_float(shutter)
    result.aperture = _rational_to_float(aperture)
    result.iso = iso
    result.exposure_compensation = _rational_to_float(exposure_bias)
    result.camera_model = model

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
