# HDR Architectural Photo Editor

An AI-assisted HDR photo editor built specifically for real estate and architectural
photographers. Upload bracketed exposures from a shoot, the app groups them by EXIF
capture time, merges each bracket into a natural (not "fake HDR") exposure, applies a
clean architectural auto-edit, and exports listing-ready JPEGs.

This is not a general photo editor — there are no manual sliders, layers, or presets.
The entire product surface is: upload → review groups → process → compare → export.

## How it works

1. **Upload** — drop every bracketed exposure from the shoot: JPEG/PNG/TIFF or
   camera RAW (CR2/CR3/NEF/ARW/RAF/RW2/ORF/DNG/PEF/SRW).
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

## Deploying a live/public instance

This repo has other apps in it with their own Vercel projects already wired up
(e.g. `listing-launch-os`) — those are unrelated. The HDR editor needs its own,
separate Vercel project (for the frontend) plus a real backend host, since the
backend is a stateful Python service (SQLite, local file storage, an RQ worker),
not something Vercel's serverless functions are built for.

### Backend → Render

A Blueprint is included at `hdr-photo-editor/render.yaml` covering the API web
service, the RQ worker, and a Redis instance.

1. In the Render dashboard: **New → Blueprint**, connect the `Praveen-08/Profile`
   repo.
2. When asked for the blueprint file location, enter `hdr-photo-editor/render.yaml`
   (it's not at the repo root, since this repo has other unrelated apps in it).
3. Deploy. You'll get a URL like `https://hdr-photo-editor-api.onrender.com`.
4. Note the free-tier tradeoffs called out in the blueprint's comments: cold
   starts after inactivity, and ephemeral disk (uploaded/processed photos are
   lost on restart/redeploy unless you add a paid Render Disk).

### Frontend → Vercel

1. https://vercel.com/new → import `Praveen-08/Profile` **again** (a second,
   separate project) → set **Root Directory** to `hdr-photo-editor/frontend`.
2. Add environment variable `NEXT_PUBLIC_API_BASE_URL` = your Render backend URL
   from above (e.g. `https://hdr-photo-editor-api.onrender.com`). This is a
   build-time variable for Next.js, so it must be set before/at deploy.
3. Deploy.

### Wire them together

Back in Render, update the `HDR_CORS_ORIGINS` env var on `hdr-photo-editor-api`
to your Vercel URL (comma-separate multiple origins if needed), then redeploy
the API service so CORS allows requests from the deployed frontend.

## Notes on the current MVP

- **Storage** is local disk under `backend/storage/` (uploads, processed output,
  thumbnails), matching the "local storage first" requirement. Swapping to
  Cloudflare R2/S3 later only touches `app/storage.py`.
- **Database** is SQLite by default (`HDR_DATABASE_URL` env var to override,
  e.g. to point at Postgres).
- The auto-edit pipeline is intentionally global/soft (curves and masks, not local
  contrast) — that's a deliberate trade-off to avoid halos, per the product spec.
- **RAW support** decodes via `rawpy` (LibRaw) with `use_camera_wb=True` and
  `no_auto_bright=True` so exposure differences between bracket shots are
  preserved for HDR fusion instead of being auto-normalized away. EXIF for RAW
  files goes through `exifread` rather than `piexif`, since vendor RAW
  containers don't parse reliably with a JPEG/TIFF-focused library. This has
  been verified against real logic (extension detection, tag parsing, path
  dispatch) but not against a real camera RAW file in this dev environment —
  test it with one of your own bracket RAW files and flag anything that looks
  off.
