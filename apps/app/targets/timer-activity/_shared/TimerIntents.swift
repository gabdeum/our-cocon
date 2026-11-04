// Spec 048 FR-004: the card's buttons, as on the Timers screen: "−1", "+1", "Pause" / "Resume" /
// "Add 1 more minute", and "Stop" / "Dismiss". Live Activity intents run in the app's process, even
// with the phone locked and the app closed (iOS wakes it), so this file is in both the app and the
// widget (_shared). A tap changes the card first, then the timer's alerts (spec 047), and leaves a note
// the app's timer store applies as soon as its code runs (lib/live-activity.ts).
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
struct StopTimerIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Stop a timer"
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await LiveTimerButtons.tap(.stop, timerId: timerId)
    return .result()
  }
}

@available(iOS 17.0, *)
enum LiveTimerButtons {
  enum Kind {
    case addMinute
    case removeMinute
    case toggle
    case stop
  }

  /// The same rules as the app's timers (lib/timers.ts): ±1 changes the time left and the total by as
  /// much, and −1 never goes below `minLeftSeconds` (nor adds time); +1 on a done timer runs it again
  /// for a minute; a pause keeps the seconds left, rounded up; Stop and Dismiss take it away.
  static func tap(_ kind: Kind, timerId: String) async {
    guard let activity = Activity<TimerActivityAttributes>.activities.first else { return }
    var state = activity.content.state
    // The card moved on since it was drawn (another timer shows now): nothing to do.
    guard state.face.id == timerId else { return }
    let before = state.face
    var face = state.face
    let now = Date().timeIntervalSince1970 * 1000
    // Reached zero on the Lock Screen: done, even if the app hasn't said so yet.
    let done = face.state == "done" || (face.state == "running" && (face.endsAt ?? 0) <= now)
    let action: String

    switch kind {
    case .stop:
      action = done ? "dismiss" : "stop"
      if let next = state.next {
        state.face = next
        state.next = nil
        await activity.update(ActivityContent(state: state, staleDate: staleDate(next)))
      } else {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      record(activity, timerId: timerId, action: action, at: now)
      removeAlerts(before)
      return
    case .addMinute where done:
      face.state = "running"
      face.totalSeconds = 60
      face.endsAt = now + 60_000
      face.remainingSeconds = nil
      swapCounts(&face)
      action = "add_minute"
    case .addMinute, .removeMinute:
      guard !done else { return }
      let running = face.state == "running"
      // Seconds left, rounded up as the app counts them.
      let left = running ? Int((((face.endsAt ?? now) - now) / 1000).rounded(.up)) : face.remainingSeconds ?? 0
      let next: Int
      if kind == .addMinute {
        next = left + 60
      } else {
        next = left <= state.minLeftSeconds ? left : max(state.minLeftSeconds, left - 60)
      }
      guard next != left else { return }
      face.totalSeconds = max(next, face.totalSeconds + (next - left))
      if running {
        face.endsAt = now + Double(next) * 1000
      } else {
        face.remainingSeconds = next
      }
      action = kind == .addMinute ? "add_minute" : "remove_minute"
    case .toggle:
      guard !done else { return }
      if face.state == "running", let endsAt = face.endsAt {
        face.state = "paused"
        face.remainingSeconds = Int(((endsAt - now) / 1000).rounded(.up))
        face.endsAt = nil
        action = "pause"
      } else if face.state == "paused", let left = face.remainingSeconds {
        face.state = "running"
        face.endsAt = now + Double(left) * 1000
        face.remainingSeconds = nil
        action = "resume"
      } else {
        return
      }
      swapCounts(&face)
    }

    state.face = face
    await activity.update(ActivityContent(state: state, staleDate: staleDate(face)))
    record(activity, timerId: timerId, action: action, at: now)
    if face.state == "running" {
      await scheduleAlerts(face)
    } else {
      removeAlerts(face)
    }
  }

  private static func swapCounts(_ face: inout TimerActivityAttributes.Face) {
    let count = face.count
    face.count = face.countToggled
    face.countToggled = count
  }

  private static func staleDate(_ face: TimerActivityAttributes.Face) -> Date? {
    face.state == "running" ? face.endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } : nil
  }

  private static func record(_ activity: Activity<TimerActivityAttributes>, timerId: String, action: String, at: Double) {
    LiveTimerTaps.append(["owner": activity.attributes.owner, "timerId": timerId, "action": action, "at": at])
    NotificationCenter.default.post(name: LiveTimerTaps.tapped, object: nil)
  }

  /// The timer's alert and follow-up at its new end, as lib/timer-alerts.ts schedules them: whole
  /// seconds rounded up, so the alert never comes before 0:00; none less than a second away.
  private static func scheduleAlerts(_ face: TimerActivityAttributes.Face) async {
    guard let alert = face.alert, let endsAt = face.endsAt else { return }
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

  /// Waiting or already shown, as the app's cancel does.
  private static func removeAlerts(_ face: TimerActivityAttributes.Face) {
    guard let alert = face.alert else { return }
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: [alert.alertId, alert.againId])
    center.removeDeliveredNotifications(withIdentifiers: [alert.alertId, alert.againId])
  }
}
