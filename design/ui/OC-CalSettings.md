# OC-CalSettings — Calendar settings

Source `screens/OC-CalSettings.dc.html` · Route `/settings/calendar` · Spec 029

## Layout
1. Back link "Menu"; title "Calendar"; lead "How the family calendar looks for you, and the family's times of day."
2. **For you**: "Opens on" Month · Week · Day · Agenda; "Week starts on" / "Automatic follows this phone's region": Automatic · Sunday · Monday; "Time format" / "Automatic follows this phone's settings": Automatic · 24-hour · 12-hour; switch "Show birthdays" / "Also on Home, 3 days ahead"; switch "Fade past days" / "So today and what's next stand out".
3. **My color** / "Your events show in this color for everyone. Taken colors show who has them.": 4 × 2 swatches (60 tall, radius 18): Honey, Rose, Sky, Mint, Lilac, Peach, Pistachio, Clay. Mine has a double ring; taken ones show the initial.
4. **Times of day** / "Used by the whole family when you pick a time of day. Only Gabriel, the family owner, can change them.": Early morning 06:00–09:00 · Morning 09:00–12:00 · Lunch 12:00–14:00 · Afternoon 14:00–18:00 · Evening 18:00–22:00 (rows with chevron for the owner; no chevron for others).
5. **Family**: "Home time zone" / "New York (Eastern Time)" ›; "AI assistants" / "Let Claude, ChatGPT or Gemini add events" ›.

## States
| State | Copy |
| --- | --- |
| Overlapping times | "Times can't overlap. Evening has to start when Afternoon ends." |
