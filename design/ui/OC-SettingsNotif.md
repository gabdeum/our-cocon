# OC-SettingsNotif — Menu › Notifications

Source `screens/OC-SettingsNotif.dc.html` (off state: `OC-SettingsNotifOff.dc.html`) · Route `/settings/notifications` · Specs 046, 047, 048, 049

## Layout
1. TopBar (spec 050): back "Back to Menu", title "Notifications" (`titleMode="always"`); then the lead "Just for you, on this iPhone."
2. Off state only: warn card (`#FFE3C2`, radius 20): "Notifications are off for Our Cocon" (16/900) · "Timers can’t chime and reminders won’t arrive while the app is closed." · ink pill "Open iPhone Settings". Everything below is dimmed (45%) and inert.
3. **Timers** card: switch "Timer on Lock Screen" / "Countdown on the Lock Screen and in the Dynamic Island"; switch "Alert when a timer ends" / "Chime and notification, even when the app is closed".
4. **Event reminders** card: switch "Event reminders" / "Before events that have a reminder"; "Remind me about" SegmentedControl "Events I’m on" · "All family events"; row "Default for new events" / "When you add an event" → value "1 hour before" › (sheet: None · 15 minutes before · 1 hour before · Morning of · 1 day before). Below the card: "Events for James remind the person who takes him, or everyone with the app if nobody’s chosen yet." (uses the family's managed members; hidden when there are none).
5. Not yet asked and not denied: card at the top "Turn on notifications" (ink button) instead of the warn card.

## States
| State | Copy |
| --- | --- |
| Web | "Notifications work in the iPhone app." (page shows only this line) |
| Reminders off | the two rows below the switch are hidden |
| Not yet asked (not drawn, spec 046) | Card: "Hear the chime and see your timer on the Lock Screen, and get reminders before family events, even when Our Cocon is closed." (15/600 muted) + ink button "Turn on notifications" |
| Default sheet (not drawn, spec 046) | BottomSheet "Default for new events", a ListRow with a radio per choice; a tap saves and closes. Failed: warn toast "Couldn't save. Try again." |
| Members without the app | The hint names them all ("Events for James and Mia remind…") and says "them": no pronouns are stored (spec 046) |
| Offline | Readable; switches and the default row are off (Patterns.md › Offline) |

## Menu row
In Menu › Settings, first card, after AI assistants: bell icon, "Notifications" / "Timers, event reminders" ›. When off in iPhone Settings, the detail reads "Off" in the warn color.
