import AVFoundation
import AppKit
import CoreImage
import Vision

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
    /// A frame, and — when asked — the people in it cut out on a transparent
    /// background, so captions set behind the agent can be previewed behind them.
    struct Frame { let image: String; let person: String? }

    func frame(path: String, seconds: Double, maxHeight: CGFloat, cutout: Bool = false,
               completion: @escaping (Result<Frame, Error>) -> Void) {
        // The path comes from a dropped FCPXML, which is untrusted input: parse
        // it without force-unwrapping (a malformed one crashed the panel) and
        // read nothing that is not a video or image file.
        guard let url = Self.mediaURL(path) else {
            return completion(.failure(FrameError.notMedia))
        }
        queue.async {
            // A still on the timeline is an image file, which AVFoundation
            // cannot read as an asset.
            if Self.stills.contains(url.pathExtension.lowercased()) {
                let result = Self.still(url: url, maxHeight: maxHeight).map { Frame(image: $0, person: nil) }
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
                let person = cutout ? Self.personCutout(image) : nil
                DispatchQueue.main.async { completion(.success(Frame(image: url, person: person))) }
            }
        }
    }

    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// The people in `image`, on transparency, as a PNG data URL — so words
    /// set behind the agent can be previewed behind them, as Final Cut's
    /// Magnetic Mask will put them. Nil when nobody is found.
    ///
    /// Segmenting the whole frame misses a presenter who is small in a wide
    /// shot (measured on real listing footage: an agent at a sixth of the
    /// frame's height came back as no one). So people are found first, and
    /// each is segmented in a crop around them, at full detail.
    static func personCutout(_ image: CGImage) -> String? {
        let source = CIImage(cgImage: image)
        let extent = source.extent
        var mask = CIImage.empty().cropped(to: extent)

        let humans = VNDetectHumanRectanglesRequest()
        humans.upperBodyOnly = false
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([humans])
        var regions = (humans.results ?? []).filter { $0.confidence > 0.3 }.map { obs -> CGRect in
            let r = VNImageRectForNormalizedRect(obs.boundingBox, Int(extent.width), Int(extent.height))
            return r.insetBy(dx: -r.width * 0.25, dy: -r.height * 0.15).intersection(extent).integral
        }
        if regions.isEmpty { regions = [extent] }          // a close-up: the whole frame

        var found = false
        for region in regions {
            guard let crop = ciContext.createCGImage(source, from: region) else { continue }
            let request = VNGeneratePersonSegmentationRequest()
            request.qualityLevel = .accurate
            request.outputPixelFormat = kCVPixelFormatType_OneComponent8
            guard (try? VNImageRequestHandler(cgImage: crop, options: [:]).perform([request])) != nil,
                  let pb = request.results?.first?.pixelBuffer else { continue }
            var m = CIImage(cvPixelBuffer: pb)
            m = m.transformed(by: CGAffineTransform(scaleX: region.width / m.extent.width, y: region.height / m.extent.height))
                 .transformed(by: CGAffineTransform(translationX: region.minX, y: region.minY))
            mask = m.composited(over: mask)
            found = true
        }
        guard found, let blend = CIFilter(name: "CIBlendWithMask") else { return nil }
        blend.setValue(source, forKey: kCIInputImageKey)
        blend.setValue(CIImage.empty().cropped(to: extent), forKey: kCIInputBackgroundImageKey)
        blend.setValue(mask, forKey: kCIInputMaskImageKey)
        guard let output = blend.outputImage,
              let cut = ciContext.createCGImage(output, from: extent) else { return nil }
        guard let png = NSBitmapImageRep(cgImage: cut).representation(using: .png, properties: [:]) else { return nil }
        return "data:image/png;base64," + png.base64EncodedString()
    }

    enum FrameError: LocalizedError {
        case notMedia
        var errorDescription: String? { "That is not a video or image file." }
    }

    static let stills: Set<String> = ["png", "jpg", "jpeg", "heic", "heif", "tif", "tiff", "gif", "bmp", "webp"]
    static let movies: Set<String> = ["mov", "mp4", "m4v", "mxf", "avi", "mts", "m2ts", "3gp", "hevc", "braw", "r3d", "insv", "lrv"]

    /// A local video or image file named by `path`, or nil.
    static func mediaURL(_ path: String) -> URL? {
        let url: URL?
        if path.hasPrefix("file://") { url = URL(string: path) }
        else if path.hasPrefix("/") { url = URL(fileURLWithPath: path) }
        else { url = nil }
        guard let url, url.isFileURL else { return nil }
        let ext = url.pathExtension.lowercased()
        return stills.contains(ext) || movies.contains(ext) ? url.standardizedFileURL : nil
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
        let url = Self.mediaURL(path) ?? URL(fileURLWithPath: "/dev/null")
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
