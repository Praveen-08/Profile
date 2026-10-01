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
  assert.match(swift, /preferred\(container\.widthAnchor\.constraint\(equalToConstant: \d+\)\)/);
  assert.match(swift, /preferred\(container\.heightAnchor\.constraint\(equalToConstant: \d+\)\)/);
  // A required size breaks when Final Cut restores a smaller saved frame: the
  // view outgrows the window and the top of the panel is clipped.
  assert.ok(!/(width|height)Anchor\.constraint\(greaterThanOrEqualToConstant/.test(swift), 'a required minimum size clips the panel in a smaller window');
  assert.match(swift, /priority = \.defaultLow/);
  assert.ok(!/preferredContentSize =/.test(swift), 'preferredContentSize pins the view to one size');
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

test('a dragged project is read at its own frame rate, not a compound clip\'s', () => {
  // A project carries its compound clips' sequences first. One of audio only
  // has a format with no rate, and taking it designed a 23.976 project at 30.
  const xml = '<format id="r1" frameDuration="1001/24000s" width="1080" height="1920"/>'
    + '<format id="r3" name="FFVideoFormatRateUndefined"/>'
    + '<media id="m1"><sequence format="r3"><spine/></sequence></media>'
    + '<event><project name="P"><sequence format="r1"><spine/></sequence></project></event>';
  assert.deepEqual(frameFromFCPXML(xml, FALLBACK), { width: 1080, height: 1920, fps: 23.976, aspect: '9:16' });
  // Without a project, the first sequence with a real rate.
  const clip = xml.replace(/<event>[\s\S]*<\/event>/, '<media id="m2"><sequence format="r1"/></media>');
  assert.equal(frameFromFCPXML(clip, FALLBACK).fps, 23.976);
});

test('the preview finds the picture under the playhead, through Final Cut\'s clocks', async () => {
  const { videoSegments, pictureAt } = await import('../fcp-extension/Panel/timeline.js');
  // The shape of a real project: one long spine gap whose own clock starts at
  // 01:00:00:00, every shot connected to it, a still at the end.
  const xml = `<fcpxml><resources>
    <asset id="a1" hasVideo="1"><media-rep kind="original-media" src="file:///Volumes/SSD/A.MP4"/></asset>
    <asset id="a2" hasVideo="1"><media-rep kind="original-media" src="file:///Volumes/SSD/B.MP4"/></asset>
    <asset id="a3" hasAudio="1"><media-rep kind="original-media" src="file:///Volumes/SSD/voice.mp3"/></asset>
    <asset id="a4" hasVideo="1"><media-rep kind="original-media" src="file:///Users/me/end.png"/></asset>
  </resources><library><event><project name="P"><sequence format="r1" tcStart="0s"><spine>
    <gap offset="0s" start="3600s" duration="20s">
      <asset-clip ref="a3" lane="-1" offset="3600s" duration="20s"/>
      <clip lane="1" offset="3600s" start="96/25s" duration="7s"><video ref="a1" offset="0s" duration="20s"/></clip>
      <clip lane="1" offset="3607s" start="2s" duration="8s"><video ref="a2" offset="0s" duration="20s"/></clip>
      <clip lane="1" offset="3615s" start="0s" duration="5s" enabled="0"><video ref="a1" offset="0s" duration="5s"/></clip>
      <video ref="a4" lane="1" offset="3615s" start="1h" duration="5s"/>
    </gap>
  </spine></sequence></project></event></library></fcpxml>`;

  const segs = videoSegments(xml);
  assert.deepEqual(segs.map((s) => [s.src.split('/').pop(), s.start, s.end]), [
    ['A.MP4', 0, 7], ['B.MP4', 7, 15], ['end.png', 15, 20],
  ], 'audio, below-storyline and disabled clips are not pictures');

  assert.deepEqual(pictureAt(segs, 0.5), { src: 'file:///Volumes/SSD/A.MP4', time: 3.84 + 0.5, still: false });
  assert.equal(pictureAt(segs, 8).time, 2 + 1);
  assert.equal(pictureAt(segs, 16).still, true);
  assert.equal(pictureAt(segs, 25), null);
});

test('security: the extension asks for no blanket access to the disk', async () => {
  const ent = await fs.readFile(path.join(EXT, 'Extension/Extension.entitlements'), 'utf8');
  // Footage is granted per folder by the editor, kept as a bookmark.
  assert.match(ent, /files\.bookmarks\.app-scope<\/key>\s*<true\/>/);
  assert.ok(!/absolute-path\.read-only/.test(ent), 'no read access to every drive');
  assert.ok(!/home-relative-path\.read-only/.test(ent), 'no read access to the whole home folder');
  // The only exception left is the shared styles folder.
  const exceptions = [...ent.matchAll(/temporary-exception[^<]*<\/key>\s*<array>([\s\S]*?)<\/array>/g)].map((m) => m[1].trim());
  assert.deepEqual(exceptions, ['<string>/Library/Application Support/PK Visuals/</string>']);
  assert.ok(!/get-task-allow/.test(ent), 'never ship the debugger entitlement');
});

test('security: release builds are Developer ID signed with the hardened runtime', async () => {
  const yml = await fs.readFile(path.join(EXT, 'project.yml'), 'utf8');
  assert.match(yml, /ENABLE_HARDENED_RUNTIME: YES/);
  assert.match(yml, /CODE_SIGN_IDENTITY: "Developer ID Application:/);
  assert.match(yml, /OTHER_CODE_SIGN_FLAGS: --timestamp/);
  assert.match(yml, /ARCHS: "arm64 x86_64"/);
  assert.match(yml, /CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO/);
});

test('security: untrusted input from a dropped timeline cannot crash or escape the panel', async () => {
  const grabber = await fs.readFile(path.join(EXT, 'Extension/FrameGrabber.swift'), 'utf8');
  assert.ok(!/URL\(string: [^)]*\)!/.test(grabber), 'no force-unwrapped URL from untrusted paths');
  assert.match(grabber, /static func mediaURL/);
  const vc = await fs.readFile(path.join(EXT, 'Extension/PKCaptionsViewController.swift'), 'utf8');
  assert.match(vc, /extension PKCaptionsViewController: WKNavigationDelegate/, 'navigation must be locked to the bundle');
  const html = await fs.readFile(path.join(EXT, 'Panel/panel.html'), 'utf8');
  assert.match(html, /Content-Security-Policy[^>]*default-src 'self'[^>]*object-src 'none'/);
});
