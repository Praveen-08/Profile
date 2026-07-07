import uuid
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.config import settings

THUMBNAIL_MAX_SIDE = 480


def project_upload_dir(project_id: str) -> Path:
    path = settings.uploads_dir / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_processed_dir(project_id: str) -> Path:
    path = settings.processed_dir / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def project_thumbnail_dir(project_id: str) -> Path:
    path = settings.thumbnails_dir / project_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def unique_filename(original_filename: str) -> str:
    suffix = Path(original_filename).suffix.lower() or ".jpg"
    return f"{uuid.uuid4().hex}{suffix}"


def save_upload(project_id: str, original_filename: str, data: bytes) -> Path:
    dest = project_upload_dir(project_id) / unique_filename(original_filename)
    dest.write_bytes(data)
    return dest


def generate_thumbnail(source_path: Path, project_id: str) -> Path:
    thumb_path = project_thumbnail_dir(project_id) / f"{source_path.stem}.jpg"
    with Image.open(source_path) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE))
        img.save(thumb_path, "JPEG", quality=82)
    return thumb_path


def save_processed_jpeg(img_bgr: np.ndarray, project_id: str, name: str, quality: int = 95) -> Path:
    dest = project_processed_dir(project_id) / f"{name}.jpg"
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    ok = cv2.imwrite(str(dest), img_bgr, encode_params)
    if not ok:
        raise IOError(f"Failed to write processed image to {dest}")
    return dest


def save_processed_thumbnail(img_bgr: np.ndarray, project_id: str, name: str) -> Path:
    dest = project_thumbnail_dir(project_id) / f"{name}_out.jpg"
    h, w = img_bgr.shape[:2]
    scale = THUMBNAIL_MAX_SIDE / max(h, w)
    if scale < 1:
        img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(dest), img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return dest
