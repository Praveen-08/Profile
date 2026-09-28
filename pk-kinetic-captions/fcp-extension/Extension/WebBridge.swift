import Foundation

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
    }
}
