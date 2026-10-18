-- Local development data, loaded by `supabase start` and `supabase db reset`. Specs add to it.
--
-- Spec 004 FR-005: the reference data from the design canvas. A family, "The Demanges", with
-- Gabriel (Owner), Alex and Mia. Sign in locally as gabriel@cocon.local, alex@cocon.local or
-- mia@cocon.local (the link arrives in Mailpit, http://127.0.0.1:54324). Inside: the leek & bacon
-- quiche with its two variants, and the sample grocery list. Emails use cocon.local so they never
-- clash with the test users (example.com).

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email, now(),
  '{"provider": "email", "providers": ["email"]}', '{}', '', '', '', '', now(), now()
from (values
  ('c0c0a000-0000-4000-8000-00000000000a', 'gabriel@cocon.local'),
  ('c0c0a000-0000-4000-8000-00000000000b', 'alex@cocon.local'),
  ('c0c0a000-0000-4000-8000-00000000000c', 'mia@cocon.local')
) as u (id, email);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email like '%@cocon.local';

insert into public.families (id, name, owner_id, joined_count, created_by)
values ('c0c0f000-0000-4000-8000-000000000001', 'The Demanges', 'c0c0a000-0000-4000-8000-00000000000a', 3, 'c0c0a000-0000-4000-8000-00000000000a');

insert into public.members (user_id, family_id, role, display_name, avatar_tone, joined_at, created_by) values
  ('c0c0a000-0000-4000-8000-00000000000a', 'c0c0f000-0000-4000-8000-000000000001', 'owner', 'Gabriel', 'honey', now() - interval '3 days', 'c0c0a000-0000-4000-8000-00000000000a'),
  ('c0c0a000-0000-4000-8000-00000000000b', 'c0c0f000-0000-4000-8000-000000000001', 'editor', 'Alex', 'sage', now() - interval '2 days', 'c0c0a000-0000-4000-8000-00000000000b'),
  ('c0c0a000-0000-4000-8000-00000000000c', 'c0c0f000-0000-4000-8000-000000000001', 'editor', 'Mia', 'peach', now() - interval '1 day', 'c0c0a000-0000-4000-8000-00000000000c');

-- Leek & bacon quiche (OC-Recipe): saved by Gabriel through Claude, serves 6.
insert into public.recipes (id, family_id, name, description, serves, total_minutes, best_months, created_by, updated_by, source)
values ('c0c0e000-0000-4000-8000-000000000001', 'c0c0f000-0000-4000-8000-000000000001', 'Leek & bacon quiche',
  'Silky custard, sweet leeks and a crisp, buttery crust.', 6, 70, '{10,11,12,1,2,3}',
  'c0c0a000-0000-4000-8000-00000000000a', 'c0c0a000-0000-4000-8000-00000000000a', 'claude');

insert into public.recipe_ingredients (id, family_id, recipe_id, position, name, quantity, unit, size_word, weight_per_piece_g,
  piece_noun_singular, piece_noun_plural, prep_note, created_by, updated_by, source)
select id::uuid, 'c0c0f000-0000-4000-8000-000000000001', 'c0c0e000-0000-4000-8000-000000000001', position, name, quantity,
  unit::public.unit, size_word::public.size_word, weight, singular, plural, prep,
  'c0c0a000-0000-4000-8000-00000000000a', 'c0c0a000-0000-4000-8000-00000000000a', 'claude'
from (values
  ('c0c01000-0000-4000-8000-000000000001', 0, 'Shortcrust pastry', 1, 'piece', null, 230, 'sheet of shortcrust pastry', 'sheets of shortcrust pastry', null),
  ('c0c01000-0000-4000-8000-000000000002', 1, 'Butter', 20, 'g', null, null, null, null, null),
  ('c0c01000-0000-4000-8000-000000000003', 2, 'Leeks', 2, 'piece', null, 150, 'leek', 'leeks', null),
  ('c0c01000-0000-4000-8000-000000000004', 3, 'Bacon lardons', 200, 'g', null, null, null, null, null),
  ('c0c01000-0000-4000-8000-000000000005', 4, 'Eggs', 3, 'piece', 'large', 50, 'egg', 'eggs', null),
  ('c0c01000-0000-4000-8000-000000000006', 5, 'Heavy cream', 300, 'ml', null, null, null, null, null),
  ('c0c01000-0000-4000-8000-000000000007', 6, 'Gruyère', 100, 'g', null, null, null, null, 'grated'),
  ('c0c01000-0000-4000-8000-000000000008', 7, 'Nutmeg', 1, 'pinch', null, null, null, null, null)
) as i (id, position, name, quantity, unit, size_word, weight, singular, plural, prep);

insert into public.recipe_steps (id, family_id, recipe_id, position, name, body, timer_seconds, timer_label, temp_check_c, temp_check_text, tip,
  created_by, updated_by, source)
select id::uuid, 'c0c0f000-0000-4000-8000-000000000001', 'c0c0e000-0000-4000-8000-000000000001', position, name, body, timer, label, temp, temp_text, tip,
  'c0c0a000-0000-4000-8000-00000000000a', 'c0c0a000-0000-4000-8000-00000000000a', 'claude'
from (values
  ('c0c02000-0000-4000-8000-000000000001', 0, 'Preheat and line',
    'Preheat the oven to 180 °C (355 °F). Line a 23 cm (9 in) tart pan with {ing:c0c01000-0000-4000-8000-000000000001} and prick the base with a fork.',
    null, null, null, null, 'Chill the lined pan for 10 minutes so the edges don’t shrink.'),
  ('c0c02000-0000-4000-8000-000000000002', 1, 'Blind bake', 'Bake the empty crust for 12 minutes until pale golden.',
    720, 'Blind bake', null, null, null),
  ('c0c02000-0000-4000-8000-000000000003', 2, 'Cook the filling',
    'In a large pan, melt {ing:c0c01000-0000-4000-8000-000000000002} over medium heat. Add {ing:c0c01000-0000-4000-8000-000000000003} finely sliced and cook 6–8 minutes until soft. Add {ing:c0c01000-0000-4000-8000-000000000004} and cook 5 minutes until golden.',
    480, 'Soften leeks', null, null, null),
  ('c0c02000-0000-4000-8000-000000000004', 3, 'Mix the custard',
    'Whisk {ing:c0c01000-0000-4000-8000-000000000005} with {ing:c0c01000-0000-4000-8000-000000000006} and {ing:c0c01000-0000-4000-8000-000000000008}. Season with salt and pepper, then stir in half of the {ing:c0c01000-0000-4000-8000-000000000007}.',
    null, null, null, null, null),
  ('c0c02000-0000-4000-8000-000000000005', 4, 'Bake',
    'Spread the filling in the crust, pour over the custard and top with the rest of the cheese. Bake for 35 minutes.',
    2100, 'Bake', 71, 'The center should barely wobble.', 'If the top browns too fast, cover it loosely with foil.'),
  ('c0c02000-0000-4000-8000-000000000006', 5, 'Rest', 'Let it rest for 10 minutes before slicing, so it holds together.',
    600, 'Rest', null, null, null)
) as s (id, position, name, body, timer, label, temp, temp_text, tip);

-- Variants (OC-Recipe, OC-EditVariants): changes follow VariantChange in packages/schemas/recipes.ts.
insert into public.recipe_variants (id, family_id, recipe_id, position, name, kind, changes, created_by, updated_by, source) values
  ('c0c03000-0000-4000-8000-000000000001', 'c0c0f000-0000-4000-8000-000000000001', 'c0c0e000-0000-4000-8000-000000000001', 0,
    'Vegetarian', 'version', '[
      {"type": "swap_ingredient", "ingredient_id": "c0c01000-0000-4000-8000-000000000004",
       "with": [{"id": "c0c04000-0000-4000-8000-000000000001", "name": "Mushrooms", "quantity": 250, "unit": "g", "prep_note": "sliced"}]}
    ]', 'c0c0a000-0000-4000-8000-00000000000a', 'c0c0a000-0000-4000-8000-00000000000a', 'claude'),
  ('c0c03000-0000-4000-8000-000000000002', 'c0c0f000-0000-4000-8000-000000000001', 'c0c0e000-0000-4000-8000-000000000001', 1,
    'Make my own dough', 'option', '[
      {"type": "swap_ingredient", "ingredient_id": "c0c01000-0000-4000-8000-000000000001", "with": [
        {"id": "c0c04000-0000-4000-8000-000000000002", "name": "Flour", "quantity": 200, "unit": "g"},
        {"id": "c0c04000-0000-4000-8000-000000000003", "name": "Cold butter", "quantity": 100, "unit": "g", "prep_note": "cubed"},
        {"id": "c0c04000-0000-4000-8000-000000000004", "name": "Ice water", "quantity": 50, "unit": "ml"}]},
      {"type": "add_step", "step_id": "c0c02000-0000-4000-8000-000000000001", "place": "before", "step": {
        "name": "Make the dough",
        "body": "Rub {ing:c0c04000-0000-4000-8000-000000000002} and {ing:c0c04000-0000-4000-8000-000000000003} together with your fingertips until sandy. Add {ing:c0c04000-0000-4000-8000-000000000004}, bring into a ball, wrap and chill.",
        "timer_seconds": 1800, "timer_label": "Chill dough", "tip": "Cold hands and cold butter make a flakier crust."}}
    ]', 'c0c0a000-0000-4000-8000-00000000000a', 'c0c0a000-0000-4000-8000-00000000000a', 'claude');

-- Pumpkin soup, so "For Pumpkin soup" on the grocery list points at a recipe.
insert into public.recipes (id, family_id, name, serves, created_by, updated_by)
values ('c0c0e000-0000-4000-8000-000000000002', 'c0c0f000-0000-4000-8000-000000000001', 'Pumpkin soup', 4,
  'c0c0a000-0000-4000-8000-00000000000c', 'c0c0a000-0000-4000-8000-00000000000c');

-- The sample grocery list (OC-Groceries). The sourdough loaf is already ticked.
insert into public.grocery_items (family_id, name, quantity, unit, aisle, recipe_id, checked, checked_by, created_by, updated_by, source)
select 'c0c0f000-0000-4000-8000-000000000001', name, quantity, unit::public.unit, aisle::public.aisle, recipe::uuid, checked,
  case when checked then by::uuid end, by::uuid, by::uuid, source
from (values
  ('Heavy cream', 300, 'ml', 'dairy_eggs', 'c0c0e000-0000-4000-8000-000000000001', false, 'c0c0a000-0000-4000-8000-00000000000a', 'app'),
  ('Gruyère', 100, 'g', 'dairy_eggs', 'c0c0e000-0000-4000-8000-000000000001', false, 'c0c0a000-0000-4000-8000-00000000000a', 'app'),
  ('Milk', 2, 'l', 'dairy_eggs', null, false, 'c0c0a000-0000-4000-8000-00000000000b', 'chatgpt'),
  ('Pumpkin', 1, 'kg', 'produce', 'c0c0e000-0000-4000-8000-000000000002', false, 'c0c0a000-0000-4000-8000-00000000000c', 'app'),
  ('Apples', 6, 'piece', 'produce', null, false, 'c0c0a000-0000-4000-8000-00000000000c', 'app'),
  ('Sourdough loaf', 1, 'piece', 'bakery', null, true, 'c0c0a000-0000-4000-8000-00000000000a', 'app'),
  ('Croissants', 4, 'piece', 'bakery', null, false, 'c0c0a000-0000-4000-8000-00000000000c', 'app')
) as g (name, quantity, unit, aisle, recipe, checked, by, source);

-- Spec 031: the sample ingredients and groceries point at their catalog entries.
update public.recipe_ingredients i set catalog_key = k.key
from (values
  ('c0c01000-0000-4000-8000-000000000001', 'shortcrust_pastry'),
  ('c0c01000-0000-4000-8000-000000000002', 'butter'),
  ('c0c01000-0000-4000-8000-000000000003', 'leek'),
  ('c0c01000-0000-4000-8000-000000000004', 'lardons'),
  ('c0c01000-0000-4000-8000-000000000005', 'egg'),
  ('c0c01000-0000-4000-8000-000000000006', 'heavy_cream'),
  ('c0c01000-0000-4000-8000-000000000007', 'gruyere'),
  ('c0c01000-0000-4000-8000-000000000008', 'nutmeg')
) as k (id, key)
where i.id = k.id::uuid;

update public.grocery_items g set catalog_key = k.key
from (values
  ('Heavy cream', 'heavy_cream'), ('Gruyère', 'gruyere'), ('Milk', 'milk'), ('Pumpkin', 'pumpkin'),
  ('Apples', 'apple'), ('Sourdough loaf', 'sourdough'), ('Croissants', 'croissant')
) as k (name, key)
where g.name = k.name and g.family_id = 'c0c0f000-0000-4000-8000-000000000001';
