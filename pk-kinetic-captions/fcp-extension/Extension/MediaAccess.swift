import AppKit

/// Access to the editor's footage, granted once per folder or drive.
///
/// The extension is sandboxed and asks for no blanket access to the disk.
/// When the preview needs a clip it cannot read, the editor is asked once to
/// choose the folder (or the whole drive) that holds it. That choice is kept as
/// a security-scoped bookmark and restored on every launch, so the question
/// never comes back for anything inside that folder — and because the editor
/// chose it in a macOS open panel, macOS does not ask its own removable-drive
/// question either.
final class MediaAccess {

    private let file: URL
    private var granted: [URL] = []

    init(storeRoot: URL) {
        file = storeRoot.appendingPathComponent("media-access.plist")
        restore()
    }

    /// True when `url` is readable now — inside a granted folder, or somewhere
    /// the sandbox already allows (Movies).
    func canRead(_ url: URL) -> Bool {
        FileManager.default.isReadableFile(atPath: url.path)
    }

    /// The folder to suggest for `url`: the drive's root for an external
    /// volume (one answer covers every clip on it), else the clip's folder.
    func suggestedFolder(for url: URL) -> URL {
        let parts = url.standardizedFileURL.pathComponents
        if parts.count > 2, parts[1] == "Volumes" {
            return URL(fileURLWithPath: "/Volumes/\(parts[2])", isDirectory: true)
        }
        return url.deletingLastPathComponent()
    }

    /// Ask the editor to choose the folder holding `url`. Completion gets true
    /// when the clip is readable afterwards.
    func requestAccess(for url: URL, from window: NSWindow?, completion: @escaping (Bool) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = false
        panel.directoryURL = suggestedFolder(for: url)
        panel.prompt = "Allow"
        panel.message = "PK Kinetic Captions needs to read your footage to preview captions over it. "
            + "Choose the drive or folder that holds “\(url.lastPathComponent)”. You will only be asked once."

        let finish: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard let self, response == .OK, let chosen = panel.url else { return completion(false) }
            self.remember(chosen)
            completion(self.canRead(url))
        }
        if let window { panel.beginSheetModal(for: window, completionHandler: finish) }
        else { finish(panel.runModal()) }
    }

    // MARK: - Bookmarks

    private func remember(_ folder: URL) {
        guard let data = try? folder.bookmarkData(options: .withSecurityScope,
                                                   includingResourceValuesForKeys: nil, relativeTo: nil)
        else { return }
        if folder.startAccessingSecurityScopedResource() { granted.append(folder) }
        var all = stored()
        all[folder.path] = data
        try? PropertyListSerialization.data(fromPropertyList: all, format: .binary, options: 0).write(to: file, options: .atomic)
    }

    private func stored() -> [String: Data] {
        guard let data = try? Data(contentsOf: file),
              let dict = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Data]
        else { return [:] }
        return dict
    }

    /// Re-open every folder granted before. A bookmark that has gone stale
    /// (the drive renamed, say) is dropped, and the editor is simply asked
    /// again the next time it matters.
    private func restore() {
        var all = stored()
        var changed = false
        for (path, data) in all {
            var stale = false
            guard let url = try? URL(resolvingBookmarkData: data, options: .withSecurityScope,
                                     relativeTo: nil, bookmarkDataIsStale: &stale),
                  url.startAccessingSecurityScopedResource()
            else { all[path] = nil; changed = true; continue }
            granted.append(url)
            if stale, let fresh = try? url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil) {
                all[path] = fresh; changed = true
            }
        }
        if changed {
            try? PropertyListSerialization.data(fromPropertyList: all, format: .binary, options: 0).write(to: file, options: .atomic)
        }
        panelLog.notice("media access restored for \(self.granted.count) folder(s)")
    }
}
