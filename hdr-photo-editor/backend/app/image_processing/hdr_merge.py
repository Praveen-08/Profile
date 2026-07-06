"""HDR bracket alignment + exposure fusion for architectural interiors.

We deliberately use exposure fusion (Mertens) rather than
merge-to-radiance-map + global tonemap: Mertens blends well-exposed regions
of each bracket directly in LDR space, which is what keeps the result
looking like a great single exposure instead of "fake HDR". Alignment runs
first to correct the small handheld/tripod-vibration shifts between shots
in a bracket, which is what actually causes halos if skipped.
"""

from __future__ import annotations

import cv2
import numpy as np

from app.image_processing.auto_edit import apply_real_estate_auto_edit


def load_image(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {path}")
    return img


def align_images(images: list[np.ndarray]) -> list[np.ndarray]:
    align_mtb = cv2.createAlignMTB()
    # cv2's vector<Mat> out-param needs pre-shaped placeholders -- passing an
    # empty list silently leaves it empty instead of raising.
    aligned = [np.empty_like(img) for img in images]
    align_mtb.process(images, aligned)
    return aligned


def merge_exposures(images_dark_to_bright: list[np.ndarray]) -> np.ndarray:
    """Align + Mertens-fuse a bracket already sorted darkest -> brightest.

    Weights are tuned conservatively (moderate saturation/exposure weight)
    to avoid the oversaturated, halo-prone look of default HDR presets.
    """
    if len(images_dark_to_bright) < 2:
        return images_dark_to_bright[0]

    aligned = align_images(images_dark_to_bright)

    merge_mertens = cv2.createMergeMertens(
        contrast_weight=1.0,
        saturation_weight=0.9,
        exposure_weight=0.8,
    )
    fusion = merge_mertens.process(aligned)
    fusion_8bit = np.clip(fusion * 255, 0, 255).astype(np.uint8)
    return fusion_8bit


def process_hdr_group(image_paths_dark_to_bright: list[str]) -> np.ndarray:
    """Full pipeline for an HDR-ready group: load -> align -> fuse -> edit."""
    images = [load_image(p) for p in image_paths_dark_to_bright]
    merged = merge_exposures(images)
    return apply_real_estate_auto_edit(merged, shadow_lift=0.1, highlight_rolloff=0.2)


def process_single_image(image_path: str) -> np.ndarray:
    """Pipeline for a Single Edit photo: no merge, same auto-edit look."""
    img = load_image(image_path)
    return apply_real_estate_auto_edit(img, shadow_lift=0.16, highlight_rolloff=0.16)
