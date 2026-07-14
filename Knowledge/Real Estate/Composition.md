# Composition

Not yet documented as an explicit shot list in the codebase — this file is a placeholder to fill
in with PK Visuals' actual composition rules (room-by-room shot angles, lens choice per space,
vertical/horizontal lines, staging checks before shutter).

Related, already-codified logic to reuse rather than duplicate:
- `quickreel/packages/story-engine` — cinematic room ordering / hero-shot detection logic, which
  encodes *sequencing* judgement (which room photo leads, which follows) even though it operates
  on already-shot photos rather than guiding the shoot itself.
- `quickreel/packages/vision` — room classification + photo quality scoring; worth mining for
  composition heuristics if it scores things like framing/exposure.

When this file gets filled in with real shot-composition rules, feed it into
`Software/Screens.md` / any future "AI Photo Assistant" (roadmap Phase 5) as its knowledge base.
