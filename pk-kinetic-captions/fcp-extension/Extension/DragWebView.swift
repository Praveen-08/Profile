import Cocoa
import WebKit

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
///
/// **Why this subclasses WKWebView rather than sitting behind one.** The web
/// view fills the panel and is the top-most view, so it is what the drag
/// lands on — a plain container underneath would never see the drop at all.
/// Overriding here intercepts first, and anything that is not Final Cut data
/// falls through to `super` so ordinary web drags keep working.
///
/// If a future WebKit routes drags past these overrides, the fallback is an
/// `NSView` layered above the web view with `registerForDraggedTypes`.
final class DragWebView: WKWebView {

    /// Final Cut's own pasteboard type.
    static let fcpxmlType = NSPasteboard.PasteboardType("com.apple.finalcutpro.xml")

    /// Final Cut also offers versioned flavours, and 12.2 drags as
    /// `com.apple.finalcutpro.xml.v1-14`. A view registered for only the
    /// unversioned name has the drag rejected before it becomes a drop — no
    /// error, nothing reaches the view. Listed up to a version beyond the
    /// current one; `fcpxml(from:)` reads any `com.apple.finalcutpro.xml*`.
    static let fcpxmlTypes: [NSPasteboard.PasteboardType] =
        [fcpxmlType] + (9...20).map { NSPasteboard.PasteboardType("com.apple.finalcutpro.xml.v1-\($0)") }

    var onFCPXML: ((String) -> Void)?

    // MARK: - Drag out

    /// Set when the editor presses the panel's "Drag to timeline" chip. The
    /// page cannot start a native drag itself, so it hands the FCPXML over
    /// and the next mouse-drag inside the web view becomes the drag.
    var pendingDragXML: String?

    override func mouseDragged(with event: NSEvent) {
        guard let xml = pendingDragXML else { return super.mouseDragged(with: event) }
        pendingDragXML = nil

        // Offered as Final Cut's own types, the way Final Cut offers a clip it
        // drags. The document says version 1.11, so that is the versioned
        // flavour declared alongside the unversioned one.
        let item = NSPasteboardItem()
        for type in [Self.fcpxmlType, NSPasteboard.PasteboardType("com.apple.finalcutpro.xml.v1-11")] {
            item.setString(xml, forType: type)
        }
        let dragged = NSDraggingItem(pasteboardWriter: item)
        let image = Self.dragImage()
        let point = convert(event.locationInWindow, from: nil)
        dragged.setDraggingFrame(NSRect(x: point.x - image.size.width / 2, y: point.y - image.size.height / 2,
                                        width: image.size.width, height: image.size.height), contents: image)
        panelLog.notice("drag out started, \(xml.utf8.count) bytes")
        beginDraggingSession(with: [dragged], event: event, source: self)
    }

    override func mouseUp(with event: NSEvent) {
        pendingDragXML = nil
        super.mouseUp(with: event)
    }

    /// What the editor sees under the pointer: a small clip-like label.
    private static func dragImage() -> NSImage {
        let size = NSSize(width: 180, height: 34)
        return NSImage(size: size, flipped: false) { rect in
            NSColor(calibratedRed: 0.79, green: 0.66, blue: 0.30, alpha: 0.92).setFill()
            NSBezierPath(roundedRect: rect, xRadius: 6, yRadius: 6).fill()
            let text = NSAttributedString(string: "PK Captions", attributes: [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: NSColor.black,
            ])
            let t = text.size()
            text.draw(at: NSPoint(x: (rect.width - t.width) / 2, y: (rect.height - t.height) / 2))
            return true
        }
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        // What the drag offers is the first question when a drop does nothing.
        let types = sender.draggingPasteboard.types?.map(\.rawValue).joined(separator: ", ") ?? "none"
        panelLog.notice("drag entered, offering: \(types, privacy: .public)")
        return fcpxml(from: sender) != nil ? .copy : super.draggingEntered(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        fcpxml(from: sender) != nil ? .copy : super.draggingUpdated(sender)
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        fcpxml(from: sender) != nil ? true : super.prepareForDragOperation(sender)
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let xml = fcpxml(from: sender) else { return super.performDragOperation(sender) }
        panelLog.notice("dropped FCPXML, \(xml.utf8.count) bytes")
        onFCPXML?(xml)
        return true
    }

    /// Pull FCPXML out of a drag, whichever way it was offered.
    ///
    /// Final Cut's own type is the direct case. A dragged `.fcpxml` file is
    /// the fallback for anything that hands over a file instead — which is
    /// what happens when someone drags in an export rather than a clip.
    private func fcpxml(from sender: NSDraggingInfo) -> String? {
        // Our own drag-out passing back over the panel is not a new source.
        if (sender.draggingSource as AnyObject?) === self { return nil }
        let board = sender.draggingPasteboard

        // Whatever versioned flavour this Final Cut offers.
        for type in board.types ?? [] where type.rawValue.hasPrefix(Self.fcpxmlType.rawValue) {
            if let direct = board.string(forType: type), direct.contains("<fcpxml") { return direct }
            if let data = board.data(forType: type),
               let direct = String(data: data, encoding: .utf8), direct.contains("<fcpxml") { return direct }
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

extension DragWebView: NSDraggingSource {
    func draggingSession(_ session: NSDraggingSession,
                         sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        context == .outsideApplication ? .copy : []
    }

    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        panelLog.notice("drag out ended, operation \(operation.rawValue)")
    }
}
