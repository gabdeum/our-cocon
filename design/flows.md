# Screens, routes and flows

## Routes (Expo Router)

| Screen | Route | Presentation | Spec |
| --- | --- | --- | --- |
| OC-Home | `/` | tab | 028 (activity card: 026) |
| OC-Recipes | `/recipes` | tab | 006 |
| OC-Filters | `/recipes/filters` | sheet | 007 |
| OC-Recipe | `/recipes/[id]` (`?tab=ingredients`) | stack | 008 |
| OC-RecipeSteps | `/recipes/[id]?tab=steps` | stack (same screen, Steps tab) | 009 |
| OC-Cook | `/recipes/[id]/cook` | full-screen modal | 012 |
| OC-ScaleIng | `/recipes/[id]/scale` | sheet | 013 |
| OC-Units | `/recipes/[id]/convert` | sheet | 013 |
| OC-RecipeSettings | `/recipes/[id]/settings` | stack | 027 |
| OC-Share | `/recipes/[id]/share` | sheet | 019 |
| OC-SharedView | `/r/[token]` (public, no tab bar) | page | 019 |
| OC-EditBasics | `/recipes/new` · `/recipes/[id]/edit?section=details` | full-screen modal | 014 |
| OC-EditIngredients | `…/edit?section=ingredients` | same modal | 015 |
| OC-EditSteps | `…/edit?section=steps` | same modal | 016 |
| OC-EditVariants | `…/edit?section=variants` | same modal | 017 |
| OC-Delete | dialog over the edit modal | dialog | 018 |
| OC-AddGroceries | `/recipes/[id]/add-to-groceries` | sheet | 022 |
| OC-Groceries | `/groceries` | tab | 020, 021 |
| OC-Menu | `/menu` (`/settings` redirects) | tab | 029 |
| OC-Connect | `/settings/ai` | stack | 025 |
| OC-Timers | `/timers` | stack (reachable from anywhere) | 011 |
| AI activity | `/activity` (Home › "See all") | stack, not designed: OC-Activity.md | 026 |
| Recently deleted | `/settings/deleted` | stack, not designed: list per spec 018 | 018 |
| Sign in | `/welcome` (public, no tab bar) | page, not designed: OC-Welcome.md | 003 |
| Sign-in link | `/auth/callback` (public) | page, not designed: OC-Welcome.md | 003 |
| Set up your family | `/welcome/family` | page, not designed: OC-Welcome.md | 003 |
| Join | `/join/[token]` (public, no tab bar) | page, not designed: OC-Welcome.md | 003 |
| Approve access | `/oauth/consent?authorization_id=…` (public, no tab bar) | page, not designed: OC-Connect.md › Approve access | 023 |

## Main flows

1. **Find and cook.** Home or Recipes → tap a recipe → Recipe (adjust Servings, Version) → Steps tab or "Start cooking" → Cook → Next … "Finish" → back to Recipe.
2. **Shop for a recipe.** Recipe → "Add to groceries…" → AddGroceries (untick what you have) → "Add N items" → success → "See the list" → Groceries.
3. **Timers.** Any timed step → "Start timer" → pill appears on every screen → tap the pill → Timers.
4. **Scale or convert.** Recipe → "…" next to Servings → panel → "Scale by an ingredient" (ScaleIng → "Apply to recipe" → Recipe) or "Unit converter" (Units → close → Recipe).
5. **Create.** Recipes → "New" → EditBasics → "Next: Ingredients" → EditIngredients → "Next: Steps" → EditSteps → "Next: Variants" → EditVariants → "Save recipe" → Recipe.
6. **Edit and delete.** Recipe → (edit entry: "Edit" in recipe settings) → Edit modal at Details → … → EditVariants → "Delete this recipe" → Delete dialog → "Delete recipe" → Recipes, with a StatusBanner "Recipe deleted · Undo".
7. **Share.** Recipe → share icon → Share → "Copy link" → friend opens `/r/[token]` → SharedView.
8. **Connect AI.** Settings → "AI assistants" → Connect → "Connect" on an assistant → guided sheet (spec 025). In the assistant, adding Our Cocon opens Approve access (`/oauth/consent`; signed out, sign in first and come back) → "Allow" → back to the assistant.
9. **Start and invite.** Sign in → (first time) Set up your family → Home. Settings → "Invite someone" → share sheet → the invitee opens `/join/[token]` → signs in → "Join {family}" → Home.
   Signed out, every page except Sign in, the sign-in link, Join, a shared recipe and Approve access goes to Sign in.

## Entry points not drawn on the canvas

- **Edit a recipe:** add an "Edit recipe" row at the top of OC-RecipeSettings (ListRow with a chevron), opening the edit modal at Details.
- **Recently deleted:** a pushed list screen built from ScreenHeader (back link "Menu", title "Recently deleted") and ListRow (title, sub-line "Deleted by Gabriel · 3 days ago · 27 days left", trailing "Restore" olive link). Tapping a row opens a sheet with "Restore" and "Delete now" (copy: OC-Menu.md › Recently deleted).

# Calendar — routes and flows

## Routes

| Screen | Route | Presentation | Spec |
| --- | --- | --- | --- |
| OC-CalMonth | `/calendar` (`?view=month`) | tab | 037 |
| OC-CalWeek | `/calendar?view=week&date=` | tab (same screen) | 038 |
| OC-CalDay | `/calendar?view=day&date=` | tab (same screen) | 039 |
| OC-CalAgenda | `/calendar?view=agenda` | tab (same screen) | 040 |
| OC-CalAdd / OC-CalAddMore | `/calendar/new` (`?date=&slot=`, or `&time=HH:MM` from a long press in the week grid: Starts at that hour, one hour long) · `/calendar/[id]/edit` (`?date=` for one occurrence) | sheet | 041, 043 |
| OC-CalEvent | `/calendar/[id]` (`?date=` for one occurrence) | stack | 042 |
| OC-CalEventDelete | dialog over OC-CalEvent | dialog | 042 |
| OC-CalBusy | sheet over any calendar view | sheet | 043 |
| OC-CalSurprise | `/calendar/[id]` as the hidden person | stack | 043 |
| Event share | `/calendar/[id]/share` (sheet) · `/e/[token]` (public page) | sheet / page | 042 |
| OC-CalSettings | `/settings/calendar` | stack | 029 |
| Add without app | sheet over `/settings/family` | sheet | 033 |

## Menu (spec 029)

| Screen | Route | Presentation | Spec |
| --- | --- | --- | --- |
| OC-Menu | `/menu` (`/settings` redirects) | tab | 029 |
| OC-SettingsFamily | `/settings/family` | stack | 029, 033 |
| OC-Connect | `/settings/ai` | stack | 025 |
| OC-SettingsRecipes | `/settings/recipes` | stack | 027 |
| OC-SettingsGroceries | `/settings/groceries` | stack | 029 |
| Recently deleted | `/settings/deleted` | stack | 018 |

The tab bar's last tab is "Menu" (spec 036). Menu has two sections: **Apps** (tiles that open Calendar, Recipes, Groceries, and later parts with no tab) and **Settings** (Family, AI assistants, Calendar, Recipes, Groceries, Recently deleted). Every settings page goes back to Menu.

## Flows

1. **Check today.** Home → calendar card (Today, or This week, or empty) → tap a row → OC-CalEvent; "+" → OC-CalAdd; "Open calendar" → Calendar tab.
2. **Scan and drill in.** Calendar tab → Month (scroll through months) → tap a day → Day → "+ Add in the evening" → OC-CalAdd with that day and slot.
3. **Quick add.** "+" anywhere → type title → Today → Evening → Save → toast with Undo.
4. **Add with details.** OC-CalAdd → More options → Who, Repeat, Where, "Who takes James?" → Save.
5. **Edit, move, delete.** OC-CalEvent → Edit (repeating: "This event only" / "All future events") → Save; Delete → dialog → toast "Event deleted · Undo".
6. **Private / surprise.** OC-CalAdd → More options → Who can see it → Private (others see OC-CalBusy) or Surprise (the hidden person sees OC-CalSurprise).
7. **Browse weeks and days.** Week or Day → swipe left/right or ‹ › → "Today" to come back.
8. **By AI.** "Add James's baby music class every Saturday morning" → `create_event` → appears live, "Added via Claude".
