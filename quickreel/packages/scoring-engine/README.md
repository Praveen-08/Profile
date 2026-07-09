# @quickreel/scoring-engine

Computes the **AI Reel Score** shown on every completed render: six 0-100
sub-scores plus an overall composite and plain-language recommendations.

## Honest gap

`viewerRetentionPrediction` is named to match the product spec, but this
package does **not** run a model trained on real viewer engagement/watch-time
data — there is no such dataset available in this build. Every sub-score,
including that one, is a deterministic heuristic computed directly from the
resolved EDL, the beat grid it was cut to, and the style it was cut with:

- **storytellingScore** — hook-shot strength (does the reel open on an
  exterior/drone/twilight shot?) and room-type diversity across clips.
- **beatSyncScore** — how close each clip boundary lands to the nearest beat
  timestamp in the beat grid, normalized by the beat interval.
- **luxuryScore** — average clip hold length, whether the style enables
  atmospheric effects, and the style's global motion intensity.
- **motionQualityScore** — how often consecutive clips repeat the same
  camera movement, and how often clips use a "cinematic" easing curve
  (`cinematicEaseInOut`/`momentumOut`/`craneEase`) rather than `linear`.
- **viewerRetentionPrediction** — a proxy built from hook strength, opening
  pace, and total duration fit — not a fitted model.
- **socialMediaScore** — vertical aspect ratio, total duration, and CTA
  presence.

This mirrors the same disclosure pattern used elsewhere in this repo:
packages/vision's heuristic room-classification fallback, and
apps/ai-service's depth-estimation sandbox note. If a real
watch-time-labeled dataset becomes available, `viewerRetentionPrediction`
is the field to replace with an actual trained model — the six-sub-score
shape and the 0-100 range are designed to stay stable across that swap.

## Usage

```ts
import { scoreReel } from "@quickreel/scoring-engine";

const score = scoreReel({ edl, beatGrid, style });
// { scoreVersion, storytellingScore, beatSyncScore, luxuryScore,
//   motionQualityScore, viewerRetentionPrediction, socialMediaScore,
//   overallScore, recommendations }
```

Called once per completed render, in `apps/worker`'s render-video
processor, right after the output MP4 is uploaded. The result is stored
verbatim on `Render.scoreJson`.
