# @quickreel/vision

Photo analysis: room classification, the seven quality signals, and
perceptual hashing for dedup.

## The honest gap

Sharpness, brightness, composition, leading lines, visual impact, and the
perceptual hash are all computed directly from pixels with `sharp`
(Laplacian-variance sharpness, Sobel directional energy, a rule-of-thirds
energy grid, an 8x8 average hash) and work identically with or without an
OpenAI key.

**Room classification is different.** Without `OPENAI_API_KEY`, the
heuristic adapter (`classifiers/heuristic.ts`) can only detect sky —
distinguishing exterior-daytime / twilight / night from "probably indoors,
can't tell" (`UNKNOWN`, confidence `0`). It genuinely cannot tell a kitchen
from a bedroom from pixel statistics alone, and does not pretend to. Set
`OPENAI_API_KEY` to get real classification across the full 21-room-type
catalog via `classifiers/openai.ts`.

`luxuryAppeal` is similarly upgraded: the heuristic adapter derives it from
exposure/composition/colorfulness as a rough proxy; the OpenAI adapter asks
the model to judge it directly.
