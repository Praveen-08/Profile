# QuickReel AI service

Python/FastAPI. The one genuinely Python-only surface in the system:
librosa-backed tempo/beat/energy analysis. Everything else in the AI
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

## Honest gap: drop detection

There is no trained transient/drop detector here. `_detect_drop` in
`beat_analysis.py` is a heuristic: the sharpest positive jump in the
smoothed energy envelope, only accepted if it clears a fixed multiple of
the track's typical frame-to-frame energy change. It works reasonably well
on tracks with an obvious build-and-release structure and returns `null`
otherwise — `MusicTrack.manualDropSec` exists specifically as a
human-authored override for tracks where this heuristic misfires.
