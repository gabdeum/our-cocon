import ActivityKit
import ExpoModulesCore
import Foundation

/// Spec 048: starts, updates and ends the one Live Activity for this phone's timers. What it shows
/// comes from the app as JSON (lib/live-activity.ts); the card itself is targets/timer-activity.
/// Only from iOS 17, where its buttons work (FR-004).
public final class LiveTimerModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("CoconLiveTimer")

    Events("onAction")

    Function("areEnabled") { () -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("current") { () -> String? in
      guard #available(iOS 17.0, *) else { return nil }
      return Activity<TimerActivityAttributes>.activities.first?.attributes.owner
    }

    AsyncFunction("start") { (owner: String, state: String, staleAt: Double?) -> Bool in
      guard #available(iOS 17.0, *), let content = Self.decode(state) else { return false }
      do {
        _ = try Activity.request(
          attributes: TimerActivityAttributes(owner: owner),
          content: ActivityContent(state: content, staleDate: Self.date(staleAt)),
          pushType: nil
        )
        return true
      } catch {
        // Refused (Live Activities off, too many): no card, the app keeps working.
        return false
      }
    }

    // That person's card only; anyone else's goes. False when none of theirs is showing any more
    // (iOS ended it after 8 hours, or it was swiped away).
    AsyncFunction("update") { (owner: String, state: String, staleAt: Double?) async -> Bool in
      guard #available(iOS 17.0, *), let content = Self.decode(state) else { return false }
      var updated = false
      for activity in Activity<TimerActivityAttributes>.activities {
        if activity.attributes.owner == owner {
          await activity.update(ActivityContent(state: content, staleDate: Self.date(staleAt)))
          updated = true
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      return updated
    }

    AsyncFunction("end") { () async in
      LiveTimerTaps.clear()
      guard #available(iOS 17.0, *) else { return }
      for activity in Activity<TimerActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }

    AsyncFunction("takeActions") { () -> String in
      LiveTimerTaps.take()
    }

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(forName: LiveTimerTaps.tapped, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onAction", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observer = nil
    }
  }

  private static func decode(_ json: String) -> TimerActivityAttributes.ContentState? {
    try? JSONDecoder().decode(TimerActivityAttributes.ContentState.self, from: Data(json.utf8))
  }

  private static func date(_ ms: Double?) -> Date? {
    ms.map { Date(timeIntervalSince1970: $0 / 1000) }
  }
}
