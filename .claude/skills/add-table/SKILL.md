---
name: add-table
description: Add a database table or column the Our Cocon way (migration, RLS, tests, types, schema).
---
1. `pnpm db:new <name>`. Every table has `id`, `family_id`, `created_by`, `updated_by`, `source` (`public.write_source`: 'app' or the assistant's name), `created_at`, `updated_at`, and `deleted_at` if users can delete rows. A child table also references its parent by `(parent_id, family_id)`, so it can't point at another family's row.
2. Call `select public._family_table('public.<table>', live => false)` (spec 004). It turns RLS on, adds the four family policies and grants, and adds the trigger that sets the family, author and source. Use `live => true` only for tables a spec lists for realtime. Share-link access only through the dedicated view (spec 019).
3. Tests in `supabase/tests`: member can read and write, non-member gets zero rows, signed-out gets zero rows.
4. `pnpm db:types`, then add or update the Zod schema in `packages/schemas`.
5. In the app, start the table's query keys with its name (`['<table>', …]`), so live changes refetch them (apps/app/lib/query.ts).
