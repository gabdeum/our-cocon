# OC-CalSettings — Calendar settings

Source `screens/OC-CalSettings.dc.html` · Route `/settings/calendar` · Spec 029. My color moved to the Family page (spec 033, 2026-10-27); the canvas still shows it here.

## Layout
1. Back link "Menu"; title "Calendar"; lead "How the family calendar looks for you, and the family's times of day."
2. **For you**: "Opens on" Month · Week · Day · Agenda; "Week starts on" / "Automatic follows this phone's region": Automatic · Sunday · Monday; "Time format" / "Automatic follows this phone's settings": Automatic · 24-hour · 12-hour; switch "Show birthdays" / "Also on Home, 3 days ahead"; switch "Fade past days" / "So today and what's next stand out".
3. **Times of day** / "Used by the whole family when you pick a time of day. Only Gabriel, the family owner, can change them.": Early morning 06:00–09:00 · Morning 09:00–12:00 · Lunch 12:00–14:00 · Afternoon 14:00–18:00 · Evening 18:00–22:00 (rows with chevron for the owner; no chevron for others).
4. **Family**: "Home time zone" / "New York (Eastern Time)" ›; "AI assistants" / "Let Claude, ChatGPT or Gemini add events" ›.

## States
| State | Copy |
| --- | --- |
| Overlapping times | "Times can't overlap. Evening has to start when Afternoon ends." |
