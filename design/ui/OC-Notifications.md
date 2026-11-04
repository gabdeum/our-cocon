# OC-Notifications — what the phone shows

Sources `screens/OC-NotifAsk.dc.html`, `OC-NotifLockTimer.dc.html`, `OC-NotifIsland.dc.html`, `OC-NotifLockDone.dc.html`, `OC-NotifLockReminders.dc.html` · Specs 046–049

Lock Screen mock-ups show content and order only; iOS draws the notification chrome. Notification titles and bodies are plain text (no emoji).

## Ask sheet (046)
BottomSheet over the screen that triggered it. Honey circle 72 with bell icon; title "Know when it’s done" (26/900); body "Turn on notifications to hear the chime and see your timer on the Lock Screen, even with your phone locked. You’ll also get reminders before family events." (16/600 muted); ink button 56 "Turn on notifications"; link "Not now"; note "You can change this anytime in Menu › Notifications." (13/600 muted).
From a reminder (first event with a reminder): title "Get a heads-up before events", body "Turn on notifications so reminders reach your phone, even when Our Cocon is closed."

## Live timer (048)
Lock Screen card: the Timers screen's card (OC-Timers, TimerCard README › Timers screen), same parts, order, colours and words: name 17/900 + "{recipe or No recipe} · {Running | Paused | Done!}" 13/700 · "−1" · clock 40/900 · "+1" (40 circles, white 70%) · progress 6 px (ink on 12% ink) · ink pill "Pause" | "Resume" | "Add 1 more minute" (done) + soft "Stop" | "Dismiss" (done). Fill sage while running, surface-soft while paused, honey + 2 px ink border when done.
In place of "Go to step": a pill "{n} running" 13/800 (white 70%) that opens Timers; a tap anywhere else opens the timer's step in cooking mode (Timers for a quick timer).
iOS cuts the card at 160 pt, so it is tighter than on the Timers screen: padding 10 16, gaps 6, circles 40, clock 40, buttons 36 (spec 048 Changelog).
Dynamic Island: compact = timer icon (honey) · time 15/900 honey; minimal = honey progress ring; expanded = app mark 36, label 17/900 white, "{recipe} · +{n} more" 13/700 `island-sub`, time 36/900 honey, progress 6 px on `island-track`, three buttons 42 on `island-button` ("−1 min", "+1 min", "Pause").
Not drawn (spec 048): every timer paused, the pill says "{n} paused"; done in the island, the compact icon is the bell and the expanded one shows "{label} is done" with no buttons; one timer only, the island's sub is the step ("Leek & bacon quiche · step 3"). All words are in `strings/en.ts` › `timersScreen` (the card) and `liveTimer` (the pill and the island); the phone only draws the time.

## Timer done (047)
Title "{label} is done" · body "{recipe} · step {n}" or "{n}-minute kitchen timer". Long-press actions: "+1 min" · "Stop".
Follow-up after 2 min: "Still waiting: {label}" · "Done {n} minutes ago."

## Event reminders (049)
| Kind | Title | Body example |
| --- | --- | --- |
| 15 minutes before | "Pediatrician in 15 minutes" | "10:00 · Dr. Lee · Gabriel takes James" |
| 1 hour before | "Baby swim class in 1 hour" | "14:30 · Aquatic Center · Gabriel takes James" |
| Morning of | "Pediatrician at 10:00" · "Baby music this morning" · "Today: Grandma visits" | "James · Dr. Lee · Gabriel takes James" |
| 1 day before | "Tomorrow: Eva’s birthday" | "All day · Tuesday" |
Body rules (spec 049 FR-004): "15 minutes" and "1 hour": "{time or slot} · {place} · {who takes}". "Morning of" has the time in its title, so the body is "{who it's for} · {place} · {who takes}" (no names when it's only the recipient). "1 day before": "{time, slot or All day} · {weekday} · {place} · {who takes}". Empty parts are left out. Titles for a slot: "{title} this morning / this afternoon / this evening", "{title} early this morning", "{title} at lunch". An all-day event's "15 minutes" and "1 hour" remind at 07:30 as "Today: {title}". Times follow the recipient's clock (12- or 24-hour). The words are in `packages/calendar/words.en.ts` › `reminders` (the notifier has no app strings).
In-app (app open): StatusBanner with the same title and body, tap → event. Built as the app's Toast: "{title} · {body}" with the button "Open" (spec 046).
