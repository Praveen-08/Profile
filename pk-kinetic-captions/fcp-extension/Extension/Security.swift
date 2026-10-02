import CryptoKit
import Foundation
import IOKit
import Security

/// Shared with 08 Track and 08 Callout (PKPropertyBoundary/Editor/Security.swift);
/// only the device salt and keychain service differ.
///
/// The pieces licensing leans on: which Mac this is, whether the app is still
/// the one that was signed, and a network client that refuses to talk to
/// anything but the real licence server.
///
/// None of this makes a native app uncrackable — a determined attacker with a
/// debugger can patch any client. What it does is stop the easy attacks:
/// copying an activated licence to another Mac, editing the cached licence,
/// pointing the app at a fake server with a self-signed certificate, running
/// a modified build, and turning the clock back.
enum Security {

    // MARK: this Mac

    /// Stable per-Mac identifier, hashed so the raw hardware UUID never leaves.
    static let deviceID: String = {
        var uuid = ""
        let service = IOServiceGetMatchingService(kIOMainPortDefault,
                                                  IOServiceMatching("IOPlatformExpertDevice"))
        if service != 0 {
            if let cf = IORegistryEntryCreateCFProperty(service, "IOPlatformUUID" as CFString,
                                                        kCFAllocatorDefault, 0) {
                uuid = (cf.takeRetainedValue() as? String) ?? ""
            }
            IOObjectRelease(service)
        }
        if uuid.isEmpty {
            // No hardware UUID (rare). Fall back to a random id kept in this
            // Mac's Keychain — still per-Mac, and it never leaves the device.
            let account = "device.v1"
            if let d = keychainGet(account), let s = String(data: d, encoding: .utf8), !s.isEmpty {
                uuid = s
            } else {
                uuid = UUID().uuidString
                keychainSet(account, Data(uuid.utf8))
            }
        }
        let d = SHA256.hash(data: Data((uuid + "|PKKineticCaptions").utf8))
        return d.map { String(format: "%02x", $0) }.joined()
    }()

    static var deviceName: String {
        Host.current().localizedName ?? ProcessInfo.processInfo.hostName
    }

    /// Key for signing local records, derived from this Mac. A licence copied
    /// to another Mac fails its check there.
    private static var localKey: SymmetricKey {
        SymmetricKey(data: SHA256.hash(data: Data(("k1|" + deviceID).utf8)))
    }

    static func sign(_ data: Data) -> String {
        Data(HMAC<SHA256>.authenticationCode(for: data, using: localKey)).base64EncodedString()
    }

    static func verify(_ data: Data, signature: String) -> Bool {
        guard let sig = Data(base64Encoded: signature) else { return false }
        return HMAC<SHA256>.isValidAuthenticationCode(sig, authenticating: data, using: localKey)
    }

    // MARK: keychain (device-only, never synced to iCloud)

    /// Each app keeps its own licence. The extension's bundle id, so the
    /// item lives with the code that reads it.
    private static var service: String {
        Bundle.main.bundleIdentifier ?? "nz.pkvisuals.kinetic-captions.panel"
    }

    static func keychainSet(_ account: String, _ value: Data) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: service,
                                kSecAttrAccount as String: account]
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = value
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func keychainGet(_ account: String) -> Data? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: service,
                                kSecAttrAccount as String: account,
                                kSecReturnData as String: true,
                                kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    static func keychainDelete(_ account: String) {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword,
                       kSecAttrService as String: service,
                       kSecAttrAccount as String: account] as CFDictionary)
    }

    // MARK: the app itself

    /// True when this build is signed by the expected team and unmodified.
    /// Builds without a team in Info.plist (development) skip the check.
    ///
    /// Only a clear "this isn't your signed app any more" answer counts as
    /// tampering. Anything inconclusive passes: a customer on a plane, or one
    /// hitting a transient Keychain error, must never be locked out by this.
    /// It is also hashed once an hour at most, since it reads the whole bundle.
    private static var intactCache: (Bool, Date)?

    static func appIntact() -> Bool {
        if let (v, when) = intactCache, Date().timeIntervalSince(when) < 3600 { return v }
        let result = checkSignature()
        intactCache = (result, Date())
        return result
    }

    private static func checkSignature() -> Bool {
        guard let team = Bundle.main.object(forInfoDictionaryKey: "TFTeamID") as? String,
              !team.isEmpty else { return true }
        var code: SecStaticCode?
        guard SecStaticCodeCreateWithPath(Bundle.main.bundleURL as CFURL, [], &code) == errSecSuccess,
              let code = code else { return true }
        var req: SecRequirement?
        let text = "anchor apple generic and certificate leaf[subject.OU] = \"\(team)\"" as CFString
        guard SecRequirementCreateWithString(text, [], &req) == errSecSuccess else { return true }
        // no revocation checks: they need the network, and an offline customer
        // with a perfectly good copy would otherwise be told it was modified
        switch SecStaticCodeCheckValidity(code, [], req) {
        case errSecSuccess: return true
        case errSecCSUnsigned,                   // signature stripped
             errSecCSSignatureFailed, errSecCSSignatureInvalid, errSecCSSignatureNotVerifiable,
             errSecCSReqFailed,                  // signed by someone else
             errSecCSBadResource,                // a file inside the app was edited
             errSecCSResourceRulesInvalid, errSecCSResourceDirectoryFailed,
             errSecCSBadObjectFormat, errSecCSStaticCodeChanged, errSecCSFileHardQuarantined:
            return false
        default:
            return true                      // inconclusive: let the app run
        }
    }

    /// A debugger attached to a shipped build — the usual first step in
    /// patching one.
    static func beingDebugged() -> Bool {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&mib, 4, &info, &size, nil, 0) == 0 else { return false }
        return (info.kp_proc.p_flag & P_TRACED) != 0
    }

    // MARK: talking to the licence server

    /// Only Apple's built-in roots are accepted, so a proxy with a certificate
    /// the user installed themselves can't sit in the middle and fake answers.
    final class PinnedSession: NSObject, URLSessionDelegate {
        let host: String
        private(set) lazy var session = URLSession(configuration: {
            let c = URLSessionConfiguration.ephemeral
            c.timeoutIntervalForRequest = 15
            c.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            c.httpAdditionalHeaders = ["Accept": "application/json"]
            return c
        }(), delegate: self, delegateQueue: nil)

        init(host: String) { self.host = host }

        func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
            guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
                  let trust = challenge.protectionSpace.serverTrust,
                  challenge.protectionSpace.host == host else {
                completionHandler(.cancelAuthenticationChallenge, nil); return
            }
            var anchors: CFArray?
            SecTrustCopyAnchorCertificates(&anchors)
            if let a = anchors {
                SecTrustSetAnchorCertificates(trust, a)
                SecTrustSetAnchorCertificatesOnly(trust, true)      // ignore user-added roots
            }
            SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, host as CFString))
            var error: CFError?
            if SecTrustEvaluateWithError(trust, &error) {
                completionHandler(.useCredential, URLCredential(trust: trust))
            } else {
                completionHandler(.cancelAuthenticationChallenge, nil)
            }
        }
    }
}
