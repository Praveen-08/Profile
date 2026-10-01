import Cocoa

//  The one file that touches Final Cut's workflow-extension API.
//
//  Reconciled against Final Cut 12.2 itself rather than against headers —
//  there are none. ProExtension.framework ships without them, and the classes
//  Final Cut hands an extension come from ProExtensionHost.framework, which
//  Final Cut injects into the extension process at run time. So nothing here
//  imports a module; every class is reached by name.
//
//  What the API actually offers, enumerated from inside Final Cut 12.2:
//
//    ProExtensionRequestHandling.sharedInstance.extensionContext   (pull, not a callback)
//      .host  → FCPXHost: name, versionString, bundleIdentifier, timeline
//    FCPXTimeline: activeSequence, playheadTime, movePlayheadTo:, sequenceTimeRange
//    FCPXHost.sendHostActionTo:action:auxiliaryInfo:  (timeline actions; no reply)
//
//  What it does NOT offer, which decides this file:
//
//    · no call that returns the timeline as FCPXML
//    · no call that takes FCPXML and places it on the timeline
//
//  The first draft of this file called `requestFCPXMLWithCompletionHandler:`
//  and `sendFCPXML:completionHandler:`. Neither exists. So:
//
//    read  → drag. A clip or project dragged onto the panel carries the whole
//            timeline as FCPXML on the pasteboard (DragWebView). That path
//            does not involve this API at all, and it works.
//    send  → the finished .fcpxml is written to ~/Movies/PK Kinetic Captions
//            and opened in Final Cut, which imports it.

/// Live bridge to Final Cut Pro.
final class ProExtensionTimelineBridge: NSObject, TimelineBridge {

    /// Final Cut's `FCPXHost`, when the panel is running inside it.
    private(set) var host: AnyObject?

    var isConnected: Bool { host != nil }

    /// Reach Final Cut, if the panel is running inside it.
    ///
    /// Returns nil outside Final Cut — in a plain window during development,
    /// say — where the classes are not loaded and there is nothing to reach.
    static func connect() -> ProExtensionTimelineBridge? {
        guard let cls = NSClassFromString("ProExtensionRequestHandling") as? NSObject.Type,
              cls.responds(to: NSSelectorFromString("sharedInstance")),
              let shared = cls.perform(NSSelectorFromString("sharedInstance"))?.takeUnretainedValue() as? NSObject,
              let context = shared.value(forKey: "extensionContext") as? NSObject,
              let host = context.value(forKey: "host") as AnyObject?
        else { return nil }

        let bridge = ProExtensionTimelineBridge()
        bridge.host = host
        return bridge
    }

    /// "Final Cut Pro 12.2", for the status line.
    var hostDescription: String? {
        guard let host = host as? NSObject else { return nil }
        let name = host.value(forKey: "name") as? String ?? "Final Cut Pro"
        let version = host.value(forKey: "versionString") as? String ?? ""
        return version.isEmpty ? name : "\(name) \(version)"
    }

    func requestTimelineFCPXML(completion: @escaping (Result<String, TimelineError>) -> Void) {
        // There is nothing to ask. Say how to get the timeline instead of
        // pretending to try.
        DispatchQueue.main.async {
            completion(.failure(.hostRefused(
                "Final Cut does not let extensions read the timeline. "
                + "Drag the project or clip from Final Cut onto this panel instead.")))
        }
    }

    func sendFCPXML(_ xml: String, completion: @escaping (Result<Void, TimelineError>) -> Void) {
        do {
            let url = try Self.write(xml)
            guard let finalCut = Self.finalCutURL() else {
                return completion(.failure(.hostRefused(
                    "Saved \(url.lastPathComponent) to Movies ▸ PK Kinetic Captions, but could not find Final Cut to open it.")))
            }
            let config = NSWorkspace.OpenConfiguration()
            config.activates = true
            NSWorkspace.shared.open([url], withApplicationAt: finalCut, configuration: config) { _, error in
                DispatchQueue.main.async {
                    if let error {
                        return completion(.failure(.hostRefused(
                            "Saved \(url.lastPathComponent) to Movies ▸ PK Kinetic Captions, but Final Cut would not open it: \(error.localizedDescription)")))
                    }
                    completion(.success(()))
                }
            }
        } catch {
            completion(.failure(.hostRefused("Could not save the captions: \(error.localizedDescription)")))
        }
    }

    // MARK: - Files

    /// The user's real Movies folder.
    ///
    /// Not `FileManager.urls(for: .moviesDirectory…)`: in a sandboxed
    /// extension that returns the container's Movies folder, which Final Cut
    /// would import from — and the project would go offline the day the
    /// container is cleaned up.
    static var outputFolder: URL {
        realHome
            .appendingPathComponent("Movies", isDirectory: true)
            .appendingPathComponent("PK Kinetic Captions", isDirectory: true)
    }

    static var realHome: URL {
        if let pw = getpwuid(getuid()), let dir = pw.pointee.pw_dir {
            return URL(fileURLWithPath: String(cString: dir), isDirectory: true)
        }
        return FileManager.default.homeDirectoryForCurrentUser
    }

    private static func write(_ xml: String) throws -> URL {
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)
        // No colons: Finder shows them as slashes.
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH.mm.ss"
        let stamp = formatter.string(from: Date())
        let url = outputFolder.appendingPathComponent("Captions \(stamp).fcpxml")
        try xml.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    private static func finalCutURL() -> URL? {
        for id in ["com.apple.FinalCut", "com.apple.FinalCutTrial"] {
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: id) { return url }
        }
        return nil
    }
}
