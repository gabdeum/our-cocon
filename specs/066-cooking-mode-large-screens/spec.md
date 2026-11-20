# Feature Specification: Cooking mode on larger screens

**Feature Branch**: `066-cooking-mode-large-screens` · **Status**: Ready · **Depends on**: 063, 065, 012, 010, 011, 062

Screen: `design/screens/OC-CookResponsive.dc.html` (one component; pass `w`/`h` to preview 390, 590, 744, 820, 1180). UI spec: `design/ui/OC-LargeScreens.md` § Cooking.

> Use the app's existing cooking mode: step sections, highlighted ingredients, the dark step timer card, temperature check, chef's tip, Back / Next, progress bars. Use the existing timer cards from the Timers screen. New: the timers panel, the step list, the quick-timer row and the phone timer pill position.

## Functional requirements
Priority as width grows: **steps (always) → + timers (≥ 600) → + step list (≥ 960).**

- **FR-001 Compact (< 600)**: today's cooking mode, with one change: **the timer pill moves to the bottom**, floating 12 px above the Back / Next bar and centred, in the same style and place as outside cooking mode (white, 2 px honey border, `shadow-float`, 50 px tall: icon, timer name, time, "+N"). It opens the Timers screen. The header shows the close button on the left and two round 48 px buttons on the right: **Timers** (clock icon, opens Timers) and **Settings** (sliders icon). Both always show on phone.
- **FR-002 Medium (600–959)**: two columns, 16 px gap, 16 px top / 20 px side / 20 px bottom padding.
  - Left: the step list exactly as on phone (sections, dimming, scroll snap), centred in a column up to 640 px wide. Back / Next sits under it, same width.
  - Right: **Timers panel**, 290 px: title "Timers" + "{n} running · {n} total", then the existing timer cards for every timer (all recipes, not just this one), then the **Quick timer** row (FR-005), then the hint "Timers keep running when you leave the recipe. You'll hear a chime when one ends." It scrolls on its own.
  - Header: close, recipe title + "Serves {n} · {variant}", Settings button. No Timers button and no pill: the panel shows them.
  - Progress bars stay under the header.
- **FR-003 Expanded (≥ 960)**: as medium, plus a **step list** on the left (260 px white card, 22 px radius): "All steps", then one row per step (56 px min: number badge, step name, the step's running time as a small ink pill when its timer runs). Current step: soft fill with 2 px olive border; done steps: muted badge with a tick. Tapping a row scrolls the steps column to that step (same smooth scroll as the bars). The progress bars are hidden (the list replaces them); the line under the header reads "Tap a step to jump to it". Timers panel 320 px.
- **FR-004 Step photo** (only when the step has a photo; most don't): a small square to the right of the step title. 72 px on phone, 96 px from 600; 16 px radius; `object-fit: cover`. Tap → full-screen photo viewer (existing image viewer if there is one, else a simple modal). The photo never takes the full width.
- **FR-005 Quick timers** (timers panel, ≥ 600): label "Quick timer", then four 48 px buttons in a row (5, 10, 15 and 30 min, the Timers screen's presets) in the dashed "add" style. Each starts a timer immediately (name "{n} min timer", no recipe), which appears at the end of the list. Same action as the Timers screen.
- **FR-006 Settings button** opens the existing cooking-settings sheet, presented per 065 (popover at ≥ 600, anchored to the button).
- **FR-007 Step heights**: each step section is at least 60 % of the window height from 600 (min 500), so the next step peeks below the current one as on phone.
- **FR-008 Same state at every size**: current step, timers and scroll survive tier changes (063 FR-001).

## Success criteria
- **SC-001** Starting a step timer at 820 shows it in the step card and in the panel at once; pausing in either updates both.
- **SC-002** At 1180, tapping step 5 in the step list scrolls to step 5 and marks it current within 700 ms.
- **SC-003** At 390, the timer pill never covers the Back / Next buttons (it sits above them).

## Tracking (PostHog)
| Event | Properties |
| --- | --- |
| `cook_step_jump` | source (bars, step_list), from, to |
| `timer_started` (existing) | + source `quick_panel`, minutes |

## Warnings and errors
None new.

## Needs your attention
- If a recipe step has no photo field in the data today, skip FR-004 (no data change in this work).
- The mockup's cooking-settings rows are a guess; keep the app's real sheet content.

## Changelog
- 2026-11-19: Ready.
- 2026-11-19: Gabriel confirmed FR-001: on the phone the timer pill leaves the header for the bottom, above Back / Next. It's the only phone change in 063–070.
- 2026-11-20: Shipped. `CookLayout` keeps one tree at every tier (the steps' scroll, current step and timers stay on resize; `useStepScroll.hold` re-aims at the current step) and takes `title`/`subtitle`, `pill`, `panel` and `stepList`. Phone: the TimerPill (50, with its ✕, Gabriel's call) floats 12 above Back / Next; Timers + Settings in the header. From 600: recipe name + "Serves 6 · Classic" (the version only when the recipe has versions), header top safe area + 24 (063's rule, 032-later L158, rather than the mockup's 28), the steps in a 640 column (`layout-reading`), the timers panel (`CookTimersPanel`: the Timers screen's cards, quick timers labelled "Quick timer", footnote) at 290 / 320. From 960: `CookStepList` (new component, scrolls on its own) and no bars. Step photos: `StepPhoto` 72 / 96 and `PhotoViewer` (new: no viewer existed). Step sections 60 % of the window from 600 (`cookStepHeight`). Tokens `layout-step-list` 260, `layout-reading` 640; `TimePresets` gains `eyebrow`; the 48-tall `compact` TimerPill is gone. Events: `cook_step_jump` (new); `timer_started` gains `from: 'quick_panel'` and `minutes` for quick timers. Deviations: the spec's `source` is the existing `from` property; quick timers stay as on the Timers screen, "Kitchen timer" and newest first (Gabriel's call), not "{n} min timer" at the end; the panel's empty state and the bars' 44 tap areas are the existing components' (16/700, padding 40), not the mockup's 15/700 and 24. An update is enough (no native change).
- 2026-11-20: After a first look (Gabriel): the step list scrolls to keep the current step in sight (centred when it changes or on opening at a later step; 032-later L163, done); each step with a timer shows its time in the list before it starts, in a beige `line-strong` pill (ink only while running, what's left once started); the timers panel's "Timers" title and running count stay at the top while the cards scroll (`CookLayout`'s panel no longer scrolls; `CookTimersPanel` brings its own).
- 2026-11-20: Wider on large iPads (Gabriel): the side columns grow a little with the window (`cookColumns`: step list 18 %, 260 to 300; timers panel 24 %, from 290 / 320 to 380) and the steps column's cap goes from 640 to 960 (`layout-reading`), so the steps fill the middle instead of centring and stay the widest column (13" iPad sideways: 260 · 706 · 328). Deviation from FR-002 / FR-003's fixed 290 / 320 / 260 and the design's 640. Tokens `layout-step-list-max`, `layout-panel-max`.
