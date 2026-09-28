import Cocoa

/// The wrapper app.
///
/// macOS will not install a bare app extension, so one has to ship inside an
/// application. This application has no job beyond existing — it says where
/// the panel is and closes. Keeping it that small is deliberate: everything
/// the editor actually does happens inside Final Cut.
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 260),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered, defer: false)
        window.title = "PK Kinetic Captions"
        window.center()

        let text = NSTextField(wrappingLabelWithString: """
        PK Kinetic Captions is installed.

        Open Final Cut Pro and choose Window ▸ Extensions ▸ PK Kinetic Captions.

        Drag a clip from the browser or the timeline onto the panel — its \
        captions come across with their timing, and the designed titles go \
        straight back to your timeline.
        """)
        text.font = .systemFont(ofSize: 13)
        text.frame = NSRect(x: 28, y: 28, width: 404, height: 204)
        window.contentView?.addSubview(text)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
