# PK KINETIC CAPTIONS — handoff

Everything a new session needs. Read this before changing anything.

---

## What this is

A kinetic typography system for Final Cut Pro. **It turns spoken words into
designed motion typography — it is not a subtitle plugin.** That distinction
drives every design decision below.

Built for PK Visuals, a New Zealand real-estate videographer.

Three ways to use it, sharing one engine:

| | What it is | State |
|---|---|---|
| **CLI** | `bin/pkkc.js` — transcript in, FCPXML out | works, tested |
| **Mac app** | dock icon, drop a clip, design on real footage | works, tested |
| **FCP panel** | inside Final Cut, reads the timeline directly | **written, never compiled** |

All three import the same 22 engine modules. A change to emphasis or layout
reaches all three at once. This is deliberate — do not fork the engine.

---

## Current state

**132 of 132 tests pass** (`npm test`). Typecheck is clean (`npm run typecheck`).

Verified by running it:

- FCPXML caption ingest is frame-exact (`12012/30000s` → `0.400s`)
- The app loads video, detects 540×960 @ 30fps, composites captions over footage
- Colour capture pulls `#048785` (teal) from a real frame
- Template persistence survives a simulated restart byte-identically
- The Mac launcher finds Node across Homebrew, nvm, fnm, Volta and asdf

**Never verified, because the build environment was Linux with no Xcode, no
Final Cut and no macOS:**

- that the generated FCPXML actually imports into Final Cut Pro
- that any of the Swift compiles

Those two are the whole remaining risk. Everything else has been exercised.

---

## The immediate blocker

The panel does not appear in Final Cut because **it has never been built**.
`51ff770` is the commit that merely *wrote* the extension source.

To build it:

```bash
cd pk-kinetic-captions/fcp-extension
./build.sh            # builds, installs, registers, verifies
./build.sh --check    # diagnoses an existing install, changes nothing
```

Three things make this fail silently if done by hand, which is why the script
exists:

1. **An unsigned app extension is refused by macOS without any error** — no
   warning, no log, just an empty Extensions menu. `build.sh` ad-hoc signs it.
2. **macOS only registers an extension after its host app has been launched
   once.** Building is not enough. The script launches it.
3. The app must be in `/Applications` or `~/Applications`.

Then quit Final Cut completely and reopen it: **Window ▸ Extensions ▸ PK
Kinetic Captions**.

### Expect one file to fail

`Extension/ProExtensionTimelineBridge.swift` is the **only** file touching
Apple's `ProExtensionHost` API, which is thinly documented. Its selector names
were written from the API's documented shape, not from headers anyone could
read. They are the most likely thing to be wrong.

```bash
xcrun --show-sdk-path    # then look for ProExtensionHost.framework
```

Everything else talks to the `TimelineBridge` protocol, so that should be the
only file needing changes. `MockTimelineBridge` lets the panel and the whole
engine be developed without Final Cut running.

**The panel is useful even if the send path stays broken.** Dragging a clip in
goes through the pasteboard (`DragWebView`), not the host API, so the read
path works independently.

---

## Architecture

```
src/
  core/        colour (OKLab/OKLCH), hash (FNV-1a), time (rationals), types
  lexicon/     function-words, morphology, real-estate
  transcript/  ingest (SRT/VTT/FCPXML/text), normalize, sync
  engine/      phrasing → emphasis → typography → layout → motion → composite
  render/      svg
  export/      fcpxml, install
  templates/   schema, store, brand, package, builtin/
  ui/          server + public/ (the Mac app's panel)
  cli/
app/           .app wrapper: icns, launcher.sh, build-app.mjs
fcp-extension/
  Panel/                     the panel's own HTML/CSS/JS
  Extension/
    PKCaptionsViewController WKWebView host, message routing
    DragWebView              claims com.apple.finalcutpro.xml off the pasteboard
    TimelineBridge           the protocol everything talks to, plus a mock
    ProExtensionTimelineBridge  ← the only file touching Apple's API
    TemplateStore            styles, in the folder the CLI and app already use
    WebBridge
    Resources/web/           GENERATED — never edit, regenerated every build
  Host/                      the wrapper app macOS requires
  scripts/bundle-web.mjs     copies the engine in; FAILS the build on any
                             top-level Node import (that would be a blank panel)
  project.yml                XcodeGen — there is no checked-in .pbxproj
  build.sh
```

**Zero runtime dependencies.** Node 20+, nothing to install. `typescript` and
`@types/node` are dev-only.

---

## Design decisions that must not be undone

Each of these replaced something that was actually broken. Reverting any one
reintroduces a specific bug.

**Hierarchy is NORMAL / EMPHASIS / HERO.** *If everything is emphasized,
nothing is emphasized.* Levels are allocated from a **budget**, not a
threshold — `DENSITY = {subtle: {emphasis 0.16, hero 0.035}, balanced: {0.30,
0.070}, strong: {0.48, 0.120}}` — plus a hero cooldown, a per-phrase cap and a
no-adjacent-emphasis rule. Thresholds produced clumps; budgets produce the
NORMAL→EMPHASIS→NORMAL→HERO rhythm that reads as designed.

**Nothing is random.** The brief forbids it. Any variation comes from
deterministic FNV-1a hashing of the word and its position, so the same input
always yields the same output. Do not introduce `Math.random()`.

**Type is sized by cap-height against the frame's SHORT edge**
(`referenceEdge = min(width, height)`). Sizing against width made 9:16 and
16:9 wildly different; cap-height rather than point size means swapping fonts
doesn't silently rescale everything.

**Phrase segmentation is dynamic programming over break costs**, not a word
count. `HARD_NO_TRAIL` (+30) stops a phrase ending on "and"; `isCompoundBreak`
(+30) stops "real estate" being split; `hardMax = maxWords + 2` makes the word
cap soft so a good break is preferred over an arbitrary one.

**Easing is settled.** `settled()` maps overshoot easings back to `out` for
opacity and blur — overshoot there produced opacity 1.089, which is invalid.
All `outEase` values are `inOut` or `in`, never `out*`; an `out*` exit made
words blink off mid-life (opacity 0.407 at 60%). The in/out budget is
`life * 0.35` each way, so at least 30% of every word is a real hold.

**FCPXML uses `adjust-transform` / `adjust-blend`, not Motion parameter keys.**
Those opaque keys (`9999/10003/…`) differ between templates and FCP versions
and fail *silently*. Times are frame-exact rationals. Keyframes are baked
linear because FCPXML offers only linear/ease/easeIn/easeOut.

**Real-estate normalisation never changes meaning automatically.**
`four bedrooms` → `4 BEDROOMS`, `650m²`, `$1.5M` are offered, not applied. The
`UNIT_FIXUPS` table exists because uppercasing turned `650m²` into `650M²`.

**Text/video interaction is implemented, not faked.** Clean / Invert /
Cinematic / Ghost / Editorial / Knockout use real blend modes — not recoloured
text.

**PK Bold is pure typographic hierarchy, all white.** Its original colour
scheme was invisible on dark footage.

**The drop target must be the WKWebView itself.** `DragWebView` subclasses
`WKWebView` rather than wrapping it: the web view is top-most, so a container
view behind it never receives the drop at all.

Six built-in styles: `pk-editorial`, `pk-luxury`, `pk-modern`, `pk-minimal`,
`pk-bold`, `pk-real-estate`.

**Templates are a core product feature,** with a mandatory test: save a style,
quit, reboot, new project — fonts, colours, weights, sizes, spacing,
animation, position, blend and effects must all reproduce identically.

---

## Environment facts

**GitHub pushes are blocked.** Writes to `Praveen-08/Profile` return 403 on
both `git push` and the GitHub App API. The cloud session authenticates as
`pkvisuals` (a different account from the repo owner `Praveen-08`). The repo is
public, so *reads* work — which disguises the problem. A second session ("08
Labs landing page") hit the identical wall, so it is account-wide, not
session-specific. Reconnecting at https://claude.ai/connect-github fixes it,
but **an existing session will not pick up the new credentials** — its token is
minted at session start. A newly started session will.

**Cloud sessions cannot reach the Mac.** A session created from claude.ai runs
in a Linux container (`environment_kind: anthropic_cloud`). The session that
built the PK Boundary FxPlug plugin ran via `claude remote-control` from the
CLI (`environment_kind: bridge`) and *could* act on the Mac directly. Same
tool, different setup. For anything needing Xcode, Final Cut or the local
filesystem, use a bridge session.

**Three commits may be missing.** `cf39f53`, `c387006` and `e243b9b` were
committed in a cloud session that could not push. They add `build.sh` and fix
four real bugs — most importantly **drops going to the wrong view** and **the
event name never being passed** to the web view (`receive(json, json)` instead
of `receive(event, json)`). Check whether the branch has them:

```bash
git log --oneline -4    # expect e243b9b at the top
```

If not, they exist as a git bundle and as `three.patch`, or reproduce them
from the descriptions above.

---

## What to do next, in order

1. `git diff` — there are uncommitted edits on the Mac to
   `Extension/Info.plist` and two `fcpxml.js` files. `Info.plist` declares the
   extension point; if it was edited wrongly the panel will never appear no
   matter how clean the build. Decide on each change deliberately.
2. `./build.sh` in `fcp-extension/`.
3. Fix `ProExtensionTimelineBridge.swift` against the real SDK headers.
4. **Import a generated `.fcpxml` into Final Cut and confirm it opens.** This
   has never once been verified and is the highest-risk unknown in the project.
5. Push the branch.
