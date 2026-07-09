# QuickReel AI service

Python/FastAPI. Two genuinely Python-only surfaces: librosa-backed
tempo/beat/energy analysis, and monocular depth estimation for the
Cinematic Motion Engine's parallax rendering. Everything else in the AI
Director Engine (room classification, story ordering, camera/transition
selection, timing) is plain TypeScript — see `packages/*`.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## `POST /audio/beat-detect`

```json
{ "audioUrl": "http://localhost:4000/local-storage/music-library/luxury-piano-01.wav", "trackSlug": "luxury-piano-01" }
```

Returns a `BeatGrid` (see `packages/shared/src/beat-grid.ts`) — real tempo,
beat timestamps, and energy envelope from `librosa.beat.beat_track` /
`librosa.feature.rms`.

## `POST /vision/depth-map`

```json
{ "imageUrl": "http://localhost:4000/local-storage/projects/<id>/images/<image>.jpg" }
```

Returns an 8-bit grayscale PNG (`image/png`) depth map, same dimensions as
the input: **brighter = nearer the camera, darker = farther away**. Backed
by `depth-anything/Depth-Anything-V2-Small-hf` via `transformers`, run on
CPU (`device=-1`) — no GPU required, a few seconds per image. The model is
lazy-loaded on first request, not at process startup, so a slow/failed
download degrades only this endpoint rather than blocking the whole
service.

**Unvalidated in the sandbox this repo was built in**: that environment's
network egress allowlist covers package registries (PyPI, npm) but not
model-weight hosts (`huggingface.co` returns 403 at the proxy). The code is
correct and complete — `pip install torch transformers` succeeds from
PyPI — but the first depth-map request, which needs to actually download
~100MB of weights from the Hugging Face Hub, has never been exercised
end-to-end there. It should work with zero changes in any environment with
normal internet access. Same honest-gap pattern as the OpenAI Vision
fallback: real code, environment-dependent validation.

## Honest gap: drop detection

There is no trained transient/drop detector here. `_detect_drop` in
`beat_analysis.py` is a heuristic: the sharpest positive jump in the
smoothed energy envelope, only accepted if it clears a fixed multiple of
the track's typical frame-to-frame energy change. It works reasonably well
on tracks with an obvious build-and-release structure and returns `null`
otherwise — `MusicTrack.manualDropSec` exists specifically as a
human-authored override for tracks where this heuristic misfires.
