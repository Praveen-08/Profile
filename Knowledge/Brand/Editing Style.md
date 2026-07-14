# Editing Style

## Photography (from `services.html` + `hdr-photo-editor/`)
- HDR interior & exterior blending is the baseline for every shoot, not an upsell.
- Twilight/golden-hour treatment available as its own premium look (see `Real
  Estate/Twilight.md`).
- The repo has a dedicated internal tool for this: `hdr-photo-editor/` (Next.js + FastAPI MVP) —
  the codified version of PK Visuals' HDR editing process. Treat that tool's pipeline as the
  source of truth for "what HDR editing means" for this brand once it's fleshed out further; this
  file should be updated to describe its actual blend/exposure logic as that tool matures.

## Video (from `services.html`)
- 4K cinematic walkthroughs, smooth camera movement, natural light, licensed music.
- Story-driven, not a raw walkthrough — see `Real Estate/Video Guide.md`.

## Reels / QuickReel (from `quickreel/README.md`)
QuickReel's **AI Director Engine** is the codified version of "how PK Visuals would cut a reel,"
broken into composable rule-based engines:
- `story-engine` — dedup, hero-shot detection, cinematic room ordering
- `camera-engine` — ~18-movement catalog, per-room selection
- `transition-engine` — room-relationship-aware transitions
- `hook-engine` — first-2-second opening sequence generation/ranking
- `timing-engine` — reel length → clip count → beat-duration allocation
- `music-engine` — 10-vibe music catalog + track selection
- `beat-engine` — beat-grid snapping/quantizing

Critical constraint: QuickReel **never alters a pixel of the source photos** — only camera
motion, transitions, and typography are synthesized. This is a brand promise (the photography
itself is never AI-manipulated) as much as a technical one — keep it true in any future engine
work.
