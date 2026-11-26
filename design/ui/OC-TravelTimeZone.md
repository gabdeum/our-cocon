# OC-TravelTimeZone — the phone moved to another time zone

Spec 071 · Not drawn: a BottomSheet built like the notifications ask sheet (OC-Notifications › Ask sheet).

## Drawer
Opens over whatever screen is showing, when the app opens or comes back on another clock than the member's times (spec 071 FR-001).

1. Honey IconTile xl with the `plane` icon.
2. Title "You’re on {city} time" (BottomSheet title). `{city}`: the zone's last part, "New York".
3. Lead "Your phone moved to {city} time, {gap} {family}. Should your plans keep the times you entered?". `{gap}`: "6 hours behind" / "1 hour ahead of" / "4 hours 30 minutes ahead of". `{family}`: the family time zone's city, "Paris".
4. A surface-soft card (radius xl, padding 16, gap 12):
   - "For example, an event you added for {4 PM}:" (15/700), in the member's clock.
   - "Keep my times (I am the only one travelling)" (16/900) / "Stays at {4 PM}, {city} time, for you. The rest of the family stays on {family} time." (15/600 muted)
   - "Keep everyone’s time (everyone is travelling)" (16/900) / "The family moves to {city} time: everyone’s plans stay at {4 PM}, {city} time, and nobody else is asked." (15/600 muted)
   - "Stay on {family} time" (16/900) / "Happens at {4 PM} {family} time, which is {10 AM} in {city}." (15/600 muted)
5. Footer: ink button "Keep my times" (block); soft button "Keep everyone’s time" (block); link "Stay on {family} time"; note "If only you keep your times, they go back by themselves when your phone is back on {family} time." (13/600 muted, centred).

Closing the sheet (✕, swipe, scrim) is "Stay on {family} time". Failure: warn toast "Couldn’t change your times. Check your connection and try again."; the drawer stays.

## Back on the family's time
Nothing is shown: the member's own times go back by themselves (FR-005). After "Keep everyone’s time" nothing goes back: coming home, the drawer asks again.
