# Legacy patches — do not run

These files were applied by hand in the Supabase SQL Editor before the project
used migrations. Everything in them is already part of
`supabase/migrations/20261004000000_baseline.sql`.

Running them now can undo newer code. `financial_required_inputs_patch.sql`
contains an older `save_financial_model_settings` without loan currency, name and
received-date support, and it does not write to `financial_loans`.

They are kept only as history. New database changes go into a new file under
`supabase/migrations/`.
