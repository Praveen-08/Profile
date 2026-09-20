# Telling the engine what is in the shot

Subject-aware placement, face avoidance and behind-subject typography all
need to know where the person is. PK Kinetic Captions does not run a face
detector — Final Cut already has one, and duplicating it would mean shipping
a model and a video decoder. Instead it accepts an analysis file.

## Format

```json
[
  {
    "start": 0,
    "end": 8.4,
    "kind": "talkingHead",
    "face":    { "x":  0.10, "y":  0.20, "w": 0.22, "h": 0.16 },
    "subject": { "x":  0.18, "y": -0.05, "w": 0.50, "h": 0.80 },
    "subjectColour": { "r": 0.08, "g": 0.72, "b": 0.65, "a": 1 }
  },
  { "start": 8.4, "end": 19.0, "kind": "drone" },
  { "start": 19.0, "end": 31.2, "kind": "property" }
]
```

Pass it with `--shots shots.json`.

### Coordinates

Normalised, **origin at the centre of the frame**, `+x` right, `+y` up, each
axis running −0.5 to 0.5. A face in the upper right is around
`{ "x": 0.2, "y": 0.2 }`. Sizes are fractions of the frame.

This is resolution- and aspect-independent on purpose: one analysis file
works for the 9:16 cut and the 16:9 cut of the same footage.

### Fields

| Field | Required | Effect |
|---|---|---|
| `start`, `end` | yes | Seconds on the timeline. |
| `kind` | no | `talkingHead`, `property`, `drone`, `lifestyle`, `unknown`. Drone and property shots invite larger, more central type. |
| `face` | no | Normal captions keep clear of it. Hero type may cross it when the style sets `heroMayOverlap`. |
| `subject` | no | Type is pushed into the empty side of the frame. |
| `subjectColour` | no | Offered in the interface as a suggested accent. Never applied on its own. |

Everything except `start` and `end` is optional, and the engine degrades
cleanly: with no analysis at all it uses the template's static composition,
which is what most listing footage wants anyway.

## Getting the numbers

- **By eye.** Pause on a representative frame, estimate. The engine only
  needs to know which side the subject is on; it is not doing compositing.
- **From a detector you already run.** Most face detectors return pixel
  boxes. Convert with `x = (cx / width) - 0.5`, `y = 0.5 - (cy / height)`,
  `w = boxWidth / width`, `h = boxHeight / height`.

## Text behind the subject

Set `interaction.heroBehindSubject` (Advanced ▸ Subject interaction, or
`--behind-subject`). The exporter then places hero type on a **negative
lane**, below the storyline.

Final Cut needs one more thing that FCPXML cannot express: the subject has to
be cut out of a copy of the shot sitting above the type. In Final Cut:

1. Select the shot, ⌥-drag a copy to the lane directly above the type.
2. Apply **Magnetic Mask** to the top copy and click the person.
3. The type is now sandwiched: background plate, type, isolated subject.

The exporter builds the lane structure and says so in its warnings; the mask
is the one step that stays manual, because it is the one step Final Cut does
better than any file format could describe.
