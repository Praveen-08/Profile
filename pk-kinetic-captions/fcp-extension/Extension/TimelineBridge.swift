import Foundation

/// What the extension needs from Final Cut: the current timeline as FCPXML,
/// and a way to send FCPXML back.
///
/// Everything else in this target talks to this protocol and nothing else.
/// That is deliberate: `ProExtensionHost` is thinly documented, so the one
/// file that touches it (`ProExtensionTimelineBridge`) is the only file that
/// has to be reconciled against the real SDK headers. The view controller,
/// the web bridge and the template store are ordinary Swift and can be built
/// and run against `MockTimelineBridge` before Final Cut is involved at all.
protocol TimelineBridge: AnyObject {

    /// True when a host is attached. False when running standalone for development.
    var isConnected: Bool { get }

    /// Ask the host for the active timeline, serialised as FCPXML.
    ///
    /// This is where the captions come from: Final Cut's own transcription
    /// lives in the timeline, so the extension reads word timing that is
    /// already correct rather than asking anyone to export an SRT.
    func requestTimelineFCPXML(completion: @escaping (Result<String, TimelineError>) -> Void)

    /// Hand FCPXML back to Final Cut for it to place on the timeline.
    func sendFCPXML(_ xml: String, completion: @escaping (Result<Void, TimelineError>) -> Void)
}

enum TimelineError: LocalizedError {
    case notConnected
    case noActiveTimeline
    case hostRefused(String)
    case malformedResponse

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Final Cut Pro is not connected to this panel. Open it from Window ▸ Extensions."
        case .noActiveTimeline:
            return "No active timeline. Open a project in Final Cut Pro and try again."
        case .hostRefused(let reason):
            return "Final Cut Pro refused the request: \(reason)"
        case .malformedResponse:
            return "Final Cut Pro returned something this panel could not read."
        }
    }
}

/// Stand-in used when the panel runs outside Final Cut.
///
/// Worth keeping: it means the interface and the whole design engine can be
/// developed and debugged in a plain window, without relaunching Final Cut on
/// every change.
final class MockTimelineBridge: TimelineBridge {

    var isConnected: Bool { false }

    /// FCPXML with a caption on it, so the read path exercises the same code
    /// it will in production.
    private let sample = """
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE fcpxml>
    <fcpxml version="1.11">
      <resources>
        <format id="r1" frameDuration="1/30s" width="1080" height="1920"/>
      </resources>
      <library>
        <event name="Sample">
          <project name="Sample">
            <sequence format="r1" duration="300/30s">
              <spine>
                <gap name="Gap" offset="0s" start="0s" duration="300/30s">
                  <caption lane="1" offset="12/30s" duration="96/30s" role="iTT?captionFormat=ITT.en">
                    <text><text-style ref="cs1">I've always been competitive in sports,</text-style></text>
                  </caption>
                  <caption lane="1" offset="108/30s" duration="102/30s" role="iTT?captionFormat=ITT.en">
                    <text><text-style ref="cs1">business and real estate.</text-style></text>
                  </caption>
                </gap>
              </spine>
            </sequence>
          </project>
        </event>
      </library>
    </fcpxml>
    """

    func requestTimelineFCPXML(completion: @escaping (Result<String, TimelineError>) -> Void) {
        DispatchQueue.main.async { completion(.success(self.sample)) }
    }

    func sendFCPXML(_ xml: String, completion: @escaping (Result<Void, TimelineError>) -> Void) {
        // Write it where it can be inspected instead of silently discarding it.
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("pkkc-mock-send.fcpxml")
        try? xml.write(to: url, atomically: true, encoding: .utf8)
        NSLog("[PKKC] mock bridge wrote %@ (%d bytes)", url.path, xml.utf8.count)
        DispatchQueue.main.async { completion(.success(())) }
    }
}
