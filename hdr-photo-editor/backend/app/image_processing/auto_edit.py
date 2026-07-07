"""Real-estate specific auto-edit pipeline.

Design goals (per product spec): natural tone mapping, no fake-HDR halos,
no oversaturation, neutral walls, preserved window/highlight detail, mild
sharpening/denoise only. Every step below works on 8-bit BGR numpy arrays
(OpenCV convention) and is intentionally global/soft rather than aggressive
local contrast, since local-contrast HDR tone-mapping is what produces the
"fake HDR halo" look this product explicitly avoids.
"""

from __future__ import annotations

import cv2
import numpy as np


def correct_white_balance(img_bgr: np.ndarray, strength: float = 0.6) -> np.ndarray:
    """Neutralize yellow/green colour casts using a luminance-weighted
    gray-world correction in LAB space.

    Only midtones/highlights are pulled toward neutral (weighted by L), which
    targets walls/ceilings without flattening intentionally warm materials
    like wood floors that sit mostly in the shadows/midtones of the frame.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l, a, b = cv2.split(lab)

    avg_a = float(np.mean(a)) - 128.0
    avg_b = float(np.mean(b)) - 128.0

    weight = (l / 255.0) * strength
    a = a - avg_a * weight
    b = b - avg_b * weight

    lab = cv2.merge([l, np.clip(a, 0, 255), np.clip(b, 0, 255)])
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def apply_tone_curve(
    img_bgr: np.ndarray,
    shadow_lift: float = 0.12,
    highlight_rolloff: float = 0.18,
) -> np.ndarray:
    """Lift shadows and gently roll off highlights via an S-curve applied to
    the luminance channel only, so hue/saturation stay put (avoids the
    "washed out wall" look of applying curves per RGB channel).
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l, a, b = cv2.split(lab)

    x = np.array([0, 32, 64, 128, 192, 224, 255], dtype=np.float32)
    y = np.array(
        [
            0,
            32 + shadow_lift * 60,
            64 + shadow_lift * 30,
            128,
            192 - highlight_rolloff * 40,
            224 - highlight_rolloff * 55,
            255 - highlight_rolloff * 20,
        ],
        dtype=np.float32,
    )
    y = np.clip(y, 0, 255)

    lut = np.interp(np.arange(256), x, y).astype(np.float32)
    l_new = lut[np.clip(l, 0, 255).astype(np.uint8)]

    lab = cv2.merge([l_new, a, b])
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def recover_highlights(img_bgr: np.ndarray, threshold: int = 232, strength: float = 0.45) -> np.ndarray:
    """Soften near-blown highlights (windows, sky) so detail survives.

    Uses a smooth, edge-free mask based purely on brightness (no local
    contrast/unsharp trick), which avoids halo artifacts around window
    frames that local tone-mapping tends to create.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mask = np.clip((gray - threshold) / max(255 - threshold, 1), 0, 1) ** 1.5

    img_f = img_bgr.astype(np.float32)
    darkened = img_f * 0.72
    mask3 = mask[..., None] * strength
    result = img_f * (1 - mask3) + darkened * mask3
    return np.clip(result, 0, 255).astype(np.uint8)


def clamp_saturation(img_bgr: np.ndarray, max_scale: float = 1.05, target_scale: float = 0.96) -> np.ndarray:
    """Keep colours realistic: mild global desaturation to counteract the
    saturation boost that exposure fusion / tone curves tend to introduce.
    """
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = cv2.split(hsv)
    s = np.clip(s * target_scale, 0, 255)
    hsv = cv2.merge([h, s, v])
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def sharpen_and_denoise(
    img_bgr: np.ndarray,
    denoise_strength: float = 3.0,
    sharpen_amount: float = 0.35,
) -> np.ndarray:
    """Mild noise reduction followed by a light unsharp mask. Kept subtle on
    purpose -- real estate photos should look crisp, not "processed".
    """
    denoised = cv2.fastNlMeansDenoisingColored(
        img_bgr, None, denoise_strength, denoise_strength, 7, 21
    )
    blurred = cv2.GaussianBlur(denoised, (0, 0), sigmaX=1.6)
    sharpened = cv2.addWeighted(denoised, 1 + sharpen_amount, blurred, -sharpen_amount, 0)
    return sharpened


def apply_real_estate_auto_edit(
    img_bgr: np.ndarray,
    *,
    shadow_lift: float = 0.12,
    highlight_rolloff: float = 0.18,
    wb_strength: float = 0.6,
) -> np.ndarray:
    """Full auto-edit pipeline shared by both the HDR-merged path and the
    single-image path (spec: 'apply clean architectural auto-edit')."""
    img = correct_white_balance(img_bgr, strength=wb_strength)
    img = apply_tone_curve(img, shadow_lift=shadow_lift, highlight_rolloff=highlight_rolloff)
    img = recover_highlights(img)
    img = clamp_saturation(img)
    img = sharpen_and_denoise(img)
    return img
