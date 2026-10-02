import Cocoa
import WebKit
import UniformTypeIdentifiers

/// The panel Final Cut shows under Window ▸ Extensions.
///
/// It is a thin shell. All the design work — phrasing, emphasis, typography,
/// layout, motion, compositing, and writing the FCPXML — happens in the
/// JavaScript engine loaded into the web view, which is the same engine the
/// command line and the standalone app use. Keeping it that way is the point:
/// three front ends, one set of design decisions, no drift.
///
/// Swift's job is only what a web view cannot do:
///   · talk to Final Cut
///   · accept a clip dragged in, and offer the result to drag out
///   · read and write the styles folder
///
/// `@objc(PKCaptionsViewController)` gives it a plain Objective-C name, which
/// is what `ProExtensionPrincipalViewControllerClass` in Info.plist names.
/// Without it the runtime name is module-mangled and Final Cut finds nothing.
@objc(PKCaptionsViewController)
final class PKCaptionsViewController: NSViewController {

    private var webView: DragWebView!
    private var bridge: TimelineBridge = MockTimelineBridge()
    private let store = TemplateStore()
    private let frames = FrameGrabber()
    private lazy var media = MediaAccess(storeRoot: store.root)

    /// The FCPXML the panel last produced, held so it can be dragged out.
    private var pendingFCPXML: String?

    // MARK: - Lifecycle

    override func loadView() {
        let config = WKWebViewConfiguration()

        // The panel and the engine are local files; nothing is fetched.
        let controller = WKUserContentController()
        for name in WebBridge.Message.allCases { controller.add(self, name: name.rawValue) }
        // Installed before any page script runs, so a module that fails to
        // load or throws at the top level is still reported.
        controller.addUserScript(WKUserScript(source: Self.errorForwarder,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
        config.userContentController = controller

        // Served from the bundle under pkkc:// rather than file:// — see
        // PanelSchemeHandler for why module scripts need it.
        if let web = Bundle(for: Self.self).resourceURL?.appendingPathComponent("web", isDirectory: true) {
            config.setURLSchemeHandler(PanelSchemeHandler(root: web), forURLScheme: PanelSchemeHandler.scheme)
        }

        let web = DragWebView(frame: NSRect(x: 0, y: 0, width: 420, height: 720), configuration: config)
        web.onFCPXML = { [weak self] xml in self?.receiveDraggedFCPXML(xml) }
        web.registerForDraggedTypes(DragWebView.fcpxmlTypes + [.fileURL, .string])

        // `drawsBackground` is not public API on WKWebView. Setting it through
        // KVC raises if the key ever goes away, and the panel would die on
        // launch inside Final Cut for a purely cosmetic reason — so the page's
        // own CSS paints the surface instead.
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = .clear }
        // Lets Safari's Develop menu attach to the panel while it runs in Final Cut.
        if #available(macOS 13.3, *) { web.isInspectable = true }

        web.navigationDelegate = self
        webView = web

        // Final Cut sizes the extension window from this view's frame. A bare
        // NSView() is zero-sized, and the web view pinned inside it has no
        // size of its own — the panel opened as a 0 px-wide title bar.
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 420, height: 720))
        container.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            // Final Cut sizes the window from the view's Auto Layout fitting
            // size, not its frame. A web view has no intrinsic size, so
            // without these the fitting size is zero and the panel opens as a
            // bare title bar (measured: {0, 28}) — which Final Cut then saves
            // and restores on every later open.
            //
            // Preferred, never required: Final Cut can restore a saved frame
            // smaller than any minimum given here, and a required height then
            // makes the view taller than the window — AppKit's origin is the
            // bottom left, so the top of the panel (drop zone, status) is cut
            // off. The window's minimum is ContentViewMinimum* in Info.plist.
            preferred(container.widthAnchor.constraint(equalToConstant: 420)),
            preferred(container.heightAnchor.constraint(equalToConstant: 720)),
        ])
        // No preferredContentSize: Final Cut held the view at exactly that
        // size, so it neither filled a larger window nor shrank to a smaller one.
        view = container
    }

    /// Sends uncaught errors, rejected promises and console.error to the
    /// native log. Without it a script failure inside Final Cut is a blank
    /// panel and nothing anywhere says why.
    private static let errorForwarder = """
    (() => {
      const post = (message) => {
        try { window.webkit.messageHandlers.log.postMessage({ message: String(message) }); } catch {}
      };
      window.addEventListener('error', (e) => {
        // A <script> or <link> that fails to load fires a bare Event on the
        // element, with no message — name the resource instead.
        const el = e.target;
        if (el && el !== window && (el.src || el.href)) return post(`could not load <${el.tagName.toLowerCase()}> ${el.src || el.href}`);
        post(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
      }, true);
      window.addEventListener('unhandledrejection', (e) => post(`unhandled rejection: ${e.reason && e.reason.stack || e.reason}`));
      const original = console.error.bind(console);
      console.error = (...args) => { post(args.map(String).join(' ')); original(...args); };
    })();
    """

    /// A size the window opens at but the editor can resize away from. Low
    /// enough that the window always wins, but above the fitting-size
    /// compression priority (50), so the first open still has a size.
    private func preferred(_ constraint: NSLayoutConstraint) -> NSLayoutConstraint {
        constraint.priority = .defaultLow
        return constraint
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        try? store.prepare()
        TitleInstaller.ensureInstalled()
        LicenseManager.shared.onChange = { [weak self] in self?.pushLicense() }
        LicenseManager.shared.start()
        connectToHost()

        guard Bundle(for: Self.self).url(forResource: "panel", withExtension: "html", subdirectory: "web") != nil else {
            return present(error: "The panel's web resources are missing from the bundle. Run fcp-extension/scripts/bundle-web.mjs and rebuild.")
        }
        webView.load(URLRequest(url: PanelSchemeHandler.entry))
    }

    // MARK: - Host

    /// Final Cut never calls in to say it has attached — reaching it is a
    /// pull. Outside Final Cut there is nothing to reach and the mock stays.
    private func connectToHost() {
        guard let live = ProExtensionTimelineBridge.connect() else {
            panelLog.notice("not running inside Final Cut; using the mock bridge")
            return
        }
        bridge = live
        panelLog.notice("connected to \(live.hostDescription ?? "Final Cut", privacy: .public)")
    }

    private var hostDescription: String? {
        (bridge as? ProExtensionTimelineBridge)?.hostDescription
    }

    // MARK: - Drag in

    /// A clip was dragged onto the panel. Final Cut hands over the timeline as
    /// FCPXML, which already contains its captions with their real word
    /// timing — so nothing has to be exported, and nothing has to be typed.
    private func receiveDraggedFCPXML(_ xml: String) {
        // Keep the last drop, so "no captions found" can be checked against
        // what Final Cut actually sent — and a customer can send it to support.
        // Beside the styles, because a signed app's container is protected from
        // every other process, including the person debugging it:
        // ~/Library/Application Support/PK Visuals/Kinetic Captions/diagnostics/
        let dir = store.root.appendingPathComponent("diagnostics", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? xml.write(to: dir.appendingPathComponent("last-drop.fcpxml"), atomically: true, encoding: .utf8)
        send(event: "timelineDropped", payload: ["fcpxml": xml])
    }

    // MARK: - JavaScript bridge

    private func send(event: String, payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.pkkc && window.pkkc.receive(\(event.swiftQuoted), \(json))") { _, error in
            if let error { panelLog.error("bridge send failed: \(error.localizedDescription, privacy: .public)") }
        }
    }

    private func reply(to id: String, ok: Bool, payload: [String: Any]) {
        var body = payload
        body["__id"] = id
        body["__ok"] = ok
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.pkkc && window.pkkc.resolve(\(json))")
    }

    private func present(error: String) {
        panelLog.error("\(error, privacy: .public)")
        let label = NSTextField(wrappingLabelWithString: error)
        label.frame = view.bounds.insetBy(dx: 20, dy: 20)
        view.addSubview(label)
    }
}

// MARK: - Messages from the panel

extension PKCaptionsViewController: WKScriptMessageHandler {

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body as? [String: Any] ?? [:]
        let id = body["__id"] as? String ?? ""

        switch WebBridge.Message(rawValue: message.name) {

        case .readTimeline:
            bridge.requestTimelineFCPXML { [weak self] result in
                switch result {
                case .success(let xml): self?.reply(to: id, ok: true, payload: ["fcpxml": xml])
                case .failure(let error): self?.reply(to: id, ok: false, payload: ["error": error.localizedDescription])
                }
            }

        case .sendToTimeline:
            guard LicenseManager.shared.isUsable else {
                return reply(to: id, ok: false, payload: ["error": LicenseManager.shared.summary])
            }
            guard let xml = body["fcpxml"] as? String, !xml.isEmpty else {
                return reply(to: id, ok: false, payload: ["error": "No FCPXML to send."])
            }
            // Hold it for a drag-out too, so the panel works even when the
            // host's send call is unavailable.
            pendingFCPXML = xml
            bridge.sendFCPXML(xml) { [weak self] result in
                switch result {
                case .success: self?.reply(to: id, ok: true, payload: [:])
                case .failure(let error): self?.reply(to: id, ok: false, payload: ["error": error.localizedDescription])
                }
            }

        case .listTemplates:
            let all = store.list()
            reply(to: id, ok: true, payload: ["templates": all])

        case .saveTemplate:
            guard let templateId = body["id"] as? String, let json = body["json"] as? String else {
                return reply(to: id, ok: false, payload: ["error": "A template needs an id and its JSON."])
            }
            do {
                try store.save(id: templateId, json: json)
                if let svg = body["thumbnail"] as? String { try store.saveThumbnail(id: templateId, svg: svg) }
                reply(to: id, ok: true, payload: [:])
            } catch {
                reply(to: id, ok: false, payload: ["error": error.localizedDescription])
            }

        case .deleteTemplate:
            guard let templateId = body["id"] as? String else {
                return reply(to: id, ok: false, payload: ["error": "No template id."])
            }
            try? store.delete(id: templateId)
            reply(to: id, ok: true, payload: [:])

        case .status:
            reply(to: id, ok: true, payload: [
                "connected": bridge.isConnected,
                "host": hostDescription ?? "",
                "storeRoot": store.root.path,
                "outputFolder": ProExtensionTimelineBridge.outputFolder.path,
                "pkTitle": TitleInstaller.isInstalled,
            ])

        case .beginDrag:
            guard LicenseManager.shared.isUsable else {
                webView.pendingDragXML = nil
                return reply(to: id, ok: false, payload: ["error": LicenseManager.shared.summary])
            }
            guard let xml = body["fcpxml"] as? String, !xml.isEmpty else {
                return reply(to: id, ok: false, payload: ["error": "Nothing to drag yet."])
            }
            webView.pendingDragXML = xml
            reply(to: id, ok: true, payload: [:])

        case .frame:
            guard let path = body["path"] as? String, let time = body["time"] as? Double else {
                return reply(to: id, ok: false, payload: ["error": "No clip to preview."])
            }
            let height = body["height"] as? Double ?? 720
            // Say so plainly when the footage is somewhere not yet allowed, so
            // the panel can offer the one-time "Allow access" instead of a
            // black preview.
            if let url = FrameGrabber.mediaURL(path), !media.canRead(url) {
                let folder = media.suggestedFolder(for: url)
                return reply(to: id, ok: false, payload: [
                    "error": "needsAccess", "folder": folder.lastPathComponent, "path": path,
                ])
            }
            frames.frame(path: path, seconds: time, maxHeight: CGFloat(height), cutout: body["cutout"] as? Bool ?? false) { [weak self] result in
                switch result {
                case .success(let frame):
                    var payload: [String: Any] = ["image": frame.image]
                    if let person = frame.person { payload["person"] = person }
                    self?.reply(to: id, ok: true, payload: payload)
                case .failure(let error): self?.reply(to: id, ok: false, payload: ["error": error.localizedDescription])
                }
            }

        case .grantAccess:
            guard let path = body["path"] as? String, let url = FrameGrabber.mediaURL(path) else {
                return reply(to: id, ok: false, payload: ["error": "No clip to grant access for."])
            }
            media.requestAccess(for: url, from: view.window) { [weak self] ok in
                self?.reply(to: id, ok: ok, payload: ok ? [:] : ["error": "Access was not given."])
            }

        case .fonts:
            reply(to: id, ok: true, payload: ["fonts": FontCatalog.list()])

        case .loadPrefs:
            reply(to: id, ok: true, payload: ["json": store.loadPrefs() ?? ""])

        case .savePrefs:
            guard let json = body["json"] as? String else {
                return reply(to: id, ok: false, payload: ["error": "No settings to save."])
            }
            do {
                try store.savePrefs(json)
                reply(to: id, ok: true, payload: [:])
            } catch {
                reply(to: id, ok: false, payload: ["error": error.localizedDescription])
            }

        case .loadEdits:
            reply(to: id, ok: true, payload: ["json": store.loadEdits(body["key"] as? String ?? "") ?? ""])

        case .saveEdits:
            do {
                try store.saveEdits(body["key"] as? String ?? "", body["json"] as? String ?? "")
                reply(to: id, ok: true, payload: [:])
            } catch {
                reply(to: id, ok: false, payload: ["error": error.localizedDescription])
            }

        case .license:
            reply(to: id, ok: true, payload: licensePayload())

        case .licenseActivate:
            LicenseManager.shared.activate(key: body["key"] as? String ?? "") { [weak self] error in
                guard let self else { return }
                if let error { self.reply(to: id, ok: false, payload: ["error": error]) }
                else { self.reply(to: id, ok: true, payload: self.licensePayload()) }
            }

        case .licenseDeactivate:
            LicenseManager.shared.deactivateThisMac { [weak self] error in
                guard let self else { return }
                if let error { self.reply(to: id, ok: false, payload: ["error": error]) }
                else { self.reply(to: id, ok: true, payload: self.licensePayload()) }
            }

        case .log:
            let text = body["message"] as? String ?? "\(message.body)"
            panelLog.error("page: \(text, privacy: .public)")

        case .none:
            panelLog.error("unknown message from the panel: \(message.name, privacy: .public)")
        }
    }
}

private extension String {
    /// Quote a string for embedding in evaluated JavaScript.
    var swiftQuoted: String {
        let escaped = replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
        return "\"\(escaped)\""
    }
}

// MARK: - Navigation lock

/// The panel only ever shows its own bundled pages. Anything else — a link, a
/// redirect, a dropped URL — is refused, so nothing from outside can run with
/// the panel's access to the bridge.
extension PKCaptionsViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let allowed = action.request.url?.scheme == PanelSchemeHandler.scheme
        if !allowed { panelLog.error("blocked navigation to \(action.request.url?.absoluteString ?? "?", privacy: .public)") }
        decisionHandler(allowed ? .allow : .cancel)
    }
}

// MARK: - Licence

extension PKCaptionsViewController {

    func licensePayload() -> [String: Any] {
        let m = LicenseManager.shared
        let kind: String
        switch m.state {
        case .checking: kind = "checking"
        case .unlicensed: kind = "unlicensed"
        case .trial: kind = "trial"
        case .active: kind = "active"
        case .expired: kind = "expired"
        case .blocked: kind = "blocked"
        }
        return ["usable": m.isUsable, "state": kind, "summary": m.summary]
    }

    /// Tell the panel when the licence changes (a background re-check, a trial ending).
    func pushLicense() { send(event: "license", payload: licensePayload()) }
}
