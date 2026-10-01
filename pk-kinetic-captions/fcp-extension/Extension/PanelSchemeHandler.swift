import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled panel at `pkkc://panel/…`.
///
/// The engine is ES modules, and WebKit will not load a module script from a
/// `file://` page: inside Final Cut, `loadFileURL` produced a blank panel and
/// the one clue was "could not load <script> …/web/panel.js". A custom scheme
/// gives the page a real origin, so `import` works exactly as it does in the
/// CLI's browser preview. Everything is read from the bundle; nothing is
/// fetched from the network.
final class PanelSchemeHandler: NSObject, WKURLSchemeHandler {

    static let scheme = "pkkc"
    static let entry = URL(string: "pkkc://panel/panel.html")!

    private let root: URL

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            return task.didFailWithError(URLError(.badURL))
        }

        // Resolve inside the web folder only; a "../" must not escape it.
        let file = root.appendingPathComponent(url.path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"),
              let data = try? Data(contentsOf: file) else {
            panelLog.error("panel resource not found: \(url.path, privacy: .public)")
            return task.didFailWithError(URLError(.fileDoesNotExist))
        }

        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": Self.mimeType(for: file),
            "Content-Length": String(data.count),
            "Cache-Control": "no-store",
        ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    /// Module scripts are refused unless served as JavaScript, so the type matters.
    private static func mimeType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "html": return "text/html; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        default: return UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
