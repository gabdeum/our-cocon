// Spec 048 FR-003: the Live Activity. On the Lock Screen it is the Timers screen's card (TimerCard
// README › Timers screen, OC-Timers), with a "2 running" pill in place of "Go to step"; the Dynamic
// Island is OC-NotifIsland. Colours are design tokens (Theme.swift, from `pnpm theme`); every word comes
// from the app. The phone counts down by itself from `endsAt`.
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
        .activityBackgroundTint(card.fill)
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

/// The card's state, with "done" also when the timer reached zero while the app slept: iOS marks the
/// activity stale at `endsAt` (the app sets that date) and draws it again.
struct Card {
  let state: TimerActivityAttributes.ContentState
  let ended: Bool

  var face: TimerActivityAttributes.Face { state.face }
  var copy: TimerActivityAttributes.Copy { state.copy }
  var isDone: Bool { face.state == "done" || (ended && face.state == "running") }
  var isPaused: Bool { face.state == "paused" }
  var count: String { isDone && face.state == "running" ? face.countDone : face.count }
  var sub: String { isDone ? face.subDone : isPaused ? face.subPaused : face.subRunning }
  /// As on the Timers screen: sage while running, surface-soft while paused, honey once done.
  var fill: Color { isDone ? Theme.honey : isPaused ? Theme.surfaceSoft : Theme.sage }
  /// A tap on the card: the step in cooking mode, or Timers.
  var openURL: URL? { URL(string: face.openUrl) }
  var timersURL: URL? { URL(string: state.timersUrl) }

  private var end: Date? { face.endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
  private var start: Date? { end.map { $0.addingTimeInterval(-Double(face.totalSeconds)) } }

  /// The clock: ticking while running, the time it stopped at while paused, 0:00 once done.
  var countdown: Text {
    if !isDone, let start, let end, start <= end {
      return Text(timerInterval: start...end, countsDown: true)
    }
    return Text(Clock.text(isDone ? 0 : face.remainingSeconds ?? 0))
  }

  /// Time gone, as on the Timers screen: fills as time passes.
  func bar(height: CGFloat, fill: Color, track: Color) -> some View {
    Group {
      if !isDone, let start, let end, start <= end {
        ProgressView(timerInterval: start...end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
      } else {
        ProgressView(value: isDone ? 1 : pausedProgress)
      }
    }
    .progressViewStyle(.linear)
    .tint(fill)
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
    guard face.totalSeconds > 0 else { return 0 }
    return min(1, max(0, 1 - Double(face.remainingSeconds ?? 0) / Double(face.totalSeconds)))
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

// MARK: - Lock Screen: the Timers screen's card

/// iOS cuts a Lock Screen Live Activity at 160 pt and the Timers screen's card is about 210, so it is
/// tightened (padding 10 16, gaps 6, circles 40, clock 40, buttons 36); parts, order, colours and words
/// are the Timers screen's.
struct LockScreenCard: View {
  let card: Card

  var body: some View {
    VStack(spacing: 6) {
      HStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 0) {
          Text(card.face.label).font(.nunito(17, .black)).lineLimit(1)
          Text(card.sub).font(.nunito(13, .bold)).opacity(0.8).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        CountPill(text: card.count, url: card.timersURL)
      }
      .frame(height: 36)
      HStack(spacing: 8) {
        Button(intent: RemoveMinuteIntent(timerId: card.face.id)) {
          AdjustCircle(text: card.copy.minus)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(card.copy.minusA11y)
        card.countdown
          .font(.nunito(40, .black))
          .kerning(-1)
          .monospacedDigit()
          .multilineTextAlignment(.center)
          .lineLimit(1)
          .frame(maxWidth: .infinity, maxHeight: 40)
        Button(intent: AddMinuteIntent(timerId: card.face.id)) {
          AdjustCircle(text: card.copy.plus)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(card.copy.plusA11y)
      }
      .frame(height: 40)
      card.bar(height: 6, fill: Theme.ink, track: Theme.ink.opacity(0.12))
      HStack(spacing: 8) {
        if card.isDone {
          Button(intent: AddMinuteIntent(timerId: card.face.id)) {
            MainPill(text: card.copy.addMore)
          }
          .buttonStyle(.plain)
        } else {
          Button(intent: TogglePauseIntent(timerId: card.face.id)) {
            MainPill(text: card.isPaused ? card.copy.resume : card.copy.pause)
          }
          .buttonStyle(.plain)
        }
        Button(intent: StopTimerIntent(timerId: card.face.id)) {
          Text(card.isDone ? card.copy.dismiss : card.copy.stop)
            .font(.nunito(15, .heavy))
            .padding(.horizontal, 16)
            .frame(height: 36)
            .background(Capsule().fill(Theme.surfaceCard.opacity(0.7)))
        }
        .buttonStyle(.plain)
      }
    }
    .foregroundStyle(Theme.ink)
    .padding(.vertical, 10)
    .padding(.horizontal, 16)
    // Done: the Timers screen's 2 px ink border, along the card's own corners.
    .overlay {
      if card.isDone {
        ContainerRelativeShape().strokeBorder(Theme.ink, lineWidth: 2)
      }
    }
  }
}

/// "−1" and "+1": white at 70%.
struct AdjustCircle: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.nunito(15, .black))
      .frame(width: 40, height: 40)
      .background(Circle().fill(Theme.surfaceCard.opacity(0.7)))
  }
}

/// "Pause", "Resume" or "Add 1 more minute": the ink pill, as wide as it can be.
struct MainPill: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.nunito(16, .black))
      .foregroundStyle(Theme.onOlive)
      .lineLimit(1)
      .frame(maxWidth: .infinity, minHeight: 36, maxHeight: 36)
      .background(Capsule().fill(Theme.ink))
  }
}

/// "2 running", where the Timers screen has "Go to step": it opens Timers, wherever the card opens.
struct CountPill: View {
  let text: String
  let url: URL?

  var body: some View {
    let pill = Text(text)
      .font(.nunito(13, .heavy))
      .lineLimit(1)
      .padding(.horizontal, 10)
      .frame(height: 26)
      .background(Capsule().fill(Theme.surfaceCard.opacity(0.7)))
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
          Text(card.isDone ? card.face.doneTitle : card.face.label).font(.nunito(17, .black)).foregroundStyle(Theme.onOlive).lineLimit(1)
          Text(card.isPaused ? card.copy.pausedSub : card.face.islandSub).font(.nunito(13, .bold)).foregroundStyle(Theme.islandSub).lineLimit(1)
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
      card.bar(height: 6, fill: Theme.honey, track: Theme.islandTrack)
      if !card.isDone {
        HStack(spacing: 8) {
          Button(intent: RemoveMinuteIntent(timerId: card.face.id)) {
            IslandButton(text: card.copy.removeMinute)
          }
          .buttonStyle(.plain)
          Button(intent: AddMinuteIntent(timerId: card.face.id)) {
            IslandButton(text: card.copy.addMinute)
          }
          .buttonStyle(.plain)
          Button(intent: TogglePauseIntent(timerId: card.face.id)) {
            IslandButton(text: card.isPaused ? card.copy.resume : card.copy.pause)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 4)
  }
}

struct IslandButton: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.nunito(15, .black))
      .foregroundStyle(Theme.onOlive)
      .lineLimit(1)
      .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
      .background(Capsule().fill(Theme.islandButton))
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
