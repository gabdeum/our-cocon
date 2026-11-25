-- Catalog version 6 (Gabriel's feedback, 2026-11-25): whole spices are their own ingredients,
-- counted in pieces, apart from the ground ones measured in spoons. Keys are permanent, so the
-- ground ones keep theirs (cinnamon, cardamom, ground_cloves) and the lines that meant the whole
-- spice move to the new keys: counted in pieces, or named so ("cinnamon stick", "cardamom pods",
-- "whole cloves"). Star anise, fennel and caraway seeds were matched to cardamom and get theirs.
--
-- Then whole-only ingredients (eggs, garlic, bay leaves, the new whole spices) counted in pieces
-- never keep a fraction (spec 005 FR-003): saved recipes are rounded like Save now does.

create function pg_temp.split_key(key text, unit text, quantity numeric, name text) returns text
language sql immutable as $$
  select case
    when key = 'cardamom' and name ~* 'star anise' then 'star_anise'
    when key = 'cardamom' and name ~* 'fennel' then 'fennel_seed'
    when key = 'cardamom' and name ~* 'caraway' then 'caraway_seed'
    when key = 'cardamom' and (name ~* '\mpods?\M' or (quantity is not null and coalesce(unit, 'piece') = 'piece')) then 'cardamom_pod'
    when key = 'cinnamon' and (name ~* '\m(sticks?|quills?)\M' or (quantity is not null and coalesce(unit, 'piece') = 'piece')) then 'cinnamon_stick'
    when key = 'ground_cloves' and (name ~* '\mwhole\M' or (quantity is not null and coalesce(unit, 'piece') = 'piece')) then 'cloves'
    else key
  end
$$;

update public.recipe_ingredients
set catalog_key = pg_temp.split_key(catalog_key, unit::text, quantity, name)
where catalog_key in ('cardamom', 'cinnamon', 'ground_cloves')
  and pg_temp.split_key(catalog_key, unit::text, quantity, name) <> catalog_key;

update public.grocery_items
set catalog_key = pg_temp.split_key(catalog_key, unit::text, quantity, name)
where catalog_key in ('cardamom', 'cinnamon', 'ground_cloves')
  and pg_temp.split_key(catalog_key, unit::text, quantity, name) <> catalog_key;

-- A variant's ingredients (add_ingredient, swap_ingredient's `with`), shaped by VariantChange.
create function pg_temp.fix_ingredient(i jsonb) returns jsonb
language sql stable as $$
  with keyed as (
    select case
      when i ? 'catalog_key' and i ->> 'catalog_key' is not null
        then jsonb_set(i, '{catalog_key}', to_jsonb(pg_temp.split_key(i ->> 'catalog_key', i ->> 'unit', (i ->> 'quantity')::numeric, i ->> 'name')))
      else i
    end as i
  )
  select case
    when (keyed.i ->> 'quantity') is not null
      and coalesce(keyed.i ->> 'unit', 'piece') = 'piece'
      and exists (select 1 from public.catalog_ingredients c where c.key = keyed.i ->> 'catalog_key' and c.whole_only)
      then jsonb_set(keyed.i, '{quantity}', to_jsonb(greatest(1, round((keyed.i ->> 'quantity')::numeric))))
    else keyed.i
  end
  from keyed
$$;

update public.recipe_variants v
set changes = (
  select jsonb_agg(
    case c ->> 'type'
      when 'add_ingredient' then jsonb_set(c, '{ingredient}', pg_temp.fix_ingredient(c -> 'ingredient'))
      when 'swap_ingredient' then jsonb_set(c, '{with}', (
        select jsonb_agg(pg_temp.fix_ingredient(w.value) order by w.ord)
        from jsonb_array_elements(c -> 'with') with ordinality as w (value, ord)
      ))
      else c
    end
    order by x.ord
  )
  from jsonb_array_elements(v.changes) with ordinality as x (c, ord)
)
where jsonb_array_length(v.changes) > 0
  and v.changes::text ~ '"catalog_key": ?"[a-z_]+"';

update public.recipe_ingredients i
set quantity = greatest(1, round(i.quantity))
from public.catalog_ingredients c
where c.key = i.catalog_key
  and c.whole_only
  and i.quantity is not null
  and coalesce(i.unit::text, 'piece') = 'piece'
  and i.quantity <> greatest(1, round(i.quantity));
