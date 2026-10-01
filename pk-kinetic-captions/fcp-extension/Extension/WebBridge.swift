import Foundation
import os

/// The extension's log. Messages are marked public: NSLog's arguments are
/// redacted in the unified log, which made the first run inside Final Cut
/// look as if the view controller never loaded.
///
///   log stream --predicate 'subsystem == "nz.pkvisuals.kinetic-captions"'
let panelLog = Logger(subsystem: "nz.pkvisuals.kinetic-captions", category: "panel")

/// The message names the panel and the native side agree on.
///
/// An enum rather than loose strings so a typo is a build error instead of a
/// message that silently goes nowhere — which, across a WKWebView boundary,
/// is otherwise almost impossible to notice.
enum WebBridge {

    enum Message: String, CaseIterable {
        /// "Give me the current timeline as FCPXML."
        case readTimeline
        /// "Here are the captions — put them on the timeline."
        case sendToTimeline
        /// Saved styles, from the shared Application Support folder.
        case listTemplates
        case saveTemplate
        case deleteTemplate
        /// Whether Final Cut is attached, and where styles are stored.
        case status
        /// Script errors and console.error from the page. Inside Final Cut
        /// there is no inspector to see them in, so they go to the system log.
        case log
        /// "The editor is dragging the captions out — offer this FCPXML."
        case beginDrag
        /// The panel's own settings (sizes per orientation, looks, colours).
        case loadPrefs
        case savePrefs
        /// A frame of the editor's footage for the preview.
        case frame
        /// Ask the editor, once, for the folder or drive that holds a clip.
        case grantAccess
    }
}
