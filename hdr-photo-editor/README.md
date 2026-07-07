# HDR Architectural Photo Editor

An AI-assisted HDR photo editor built specifically for real estate and architectural
photographers. Upload bracketed exposures from a shoot, the app groups them by EXIF
capture time, merges each bracket into a natural (not "fake HDR") exposure, applies a
clean architectural auto-edit, and exports listing-ready JPEGs.

This is not a general photo editor — there are no manual sliders, layers, or presets.
The entire product surface is: upload → review groups → process → compare → export.

## How it works

1. **Upload** — drop every bracketed exposure from the shoot (JPEG/PNG/TIFF).
2. **Auto grouping** — the backend reads each photo's EXIF (capture time, shutter
   speed, ISO, aperture, exposure compensation, camera model) and clusters photos
   whose capture times fall within a configurable window (default 3s). Within each
   group, photos are sorted darkest → brightest using a computed exposure-value score
   (shutter speed + aperture + ISO + exposure bias), not just filename order.
   - 1 photo → **Single Edit**
   - 3 or 5 photos → **HDR Ready**
   - 2, 4, or 6+ photos → **Needs Review** (ambiguous bracket, needs a human)
3. **Manual correction** — split a group, merge groups, drag a photo onto another
   group's card to move it, or remove a photo into its own group. Every correction
   immediately re-derives the group's status from its new photo count.
4. **HDR processing** — HDR Ready groups are aligned (`cv2.AlignMTB`) and exposure-fused
   (`cv2.MergeMertens`), then run through a shared auto-edit pipeline: white-balance
   cast removal, a shadow-lift/highlight-rolloff tone curve, highlight recovery for
   blown windows, mild saturation clamping, and light sharpening/denoise. Single Edit
   photos go through the same auto-edit pipeline without the merge step.
5. **Before/after preview** — a draggable slider compares the original exposure
   against the finished edit per group.
6. **Export** — download an individual group's JPEG or a ZIP of everything that's
   been processed.

### Why exposure fusion instead of "real" HDR tonemapping

The spec explicitly rules out the "fake HDR" look (halos, oversaturation, crunchy
local contrast). `cv2.MergeMertens` blends the well-exposed regions of each bracket
directly in LDR space instead of building a 32-bit radiance map and globally
tonemapping it — that's what keeps results looking like a great single exposure
rather than an HDR preset. Alignment runs first because handheld/tripod vibration
between shots in a bracket is what actually causes ghosting/halos if skipped.

## Project structure

```
hdr-photo-editor/
├── backend/                  FastAPI + SQLAlchemy + OpenCV
│   ├── app/
│   │   ├── main.py           FastAPI app, CORS, static file mounts
│   │   ├── config.py         Settings (storage paths, DB url, Redis url, defaults)
│   │   ├── database.py       SQLAlchemy engine/session
│   │   ├── models.py         Project / Group / Photo ORM models
│   │   ├── schemas.py        Pydantic response models
│   │   ├── serializers.py    ORM -> API response conversion (incl. media URLs)
│   │   ├── exif_utils.py     EXIF extraction + exposure-value scoring (piexif)
│   │   ├── grouping.py       Auto-grouping algorithm + manual split/merge/move
│   │   ├── storage.py        File paths, thumbnail generation, JPEG export
│   │   ├── redis_conn.py     Redis connection helper
│   │   ├── worker.py         RQ job: HDR merge / single-edit processing
│   │   ├── image_processing/
│   │   │   ├── hdr_merge.py  Align + Mertens fusion pipeline
│   │   │   └── auto_edit.py  White balance, tone curve, highlight recovery, etc.
│   │   └── routers/
│   │       ├── upload.py     Project + photo upload endpoints
│   │       ├── groups.py     List / rerun / split / merge / move endpoints
│   │       ├── process.py    Enqueue processing, poll status
│   │       └── export.py     Download single JPEG / ZIP of all processed
│   ├── tests/                 Unit tests for grouping + manual correction
│   └── requirements.txt
└── frontend/                  Next.js (App Router) + Tailwind
    ├── app/
    │   ├── page.tsx            1. Upload
    │   ├── groups/page.tsx      2. Auto grouping review (+ manual correction)
    │   ├── processing/page.tsx  3. HDR processing
    │   ├── preview/page.tsx     4. Before/after
    │   └── export/page.tsx      5. Export/download
    ├── components/              Shared UI (group cards, sliders, shadcn-style primitives)
    └── lib/                     API client, types, formatting helpers
```

## Running it locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis (optional — see "Background jobs" below)

### 1. Backend

```bash
cd hdr-photo-editor/backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (health check: `GET /api/health`).
SQLite database and uploaded/processed files are created automatically under
`backend/storage/`.

### 2. Background jobs (Redis + RQ)

Image processing runs as a background job so uploads and grouping stay snappy.

```bash
# Terminal 2: Redis
redis-server

# Terminal 3: RQ worker
cd hdr-photo-editor/backend
source .venv/bin/activate
python -m app.worker
```

**If you don't have Redis running**, the app still works: `process.py` checks
Redis connectivity before enqueueing, and falls back to running the job inline via
FastAPI `BackgroundTasks` if Redis is unreachable. This is meant for quick local
testing only — for anything beyond a couple of photos, run Redis + the RQ worker so
processing doesn't block other requests.

### 3. Frontend

```bash
cd hdr-photo-editor/frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`. Create a project, upload a bracketed shoot, and walk
through Upload → Auto Grouping → Processing → Before/After → Export.

### Running the backend tests

```bash
cd hdr-photo-editor/backend
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Tests cover the pure grouping algorithm (range-based clustering, darkest→brightest
sorting, HDR Ready/Single Edit/Needs Review classification) and the manual
split/merge/move operations against a real (in-memory) database.

## Notes on the current MVP

- **Storage** is local disk under `backend/storage/` (uploads, processed output,
  thumbnails), matching the "local storage first" requirement. Swapping to
  Cloudflare R2/S3 later only touches `app/storage.py`.
- **Database** is SQLite by default (`HDR_DATABASE_URL` env var to override,
  e.g. to point at Postgres).
- The auto-edit pipeline is intentionally global/soft (curves and masks, not local
  contrast) — that's a deliberate trade-off to avoid halos, per the product spec.
