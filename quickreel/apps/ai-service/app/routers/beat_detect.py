import os
import tempfile

import httpx
from fastapi import APIRouter, HTTPException

from app.beat_analysis import analyze_audio_file
from app.schemas import BeatDetectRequest

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/beat-detect")
async def beat_detect(request: BeatDetectRequest) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(request.audio_url)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch audio from {request.audio_url}: {exc}") from exc

    suffix = os.path.splitext(request.audio_url)[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    try:
        result = analyze_audio_file(tmp_path, source_track_id=request.track_slug)
    except Exception as exc:  # librosa/soundfile can raise a wide variety of decode errors
        raise HTTPException(status_code=422, detail=f"Failed to analyze audio: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    return result
