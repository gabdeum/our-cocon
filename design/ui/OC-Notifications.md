# OC-Notifications — what the phone shows

Sources `screens/OC-NotifAsk.dc.html`, `OC-NotifLockTimer.dc.html`, `OC-NotifIsland.dc.html`, `OC-NotifLockDone.dc.html`, `OC-NotifLockReminders.dc.html` · Specs 046–049

Lock Screen mock-ups show content and order only; iOS draws the notification chrome. Notification titles and bodies are plain text (no emoji).

## Ask sheet (046)
BottomSheet over the screen that triggered it. Honey circle 72 with bell icon; title "Know when it’s done" (26/900); body "Turn on notifications to hear the chime and see your timer on the Lock Screen, even with your phone locked. You’ll also get reminders before family events." (16/600 muted); ink button 56 "Turn on notifications"; link "Not now"; note "You can change this anytime in Menu › Notifications." (13/600 muted).
From a reminder (first event with a reminder): title "Get a heads-up before events", body "Turn on notifications so reminders reach your phone, even when Our Cocon is closed."

## Live timer (048)
Lock Screen card (radius 24, padding 14 16, `surface-page`): row app mark 28 + "Timers" 14/900 + "{n} running" 13/800 muted · label 20/900 + sub 13/700 muted ("Leek & bacon quiche · step 3") · countdown 42/900 olive-deep, tabular, right-aligned · progress 8 px (`line` track, honey fill) · row "{next label} {time}" (or "· +{n} more") + soft pill "+1 min" + ink pill "Pause" (40 tall).
Paused: countdown frozen, sub "Paused", ink pill "Resume".
Done: card fill honey; bell 34 + "{label} is done" 22/900 + sub; next timer in a white 55% row "{label} · {time} left".
Dynamic Island: compact = timer icon (honey) · time 15/900 honey; minimal = honey progress ring; expanded = app mark 36, label 17/900 white, "{recipe} · +{n} more" 13/700 `#CFC6B0`, time 36/900 honey, progress 6 px on `#3A3A3A`, two buttons 42 on `#2E2E2E`.

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
In-app (app open): StatusBanner with the same title and body, tap → event. Built as the app's Toast: "{title} · {body}" with the button "Open" (spec 046).
