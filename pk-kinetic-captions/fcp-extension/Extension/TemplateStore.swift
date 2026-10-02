import Foundation

/// Where saved styles live.
///
/// Deliberately the same folder the command line and the standalone app use,
/// so a style saved in one is available in the others. A style is a file, not
/// a database row: an editor can back the folder up by dragging it, and if
/// this software disappears the styles are still readable JSON.
///
///   ~/Library/Application Support/PK Visuals/Kinetic Captions/
///     templates/<id>.json
///     thumbnails/<id>.svg
///     brand.json
struct TemplateStore {

    let root: URL

    init() {
        // The real ~/Library, not FileManager's: inside the sandbox that
        // answers with the container's Application Support, and a style saved
        // there would never reach the CLI or the app. Reaching the real folder
        // is what the home-relative-path exception in the entitlements is for.
        let support = ProExtensionTimelineBridge.realHome
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
        root = support
            .appendingPathComponent("PK Visuals", isDirectory: true)
            .appendingPathComponent("Kinetic Captions", isDirectory: true)
    }

    private var templates: URL { root.appendingPathComponent("templates", isDirectory: true) }
    private var thumbnails: URL { root.appendingPathComponent("thumbnails", isDirectory: true) }

    /// The panel's settings: one small JSON file beside the styles.
    private var prefs: URL { root.appendingPathComponent("panel-prefs.json") }

    func loadPrefs() -> String? { try? String(contentsOf: prefs, encoding: .utf8) }

    func savePrefs(_ json: String) throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try json.write(to: prefs, atomically: true, encoding: .utf8)
    }

    // MARK: Word edits, per project

    /// The editor's word-by-word work on one project: per-word styles,
    /// levels and positions. Keyed by the panel's hash of the project, so
    /// dropping the same project again brings its edits back.
    private var edits: URL { root.appendingPathComponent("edits", isDirectory: true) }

    /// Only the panel's own hash shape is accepted as a file name, so a key
    /// can never reach outside the folder.
    private func editsFile(_ key: String) -> URL? {
        guard key.range(of: "^p[0-9a-f]{8,32}$", options: .regularExpression) != nil else { return nil }
        return edits.appendingPathComponent("\(key).json")
    }

    func loadEdits(_ key: String) -> String? {
        editsFile(key).flatMap { try? String(contentsOf: $0, encoding: .utf8) }
    }

    func saveEdits(_ key: String, _ json: String) throws {
        guard let file = editsFile(key) else { throw CocoaError(.fileWriteInvalidFileName) }
        try FileManager.default.createDirectory(at: edits, withIntermediateDirectories: true)
        try json.write(to: file, atomically: true, encoding: .utf8)
    }

    func prepare() throws {
        for dir in [templates, thumbnails] {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
    }

    /// Every saved style, as raw JSON for the panel to parse.
    func list() -> [String] {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: templates.path) else { return [] }
        return names.filter { $0.hasSuffix(".json") }.sorted().compactMap {
            try? String(contentsOf: templates.appendingPathComponent($0), encoding: .utf8)
        }
    }

    /// Write atomically so an interrupted save cannot leave half a style behind.
    func save(id: String, json: String) throws {
        try prepare()
        try json.write(to: templates.appendingPathComponent("\(safe(id)).json"), atomically: true, encoding: .utf8)
    }

    func saveThumbnail(id: String, svg: String) throws {
        try prepare()
        try svg.write(to: thumbnails.appendingPathComponent("\(safe(id)).svg"), atomically: true, encoding: .utf8)
    }

    func delete(id: String) throws {
        try? FileManager.default.removeItem(at: templates.appendingPathComponent("\(safe(id)).json"))
        try? FileManager.default.removeItem(at: thumbnails.appendingPathComponent("\(safe(id)).svg"))
    }

    /// An id becomes a filename, and ids can arrive from an imported style
    /// someone else made, so it must never be able to escape the folder.
    private func safe(_ id: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
        let cleaned = String(id.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
            .replacingOccurrences(of: "..", with: "-")
        let trimmed = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: ".-"))
        return trimmed.isEmpty ? "untitled" : String(trimmed.prefix(120))
    }
}
