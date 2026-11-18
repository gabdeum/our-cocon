import Foundation

/// Spec 061: AlarmKit alarms for timers (iOS 26+). The alarms and their buttons live in the app target
/// (targets/timer-activity/_shared/TimerAlarms.swift): their intents must be the app's own for iOS to
/// run them, and this module is a separate pod that can't see the app's types. The app target's
/// `CoconTimerAlarms` class implements this; the module finds it by name. Missing (a build before
/// 061, or iOS before 26): no alarms, and timers alert with notifications (spec 047).
@objc public protocol CoconTimerAlarmsBridge: NSObjectProtocol {
  /// iOS 26 or later.
  static func alarmsAvailable() -> Bool
  /// "authorized", "denied" or "notDetermined".
  static func alarmAuthorization() -> String
  static func requestAlarmAuthorization(_ done: @escaping (String) -> Void)
  /// One timer's alarm (JSON: TimerAlarm), replacing any it had. `at` in ms since 1970.
  static func scheduleAlarm(_ json: String, at: Double, done: @escaping (Bool) -> Void)
  /// By alert id ("timer:{id}"): waiting or ringing. Applied after every call made before it.
  static func cancelAlarms(_ alertIds: [String])
  /// The alert ids of the alarms still waiting or ringing.
  static func alarmIds(_ done: @escaping ([String]) -> Void)
  /// Sign-out or another person: every alarm goes, and no tap under way can set one again.
  static func clearAlarms(_ done: @escaping () -> Void)
}

enum TimerAlarmsLink {
  static var bridge: CoconTimerAlarmsBridge.Type? {
    NSClassFromString("CoconTimerAlarms") as? CoconTimerAlarmsBridge.Type
  }
}
