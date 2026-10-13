---
name: add-table
description: Add a database table or column the Our Cocon way (migration, RLS, tests, types, schema).
---
1. `pnpm db:new <name>`. Every table has `id`, `family_id`, `created_by`, `source` ('app' or the assistant's name), `created_at`, `updated_at`, and `deleted_at` if users can delete rows.
2. Enable RLS. Policies: family members read and write their family's rows; nobody else sees anything. Share-link access only through the dedicated view (spec 019).
3. Tests in `supabase/tests`: member can read and write, non-member gets zero rows, signed-out gets zero rows.
4. `pnpm db:types`, then add or update the Zod schema in `packages/schemas`.
5. Add the table to realtime only if a spec says so (spec 004 lists them).
