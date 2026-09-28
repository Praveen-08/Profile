import Foundation

//  ⚠️  THIS IS THE ONE FILE TO RECONCILE WITH THE SDK.
//
//  Final Cut's workflow-extension API (ProExtensionHost) is thinly
//  documented. The symbol names below are written against its documented
//  shape and Apple's sample extension; treat them as a first draft to check
//  against the real headers on your Mac:
//
//      xcrun --show-sdk-path
//      # then look for ProExtensionHost.framework and read its headers
//
//  Only this file should need changing. Everything else talks to
//  `TimelineBridge`, so once the three calls below compile, the panel works.
//
//  The three things needed from the host:
//    1. a handle to the host object
//    2. "give me the current timeline as FCPXML"
//    3. "here is FCPXML, put it on the timeline"

#if canImport(ProExtensionHost)
import ProExtensionHost

/// Live bridge to Final Cut Pro.
final class ProExtensionTimelineBridge: NSObject, TimelineBridge {

    /// Set by the view controller when the host hands over its object.
    weak var host: AnyObject?

    var isConnected: Bool { host != nil }

    func requestTimelineFCPXML(completion: @escaping (Result<String, TimelineError>) -> Void) {
        guard let host else { return completion(.failure(.notConnected)) }

        // RECONCILE: the host exposes the active timeline as FCPXML. In the
        // sample this is a `getFCPXML`-shaped call taking a completion. If the
        // real signature differs, adapt here and nothing else changes.
        let selector = NSSelectorFromString("requestFCPXMLWithCompletionHandler:")
        guard host.responds(to: selector) else {
            return completion(.failure(.hostRefused(
                "This build of Final Cut does not expose \(NSStringFromSelector(selector)). "
                + "Check ProExtensionHost's headers and update ProExtensionTimelineBridge.")))
        }

        let handler: @convention(block) (String?, NSError?) -> Void = { xml, error in
            DispatchQueue.main.async {
                if let error { return completion(.failure(.hostRefused(error.localizedDescription))) }
                guard let xml, !xml.isEmpty else { return completion(.failure(.noActiveTimeline)) }
                completion(.success(xml))
            }
        }
        _ = host.perform(selector, with: handler)
    }

    func sendFCPXML(_ xml: String, completion: @escaping (Result<Void, TimelineError>) -> Void) {
        guard let host else { return completion(.failure(.notConnected)) }

        // RECONCILE: the send-to-timeline call. Final Cut validates the
        // FCPXML and reports its own errors, so anything it rejects surfaces
        // through the completion rather than failing silently.
        let selector = NSSelectorFromString("sendFCPXML:completionHandler:")
        guard host.responds(to: selector) else {
            return completion(.failure(.hostRefused(
                "This build of Final Cut does not expose \(NSStringFromSelector(selector)). "
                + "Check ProExtensionHost's headers and update ProExtensionTimelineBridge.")))
        }

        let handler: @convention(block) (NSError?) -> Void = { error in
            DispatchQueue.main.async {
                if let error { return completion(.failure(.hostRefused(error.localizedDescription))) }
                completion(.success(()))
            }
        }
        _ = host.perform(selector, with: xml, with: handler)
    }
}

#else

/// Built without the framework — the panel still runs, against the mock.
final class ProExtensionTimelineBridge: NSObject, TimelineBridge {
    weak var host: AnyObject?
    var isConnected: Bool { false }

    func requestTimelineFCPXML(completion: @escaping (Result<String, TimelineError>) -> Void) {
        completion(.failure(.hostRefused("Built without ProExtensionHost. Build the extension target inside Final Cut's SDK.")))
    }

    func sendFCPXML(_ xml: String, completion: @escaping (Result<Void, TimelineError>) -> Void) {
        completion(.failure(.hostRefused("Built without ProExtensionHost.")))
    }
}

#endif
