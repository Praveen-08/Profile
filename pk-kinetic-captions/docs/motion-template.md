# The PK Kinetic Caption Motion title

**You do not need this to use PK Kinetic Captions.** The default export
profile (`native`) drives Final Cut's own Basic Title and reproduces
everything the design engine plans: per-word font, weight, width, case,
size, colour, tracking, outline, shadow, position, scale, opacity and blend
mode. Install nothing, and the plugin works.

This document describes the optional Motion title that adds the three things
a stock title cannot do.

## What it adds

| Capability | Native profile | PK title |
|---|---|---|
| Position, scale, opacity keyframes | yes | yes |
| Blend modes (Invert, Ghost, Ink, Knockout…) | yes | yes |
| Font, weight, width, case, tracking per word | yes | yes |
| Outline and shadow | yes | yes |
| **Blur-to-sharp entrances** | no | yes |
| **Mask reveals / mask exits** | no | yes |
| **Per-character hero animation** | no | yes |

When you export with `--profile native` the composer does not put blur,
mask-reveal or per-character motion into the plan at all — so the preview
never promises motion the timeline will not deliver. `--profile pk` enables
them.

## Status

This release does not ship a prebuilt `.moti`. A Motion template is a Motion
document, and one authored blind — without Motion available to open, verify
and round-trip it — would be a file that might silently fail to import. The
specification below is exact enough to build in Motion in about twenty
minutes, and `pkkc install --bundle <file.moti>` puts the result where Final
Cut looks for it.

## Build specification

Create in Motion: **File ▸ New ▸ Final Cut Title**, at 1920×1080, 30fps.

Save to category **PK Visuals**, name **PK Kinetic Caption**. That produces:

```
~/Movies/Motion Templates.localized/Titles.localized/
  PK Visuals.localized/
    PK Kinetic Caption.localized/
      PK Kinetic Caption.moti
```

### Layers

One text layer named `Word`, centred, with:

- **Layout**: Type ▸ Paragraph, alignment Centre, no auto-shrink.
- **Behaviours**: none. The exporter supplies every keyframe; a built-in
  Build In/Out would double up with it.
- **Filters**: one *Gaussian Blur* on the text layer, amount published.

### Published parameters

The exporter writes these by name, so the names must match exactly.

| Published name | Type | Range | Driven by |
|---|---|---|---|
| `Text` | text | — | the word |
| `Blur` | number | 0–60 | blur entrances and exits |
| `Reveal` | number | 0–100 | mask reveal, as a left-to-right wipe |
| `Character Delay` | number | 0–0.2 | per-character hero animation |

Position, scale, opacity and blend are **not** published: they are applied by
Final Cut to the clip itself via `adjust-transform` and `adjust-blend`, which
is why the native profile works at all.

### Mask reveal

Add a rectangle mask to the text layer. Rig `Reveal` (0–100) to the mask's
right edge so 0 hides the word entirely and 100 shows it fully. Use a linear
rig so the exporter's baked keyframes land where they should.

### Verifying

```bash
pkkc install --bundle ~/Desktop/PK\ Kinetic\ Caption.moti
pkkc check                      # should report: PK Motion title  installed
pkkc generate script.txt --profile pk --template pk-editorial
```

Import the FCPXML. If a clip appears with the right text but no blur, the
`Blur` parameter is published under a different name — check it in Motion's
Rig/Published Parameters list.

## If you would rather not build it

Use the native profile. Of the seven animation styles, only *editorial*,
*cinematic* and *luxury* use blur at all, and only as a small amount on
emphasis and hero words. They are designed to read without it.
