// Spec 048 FR-004: the card's "−1 min", "+1 min" and "Pause" / "Resume". Live Activity intents run in the app's
// process, even with the phone locked and the app closed (iOS wakes it), so this file is in both the
// app and the widget (_shared). A tap changes the card and the timer's alerts (spec 047) right away,
// then leaves a note the app's timer store applies as soon as its code runs (lib/live-activity.ts).
import ActivityKit
import AppIntents
import Foundation
import UserNotifications

@available(iOS 17.0, *)
struct AddMinuteIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Add a minute to a timer"
  // Only the card's buttons: not offered in Shortcuts, Siri or Spotlight.
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await LiveTimerButtons.tap(.addMinute, timerId: timerId)
    return .result()
  }
}

@available(iOS 17.0, *)
struct TogglePauseIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Pause or resume a timer"
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await LiveTimerButtons.tap(.toggle, timerId: timerId)
    return .result()
  }
}

@available(iOS 17.0, *)
struct RemoveMinuteIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Take a minute off a timer"
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await LiveTimerButtons.tap(.removeMinute, timerId: timerId)
    return .result()
  }
}

@available(iOS 17.0, *)
enum LiveTimerButtons {
  enum Kind {
    case addMinute
    case removeMinute
    case toggle
  }

  /// The same rules as the app's timers (lib/timers.ts): ±1 min changes the time left and the total by
  /// as much, and −1 min never goes below `minLeftSeconds` (nor adds time); a pause keeps the seconds
  /// left, rounded up. The card changes first, so the tap shows at once; the alerts follow.
  static func tap(_ kind: Kind, timerId: String) async {
    guard let activity = Activity<TimerActivityAttributes>.activities.first else { return }
    var state = activity.content.state
    // The card moved on since it was drawn (another timer is first now): nothing to do.
    guard state.id == timerId else { return }
    let now = Date().timeIntervalSince1970 * 1000
    let action: String
    var moveAlerts = false
    var dropAlerts = false
    switch kind {
    case .addMinute, .removeMinute:
      let running = state.state == "running"
      guard running || state.state == "paused" else { return }
      guard !running || (state.endsAt ?? now) > now else { return }
      // Seconds left, rounded up as the app counts them.
      let left = running ? Int((((state.endsAt ?? now) - now) / 1000).rounded(.up)) : state.remainingSeconds ?? 0
      let next: Int
      if kind == .addMinute {
        next = left + 60
      } else {
        next = left <= state.minLeftSeconds ? left : max(state.minLeftSeconds, left - 60)
      }
      guard next != left else { return }
      let delta = next - left
      state.totalSeconds = max(next, state.totalSeconds + delta)
      if running {
        state.endsAt = now + Double(next) * 1000
        moveAlerts = true
      } else {
        state.remainingSeconds = next
      }
      action = kind == .addMinute ? "add_minute" : "remove_minute"
    case .toggle:
      if state.state == "running", let endsAt = state.endsAt, endsAt > now {
        state.state = "paused"
        state.remainingSeconds = Int(((endsAt - now) / 1000).rounded(.up))
        state.endsAt = nil
        dropAlerts = true
        action = "pause"
      } else if state.state == "paused", let left = state.remainingSeconds {
        state.state = "running"
        state.endsAt = now + Double(left) * 1000
        state.remainingSeconds = nil
        moveAlerts = true
        action = "resume"
      } else {
        return
      }
      let count = state.copy.count
      state.copy.count = state.copy.countToggled
      state.copy.countToggled = count
    }
    let staleDate = state.endsAt.map { Date(timeIntervalSince1970: $0 / 1000) }
    await activity.update(ActivityContent(state: state, staleDate: staleDate))
    LiveTimerTaps.append(["owner": activity.attributes.owner, "timerId": timerId, "action": action, "at": now])
    NotificationCenter.default.post(name: LiveTimerTaps.tapped, object: nil)
    if dropAlerts { removeAlerts(state) }
    if moveAlerts { await scheduleAlerts(state) }
  }

  /// The timer's alert and follow-up at its new end, as lib/timer-alerts.ts schedules them: whole
  /// seconds rounded up, so the alert never comes before 0:00; none less than a second away.
  private static func scheduleAlerts(_ state: TimerActivityAttributes.ContentState) async {
    guard let alert = state.alert, let endsAt = state.endsAt else { return }
    let fireAt = (endsAt / 1000).rounded(.up)
    let center = UNUserNotificationCenter.current()
    let both = [
      (alert.alertId, alert.title, alert.body, fireAt),
      (alert.againId, alert.againTitle, alert.againBody, fireAt + alert.againAfterMs / 1000),
    ]
    for (id, title, body, at) in both {
      let delay = at - Date().timeIntervalSince1970
      guard delay >= 1 else { continue }
      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      content.userInfo = alert.data
      content.sound = UNNotificationSound(named: UNNotificationSoundName(alert.sound))
      content.threadIdentifier = alert.thread
      content.categoryIdentifier = alert.category
      content.interruptionLevel = .timeSensitive
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
      try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }
  }

  private static func removeAlerts(_ state: TimerActivityAttributes.ContentState) {
    guard let alert = state.alert else { return }
    UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [alert.alertId, alert.againId])
  }
}
