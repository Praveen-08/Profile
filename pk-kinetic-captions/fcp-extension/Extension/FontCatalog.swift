import AppKit

/// The fonts installed on this Mac, family by family, with each face's real
/// name. Final Cut matches a title's font by family and exact face name, so the
/// panel offers only faces that exist rather than guessing "Heavy" for a
/// family whose face is called "ExtraBold".
enum FontCatalog {

    /// NSFontManager weights (0–15) → CSS weights, for the preview.
    private static let cssWeight = [100, 100, 100, 200, 300, 400, 500, 500, 600, 700, 800, 900, 900, 900, 900, 900]

    static func list() -> [[String: Any]] {
        let manager = NSFontManager.shared
        return manager.availableFontFamilies
            .filter { !$0.hasPrefix(".") }                       // hidden system faces
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            .compactMap { family in
                guard let members = manager.availableMembers(ofFontFamily: family) else { return nil }
                let faces: [[String: Any]] = members.compactMap { m in
                    guard m.count >= 4, let face = m[1] as? String, let weight = m[2] as? Int, let traits = m[3] as? UInt else { return nil }
                    let italic = (traits & NSFontTraitMask.italicFontMask.rawValue) != 0
                    return ["face": face, "weight": cssWeight[max(0, min(15, weight))], "italic": italic]
                }
                return faces.isEmpty ? nil : ["family": family, "faces": faces]
            }
    }
}
