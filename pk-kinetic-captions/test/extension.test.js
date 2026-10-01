import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameFromFCPXML, nearestAspect } from '../fcp-extension/Panel/frame.js';
import { collectModules } from '../fcp-extension/scripts/bundle-web.mjs';

const EXT = fileURLToPath(new URL('../fcp-extension/', import.meta.url));
const FALLBACK = { width: 1080, height: 1920, fps: 30, aspect: '9:16' };

test('the frame is read from the sequence Final Cut actually uses', () => {
  // A library can declare several formats. Taking the first one would design
  // against whatever happened to be listed earliest.
  const xml = '<format id="r1" width="640" height="480" frameDuration="1/30s"/>'
    + '<format id="r2" width="1080" height="1920" frameDuration="1001/24000s"/>'
    + '<sequence format="r2"/>';
  assert.deepEqual(frameFromFCPXML(xml, FALLBACK), { width: 1080, height: 1920, fps: 23.976, aspect: '9:16' });
});

test('attribute order does not matter', () => {
  const a = frameFromFCPXML('<format id="r1" width="1920" height="1080" frameDuration="1/25s"/><sequence format="r1"/>', FALLBACK);
  const b = frameFromFCPXML('<format id="r1" height="1080" frameDuration="1/25s" width="1920"/><sequence format="r1"/>', FALLBACK);
  assert.deepEqual(a, b);
  assert.equal(a.width, 1920);
});

test('the awkward frame rates come back as themselves', () => {
  // These are the ones that matter. Reading 1001/30000 as 30 drifts a whole
  // frame every 33 seconds against the picture.
  for (const [duration, timebase, expected] of [
    [1001, 30000, 29.97], [1001, 24000, 23.976], [1001, 60000, 59.94],
    [1, 25, 25], [1, 30, 30], [1, 60, 60], [100, 3000, 30],
  ]) {
    const xml = `<format id="r1" width="1920" height="1080" frameDuration="${duration}/${timebase}s"/><sequence format="r1"/>`;
    assert.equal(frameFromFCPXML(xml, FALLBACK).fps, expected, `${duration}/${timebase}`);
  }
});

test('a timeline with no usable format leaves the frame alone', () => {
  assert.deepEqual(frameFromFCPXML('<fcpxml/>', FALLBACK), FALLBACK);
  assert.deepEqual(frameFromFCPXML('', FALLBACK), FALLBACK);
  assert.deepEqual(frameFromFCPXML(null, FALLBACK), FALLBACK);
});

test('aspect follows the real dimensions', () => {
  assert.equal(nearestAspect(1080 / 1920), '9:16');
  assert.equal(nearestAspect(1920 / 1080), '16:9');
  assert.equal(nearestAspect(1), '1:1');
  assert.equal(nearestAspect(0.8), '4:5');
});

test('a real Final Cut export is read correctly end to end', async () => {
  const xml = await fs.readFile(new URL('../examples/timeline-export.fcpxml', import.meta.url), 'utf8');
  const frame = frameFromFCPXML(xml, { width: 1, height: 1, fps: 1, aspect: '1:1' });
  assert.equal(frame.width, 1080);
  assert.equal(frame.height, 1920);
  assert.equal(frame.fps, 30);        // 100/3000s
  assert.equal(frame.aspect, '9:16');
});

test('everything the panel loads can run without Node', async () => {
  // The panel runs in a WKWebView. A top-level Node import in any of these
  // is a blank panel inside Final Cut with a console message nobody sees.
  const { modules, nodeImports } = await collectModules();
  assert.deepEqual(nodeImports, [], `Node imports reached the panel: ${JSON.stringify(nodeImports)}`);
  assert.ok(modules.length >= 20, `only ${modules.length} modules collected`);
  assert.ok(modules.includes('engine/compose.js') && modules.includes('export/fcpxml.js'));
});

test('the extension declares itself to Final Cut correctly', async () => {
  const plist = await fs.readFile(path.join(EXT, 'Extension/Info.plist'), 'utf8');
  assert.match(plist, /com\.apple\.FinalCut\.WorkflowExtension/, 'wrong extension point — Final Cut will not list the panel');
  assert.match(plist, /PKCaptionsViewController/);
  assert.match(plist, /ProExtensionPrincipalViewControllerClass/);
});

test('the drag destination is the view that actually receives the drop', async () => {
  const swift = await fs.readFile(path.join(EXT, 'Extension/DragWebView.swift'), 'utf8');

  // The web view fills the panel and is top-most, so it has to be the
  // destination. A container behind it would never see the drag.
  assert.match(swift, /final class DragWebView: WKWebView/, 'the drag destination must be the web view itself');
  assert.match(swift, /com\.apple\.finalcutpro\.xml/, 'Final Cut\'s pasteboard type is not claimed');
  for (const method of ['draggingEntered', 'draggingUpdated', 'performDragOperation']) {
    assert.ok(swift.includes(`override func ${method}`), `${method} is not overridden`);
  }
  // Anything that is not Final Cut data must still reach the web view.
  assert.match(swift, /super\.performDragOperation/, 'ordinary web drags would be swallowed');
});

test('the panel is told which event fired', async () => {
  const swift = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  // Passing the payload as the event name meant no unprompted message from
  // Swift ever reached the panel — a drop would arrive and nothing happened.
  assert.match(swift, /receive\(\\\(event\.swiftQuoted\)/, 'the event name is not passed to the panel');
});

test('one unreadable saved style does not take the rest with it', async () => {
  const panel = await fs.readFile(path.join(EXT, 'Panel/panel.js'), 'utf8');
  const block = /callNative\('listTemplates'\)([\s\S]*?)\.catch/.exec(panel)?.[1] ?? '';
  assert.ok(block, 'the template loader was not found');

  // A bare templates.map(JSON.parse) throws on the first bad file, the whole
  // promise rejects, and every saved style silently disappears.
  assert.ok(!/\.map\(\s*\(?\w+\)?\s*=>\s*JSON\.parse/.test(block), 'one bad file would reject the whole load');
  assert.match(block, /try\s*\{/, 'parsing is not guarded per file');
  assert.match(block, /unreadable/, 'skipped styles are not reported');
});

test('a dropped file is actually read, not just prevented', async () => {
  const panel = await fs.readFile(path.join(EXT, 'Panel/panel.js'), 'utf8');
  const handler = /addEventListener\('drop',([\s\S]*?)\n\}\);/.exec(panel)?.[1] ?? '';
  assert.ok(handler, 'the drop handler was not found');

  // The status offers "drag an .fcpxml in to try it" when there is no host.
  // A handler that only calls preventDefault makes that a lie.
  assert.match(handler, /dataTransfer\?\.files/, 'a dropped file is ignored');
  assert.match(handler, /useTimelineXML/, 'a dropped timeline is never used');
  assert.match(handler, /<fcpxml/, 'the drop does not check what it got');
});

test('no private API is used to make the panel transparent', async () => {
  const swift = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  // setValue(_:forKey:) on WKWebView.drawsBackground raises if the key goes
  // away, killing the panel on launch for a cosmetic reason.
  assert.ok(!swift.includes('forKey: "drawsBackground"'), 'drawsBackground is not public API');
});

// Each test below pins a fault found the first time the panel ran inside
// Final Cut 12.2. Every one of them failed silently: an empty Extensions menu,
// a zero-width window, or a blank panel — with nothing on screen to say why.

test('xcodegen never regenerates the Info.plists', async () => {
  // With an `info:` block, every xcodegen run rewrote Extension/Info.plist and
  // dropped NSExtension, so Final Cut never listed the panel.
  const yml = await fs.readFile(path.join(EXT, 'project.yml'), 'utf8');
  assert.ok(!/^\s+info:\s*$/m.test(yml), 'project.yml has an info: block — it will overwrite the hand-written plist');
  assert.match(yml, /INFOPLIST_FILE: Extension\/Info\.plist/);
  assert.match(yml, /GENERATE_INFOPLIST_FILE: NO/);
});

test('the extension can load inside Final Cut', async () => {
  const yml = await fs.readFile(path.join(EXT, 'project.yml'), 'utf8');
  // Without ProExtension linked, the process traps looking for NSExtensionContextClass.
  assert.match(yml, /-needed_framework,ProExtension/);
  assert.match(yml, /CODE_SIGN_ENTITLEMENTS: Extension\/Extension\.entitlements/);

  const ent = await fs.readFile(path.join(EXT, 'Extension/Extension.entitlements'), 'utf8');
  // PlugInKit ignores an unsandboxed extension.
  assert.match(ent, /com\.apple\.security\.app-sandbox<\/key>\s*<true\/>/);
  // WKWebView's network process crashes in the sandbox without it.
  assert.match(ent, /com\.apple\.security\.network\.client<\/key>\s*<true\/>/);

  const swift = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  // Info.plist names the class without a module prefix.
  assert.match(swift, /@objc\(PKCaptionsViewController\)/);
  // Final Cut never calls in; the host is pulled from ProExtensionRequestHandling.
  const bridge = await fs.readFile(path.join(EXT, 'Extension/ProExtensionTimelineBridge.swift'), 'utf8');
  assert.match(bridge, /NSClassFromString\("ProExtensionRequestHandling"\)/);
});

test('the panel window opens at a usable size', async () => {
  // Final Cut sizes the window from the Auto Layout fitting size. A web view
  // has none, so without explicit constraints it opened {0, 28} — and Final
  // Cut saved that and restored it on every later open.
  const swift = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  assert.match(swift, /widthAnchor\.constraint\(greaterThanOrEqualToConstant: \d+\)/);
  assert.match(swift, /heightAnchor\.constraint\(greaterThanOrEqualToConstant: \d+\)/);
});

test('the panel page is not loaded from file://', async () => {
  // WebKit will not run a module script from a file:// page: the panel was
  // blank, with "could not load <script> …/panel.js" in the log.
  const swift = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  assert.ok(!swift.includes('loadFileURL'), 'loadFileURL breaks the ES-module engine');
  assert.match(swift, /setURLSchemeHandler\(PanelSchemeHandler/);
  const html = await fs.readFile(path.join(EXT, 'Panel/panel.html'), 'utf8');
  assert.match(html, /<script type="module"/);
});

test('drags from current Final Cut are accepted', async () => {
  // Final Cut 12.2 drags as com.apple.finalcutpro.xml.v1-14; a view registered
  // only for the unversioned type rejects the drag before it becomes a drop.
  const swift = await fs.readFile(path.join(EXT, 'Extension/DragWebView.swift'), 'utf8');
  assert.match(swift, /com\.apple\.finalcutpro\.xml\.v1-/);
  assert.match(swift, /hasPrefix\(Self\.fcpxmlType\.rawValue\)/);
});
