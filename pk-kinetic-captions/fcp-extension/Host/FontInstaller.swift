import AppKit
import CoreText

/// Installs the caption fonts the presets use.
///
/// Final Cut draws a title only in a font that is installed, so a preset in
/// Montserrat or Anton needs those fonts on the editor's Mac. They are SIL
/// Open Font License fonts, bundled unmodified (Fonts/OFL.txt). Each family
/// the Mac does not already have is copied into ~/Library/Fonts — the same
/// place Font Book installs to — and registered so it is usable at once.
/// A family that is already installed is left alone, whatever its version.
enum FontInstaller {

    /// Families installed by this run, for the welcome text.
    @discardableResult
    static func installMissing() -> [String] {
        guard let folder = Bundle.main.url(forResource: "Fonts", withExtension: nil) else { return [] }
        let fm = FileManager.default
        let have = Set(NSFontManager.shared.availableFontFamilies)
        let target = fm.homeDirectoryForCurrentUser.appendingPathComponent("Library/Fonts", isDirectory: true)
        try? fm.createDirectory(at: target, withIntermediateDirectories: true)

        var installed = Set<String>()
        let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        for file in files where ["ttf", "otf"].contains(file.pathExtension.lowercased()) {
            guard let family = familyName(of: file), !have.contains(family) else { continue }
            let dest = target.appendingPathComponent(file.lastPathComponent)
            guard !fm.fileExists(atPath: dest.path) else { continue }
            do {
                try fm.copyItem(at: file, to: dest)
                CTFontManagerRegisterFontURLs([dest] as CFArray, .user, true, nil)
                installed.insert(family)
            } catch {
                NSLog("PK Kinetic Captions: could not install \(file.lastPathComponent): \(error.localizedDescription)")
            }
        }
        return installed.sorted()
    }

    private static func familyName(of file: URL) -> String? {
        guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(file as CFURL) as? [CTFontDescriptor],
              let first = descriptors.first else { return nil }
        return CTFontDescriptorCopyAttribute(first, kCTFontFamilyNameAttribute) as? String
    }
}
