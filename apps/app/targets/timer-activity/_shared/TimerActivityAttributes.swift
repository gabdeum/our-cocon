// Spec 048: the Live Activity's data, the same shape as LiveActivityState in lib/live-activity.ts.
// This file exists twice, word for word: modules/live-timer/ios (the app starts, updates and ends the
// card) and targets/timer-activity/_shared (the card and its buttons). ActivityKit matches the two by
// name; lib/live-activity.test.ts checks they stay the same.
import ActivityKit
import Foundation

public struct TimerActivityAttributes: ActivityAttributes {
  /// One timer as the card shows it, every word from strings/en.ts.
  public struct Face: Codable, Hashable {
    public var id: String
    /// "running", "paused" or "done".
    public var state: String
    public var label: String
    public var subRunning: String
    public var subPaused: String
    public var subDone: String
    public var islandSub: String
    public var doneTitle: String
    /// Milliseconds since 1970, as in the app.
    public var endsAt: Double?
    public var remainingSeconds: Int?
    public var totalSeconds: Int
    /// A tap on the card: the step in cooking mode, or Timers.
    public var openUrl: String
    /// The "2 running" pill now; after Pause, Resume or "Add 1 more minute"; once this one ends.
    public var count: String
    public var countToggled: String
    public var countDone: String
    public var alert: Alert?
  }

  /// The buttons' words.
  public struct Copy: Codable, Hashable {
    public var minus: String
    public var plus: String
    public var minusA11y: String
    public var plusA11y: String
    public var pause: String
    public var resume: String
    public var addMore: String
    public var stop: String
    public var dismiss: String
    public var removeMinute: String
    public var addMinute: String
    public var pausedSub: String
  }

  /// A timer's two alerts (spec 047), for the buttons to move while the app sleeps.
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
    public var face: Face
    /// Shown once `face` is stopped or dismissed on the Lock Screen; none: the card ends.
    public var next: Face?
    public var copy: Copy
    /// "−1" never takes the time left below this.
    public var minLeftSeconds: Int
    /// A tap on the "2 running" pill: Timers.
    public var timersUrl: String
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
