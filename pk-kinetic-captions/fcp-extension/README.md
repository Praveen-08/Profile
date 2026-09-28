# PK Kinetic Captions — Final Cut Pro workflow extension

A panel inside Final Cut. Drag a clip onto it; its captions come across with
their real word timing, you choose a style, and the designed titles go back to
your timeline.

No transcription step, no SRT export, no import — Final Cut has already
transcribed and aligned the words, and the panel reads that.

## Status

**Unbuilt.** Every file here was written on Linux, where there is no Xcode and
no Final Cut. It has not been compiled, signed or run. You will be the first
person to build it, and something will need fixing — see *What to expect on
first build*.

The JavaScript half is exercised by the main test suite. The Swift half is not
verified at all.

## Build

```bash
brew install xcodegen          # once
cd fcp-extension
xcodegen                       # writes PKKineticCaptions.xcodeproj
open PKKineticCaptions.xcodeproj
```

In Xcode: select the **PKKineticCaptions** scheme, set your team under
Signing & Capabilities on both targets, and Run. The host app launches, which
registers the extension with macOS.

Then in Final Cut: **Window ▸ Extensions ▸ PK Kinetic Captions**.

## What to expect on first build

**`ProExtensionTimelineBridge.swift` is the file to fix.** Final Cut's host
API is thinly documented, and the selector names in it are written against its
documented shape rather than against headers I could read. Find the real ones:

```bash
xcrun --show-sdk-path     # then look for ProExtensionHost.framework
```

Only that file should need changing — everything else talks to the
`TimelineBridge` protocol, so once those calls compile the panel works.

**The panel is useful before that is solved.** Dragging a clip in goes through
the pasteboard (`DragWebView`), not the host API, so the read path works
independently. If the send call is what needs fixing, you can still design
captions and export FCPXML.

## How it fits together

```
Panel/                  the panel's own HTML, CSS and JS
Extension/
  PKCaptionsViewController  WKWebView host, message routing
  DragWebView               claims com.apple.finalcutpro.xml off the pasteboard
  TimelineBridge            the protocol everything else talks to, plus a mock
  ProExtensionTimelineBridge   ← the only file touching Apple's API
  TemplateStore             styles, in the folder the CLI and app already use
  Resources/web/            generated — do not edit
Host/                   the wrapper app macOS requires
scripts/bundle-web.mjs  copies the engine in
```

**The panel does not reimplement anything.** It imports the same 22 engine
modules the command line and the standalone app use, so a change to emphasis
or layout reaches all three at once. The bundler follows imports from
`compose()` and `exportFCPXML()` and **fails the build** if any of them gains
a top-level Node import — inside a web view that would be a blank panel with a
console message nobody sees.

`Extension/Resources/web/` is regenerated in full on every build. Edit
`Panel/` and `../src/`, never that folder.

## Developing without Final Cut

`MockTimelineBridge` returns a timeline with captions on it, so the panel and
the whole design engine can be built and debugged in a plain window. Relaunching
Final Cut for every change gets old within the hour.

## Signing

A free personal team is enough for your own Mac. Distribution needs a
Developer ID and notarization.

## Why a panel rather than the standalone app

The standalone app has to be told things Final Cut already knows. The panel
reads the timeline, so:

| | Standalone app | Panel |
|---|---|---|
| Captions | export SRT or XML, then drop it in | read from the timeline |
| Timing | whatever the export carried | Final Cut's own, by construction |
| Result | import XML, paste the clips | sent to the timeline |

The standalone app stays useful — it previews on the footage, which the panel
leaves to Final Cut's viewer, and it runs without Final Cut open at all.
