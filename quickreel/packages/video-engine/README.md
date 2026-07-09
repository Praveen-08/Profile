# @quickreel/video-engine

The Remotion composition and programmatic renderer. `renderReel()`
(`src/render.ts`) is the only export apps/worker calls — everything else
(the composition, camera-move/transition CSS math, text overlay animation)
is internal.

## Validated in this environment (see the render spike in git history / CI)

Two things the original architecture plan flagged as unproven turned out to
need real fixes, both now baked into `render.ts`:

1. **Chromium binary**: must be the `headless_shell` build
   (`chromium_headless_shell-*/chrome-linux/headless_shell`), not regular
   Chromium (`chromium-*/chrome-linux/chrome`). Modern full-Chromium builds
   removed "old" headless mode, which is what Remotion's renderer launches
   with by default — using the wrong binary fails with *"Old Headless mode
   has been removed from the Chrome binary."* Set
   `REMOTION_CHROMIUM_EXECUTABLE_PATH` accordingly (see `.env.example`), and
   pass it to **both** `selectComposition()` and `renderMedia()` — they
   launch separate browser instances.
2. **ffmpeg-free rendering**: confirmed. Remotion v4's own compositor
   handles h264 encoding and audio muxing without a system `ffmpeg`
   install — verified end-to-end with a real 2-clip, beat-synced,
   audio-muxed render on a box with no `ffmpeg` on PATH.

One more real bug worth knowing about: Remotion's bundler runs on webpack,
which has no built-in notion of this monorepo's Node-ESM convention of
importing relative TypeScript files with a `.js` extension (e.g. `from
"./enums.js"`, resolved back to `enums.ts` by tsc/tsx). Without the
`webpackOverride` in `render.ts` adding `resolve.extensionAlias: {".js":
[".ts", ".tsx", ".js"]}`, every such import 404s during bundling.
