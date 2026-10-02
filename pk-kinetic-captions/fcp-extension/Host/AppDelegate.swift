import Cocoa

/// The wrapper app.
///
/// macOS will not install a bare app extension, so one has to ship inside an
/// application. This application's only jobs are installing the caption fonts
/// (FontInstaller) and saying where the panel is. Keeping it that small is
/// deliberate: everything the editor actually does happens inside Final Cut.
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let fonts = FontInstaller.installMissing()
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
        """ + (fonts.isEmpty ? "" : "\n\nInstalled the caption fonts: \(fonts.joined(separator: ", "))."))
        text.font = .systemFont(ofSize: 13)
        text.frame = NSRect(x: 28, y: 28, width: 404, height: 204)
        window.contentView?.addSubview(text)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
