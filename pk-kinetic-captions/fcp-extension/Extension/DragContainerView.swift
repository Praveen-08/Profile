import Cocoa

/// The panel's drag destination.
///
/// This is the input path that matters most. A clip dragged out of Final
/// Cut's browser or timeline carries the whole timeline as FCPXML on the
/// pasteboard — captions, word timing and all. Reading it here means the
/// editor never exports anything: they drag the clip onto the panel and the
/// captions are simply there, aligned, because Final Cut already aligned them.
///
/// A web view cannot do this. Browsers only expose the standard web drag
/// types, so Apple's own flavour never reaches a page. It has to be claimed
/// natively, which is most of the reason this panel exists.
final class DragContainerView: NSView {

    var onDrop: ((String) -> Void)?

    override init(frame: NSRect) {
        super.init(frame: frame)
        registerForDraggedTypes([PKCaptionsViewController.fcpxmlType, .fileURL, .string])
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        registerForDraggedTypes([PKCaptionsViewController.fcpxmlType, .fileURL, .string])
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        fcpxml(from: sender) != nil ? .copy : []
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let xml = fcpxml(from: sender) else { return false }
        onDrop?(xml)
        return true
    }

    /// Pull FCPXML out of a drag, whichever way it was offered.
    ///
    /// Final Cut's own type is the direct case. A dragged `.fcpxml` file is
    /// the fallback for anything that hands over a file instead — which is
    /// what happens when someone drags in an export rather than a clip.
    private func fcpxml(from sender: NSDraggingInfo) -> String? {
        let board = sender.draggingPasteboard

        if let direct = board.string(forType: PKCaptionsViewController.fcpxmlType), direct.contains("<fcpxml") {
            return direct
        }

        if let urls = board.readObjects(forClasses: [NSURL.self]) as? [URL] {
            for url in urls where url.pathExtension.lowercased() == "fcpxml" {
                if let text = try? String(contentsOf: url, encoding: .utf8) { return text }
            }
        }

        if let text = board.string(forType: .string), text.contains("<fcpxml") {
            return text
        }

        return nil
    }
}
