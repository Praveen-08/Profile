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
final class PKCaptionsViewController: NSViewController {

    private var webView: DragWebView!
    private var bridge: TimelineBridge = MockTimelineBridge()
    private let store = TemplateStore()

    /// The FCPXML the panel last produced, held so it can be dragged out.
    private var pendingFCPXML: String?

    // MARK: - Lifecycle

    override func loadView() {
        let config = WKWebViewConfiguration()

        // The panel and the engine are local files; nothing is fetched.
        let controller = WKUserContentController()
        for name in WebBridge.Message.allCases { controller.add(self, name: name.rawValue) }
        config.userContentController = controller

        let web = DragWebView(frame: NSRect(x: 0, y: 0, width: 420, height: 720), configuration: config)
        web.onFCPXML = { [weak self] xml in self?.receiveDraggedFCPXML(xml) }
        web.registerForDraggedTypes([DragWebView.fcpxmlType, .fileURL, .string])

        // `drawsBackground` is not public API on WKWebView. Setting it through
        // KVC raises if the key ever goes away, and the panel would die on
        // launch inside Final Cut for a purely cosmetic reason — so the page's
        // own CSS paints the surface instead.
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = .clear }

        webView = web

        let container = NSView()
        container.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])
        view = container
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        try? store.prepare()

        guard let panel = Bundle(for: Self.self).url(forResource: "panel", withExtension: "html", subdirectory: "web") else {
            return present(error: "The panel's web resources are missing from the bundle. Run fcp-extension/scripts/bundle-web.mjs and rebuild.")
        }
        webView.loadFileURL(panel, allowingReadAccessTo: panel.deletingLastPathComponent())
    }

    // MARK: - Host

    /// Called by Final Cut when it attaches. The name is part of the host
    /// protocol — see ProExtensionTimelineBridge for what to reconcile.
    @objc func hostDidConnect(_ host: AnyObject) {
        let live = ProExtensionTimelineBridge()
        live.host = host
        bridge = live
        send(event: "hostConnected", payload: ["connected": true])
    }

    // MARK: - Drag in

    /// A clip was dragged onto the panel. Final Cut hands over the timeline as
    /// FCPXML, which already contains its captions with their real word
    /// timing — so nothing has to be exported, and nothing has to be typed.
    private func receiveDraggedFCPXML(_ xml: String) {
        send(event: "timelineDropped", payload: ["fcpxml": xml])
    }

    // MARK: - JavaScript bridge

    private func send(event: String, payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.pkkc && window.pkkc.receive(\(event.swiftQuoted), \(json))") { _, error in
            if let error { NSLog("[PKKC] bridge send failed: %@", error.localizedDescription) }
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
        NSLog("[PKKC] %@", error)
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
                "storeRoot": store.root.path,
            ])

        case .none:
            NSLog("[PKKC] unknown message from the panel: %@", message.name)
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
