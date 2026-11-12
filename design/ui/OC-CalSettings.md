# OC-CalSettings — Calendar settings

Source `screens/OC-CalSettings.dc.html` · Route `/settings/calendar` · Spec 029. My color moved to the Family page (spec 033, 2026-10-27); the canvas still shows it here.

## Layout
1. TopBar (spec 050): back "Back to Menu", title "Calendar" (`titleMode="always"`); then the lead "How the family calendar looks for you, and the family's times of day."
2. **For you**: "Opens on" Month · Week · Day · Agenda; "Week starts on" / "Automatic follows this phone's region": Automatic · Sunday · Monday; "Time format" / "Automatic follows this phone's settings": Automatic · 24-hour · 12-hour; switch "Show birthdays" / "Also on Home, 3 days ahead"; switch "Fade past days" / "So today and what's next stand out".
3. **Times of day** / "Used by the whole family when you pick a time of day. Only Gabriel, the family owner, can change them.": Early morning 06:00–09:00 · Morning 09:00–12:00 · Lunch 12:00–14:00 · Afternoon 14:00–18:00 · Evening 18:00–22:00 (rows with chevron for the owner; no chevron for others).
4. **Family**: "Home time zone" / "New York (Eastern Time)" ›; "AI assistants" / "Let Claude, ChatGPT or Gemini add events" ›.

## Times of day sheet (not drawn; spec 029 build, 2026-11-02)
Tapping a slot (owner only) opens a BottomSheet titled with the slot ("Evening"): TextFields "Starts" and "Ends" (HH:MM, like Add event's custom times), footer "Cancel" · "Save" (busy "Saving…"). A slot's edge moves its neighbour's with it (Gabriel, 2026-11-02): while "Starts" differs, its hint reads "Afternoon will end at 18:30." ("Ends": "Lunch will start at 13:30."). Early morning's start and Evening's end move alone. Saving keeps existing events on the changed slots at their old hours (they become custom times).

## Home time zone sheet (not drawn)
Owner only. BottomSheet "Home time zone": lead "All dates in the family calendar use this time zone.", the current zone (16/800, "New York (Eastern Time)"), then ink block "Use this phone's time zone (Paris (Central European Time))", or, when it's the same, olive-deep "That's the family's time zone already." Others see the row with no chevron.

## States
| State | Copy |
| --- | --- |
| Overlapping times | "Times can't overlap. Evening has to start when Afternoon ends." (the slot and the neighbour it would squeeze out, under the field) |
| Not a time | "Use a time like 18:30." |
| End before start | "Pick an end time after the start." |
| Time zone not set yet | Row sub-line "Not set yet" |
| A change failed | warn toast "Couldn't save. Try again." (over the sheet when one is open; spec 053) |
| Offline | OfflineBanner; segmented controls and switches disabled, no chevrons |
