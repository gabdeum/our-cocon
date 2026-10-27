# OC-CalAgenda — Calendar, agenda

Source `screens/OC-CalAgenda.dc.html` · Route `/calendar?view=agenda` · Specs 040, 036

## Layout
1. CalHeader (Agenda), title "Coming up".
2. Day groups: header 18/900 "Today · Sun, Oct 25", "Tomorrow · Mon, Oct 26", then "Tue, Oct 27"; white card of rows (64 min): stripe, 36 avatar, title 17/800, sub-line 14/700 muted ("14:30 · Gabriel takes James", "All day", "Evening · every Tuesday"), optional tag 13/900: "Now" (honey), "Birthday" / "Day 1 of 3" (soft), "Surprise" (sage; only for those who can see it).
3. Floating add button; TabBar.

## States
| State | Copy |
| --- | --- |
| Nothing ahead | "Nothing planned yet. Tap + to add something." |
