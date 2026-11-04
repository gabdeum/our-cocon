// Spec 048: the Live Activity's data, the same shape as LiveActivityState in lib/live-activity.ts.
// This file exists twice, word for word: modules/live-timer/ios (the app starts, updates and ends the
// card) and targets/timer-activity/_shared (the card and its buttons). ActivityKit matches the two by
// name; lib/live-activity.test.ts checks they stay the same.
import ActivityKit
import Foundation

public struct TimerActivityAttributes: ActivityAttributes {
  public struct Row: Codable, Hashable {
    public var label: String
    public var endsAt: Double?
    public var remainingSeconds: Int?
  }

  /// Every word on the card, from strings/en.ts.
  public struct Copy: Codable, Hashable {
    public var title: String
    public var count: String
    public var countToggled: String
    public var countDone: String
    public var sub: String
    public var pausedSub: String
    public var islandSub: String
    public var more: String
    public var doneTitle: String
    public var left: String
    public var removeMinute: String
    public var addMinute: String
    public var pause: String
    public var resume: String
  }

  /// The primary timer's two alerts (spec 047), for the buttons to move while the app sleeps.
  public struct Alert: Codable, Hashable {
    public var alertId: String
    public var againId: String
    public var title: String
    public var body: String
    public var againTitle: String
    public var againBody: String
    public var againAfterMs: Double
    public var sound: String
    public var thread: String
    public var category: String
    public var data: [String: String]
  }

  public struct ContentState: Codable, Hashable {
    public var id: String
    /// "running", "paused" or "done".
    public var state: String
    public var label: String
    /// Milliseconds since 1970, as in the app.
    public var endsAt: Double?
    public var remainingSeconds: Int?
    public var totalSeconds: Int
    public var others: [Row]
    public var othersCount: Int
    public var copy: Copy
    /// "−1 min" never takes the time left below this.
    public var minLeftSeconds: Int
    /// A tap on the card (the step in cooking mode, or Timers), and on "2 running" (Timers).
    public var openUrl: String
    public var timersUrl: String
    public var alert: Alert?
  }

  /// Who signed in when it started: a tap on someone else's card is dropped by the app.
  public var owner: String

  public init(owner: String) {
    self.owner = owner
  }
}

/// Taps on the card's buttons, kept on the phone until the app reads them (lib/live-activity.ts).
public enum LiveTimerTaps {
  /// Posted in the app's process after each tap, so a running app reads it at once.
  public static let tapped = Notification.Name("CoconLiveTimerTapped")
  private static let key = "cocon.liveTimer.taps"
  private static let lock = NSLock()

  public static func append(_ tap: [String: Any]) {
    lock.lock()
    defer { lock.unlock() }
    let list = UserDefaults.standard.array(forKey: key) ?? []
    UserDefaults.standard.set(list + [tap], forKey: key)
  }

  /// The taps since the last call, oldest first, as a JSON array.
  public static func take() -> String {
    lock.lock()
    defer { lock.unlock() }
    let list = UserDefaults.standard.array(forKey: key) ?? []
    UserDefaults.standard.removeObject(forKey: key)
    guard let data = try? JSONSerialization.data(withJSONObject: list) else { return "[]" }
    return String(decoding: data, as: UTF8.self)
  }

  public static func clear() {
    lock.lock()
    defer { lock.unlock() }
    UserDefaults.standard.removeObject(forKey: key)
  }
}
