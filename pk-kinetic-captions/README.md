# PK Kinetic Captions

**Turn spoken words into designed motion typography, inside Final Cut Pro.**

PK Visuals · v1.1.0

Drop a clip in. Drop its captions beside it. Watch the type land on your
actual footage, click the words that matter, pull the accent colour out of
the shot, and export a Final Cut project.

It is not a subtitle tool. There is no mode in which every word comes out the
same size in the same place.

```bash
node bin/pkkc.js app     # builds the Mac app — then keep it in your dock
```

Nothing is uploaded. The video is read straight off your Mac and never
leaves it.

---

## 1. What was built

A complete caption design system: a rule-based engine, a design interface, a
command line, a persistent template store, and an FCPXML exporter.

**Engines** (`src/engine/`, one concern each, all pure functions)

| Engine | Decides |
|---|---|
| `phrasing` | Where speech breaks into visual phrases |
| `emphasis` | Which words are NORMAL, EMPHASIS or HERO |
| `typography` | Fonts, weights, widths, case, tracking, and point size |
| `layout` | Which zone a phrase occupies, and where each word sits in it |
| `motion` | Entrance and exit keyframes per word, per hierarchy level |
| `composite` | Blend modes, layer depth, and lane order |
| `fonts` | What this Mac can actually render |
| `compose` | Runs them in order and produces a `CaptionPlan` |

**Six built-in styles** — PK Editorial, PK Luxury, PK Modern, PK Minimal,
PK Bold, PK Real Estate. Each is a data file, not code.

**Real-estate intelligence** — recognises price, bedrooms, bathrooms,
carparks, land and floor area, location, features, condition and lifestyle
language, and optionally sets figures typographically: *four bedrooms* →
`4 BEDROOMS`, *six hundred and fifty square metres* → `650m²`, *one point
nine five million dollars* → `$1.95M`.

**A design app** (`pkkc ui`) where you drop a clip and its captions and watch
the typography land on the real footage — Quick and Advanced modes, a
word-level editor, accent colour picked straight from the playhead, and full
template management. The preview is drawn by the engine module the page
imports from the server, so it is literally the same renderer the exporter
uses, not a second implementation that drifts.

**A template store** outside Final Cut, so a style survives quitting the
app, a new library, a new project and a reboot.

**116 tests** covering colour maths, frame-exact timing, transcript ingest,
phrasing invariants, hierarchy budgets, typography, layout, motion, blend
mapping, determinism, template persistence, packaging, export, and the
browser/server boundary the app depends on, and the macOS bundle.

### Honest limits of this release

- No prebuilt Motion title ships. The default export profile does not need
  one. See [docs/motion-template.md](docs/motion-template.md).
- Blur entrances, mask reveals and per-character hero animation require that
  title. The composer leaves them out of the plan unless you ask for the
  `pk` profile, so the preview never shows motion the timeline cannot produce.
- Face and subject positions come from an analysis file you supply, not from
  a detector built in. See [docs/shot-analysis.md](docs/shot-analysis.md).
- Behind-subject typography builds the layer stack; isolating the subject is
  one click of Final Cut's own Magnetic Mask.
- Everything here was built and tested on Linux. The engine, the interface
  and the FCPXML are exercised by the test suite and a headless browser;
  **the FCPXML has not been opened in Final Cut Pro**, because there is no
  Mac in this environment. Start with `pkkc demo` and one import.

---

## 2. Architecture

```
transcript ─┬─ ingest ────── SRT · VTT · Whisper/WhisperX JSON · Deepgram
            │                FCPXML captions · plain text
            └─ normalize ─── corrections · real-estate figures
                    │
                    ▼
   ┌────────────────────────────────────────────────┐
   │  compose()                                     │
   │    score   → every word 0..1, with reasons     │
   │    phrase  → dynamic programming over breaks   │
   │    levels  → budgets, cooldowns, per phrase    │
   │    type    → faces, weights, cap-height sizes  │
   │    colour  → palette roles, blend adaptation   │
   │    layout  → zone choice, lines, face avoidance│
   │    motion  → keyframes with explicit easing    │
   │    blend   → compositing mode, depth, lanes    │
   └────────────────────────────────────────────────┘
                    │
              CaptionPlan  ── one resolved design
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
   SVG renderer            FCPXML exporter
   (preview, thumbnails)   (the timeline)
```

Design decisions that shape everything else:

- **The template is the only source of style.** Every engine reads from it
  and nothing else, which is why a new style pack is a data file.
- **Nothing is randomised.** Where the engine must choose between equally
  good options it hashes stable content. The same transcript and template
  always produce the same design — there is a test for it.
- **Sizing is cap-height-based against the frame's short edge.** Switching
  the hero font from Helvetica to Cormorant does not silently shrink every
  hero word, and 9:16 and 16:9 read at the same weight.
- **The preview is rendered by the exporter's own curves.** A preview that
  approximates the output separately is worse than no preview.
- **Zero runtime dependencies.** Node 20+ and nothing else, so installing
  does not depend on a working npm.

### Layout

```
src/core/         types · colour (OKLab) · frame-exact time · stable hashing
src/lexicon/      function words · morphology · real-estate concepts
src/transcript/   ingest · normalisation and corrections
src/engine/       the eight engines above
src/templates/    schema · six built-ins · store · .pkcaption · brand · thumbnails
src/render/       deterministic SVG renderer
src/export/       FCPXML · installer and environment checks
src/ui/           local server + the design interface
src/cli/          pkkc
app/              the macOS .app bundle: icon artwork, launcher, builder
```

---

## 3. Installing

Requires **Node 20 or newer**. Final Cut Pro 10.6+ for the export.

```bash
cd pk-kinetic-captions
npm install          # only a type checker; nothing at runtime
node bin/pkkc.js install
node bin/pkkc.js check
```

### The dock icon

```bash
node bin/pkkc.js app                 # → ~/Applications/PK Kinetic Captions.app
node bin/pkkc.js app --out /Applications
```

Open it once with **right-click ▸ Open** — the app is not code-signed, so
macOS refuses a plain double-click the first time and then trusts it forever.
After that it behaves like any other app: click it, the window opens, quit it
and the server stops. Drag it to the dock.

It launches the same server as `pkkc ui`; the app is a launcher, not a
separate program. The one thing it does that a shell alias cannot: a
double-clicked app gets no login shell, so `node` is almost never on its PATH.
The launcher looks where Node actually lives — Homebrew on both architectures,
nvm, fnm, Volta, asdf, MacPorts — picks the newest version it finds, and only
then falls back to asking a login shell. If anything goes wrong it says so in
a dialog rather than failing silently, and writes the detail to
`~/Library/Logs/PK Kinetic Captions.log`.

Rebuild it after moving the project folder: the path is baked into the
launcher.

Optionally put `pkkc` on your path as well:

```bash
npm link             # then just: pkkc ui
```

`pkkc check` reports your platform, where templates are stored, which of the
styles' fonts are actually installed, and what each missing one falls back
to. Worth running once.

**Fonts.** Four styles use only fonts that ship with macOS. PK Luxury wants
*Cormorant Garamond* and falls back to *Didot*; anywhere a font is missing,
the substitute is chosen to preserve the design intention rather than to be
alphabetically close.

---

## 4. Generating captions

### The app

```bash
pkkc ui
```

1. **Drop your clip on the window.** The app reads its dimensions, measures
   its real frame rate off the decoder, and sets the frame to match.
2. **Drop the captions beside it.** In Final Cut: select the clip, *Transcribe
   to Captions*, then **File ▸ Export Captions…** as SRT. Drop that file in.
   (Both files can be dropped together.)
3. **Pick a style.** The preview redraws on your footage as you click.
4. **Set the accent** — or press *Pick from video*, which hands you the frame
   you are parked on. Click the shirt, the logo, the sky.
5. **Click any word** to cycle it between normal, emphasis and hero.
   Shift-click for colour, font, scale, timing.
6. **Export FCPXML.**

The caption layer sits over the real video, so the compositing modes preview
honestly: *Invert* inverts the actual footage underneath, *Ghost* disappears
over real highlights. That is why the blend choices are worth making here
rather than guessing at them in the timeline.

Why Final Cut's own transcription rather than something built in: it is free,
already on your Mac, genuinely accurate, and it means no API key, no monthly
bill, and no client's property footage leaving your machine.

### From the command line

```bash
pkkc generate transcript.srt \
  --template "Luxury Teal" \
  --accent "#14b8a6" \
  --density low \
  --emphasis balanced \
  --animation editorial \
  --aspect 9:16 \
  --real-estate --normalise \
  --out ~/Desktop/captions
```

It writes three files: the `.fcpxml`, a `.plan.json` (the full design, for
diffing or scripting), and a `.preview.svg` contact sheet.

### Into Final Cut

**File ▸ Import ▸ XML…**, choose the `.fcpxml`. A project appears in a
*PK Kinetic Captions* event. Open it, select all the caption clips, copy, and
paste onto your own timeline above the footage.

Every clip carries the video role **PK Captions**, so you can show, hide or
solo the whole caption pass at once.

---

## 5. Choosing a style

Six built-ins, each a different answer to the same brief:

| Style | Supporting type | Hero | Feels like |
|---|---|---|---|
| **PK Editorial** | Helvetica Neue Light | Didot italic, 3.2× | Fashion magazine over video |
| **PK Luxury** | Avenir Next UltraLight, wide tracking, caps | Cormorant Garamond, 4.0× | Prestige property |
| **PK Modern** | Avenir Next Medium | Avenir Next Heavy Condensed, cyan emphasis | Contemporary creator |
| **PK Minimal** | Helvetica Neue Light | Medium, 1.9× | Let the footage carry it |
| **PK Bold** | Helvetica Neue Thin | Black Condensed, 3.1× | Weight and scale, no colour |
| **PK Real Estate** | Avenir Next Regular | Heavy Condensed, gold emphasis | Listings and agent video |

```bash
pkkc templates      # everything available, built-in and yours
```

In the interface each style shows a live specimen of its three levels, so you
are choosing by eye, not by name.

**Density** and **emphasis** are separate dials and both matter:

- *Caption density* — how many words share the screen. `low` gives few words
  and large type; `high` is closer to conventional captions.
- *Emphasis density* — how much gets promoted. `subtle` picks very few
  words; `strong` is aggressive. Even `strong` leaves most words as
  supporting type, because if everything is emphasised nothing is.

---

## 6. Changing emphasis

Automatic emphasis scores every word on part of speech, real-estate concept,
pauses either side, whether the speaker held it, sentence position, repetition
and proper nouns. Then it spends a *budget*: the top-scoring words are
promoted until the budget for the chosen density runs out, with a cooldown
between hero words and a cap per phrase. That budget is what creates the
rhythm the format depends on — normal, emphasis, normal, hero, normal.

To change it:

- **One word** — click its chip in the Words panel. It cycles normal →
  emphasis → hero. (Because the budget is fixed, promoting one word will
  usually demote another. That is the hierarchy working.)
- **Everything** — move the Emphasis dial, or turn auto emphasis off in
  Advanced and promote by hand.
- **Real-estate mode** — makes prices, bedrooms, land and location strong
  candidates without touching anything else.

Hover a word to see why it scored the way it did.

---

## 7. Capturing a colour from the video

Scrub to the shot you want, press **Pick from video**, and click the colour —
an agent's shirt, a logo, the sky, the brand on the sign. The app grabs the
frame you are parked on; there is no still to export.

(With no clip loaded it falls back to opening an image file.)

The picker does not average the region. Averaging a teal shirt against a grey
wall returns grey. It bins the pixels perceptually, discards crushed blacks
and blown highlights, and returns the most *chromatic* populated bin — which
is what "pick the colour of their shirt" actually means. If the region has no
real colour in it, it says so rather than handing you a grey.

The captured colour becomes the accent, driving every emphasis word. Tick
**Generate the whole palette from it** to derive primary, secondary, hero and
neutral as well — offered, never forced.

From the command line:

```bash
pkkc palette "#14b8a6" --mood luxury     # see what it would produce
pkkc generate script.srt --accent "#14b8a6" --palette
```

---

## 8. Editing individual words

The Words panel lists the whole transcript as chips, coloured by level and
highlighted as they appear.

- **Click** — cycle the level.
- **Shift-click** (or right-click) — open the overrides: text, level,
  colour, scale, font, weight, depth, start and end.
- **Reset to template** — drop every override on that word.
- **Reset all** — start again.

Two properties matter here:

- An override **beats the template** and is marked with a dot.
- An override **is not part of the template**. Change the accent and every
  emphasis word follows; the word you coloured magenta stays magenta. Change
  the hero font and every hero word follows. Switch to a different style
  entirely and your overrides come with you. Both directions are tested.

Fixing a transcription error keeps the timing: *"Mana Kau"* → *"Manukau"*
re-spans the original words rather than resetting them, and nothing after it
moves.

---

## 9. Saving a template

Set everything the way you want it, then **Save as template** and name it —
"Luxury Teal", "Agency White", "Editorial Gold".

A template is the complete design DNA: the font system, colour system, sizes,
weights, spacing, position mode and zones, animation style and per-level
entrances and exits, blend mode, glow, shadow, outline, caption density,
emphasis density, subject awareness, face avoidance, hero behaviour and
real-estate settings.

```bash
pkkc save "Luxury Teal" --template pk-luxury --accent "#14b8a6" \
  --animation cinematic --emphasis strong --behind-subject
```

**Update** replaces a saved template's settings and keeps its identity and
creation date. **Duplicate** copies it — "Luxury Teal" → "Luxury Gold" — and
records what it came from.

Built-in templates are protected: they cannot be updated or deleted, and
saving over one creates a separate template of your own instead. An engine
update can never overwrite your styles, and your styles can never break a
built-in.

---

## 10. Retrieving a template

Next project, next library, next month:

```bash
pkkc ui           # it is in MY TEMPLATES, with its preview
pkkc templates    # or from the command line
pkkc generate script.srt --template "Luxury Teal"
```

Templates resolve by name or id, case-insensitively, so `"luxury teal"`
works.

This is tested as a hard requirement: a template is saved, the store is torn
down and re-read from disk as if the Mac had rebooted, and the reloaded
template must reproduce a **byte-identical design** — not a similar-looking
one. See `test/templates.test.js`, *"MANDATORY: a saved template survives a
restart"*.

---

## 11. Where templates are stored

```
macOS    ~/Library/Application Support/PK Visuals/Kinetic Captions/
Linux    ~/.config/pk-visuals/kinetic-captions/
```

```
templates/<id>.json      one file per style, plain JSON
thumbnails/<id>.svg      generated previews
overrides/<project>.json per-project word overrides
brand.json               MY BRAND
```

```bash
pkkc where
```

Deliberately plain files outside any Final Cut library: back them up by
copying one folder, and if this tool ever disappears your styles are still
readable. Writes are atomic, so an interrupted save cannot corrupt a template.

Point `PKKC_HOME` at a shared folder to give a whole studio one set of styles.

---

## 12. Exporting and importing templates

```bash
pkkc export-template "Luxury Teal" ~/Desktop     # → luxury-teal.pkcaption
pkkc import-template ~/Downloads/editorial-gold.pkcaption
pkkc import-template file.pkcaption --rename "Editorial Gold (from Sam)"
```

Or **Export** / **Import** in the interface.

A `.pkcaption` carries the template and its preview, so a style can be seen
before it is imported. An import never lands on a built-in id and never
silently replaces one of your own — a name clash becomes "Luxury Teal 2".
A file that is not a PK template, or one from a newer version, is refused
with a sentence that says what to do.

---

## 13. Known limitations

**Needs a Mac to finish the loop.** Everything up to the `.fcpxml` runs
anywhere. Installing the Motion title and detecting installed fonts need
macOS. The exported FCPXML has not yet been opened in Final Cut Pro — the
format is generated conservatively (`adjust-transform` and `adjust-blend`
rather than Motion parameter keys, frame-exact rational times, escaped text)
and validated as XML, but the first real import is still ahead of it.

**One title clip per word.** Per-word position, size, colour and animation
require per-word clips. A 150-word reel is about 150 clips across a handful
of lanes. Final Cut handles that, but it is more than a subtitle track, and
the exporter warns past 400.

**Blur, mask reveals and per-character animation** need the Motion title.
Without it they are not in the plan at all, so nothing is silently lost.

**Text measurement is modelled, not rasterised.** Widths come from a
calibrated advance-width table rather than the real font file, accurate to a
few percent. Line breaks and shrink-to-fit carry a safety margin. A very
unusual font could break slightly differently in Final Cut than in the
preview.

**Face and subject positions are supplied, not detected.** See
[docs/shot-analysis.md](docs/shot-analysis.md).

**Behind-subject needs one manual step** — Final Cut's Magnetic Mask on the
top copy of the shot. The exporter builds the rest.

**The Mac app is not code-signed.** Opening it needs one right-click ▸ Open.
Signing it so it opens on any Mac without that needs a paid Apple Developer
account; it is a distribution problem, not a working-on-your-own-Mac problem.

**English only.** The function-word list, morphology and real-estate lexicon
are English. Timing, typography, layout, colour and motion are
language-neutral; only emphasis scoring would need work.

**No audio analysis.** Emphasis uses pauses and word durations from the
transcript, which turns out to be most of the signal, but not loudness or
pitch.

---

## 14. Recommended V2

In the order that would pay off:

1. **Ship the Motion title**, built and verified in Motion. Unlocks blur,
   mask reveals and per-character hero animation.
2. **A Final Cut workflow extension** so this runs inside Final Cut, reads
   the selected clip's transcript, and writes captions straight to the
   timeline — no import step.
3. **Built-in shot analysis** — face and subject detection from a handful of
   sampled frames, so subject-aware layout is automatic.
4. **PK Tracker integration.** Track once; attach a boundary, a pin, a
   caption, an arrow or a logo to the same track. The layout engine already
   speaks normalised centre-origin coordinates, which is the same space a
   tracker produces, so this is a data hand-off rather than a rewrite.
5. **Audio-driven emphasis** — loudness and pitch alongside the transcript.
6. **Style packs** on the existing architecture: PK Agent, PK Fashion, PK
   Cinematic. Data files, no engine work.
7. **Agency templates** — a shared brand plus a locked style, distributed as
   one `.pkcaption` bundle.
8. **The secondary motion elements** the references show: comment bubbles,
   profile cards, contact end-cards. Kept out of V1 on purpose; the caption
   engine had to be excellent first.

---

## Command reference

```
pkkc generate <transcript>        design captions and export FCPXML
pkkc preview <transcript>         write an SVG preview sheet
pkkc templates                    list built-in and saved styles
pkkc show <id>                    print a template as JSON
pkkc save "<name>"                save the current settings as a template
pkkc duplicate <id> "<name>"      copy a template
pkkc delete <id> --yes            remove a saved template
pkkc export-template <id> [dest]  write a .pkcaption
pkkc import-template <file>       add a .pkcaption to MY TEMPLATES
pkkc thumbnails                   regenerate template previews
pkkc brand [--accentColour HEX]   view or set MY BRAND
pkkc palette "#14b8a6"            generate a palette from an accent
pkkc check                        environment, fonts, install state
pkkc install                      create the store and Motion folders
pkkc where                        where templates are stored
pkkc ui [--port 7847]             open the design interface
pkkc demo                         one demo project per built-in style
```

`pkkc help` lists every generate option.

## Development

```bash
npm test          # 116 tests
npm run typecheck # tsc over the JSDoc types
npm run demo      # six projects and preview sheets
```
