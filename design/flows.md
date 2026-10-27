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
| OC-Settings | `/settings` | tab | 029 |
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
- **Recently deleted:** a pushed list screen built from ScreenHeader (back link "Settings", title "Recently deleted") and ListRow (title, sub-line "Deleted by Gabriel · 3 days ago · 27 days left", trailing "Restore" olive link). Tapping a row opens a sheet with "Restore" and "Delete now" (copy: OC-Settings.md › Recently deleted).
