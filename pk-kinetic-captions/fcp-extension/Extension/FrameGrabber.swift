import AVFoundation
import AppKit

/// Frames from the editor's own footage, for the panel's preview.
///
/// The preview draws the captions over the real picture so blends like
/// Difference can be judged against it. The panel works out which clip of the
/// dropped timeline is under the playhead and asks for that clip's source
/// file at a source time; this answers with a JPEG small enough to cross the
/// web-view bridge at playback rates.
final class FrameGrabber {

    private var generators: [String: AVAssetImageGenerator] = [:]
    private let queue = DispatchQueue(label: "nz.pkvisuals.kinetic-captions.frames")

    /// - Parameters:
    ///   - path: a file path or file:// URL from the timeline's media-rep.
    ///   - seconds: time in the source file.
    ///   - maxHeight: pixel height of the returned frame.
    func frame(path: String, seconds: Double, maxHeight: CGFloat,
               completion: @escaping (Result<String, Error>) -> Void) {
        queue.async {
            let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
            // A still on the timeline is an image file, which AVFoundation
            // cannot read as an asset.
            if ["png", "jpg", "jpeg", "heic", "tif", "tiff", "gif", "bmp", "webp"].contains(url.pathExtension.lowercased()) {
                let result: Result<String, Error> = Self.still(url: url, maxHeight: maxHeight)
                return DispatchQueue.main.async { completion(result) }
            }
            let generator = self.generator(for: path, maxHeight: maxHeight)
            let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
            generator.generateCGImageAsynchronously(for: time) { image, _, error in
                guard let image else {
                    return DispatchQueue.main.async { completion(.failure(error ?? CocoaError(.fileReadUnknown))) }
                }
                let rep = NSBitmapImageRep(cgImage: image)
                guard let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.72]) else {
                    return DispatchQueue.main.async { completion(.failure(CocoaError(.fileWriteUnknown))) }
                }
                let url = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                DispatchQueue.main.async { completion(.success(url)) }
            }
        }
    }

    private static func still(url: URL, maxHeight: CGFloat) -> Result<String, Error> {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceThumbnailMaxPixelSize: maxHeight * 2,
                  kCGImageSourceCreateThumbnailWithTransform: true,
              ] as CFDictionary),
              let jpeg = NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.72])
        else { return .failure(CocoaError(.fileReadCorruptFile)) }
        return .success("data:image/jpeg;base64," + jpeg.base64EncodedString())
    }

    private func generator(for path: String, maxHeight: CGFloat) -> AVAssetImageGenerator {
        let key = "\(path)#\(Int(maxHeight))"
        if let g = generators[key] { return g }
        let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
        let g = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        g.appliesPreferredTrackTransform = true
        g.maximumSize = CGSize(width: 0, height: maxHeight)
        // Scrubbing wants speed over frame accuracy; a frame either side is
        // invisible in a preview and several times faster to decode.
        g.requestedTimeToleranceBefore = CMTime(seconds: 0.04, preferredTimescale: 600)
        g.requestedTimeToleranceAfter = CMTime(seconds: 0.04, preferredTimescale: 600)
        generators[key] = g
        return g
    }
}
