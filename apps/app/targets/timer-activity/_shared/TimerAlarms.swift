// Spec 061: on iOS 26, a timer's done alert is an AlarmKit alarm: it rings through silent mode and Focus
// until "Stop" or "+1 min". This file is in the app and the widget (_shared): the widget draws the
// ringing alarm's Live Activity (TimerAlarmWidget), and both buttons are the app's own intents, which
// iOS runs in the app's process even with the phone locked and the app closed. A tap stops the alarm,
// moves the Lock Screen card if it shows that timer (spec 048), and leaves a note the app's timer
// store applies as soon as its code runs (lib/live-activity.ts), as the card's buttons do.
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import AppIntents
import Foundation
import SwiftUI

/// What the ringing alarm's Live Activity shows, every word from the app.
@available(iOS 26.0, *)
struct TimerAlarmMetadata: AlarmMetadata {
  var timerId: String
  var title: String
  /// "Leek & bacon quiche · step 3" or "5-minute kitchen timer".
  var subtitle: String
  var addMinute: String
  var stop: String
}

/// One timer's alarm as the app sends it (lib/timer-alarms.ts), kept on the phone by alert id.
struct TimerAlarm: Codable {
  /// "timer:{id}", as spec 047's notification.
  var alertId: String
  var timerId: String
  /// Who signed in when it was set: a tap on someone else's is dropped by the app.
  var owner: String
  var title: String
  var subtitle: String
  var sound: String
  var addMinute: String
  var stop: String
  /// AlarmKit's id, once scheduled.
  var alarmId: String?
}

@available(iOS 26.0, *)
struct TimerAlarmAddMinuteIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Add a minute to a done timer"
  // Only the alarm's button: not offered in Shortcuts, Siri or Spotlight.
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await TimerAlarms.tap(.addMinute, timerId: timerId)
    return .result()
  }
}

@available(iOS 26.0, *)
struct TimerAlarmStopIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Stop a timer's alarm"
  static let isDiscoverable = false

  @Parameter(title: "Timer")
  var timerId: String

  init() {}

  init(timerId: String) {
    self.timerId = timerId
  }

  func perform() async throws -> some IntentResult {
    await TimerAlarms.tap(.stop, timerId: timerId)
    return .result()
  }
}

@available(iOS 26.0, *)
enum TimerAlarms {
  enum Kind {
    case addMinute
    case stop
  }

  private static let key = "cocon.timerAlarms"
  private static let lock = NSLock()
  private static var tail: Task<Void, Never>?
  /// Bumped by `clear` (sign-out, another person): a tap already under way can't set an alarm after it.
  private static var epoch = 0

  static var currentEpoch: Int {
    lock.lock()
    defer { lock.unlock() }
    return epoch
  }

  static func authorization() -> String {
    switch AlarmManager.shared.authorizationState {
    case .authorized: return "authorized"
    case .notDetermined: return "notDetermined"
    default: return "denied"
    }
  }

  /// The same rule as the app (lib/timer-alarms.ts): allowed, so alarms replace spec 047's notifications.
  static var inUse: Bool {
    AlarmManager.shared.authorizationState == .authorized
  }

  static func requestAuthorization() async -> String {
    _ = try? await AlarmManager.shared.requestAuthorization()
    return authorization()
  }

  /// The timer's alarm at `at`, replacing any it had. None less than a second away (as spec 047).
  /// Each of these joins the line as it is called, so the app's changes apply in the order it made them.
  /// `since`: the `currentEpoch` read when the tap began; cleared since, nothing is set.
  @discardableResult
  static func schedule(_ alarm: TimerAlarm, at: Date, since: Int? = nil) -> Task<Bool, Never> {
    inLine {
      if let since, since != currentEpoch { return false }
      return await scheduleNow(alarm, at: at)
    }
  }

  /// On sign-out or a switch to another person: every alarm goes, saved or not, and no tap under way
  /// can bring one back (security review).
  @discardableResult
  static func clear() -> Task<Void, Never> {
    lock.lock()
    epoch += 1
    lock.unlock()
    return inLine {
      cancelNow(Array(saved().keys))
      for alarm in (try? AlarmManager.shared.alarms) ?? [] {
        try? AlarmManager.shared.stop(id: alarm.id)
        try? AlarmManager.shared.cancel(id: alarm.id)
      }
    }
  }

  @discardableResult
  static func cancel(_ alertIds: [String]) -> Task<Void, Never> {
    inLine { cancelNow(alertIds) }
  }

  /// The alert ids still waiting or ringing. Alarms iOS ended (its own Stop, before the intent ran)
  /// are forgotten, and any of ours nothing knows about any more goes.
  static func ids() -> Task<[String], Never> {
    inLine {
      // Unreadable (permission just taken away): the list stays as it is, so a clear still cancels each.
      guard let alarms = try? AlarmManager.shared.alarms else { return Array(saved().keys) }
      let live = Set(alarms.map(\.id))
      let list = saved().filter { live.contains(uuid($0.value)) }
      save(list)
      let known = Set(list.values.map(uuid))
      for id in live where !known.contains(id) {
        try? AlarmManager.shared.cancel(id: id)
      }
      return Array(list.keys)
    }
  }

  /// "Stop" dismisses the done timer; "+1 min" runs it again for a minute (as the Timers screen's
  /// "Add 1 more minute"), with a new alarm.
  static func tap(_ kind: Kind, timerId: String) async {
    let since = currentEpoch
    let found = inLine { () -> TimerAlarm? in
      guard let alarm = saved().values.first(where: { $0.timerId == timerId }) else { return nil }
      cancelNow([alarm.alertId])
      return alarm
    }
    guard let alarm = await found.value else { return }
    // Shown on the card: the card's own button does it all, and moves the alarm too.
    if await LiveTimerButtons.tap(kind == .stop ? .stop : .addMinute, timerId: timerId, source: "alarm", since: since) { return }
    let now = Date()
    LiveTimerTaps.append([
      "owner": alarm.owner,
      "timerId": timerId,
      "action": kind == .stop ? "dismiss" : "add_minute",
      "at": now.timeIntervalSince1970 * 1000,
      "source": "alarm",
    ])
    NotificationCenter.default.post(name: LiveTimerTaps.tapped, object: nil)
    if kind == .addMinute {
      _ = await schedule(alarm, at: now.addingTimeInterval(60), since: since).value
    }
  }

  // MARK: - One change at a time

  /// Each change waits for the one before: two quick changes to a timer (start, then "+1") would
  /// otherwise both find no alarm to replace, and the first would ring at its old time.
  private static func inLine<T: Sendable>(_ f: @escaping @Sendable () async -> T) -> Task<T, Never> {
    lock.lock()
    defer { lock.unlock() }
    let before = tail
    let task = Task { () -> T in
      await before?.value
      return await f()
    }
    tail = Task { _ = await task.value }
    return task
  }

  private static func scheduleNow(_ alarm: TimerAlarm, at: Date) async -> Bool {
    cancelNow([alarm.alertId])
    guard at.timeIntervalSinceNow >= 1 else { return false }
    let title = LocalizedStringResource(stringLiteral: alarm.title)
    let plus = AlarmButton(text: LocalizedStringResource(stringLiteral: alarm.addMinute), textColor: Theme.ink, systemImageName: "plus")
    let alert: AlarmPresentation.Alert
    if #available(iOS 26.1, *) {
      // From 26.1 the system draws its own Stop.
      alert = AlarmPresentation.Alert(title: title, secondaryButton: plus, secondaryButtonBehavior: .custom)
    } else {
      let stop = AlarmButton(text: LocalizedStringResource(stringLiteral: alarm.stop), textColor: Theme.ink, systemImageName: "stop.fill")
      alert = AlarmPresentation.Alert(title: title, stopButton: stop, secondaryButton: plus, secondaryButtonBehavior: .custom)
    }
    let metadata = TimerAlarmMetadata(timerId: alarm.timerId, title: alarm.title, subtitle: alarm.subtitle, addMinute: alarm.addMinute, stop: alarm.stop)
    let attributes = AlarmAttributes<TimerAlarmMetadata>(presentation: AlarmPresentation(alert: alert), metadata: metadata, tintColor: Theme.honey)
    let configuration = AlarmManager.AlarmConfiguration<TimerAlarmMetadata>.alarm(
      schedule: .fixed(at),
      attributes: attributes,
      stopIntent: TimerAlarmStopIntent(timerId: alarm.timerId),
      secondaryIntent: TimerAlarmAddMinuteIntent(timerId: alarm.timerId),
      // The spec 047 chime, in the app bundle (expo-notifications' plugin puts it there).
      sound: .named(alarm.sound)
    )
    let id = UUID()
    do {
      _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
    } catch {
      // Refused (no permission any more, too many): the timer still works in the app.
      return false
    }
    var list = saved()
    var kept = alarm
    kept.alarmId = id.uuidString
    list[alarm.alertId] = kept
    save(list)
    return true
  }

  /// Waiting or ringing: a ringing one stops.
  private static func cancelNow(_ alertIds: [String]) {
    var list = saved()
    for alertId in alertIds {
      guard let alarm = list.removeValue(forKey: alertId) else { continue }
      let id = uuid(alarm)
      try? AlarmManager.shared.stop(id: id)
      try? AlarmManager.shared.cancel(id: id)
    }
    save(list)
  }

  private static func uuid(_ alarm: TimerAlarm) -> UUID {
    alarm.alarmId.flatMap(UUID.init(uuidString:)) ?? UUID()
  }

  private static func saved() -> [String: TimerAlarm] {
    guard let data = UserDefaults.standard.data(forKey: key) else { return [:] }
    return (try? JSONDecoder().decode([String: TimerAlarm].self, from: data)) ?? [:]
  }

  private static func save(_ list: [String: TimerAlarm]) {
    UserDefaults.standard.set(try? JSONEncoder().encode(list), forKey: key)
  }
}
#endif

// The app's side of modules/live-timer/ios/TimerAlarmsBridge.swift. Only in the app: the widget has no
// pods, so it can't import the module.
#if canImport(CoconLiveTimer) && canImport(AlarmKit)
// `internal`, as Expo's generated module list imports it: Swift refuses two different access levels.
internal import CoconLiveTimer

@objc(CoconTimerAlarms)
final class CoconTimerAlarms: NSObject, CoconTimerAlarmsBridge {
  static func alarmsAvailable() -> Bool {
    if #available(iOS 26.0, *) { return true }
    return false
  }

  static func alarmAuthorization() -> String {
    guard #available(iOS 26.0, *) else { return "denied" }
    return TimerAlarms.authorization()
  }

  static func requestAlarmAuthorization(_ done: @escaping (String) -> Void) {
    guard #available(iOS 26.0, *) else { return done("denied") }
    Task { done(await TimerAlarms.requestAuthorization()) }
  }

  static func scheduleAlarm(_ json: String, at: Double, done: @escaping (Bool) -> Void) {
    guard #available(iOS 26.0, *), let alarm = try? JSONDecoder().decode(TimerAlarm.self, from: Data(json.utf8)) else { return done(false) }
    // In line now, before anything waits: a later call from the app comes after it.
    let scheduled = TimerAlarms.schedule(alarm, at: Date(timeIntervalSince1970: at / 1000))
    Task { done(await scheduled.value) }
  }

  static func cancelAlarms(_ alertIds: [String]) {
    guard #available(iOS 26.0, *) else { return }
    TimerAlarms.cancel(alertIds)
  }

  static func clearAlarms(_ done: @escaping () -> Void) {
    guard #available(iOS 26.0, *) else { return done() }
    let cleared = TimerAlarms.clear()
    Task {
      await cleared.value
      done()
    }
  }

  static func alarmIds(_ done: @escaping ([String]) -> Void) {
    guard #available(iOS 26.0, *) else { return done([]) }
    let ids = TimerAlarms.ids()
    Task { done(await ids.value) }
  }
}
#endif
