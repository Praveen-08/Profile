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
| **FCP panel** | inside Final Cut, Window ▸ Extensions | **builds, loads and renders in FCP 12.2** |

All three import the same 22 engine modules. A change to emphasis or layout
reaches all three at once. This is deliberate — do not fork the engine.

---

## Current state

**138 of 138 tests pass** (`npm test`), including a validation of every
built-in style against Final Cut's own FCPXML DTD whenever Final Cut is
installed.

Verified by running it:

- FCPXML caption ingest is frame-exact (`12012/30000s` → `0.400s`)
- The app loads video, detects 540×960 @ 30fps, composites captions over footage
- Colour capture pulls `#048785` (teal) from a real frame
- Template persistence survives a simulated restart byte-identically
- The Mac launcher finds Node across Homebrew, nvm, fnm, Volta and asdf
- **On the Mac (2026-10-01):** the extension builds clean with Xcode 27,
  registers with PlugInKit, appears under Window ▸ Extensions in Final Cut
  12.2, opens at a usable size, logs `connected to Final Cut Pro 12.2`, and
  renders the full panel (styles, accent, emphasis, density)
- Every built-in style's FCPXML validates against `FCPXMLv1_11.dtd` from
  inside Final Cut.app

**Still not verified:**

- that Final Cut *imports* a generated `.fcpxml` without complaint. DTD-valid
  is necessary, not sufficient. The import was started and stopped at Final
  Cut's "which library?" dialog — import into a scratch library, not a client's.
- that the caption ingester reads Final Cut 12.2's captions. A real project
  ("trial captions", library First 4) dragged onto the panel arrived intact —
  `com.apple.finalcutpro.xml.v1-14`, 2.1 MB — but the panel reported no
  captions on it. Either it has none, or the ingester misses how 12.2 writes
  them. Drop it again and read the container's `tmp/last-drop.fcpxml` to tell.
- "Send to Final Cut" end to end

---

## Building

```bash
cd pk-kinetic-captions/fcp-extension
./build.sh            # builds, checks, installs, registers, verifies
./build.sh --check    # diagnoses an existing install, changes nothing
```

`build.sh` uses `/Applications/Xcode.app` by itself when `xcode-select` points
at the Command Line Tools, and refuses to install a build that is missing the
extension point, the sandbox, or the ProExtension link.

**Reloading a new build:** toggle the panel off in Window ▸ Extensions, run
`./build.sh`, toggle it on. **Never kill the extension process** — Final Cut
then refuses to relaunch it until Final Cut itself restarts.

Logs, which Final Cut never shows anywhere:

```bash
log stream --predicate 'subsystem == "nz.pkvisuals.kinetic-captions"'
```

Page script errors and failed resource loads are forwarded there too.

### What the first run inside Final Cut found

Each of these failed **silently**, and each is now pinned by a test in
`test/export.test.js` or `test/extension.test.js`:

1. **The committed FCPXML was invalid.** Adjust-* elements came before
   `<text>`, and keyframes sat outside `<keyframeAnimation>` — 114 DTD errors
   per file. Final Cut would have rejected every import. (The fix existed as
   uncommitted edits on the Mac.)
2. **xcodegen deleted NSExtension.** `project.yml` had `info: path:` for the
   extension, so every `xcodegen` regenerated `Info.plist` without it. Plists
   are now hand-maintained via `INFOPLIST_FILE`.
3. **Wrong plist keys.** Final Cut wants `ProExtensionPrincipalViewControllerClass`
   and `ProExtensionAttributes` directly under `NSExtension`, and a plain class
   name — hence `@objc(PKCaptionsViewController)`.
4. **Not sandboxed, not linked.** PlugInKit ignores unsandboxed extensions, and
   the process traps without Final Cut's `ProExtension.framework` linked
   (`-Wl,-needed_framework,ProExtension`).
5. **The host API guessed in the first draft does not exist.** There is no
   `requestFCPXMLWithCompletionHandler:` and no `sendFCPXML:completionHandler:`,
   and no headers to check against. Final Cut offers no way to read the
   timeline as FCPXML or to put FCPXML on it. So: **read = drag** (FCPXML on the
   pasteboard), **send = write `~/Movies/PK Kinetic Captions/*.fcpxml` and open
   it in Final Cut**, which imports it. The "read the open timeline" button is
   gone. The host is reached by pulling
   `ProExtensionRequestHandling.sharedInstance.extensionContext.host`; there is
   no connect callback.
6. **Drags would have been refused.** Final Cut 12.2 drags as
   `com.apple.finalcutpro.xml.v1-14`; only the unversioned type was registered.
7. **Zero-size window.** Final Cut sizes the window from the Auto Layout fitting
   size; a pinned web view has none, so it opened `{0, 28}` — and Final Cut
   *saved* that frame (`FFExternalProvidersSavedWindowInformations` in the
   `com.apple.FinalCut` prefs) and restored it on every later open.
8. **Blank panel.** WebKit refuses ES-module scripts from `file://`. The panel
   is now served from the bundle under `pkkc://panel/` (`PanelSchemeHandler`).
9. **WebKit's network process crashed** in the sandbox without
   `com.apple.security.network.client`, even though nothing is fetched.
10. **Styles would not have been shared** with the CLI: inside the sandbox,
    Application Support is the container's. The store uses the real home folder
    plus a home-relative-path entitlement exception.
11. **The view did not follow the window.** `preferredContentSize` and a
    required minimum height held it at one size; in the 480px window Final Cut
    restored, the top of the panel was clipped. Size is now a low-priority
    preference only.
12. **Drop errors were out of sight**, in the status line at the foot of the
    panel. They now appear under the drop zone.

The 08 Track panel (`PKPropertyBoundary/fx/ext/`) is a working workflow
extension on the same Mac and the reference for anything host-related.

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
    WebBridge                message names, and the os.Logger the panel logs to
    PanelSchemeHandler       serves Resources/web as pkkc://panel/ (modules need an origin)
    Extension.entitlements   sandbox + what it needs; see the comments
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

**The cloud-only commits are applied.** The four commits made in a cloud
session that could not push (two bug-fix commits, `build.sh`, this handoff)
were applied on the Mac with `git am four.patch` on 2026-10-01. Their hashes
differ from the cloud ones because the committer differs; the content is the
same.

---

## What to do next, in order

1. **Finish the import test.** Open a generated `.fcpxml` in Final Cut, choose
   **New…** and make a scratch library (not a client's), and confirm the
   project opens with its titles animating. If Final Cut complains, its
   message names the element — fix the exporter, then add the case to the DTD
   test.
2. **Drag a project with captions onto the panel.** Expect the captions to
   load with their timing. If it says there are none, compare against
   `~/Library/Containers/nz.pkvisuals.kinetic-captions.extension/Data/tmp/last-drop.fcpxml`.
3. **Send to Final Cut** from the panel and check the import, as in step 1.
4. Push the branch (see Environment facts: it has to be a new session, or a
   push from the Mac).
