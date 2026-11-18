// Spec 061: the Live Activity iOS shows while a timer's alarm rings (AlarmKit needs the app to draw it;
// without one the Dynamic Island is an empty pill). On the Lock Screen it is the Timers screen's done
// card (honey, 2 px ink border, OC-NotifLockDone) with "+1 min" and "Stop"; every word comes from the app.
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 26.0, *)
struct TimerAlarmWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AlarmAttributes<TimerAlarmMetadata>.self) { context in
      AlarmCard(alarm: context.attributes.metadata)
        .activityBackgroundTint(Theme.honey)
        .activitySystemActionForegroundColor(Theme.ink)
    } dynamicIsland: { context in
      let alarm = context.attributes.metadata
      return DynamicIsland {
        DynamicIslandExpandedRegion(.bottom) {
          AlarmIsland(alarm: alarm)
        }
      } compactLeading: {
        AlarmBell(size: 18)
      } compactTrailing: {
        Text(alarm?.title ?? "")
          .font(.nunito(15, .black))
          .foregroundStyle(Theme.honey)
          .lineLimit(1)
          .frame(maxWidth: 80, alignment: .trailing)
      } minimal: {
        AlarmBell(size: 18)
      }
      .keylineTint(Theme.honey)
    }
  }
}

@available(iOS 26.0, *)
struct AlarmCard: View {
  let alarm: TimerAlarmMetadata?

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 10) {
        AlarmBell(size: 32, color: Theme.ink)
        VStack(alignment: .leading, spacing: 0) {
          Text(alarm?.title ?? "").font(.nunito(17, .black)).lineLimit(1)
          Text(alarm?.subtitle ?? "").font(.nunito(13, .bold)).opacity(0.8).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      if let alarm {
        HStack(spacing: 8) {
          Button(intent: TimerAlarmAddMinuteIntent(timerId: alarm.timerId)) {
            MainPill(text: alarm.addMinute)
          }
          .buttonStyle(.plain)
          Button(intent: TimerAlarmStopIntent(timerId: alarm.timerId)) {
            Text(alarm.stop)
              .font(.nunito(15, .heavy))
              .padding(.horizontal, 16)
              .frame(height: 36)
              .background(Capsule().fill(Theme.surfaceCard.opacity(0.7)))
          }
          .buttonStyle(.plain)
        }
      }
    }
    .foregroundStyle(Theme.ink)
    .padding(.vertical, 12)
    .padding(.horizontal, 16)
    .overlay {
      ContainerRelativeShape().strokeBorder(Theme.ink, lineWidth: 2)
    }
  }
}

@available(iOS 26.0, *)
struct AlarmIsland: View {
  let alarm: TimerAlarmMetadata?

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        AlarmBell(size: 36)
        VStack(alignment: .leading, spacing: 0) {
          Text(alarm?.title ?? "").font(.nunito(17, .black)).foregroundStyle(Theme.onOlive).lineLimit(1)
          Text(alarm?.subtitle ?? "").font(.nunito(13, .bold)).foregroundStyle(Theme.islandSub).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      if let alarm {
        HStack(spacing: 8) {
          Button(intent: TimerAlarmAddMinuteIntent(timerId: alarm.timerId)) {
            IslandButton(text: alarm.addMinute)
          }
          .buttonStyle(.plain)
          Button(intent: TimerAlarmStopIntent(timerId: alarm.timerId)) {
            IslandButton(text: alarm.stop)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 4)
  }
}

struct AlarmBell: View {
  let size: CGFloat
  var color: Color = Theme.honey

  var body: some View {
    Image("bell")
      .renderingMode(.template)
      .resizable()
      .frame(width: size, height: size)
      .foregroundStyle(color)
      .accessibilityHidden(true)
  }
}
#endif
