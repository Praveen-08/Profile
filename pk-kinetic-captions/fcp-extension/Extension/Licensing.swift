import Foundation

/// Names the licence messages use.
enum Product {
    static let name = "PK Kinetic Captions"
}

/// Licensing against Lemon Squeezy's licence API.
///
/// A licence key is tied to this Mac by activating an "instance" on the
/// server; the store decides how many Macs a key allows, so extra devices are
/// something the customer buys rather than something the app can be talked
/// into. Trial keys are ordinary keys from a free product that expire after
/// seven days, and a Mac can only start one trial.
///
/// The app re-checks with the server regularly. Between checks it trusts a
/// local record that is signed with a key derived from this Mac, so the record
/// can't be edited or copied to another machine, and a clock moved backwards
/// forces a fresh check.
enum LicenseState: Equatable {
    case checking
    case unlicensed                       // nothing entered yet
    case trial(ends: Date)
    case active(renews: Date?)
    case expired(String)                  // trial over, subscription lapsed, key disabled
    case blocked(String)                  // tampering, or the app was modified
}

final class LicenseManager {

    static let shared = LicenseManager()

    private(set) var state: LicenseState = .checking { didSet { if state != oldValue { notify() } } }
    /// Devices this key covers, when known.
    private(set) var deviceCount: (used: Int, limit: Int)?
    var onChange: (() -> Void)?

    /// Everything the app knows between server checks.
    private struct Record: Codable {
        var key: String
        var instanceID: String
        var status: String                // active / inactive / expired / disabled
        var expiresAt: Date?              // licence key expiry (trial keys have one)
        var isTrial: Bool
        var activationLimit: Int
        var activationUsage: Int
        var activatedAt: Date?            // when this key was first activated here
        var lastChecked: Date
        var lastSeenClock: Date           // catches the clock being wound back
        var signature: String?            // HMAC over the rest, tied to this Mac

        var unsignedData: Data? {
            var copy = self; copy.signature = nil
            let enc = JSONEncoder(); enc.outputFormatting = .sortedKeys
            enc.dateEncodingStrategy = .secondsSince1970
            return try? enc.encode(copy)
        }
    }

    private var record: Record?
    private let store = "license.v1"
    private let trialMark = "trial.v1"
    private var timer: Timer?

    // How long the app runs on its saved record without reaching the server.
    private let paidGrace: TimeInterval = 7 * 24 * 3600
    private let trialGrace: TimeInterval = 12 * 3600
    private let recheckAfter: TimeInterval = 12 * 3600

    private var api: LicenseAPI { LicenseAPI() }

    // MARK: lifecycle

    func start() {
        DispatchQueue.global(qos: .utility).async { _ = Security.appIntact() }   // warm the check
        record = loadRecord()
        evaluate()
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 1800, repeats: true) { [weak self] _ in
            self?.evaluate(); self?.refreshIfDue()
        }
    }

    /// The developer's own Mac, baked into their personal build. It is a hash
    /// of that Mac's hardware id, so it unlocks nothing anywhere else, and
    /// customer builds don't carry it at all.
    private var isOwnerMac: Bool {
        guard let owner = Bundle.main.object(forInfoDictionaryKey: "TFOwnerDevice") as? String,
              !owner.isEmpty else { return false }
        return owner == Security.deviceID
    }

    /// True when the app may be used.
    var isUsable: Bool {
        if isOwnerMac { return true }
        #if PKKC_DEV
        // development builds only; never compiled into a release
        if ProcessInfo.processInfo.environment["PKKC_DEV_BYPASS"] != nil { return true }
        #endif
        switch state {
        case .trial, .active: return true
        case .checking: return record != nil && dueForCheck == false
        default: return false
        }
    }

    var summary: String {
        switch state {
        case .checking: return "Checking licence…"
        case .unlicensed: return "Enter a trial code or licence key to start."
        case .trial(let ends):
            let days = max(0, Int(ceil(ends.timeIntervalSinceNow / 86400)))
            return "Trial — \(days) day\(days == 1 ? "" : "s") left."
        case .active(let renews):
            if isOwnerMac { return "Owner copy — licensed on this Mac." }
            let d = renews.map { " · renews \(Self.dateText($0))" } ?? ""
            let n = deviceCount.map { " · device \($0.used) of \($0.limit)" } ?? ""
            return "Licensed\(d)\(n)."
        case .expired(let why): return why
        case .blocked(let why): return why
        }
    }

    private static func dateText(_ d: Date) -> String {
        let f = DateFormatter(); f.dateStyle = .medium; f.timeStyle = .none
        return f.string(from: d)
    }

    // MARK: entering a key

    func activate(key raw: String, completion: @escaping (String?) -> Void) {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { completion("Enter your licence key."); return }
        api.activate(key: key, device: Security.deviceName) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let e): DispatchQueue.main.async { completion(e.text) }
            case .success(let r):
                DispatchQueue.main.async {
                    // one trial per Mac, however many trial keys are handed out
                    if r.isTrial, let mark = self.trialUsedElsewhere(key: key) {
                        self.api.deactivate(key: key, instance: r.instanceID) { _ in }
                        completion(mark); return
                    }
                    if r.isTrial { self.markTrialUsed(key: key) }
                    self.save(Record(key: key, instanceID: r.instanceID, status: r.status,
                                     expiresAt: r.expiresAt, isTrial: r.isTrial,
                                     activationLimit: r.activationLimit, activationUsage: r.activationUsage,
                                     activatedAt: Date(),
                                     lastChecked: Date(), lastSeenClock: Date(), signature: nil))
                    self.evaluate()
                    completion(nil)
                }
            }
        }
    }

    /// Frees this Mac so the customer can use the licence on another one.
    func deactivateThisMac(completion: @escaping (String?) -> Void) {
        guard let r = record else { completion("No licence on this Mac."); return }
        api.deactivate(key: r.key, instance: r.instanceID) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .failure(let e): completion(e.text)
                case .success:
                    Security.keychainDelete(self?.store ?? "")
                    self?.record = nil
                    self?.deviceCount = nil
                    self?.state = .unlicensed
                    completion(nil)
                }
            }
        }
    }

    // MARK: checking

    private var dueForCheck: Bool {
        guard let r = record else { return true }
        if Date() < r.lastSeenClock.addingTimeInterval(-60) { return true }   // clock moved back
        return Date().timeIntervalSince(r.lastChecked) > recheckAfter
    }

    func refreshIfDue() { if dueForCheck { refresh() } }

    func refresh() {
        guard let r = record else { if case .checking = state { state = .unlicensed }; return }
        api.validate(key: r.key, instance: r.instanceID) { [weak self] result in
            guard let self = self else { return }
            DispatchQueue.main.async {
                switch result {
                case .success(let v):
                    var n = r
                    n.status = v.status; n.expiresAt = v.expiresAt; n.isTrial = v.isTrial
                    n.activationLimit = v.activationLimit; n.activationUsage = v.activationUsage
                    n.lastChecked = Date(); n.lastSeenClock = Date()
                    self.save(n)
                case .failure:
                    break                                   // offline: the grace window applies
                }
                self.evaluate()
            }
        }
    }

    /// Works out the state from the saved record, the clock and the app itself.
    func evaluate() {
        if isOwnerMac { state = .active(renews: nil); return }
        if !Security.appIntact() {
            state = .blocked("\(Product.name) has been modified and can't run. Reinstall it from your download link.")
            return
        }
        guard var r = record else { state = .unlicensed; return }
        let now = Date()
        // Clock wound back (or a dead RTC wrote a future date): ask the server
        // rather than trusting either clock. The app keeps working while the
        // normal offline grace since the last real check still holds, so a
        // wrong clock can never strand a paying customer.
        if now < r.lastSeenClock.addingTimeInterval(-60) {
            refresh()
            let grace = r.isTrial ? trialGrace : paidGrace
            if now.timeIntervalSince(r.lastChecked) > grace || r.isTrial {
                state = .expired("This Mac's clock looks wrong. Connect to the internet so \(Product.name) can check your licence.")
                return
            }
        }
        // never record a date further ahead than a plausible check-in
        if now > r.lastSeenClock, now < r.lastChecked.addingTimeInterval(400 * 86400) {
            r.lastSeenClock = now; save(r)
        }

        // a trial with no end date from the server still ends seven days after
        // it was activated here
        let trialEnd = r.expiresAt ?? (r.isTrial ? (r.activatedAt ?? r.lastChecked).addingTimeInterval(7 * 86400) : nil)
        switch r.status {
        case "active":
            if let e = trialEnd, e < now {
                state = .expired(r.isTrial ? "Your 7-day trial has ended. Subscribe to keep using \(Product.name)."
                                           : "This licence has expired. Renew it to keep using \(Product.name).")
                return
            }
            let grace = r.isTrial ? trialGrace : paidGrace
            if now.timeIntervalSince(r.lastChecked) > grace {
                state = .expired("\(Product.name) needs to check your licence. Connect to the internet and try again.")
                return
            }
            deviceCount = (r.activationUsage, r.activationLimit)
            state = r.isTrial ? .trial(ends: trialEnd ?? now)
                              : .active(renews: r.expiresAt)
        case "expired":
            state = .expired(r.isTrial ? "Your 7-day trial has ended. Subscribe to keep using \(Product.name)."
                                       : "This licence has expired. Renew it to keep using \(Product.name).")
        case "disabled":
            state = .expired("This licence key has been disabled. Contact support if that's unexpected.")
        default:
            state = .expired("This licence isn't active on this Mac. Enter your key again.")
        }
    }

    // MARK: local record

    private func save(_ r: Record) {
        var copy = r
        copy.signature = copy.unsignedData.map { Security.sign($0) }
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .secondsSince1970
        if let d = try? enc.encode(copy) { Security.keychainSet(store, d) }
        record = copy
    }

    private func loadRecord() -> Record? {
        guard let d = Security.keychainGet(store) else { return nil }
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .secondsSince1970
        guard let r = try? dec.decode(Record.self, from: d),
              let sig = r.signature, let body = r.unsignedData,
              Security.verify(body, signature: sig) else {
            Security.keychainDelete(store)          // edited, or from another Mac
            return nil
        }
        return r
    }

    // MARK: one trial per Mac

    private struct TrialMark: Codable { var key: String; var started: Date; var signature: String? }

    private func trialUsedElsewhere(key: String) -> String? {
        guard let d = Security.keychainGet(trialMark) else { return nil }
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .secondsSince1970
        guard let m = try? dec.decode(TrialMark.self, from: d) else { return nil }
        if m.key == key { return nil }              // same trial being re-entered
        return "This Mac has already used its 7-day trial. Subscribe to keep using \(Product.name)."
    }

    private func markTrialUsed(key: String) {
        var m = TrialMark(key: key, started: Date(), signature: nil)
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .secondsSince1970
        if let body = try? enc.encode(TrialMark(key: key, started: m.started, signature: nil)) {
            m.signature = Security.sign(body)
        }
        if let d = try? enc.encode(m) { Security.keychainSet(trialMark, d) }
    }

    private func notify() { DispatchQueue.main.async { self.onChange?() } }

    #if PKKC_DEV
    // hooks used only by LicenseTest
    func forgetForTesting() { record = nil; deviceCount = nil; state = .checking }
    func reloadForTesting() { record = loadRecord() }
    func ageRecordForTesting(days: Double) {
        guard var r = record else { return }
        r.lastChecked = Date().addingTimeInterval(-days * 86400)
        save(r)
    }
    func windBackClockForTesting(days: Double) {
        guard var r = record else { return }
        r.lastSeenClock = Date().addingTimeInterval(days * 86400)
        save(r)
    }
    #endif
}

// MARK: - the licence API

/// Lemon Squeezy's licence endpoints. They take only the licence key, so the
/// app ships with no secret that could be lifted out of it.
struct LicenseAPI {

    struct Failure: Error { let text: String }

    struct Result {
        var status: String
        var expiresAt: Date?
        var isTrial: Bool
        var activationLimit: Int
        var activationUsage: Int
        var instanceID: String
    }

    private var host: String { config("TFLicenseHost") ?? "api.lemonsqueezy.com" }
    /// Development builds may point at a local mock server; released builds
    /// always talk to the real one over TLS.
    private var isMock: Bool {
        #if PKKC_DEV
        return host.hasPrefix("127.0.0.1") || host.hasPrefix("localhost")
        #else
        return false
        #endif
    }
    private var base: String { "\(isMock ? "http" : "https")://\(host)/v1/licenses" }
    /// Keys from another store or product are refused.
    private var expectedStore: Int? { Int(config("TFStoreID") ?? "") }
    private var trialProduct: Int? { Int(config("TFTrialProductID") ?? "") }
    /// Products whose keys unlock this app: its own, and the bundle.
    private var allowedProducts: [Int] {
        (config("TFProductIDs") ?? "").split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
    }

    private func config(_ k: String) -> String? {
        if let v = Bundle.main.object(forInfoDictionaryKey: k) as? String, !v.isEmpty { return v }
        #if PKKC_DEV
        return ProcessInfo.processInfo.environment[k]        // development builds only
        #else
        return nil
        #endif
    }

    func activate(key: String, device: String, completion: @escaping (Swift.Result<Result, Failure>) -> Void) {
        // A build without its store id would accept a key from any Lemon
        // Squeezy store, so it accepts none.
        guard expectedStore != nil || isMock else {
            return completion(.failure(Failure(text: "This build of \(Product.name) has no store details yet, so it can't take licence keys.")))
        }
        post("activate", ["license_key": key, "instance_name": device], completion)
    }
    func validate(key: String, instance: String, completion: @escaping (Swift.Result<Result, Failure>) -> Void) {
        post("validate", ["license_key": key, "instance_id": instance], completion)
    }
    func deactivate(key: String, instance: String, completion: @escaping (Swift.Result<Result, Failure>) -> Void) {
        post("deactivate", ["license_key": key, "instance_id": instance], completion)
    }

    private func post(_ path: String, _ fields: [String: String],
                      _ completion: @escaping (Swift.Result<Result, Failure>) -> Void) {
        guard let url = URL(string: "\(base)/\(path)") else {
            completion(.failure(Failure(text: "Couldn't reach the licence server."))); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = fields.map {
            "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "")"
        }.joined(separator: "&").data(using: .utf8)

        #if PKKC_DEV
        let started = Date()
        if ProcessInfo.processInfo.environment["PKLICTEST"] != nil {
            FileHandle.standardError.write("LICNET -> \(path) \(fields["license_key"] ?? "")\n".data(using: .utf8)!)
        }
        #endif
        let session = isMock ? URLSession(configuration: .ephemeral)
                             : Security.PinnedSession(host: host.components(separatedBy: ":")[0]).session
        session.dataTask(with: req) { data, response, error in
            #if PKKC_DEV
            if ProcessInfo.processInfo.environment["PKLICTEST"] != nil {
                FileHandle.standardError.write(String(format: "LICNET <- %@ %.2fs err=%@\n", path,
                    -started.timeIntervalSinceNow, error?.localizedDescription ?? "none").data(using: .utf8)!)
            }
            #endif
            if let error = error {
                completion(.failure(Failure(text: "Couldn't reach the licence server. \(error.localizedDescription)")))
                return
            }
            guard let data = data,
                  let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
                completion(.failure(Failure(text: "The licence server sent something unexpected."))); return
            }
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if let err = json["error"] as? String, !err.isEmpty {
                completion(.failure(Failure(text: Self.friendly(err)))); return
            }
            guard code == 200, let lk = json["license_key"] as? [String: Any] else {
                completion(.failure(Failure(text: "That licence key wasn't accepted."))); return
            }
            let meta = json["meta"] as? [String: Any] ?? [:]
            if let want = expectedStore {
                let got = (meta["store_id"] as? Int) ?? Int((meta["store_id"] as? String) ?? "")
                guard got == want else {
                    completion(.failure(Failure(text: "That key belongs to a different store."))); return
                }
            }
            let instance = (json["instance"] as? [String: Any])?["id"] as? String
                ?? fields["instance_id"] ?? ""
            let product = (meta["product_id"] as? Int) ?? Int((meta["product_id"] as? String) ?? "")
            let allowed = allowedProducts
            if !allowed.isEmpty, let p = product, !allowed.contains(p), p != trialProduct {
                completion(.failure(Failure(text:
                    "That key is for a different product. Check you're entering the \(Product.name) key."))); return
            }
            let r = Result(status: lk["status"] as? String ?? "inactive",
                           expiresAt: Self.date(lk["expires_at"]),
                           // the trial product id identifies a trial. Without it
                           // (a build missing its store details), fall back to
                           // "expires within a month" — a subscription key's own
                           // expiry, if it has one, is months or a year out.
                           isTrial: trialProduct != nil
                               ? product == trialProduct
                               : Self.date(lk["expires_at"]).map { $0 < Date().addingTimeInterval(10 * 86400) } ?? false,
                           activationLimit: lk["activation_limit"] as? Int ?? 1,
                           activationUsage: lk["activation_usage"] as? Int ?? 1,
                           instanceID: instance)
            completion(.success(r))
        }.resume()
    }

    #if PKKC_DEV
    var debugEndpoint: String { base }
    #endif

    private static func date(_ v: Any?) -> Date? {
        guard let s = v as? String else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    private static func friendly(_ e: String) -> String {
        let l = e.lowercased()
        if l.contains("activation limit") {
            return "This licence is already in use on the maximum number of Macs. "
                 + "Free one up in \(Product.name) on that Mac (Licence → Move to another Mac), or add a device to your subscription."
        }
        if l.contains("not found") { return "That licence key wasn't found. Check it and try again." }
        if l.contains("expired") { return "That licence key has expired." }
        if l.contains("disabled") { return "That licence key has been disabled." }
        return e
    }
}
