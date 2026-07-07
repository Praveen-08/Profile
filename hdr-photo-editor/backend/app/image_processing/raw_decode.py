"""Camera RAW handling (CR2/CR3/NEF/ARW/RAF/RW2/ORF/DNG/PEF/SRW).

OpenCV/Pillow can't read camera RAW containers, so decoding goes through
`rawpy` (a wrapper around LibRaw). Two things matter for bracket HDR merging
specifically:

- `no_auto_bright=True` -- LibRaw's default auto-brightness would normalize
  each exposure to look similarly bright, which destroys the exposure
  differences Mertens fusion needs to work with.
- `use_camera_wb=True` -- uses the as-shot white balance from the shoot
  (consistent across the whole bracket) rather than per-image auto white
  balance, which could drift shot-to-shot.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import rawpy

RAW_EXTENSIONS = {
    ".cr2", ".cr3",  # Canon
    ".nef",          # Nikon
    ".arw",          # Sony
    ".raf",          # Fujifilm
    ".rw2",          # Panasonic
    ".orf",          # Olympus
    ".dng",          # Adobe / universal
    ".pef",          # Pentax
    ".srw",          # Samsung
}


def is_raw(path: str) -> bool:
    return Path(path).suffix.lower() in RAW_EXTENSIONS


def raw_dimensions(path: str) -> tuple[int, int]:
    """Width/height without a full demosaic decode."""
    with rawpy.imread(path) as raw:
        return raw.sizes.width, raw.sizes.height


def decode_raw_to_bgr(path: str) -> np.ndarray:
    """Full demosaic decode to an 8-bit BGR array (OpenCV convention)."""
    with rawpy.imread(path) as raw:
        rgb = raw.postprocess(
            use_camera_wb=True,
            no_auto_bright=True,
            output_bps=8,
        )
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def extract_raw_preview_rgb(path: str) -> np.ndarray | None:
    """Fast path for thumbnails: pull the embedded JPEG/bitmap preview instead
    of doing a full demosaic decode. Returns an RGB uint8 array, or None if
    the RAW file has no usable embedded preview.
    """
    with rawpy.imread(path) as raw:
        try:
            thumb = raw.extract_thumb()
        except rawpy.LibRawNoThumbnailError:
            return None
        except rawpy.LibRawUnsupportedThumbnailError:
            return None

    if thumb.format == rawpy.ThumbFormat.JPEG:
        arr = np.frombuffer(thumb.data, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if thumb.format == rawpy.ThumbFormat.BITMAP:
        return thumb.data
    return None
