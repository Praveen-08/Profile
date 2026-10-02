import Foundation

/// Installs the PK Kinetic Caption title where Final Cut looks for titles.
///
/// Gradient and glow are drawn by this Motion title; Final Cut's Basic Title
/// cannot. The title ships inside the extension and is copied to
/// ~/Movies/Motion Templates.localized/Titles.localized/PK Visuals on launch,
/// and replaced whenever the bundled copy differs (an update). Final Cut
/// picks up a new title the next time it opens its Titles browser.
enum TitleInstaller {

    static let name = "PK Kinetic Caption"

    static var destination: URL {
        ProExtensionTimelineBridge.realHome
            .appendingPathComponent("Movies/Motion Templates.localized/Titles.localized/PK Visuals/\(name)", isDirectory: true)
            .appendingPathComponent("\(name).moti")
    }

    static var isInstalled: Bool { FileManager.default.fileExists(atPath: destination.path) }

    static func ensureInstalled() {
        guard let bundled = Bundle(for: PKCaptionsViewController.self)
            .url(forResource: name, withExtension: "moti", subdirectory: "title") else {
            return panelLog.error("the PK title is missing from the bundle")
        }
        let fm = FileManager.default
        if let have = fm.contents(atPath: destination.path), have == fm.contents(atPath: bundled.path) { return }
        do {
            try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            if fm.fileExists(atPath: destination.path) { try fm.removeItem(at: destination) }
            try fm.copyItem(at: bundled, to: destination)
            panelLog.notice("installed the PK title at \(destination.path, privacy: .public)")
        } catch {
            panelLog.error("could not install the PK title: \(error.localizedDescription, privacy: .public)")
        }
    }
}
