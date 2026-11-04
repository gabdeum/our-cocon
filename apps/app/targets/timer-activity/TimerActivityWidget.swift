// Spec 048 FR-003: the Live Activity as drawn in design/screens OC-NotifLockTimer (Lock Screen),
// OC-NotifIsland (Dynamic Island) and OC-NotifLockDone (done). Colours are design tokens (Theme.swift,
// from `pnpm theme`); every word comes from the app. The phone counts down by itself from `endsAt`.
import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct TimerActivityBundle: WidgetBundle {
  var body: some Widget {
    TimerActivityWidget()
  }
}

struct TimerActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimerActivityAttributes.self) { context in
      let card = Card(state: context.state, ended: context.isStale)
      LockScreenCard(card: card)
        .activityBackgroundTint(card.isDone ? Theme.honey : Theme.surfacePage)
        .activitySystemActionForegroundColor(Theme.ink)
        .widgetURL(card.openURL)
    } dynamicIsland: { context in
      let card = Card(state: context.state, ended: context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.bottom) {
          IslandExpanded(card: card)
        }
      } compactLeading: {
        Image(card.isDone ? "bell" : "timer")
          .renderingMode(.template)
          .resizable()
          .frame(width: 18, height: 18)
          .foregroundStyle(Theme.honey)
          .accessibilityHidden(true)
      } compactTrailing: {
        card.countdown
          .font(.nunito(15, .black))
          .monospacedDigit()
          .foregroundStyle(Theme.honey)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 56, alignment: .trailing)
      } minimal: {
        card.ring
      }
      .keylineTint(Theme.honey)
      .widgetURL(card.openURL)
    }
  }
}

// MARK: - What to show

/// The card's state, with "done" also when the primary timer reached zero while the app slept: iOS
/// marks the activity stale at `endsAt` (the app sets that date) and draws it again.
struct Card {
  let state: TimerActivityAttributes.ContentState
  let ended: Bool

  var isDone: Bool { state.state == "done" || (ended && state.state == "running") }
  var isPaused: Bool { state.state == "paused" }
  var copy: TimerActivityAttributes.Copy { state.copy }
  var count: String { isDone && state.state == "running" ? copy.countDone : copy.count }
  var next: TimerActivityAttributes.Row? { state.others.first }
  /// A tap on the card: the step in cooking mode, or Timers.
  var openURL: URL? { URL(string: state.openUrl) }
  var timersURL: URL? { URL(string: state.timersUrl) }

  private var end: Date? { state.endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
  private var start: Date? { end.map { $0.addingTimeInterval(-Double(state.totalSeconds)) } }

  /// The countdown: ticking while running, the time it stopped at while paused, 0:00 once done.
  var countdown: Text {
    if !isDone, let start, let end, start <= end {
      return Text(timerInterval: start...end, countsDown: true)
    }
    return Text(Clock.text(isDone ? 0 : state.remainingSeconds ?? 0))
  }

  /// Time gone, as on the Timers screen: fills as time passes.
  func bar(height: CGFloat, track: Color) -> some View {
    Group {
      if !isDone, let start, let end, start <= end {
        ProgressView(timerInterval: start...end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
      } else {
        ProgressView(value: isDone ? 1 : pausedProgress)
      }
    }
    .progressViewStyle(.linear)
    .tint(Theme.honey)
    // The system bar is about 4 pt tall: stretched to the drawn height, on the drawn track.
    .scaleEffect(x: 1, y: height / 4, anchor: .center)
    .frame(height: height)
    .background(Capsule().fill(track))
    .clipShape(Capsule())
    .accessibilityHidden(true)
  }

  /// The minimal island: a honey ring of the time gone.
  var ring: some View {
    Group {
      if !isDone, let start, let end, start <= end {
        ProgressView(timerInterval: start...end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
      } else {
        ProgressView(value: isDone ? 1 : pausedProgress)
      }
    }
    .progressViewStyle(.circular)
    .tint(Theme.honey)
    .accessibilityHidden(true)
  }

  private var pausedProgress: Double {
    guard state.totalSeconds > 0 else { return 0 }
    return min(1, max(0, 1 - Double(state.remainingSeconds ?? 0) / Double(state.totalSeconds)))
  }

  /// The next timer's time.
  func time(of row: TimerActivityAttributes.Row) -> Text {
    if let endsAt = row.endsAt {
      return Text(timerInterval: Date.distantPast...Date(timeIntervalSince1970: endsAt / 1000), countsDown: true)
    }
    return Text(Clock.text(row.remainingSeconds ?? 0))
  }
}

enum Clock {
  /// A stopped time in the system timer's own format: "4:12", "1:04:12".
  static func text(_ seconds: Int) -> String {
    let s = max(0, seconds)
    let (h, m, sec) = (s / 3600, (s % 3600) / 60, s % 60)
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
  }
}

// MARK: - Lock Screen (OC-NotifLockTimer, OC-NotifLockDone)

/// iOS cuts a Lock Screen Live Activity at 160 pt, so the drawn card's gaps are tightened (padding 12,
/// gaps 6, header 26, buttons 36); the order, sizes of the words and colours are as drawn.
struct LockScreenCard: View {
  let card: Card

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        Image("mark")
          .resizable()
          .frame(width: 24, height: 24)
          .clipShape(RoundedRectangle(cornerRadius: 7))
          .accessibilityHidden(true)
        Text(card.copy.title).font(.nunito(14, .black)).foregroundStyle(Theme.ink)
        Spacer(minLength: 0)
        CountPill(text: card.count, url: card.timersURL, fill: card.isDone ? Theme.surfaceCard.opacity(0.55) : Theme.surfaceSoft)
      }
      .frame(height: 26)
      if card.isDone {
        done
      } else {
        counting
      }
    }
    .padding(.vertical, 12)
    .padding(.horizontal, 16)
  }

  private var counting: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .center, spacing: 10) {
        VStack(alignment: .leading, spacing: 0) {
          Text(card.state.label).font(.nunito(20, .black)).foregroundStyle(Theme.ink).lineLimit(1)
          Text(card.isPaused ? card.copy.pausedSub : card.copy.sub).font(.nunito(13, .bold)).foregroundStyle(Theme.inkMuted).lineLimit(1)
        }
        .layoutPriority(1)
        card.countdown
          .font(.nunito(42, .black))
          .monospacedDigit()
          .foregroundStyle(Theme.oliveDeep)
          .multilineTextAlignment(.trailing)
          .lineLimit(1)
          .frame(maxWidth: .infinity, maxHeight: 44, alignment: .trailing)
      }
      .frame(height: 44)
      card.bar(height: 8, track: Theme.line)
      HStack(spacing: 6) {
        Group {
          if let next = card.next {
            (Text(next.label + " ").foregroundStyle(Theme.inkMuted) + card.time(of: next).foregroundStyle(Theme.ink) + Text(card.copy.more).foregroundStyle(Theme.inkMuted))
          } else {
            Text("")
          }
        }
        .font(.nunito(14, .heavy))
        .monospacedDigit()
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        Button(intent: RemoveMinuteIntent(timerId: card.state.id)) {
          Pill(text: card.copy.removeMinute, fill: Theme.surfaceSoft, ink: Theme.ink, height: 36)
        }
        .buttonStyle(.plain)
        Button(intent: AddMinuteIntent(timerId: card.state.id)) {
          Pill(text: card.copy.addMinute, fill: Theme.surfaceSoft, ink: Theme.ink, height: 36)
        }
        .buttonStyle(.plain)
        Button(intent: TogglePauseIntent(timerId: card.state.id)) {
          Pill(text: card.isPaused ? card.copy.resume : card.copy.pause, fill: Theme.ink, ink: Theme.onOlive, height: 36)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private var done: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 10) {
        Image("bell")
          .renderingMode(.template)
          .resizable()
          .frame(width: 34, height: 34)
          .foregroundStyle(Theme.ink)
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 0) {
          Text(card.copy.doneTitle).font(.nunito(22, .black)).lineLimit(1)
          Text(card.copy.sub).font(.nunito(14, .bold)).lineLimit(1)
        }
        .foregroundStyle(Theme.ink)
      }
      if let next = card.next {
        HStack {
          Text(next.label).lineLimit(1)
          Spacer(minLength: 8)
          (card.time(of: next) + Text(" " + card.copy.left)).monospacedDigit()
        }
        .font(.nunito(15, .heavy))
        .foregroundStyle(Theme.ink)
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.surfaceCard.opacity(0.55)))
      }
    }
  }
}

/// "2 running": a soft pill that opens Timers, wherever the card itself opens.
struct CountPill: View {
  let text: String
  let url: URL?
  let fill: Color

  var body: some View {
    let pill = Text(text)
      .font(.nunito(13, .heavy))
      .foregroundStyle(Theme.ink)
      .padding(.horizontal, 10)
      .frame(height: 26)
      .background(Capsule().fill(fill))
    if let url {
      Link(destination: url) { pill }
    } else {
      pill
    }
  }
}

// MARK: - Dynamic Island, expanded (OC-NotifIsland)

struct IslandExpanded: View {
  let card: Card

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        if card.isDone {
          Image("bell")
            .renderingMode(.template)
            .resizable()
            .frame(width: 36, height: 36)
            .foregroundStyle(Theme.honey)
            .accessibilityHidden(true)
        } else {
          Image("mark")
            .resizable()
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .accessibilityHidden(true)
        }
        VStack(alignment: .leading, spacing: 0) {
          Text(card.isDone ? card.copy.doneTitle : card.state.label).font(.nunito(17, .black)).foregroundStyle(Theme.onOlive).lineLimit(1)
          Text(card.isPaused ? card.copy.pausedSub : card.copy.islandSub).font(.nunito(13, .bold)).foregroundStyle(Theme.islandSub).lineLimit(1)
        }
        .layoutPriority(1)
        card.countdown
          .font(.nunito(36, .black))
          .monospacedDigit()
          .foregroundStyle(Theme.honey)
          .multilineTextAlignment(.trailing)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .trailing)
      }
      card.bar(height: 6, track: Theme.islandTrack)
      if !card.isDone {
        HStack(spacing: 8) {
          Button(intent: RemoveMinuteIntent(timerId: card.state.id)) {
            Pill(text: card.copy.removeMinute, fill: Theme.islandButton, ink: Theme.onOlive, height: 42, stretch: true)
          }
          .buttonStyle(.plain)
          Button(intent: AddMinuteIntent(timerId: card.state.id)) {
            Pill(text: card.copy.addMinute, fill: Theme.islandButton, ink: Theme.onOlive, height: 42, stretch: true)
          }
          .buttonStyle(.plain)
          Button(intent: TogglePauseIntent(timerId: card.state.id)) {
            Pill(text: card.isPaused ? card.copy.resume : card.copy.pause, fill: Theme.islandButton, ink: Theme.onOlive, height: 42, stretch: true)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 4)
  }
}

// MARK: - Pieces

/// A button's look: as wide as its words on the Lock Screen, sharing the width in the island.
struct Pill: View {
  let text: String
  let fill: Color
  let ink: Color
  let height: CGFloat
  var stretch = false

  var body: some View {
    Text(text)
      .font(.nunito(15, .black))
      .foregroundStyle(ink)
      .lineLimit(1)
      .padding(.horizontal, 12)
      .frame(minWidth: 44, maxWidth: stretch ? .infinity : nil, minHeight: height, maxHeight: height)
      .fixedSize(horizontal: !stretch, vertical: false)
      .background(Capsule().fill(fill))
  }
}

extension Font {
  /// Nunito, bundled with the widget (fonts/, Info.plist); the system's rounded font if it's missing.
  static func nunito(_ size: CGFloat, _ weight: Font.Weight) -> Font {
    let name: String
    switch weight {
    case .black: name = "Nunito-Black"
    case .heavy: name = "Nunito-ExtraBold"
    default: name = "Nunito-Bold"
    }
    return .custom(name, size: size)
  }
}
