# Atera

New Atera workspace for migrating `atera_v2` piece by piece.

## Run locally

```zsh
cd ~/Desktop/Coding/atera
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with the values from your new Supabase project:

- `Project Settings > API > Project URL`
- `Project Settings > API > anon public key`

## Supabase setup

Database changes live in `supabase/migrations` and are applied in file-name order.

New project:

1. Create a new Supabase project.
2. Apply the migrations, either with the Supabase CLI (`supabase link --project-ref <ref>`, then `supabase db push`) or by running each file in `supabase/migrations` in order in the SQL Editor.
3. Optional: run `supabase/seeds/startup_feasibility_seed.sql` to load the functional cold-chain beverage startup test scenario.
4. Deploy the Edge Functions: `supabase functions deploy create-company-user` (user provisioning) and `supabase functions deploy tcmb-rates` (TCMB exchange rates; tcmb.gov.tr cannot be read from the browser because it sends no CORS headers, so the deployed app fetches it through this function).
5. In `Authentication > Sign In / Providers`, turn off **Allow new users to sign up**. Company users are created by the function above, not by public sign-up.
6. In `Authentication > URL Configuration`, set the site URL to your local Vite URL. This app usually runs at `http://127.0.0.1:5173` or `http://127.0.0.1:5174`.
7. Add these to the redirect URLs:
   - `http://127.0.0.1:5173/login`
   - `http://127.0.0.1:5174/login`
8. Confirm the storage bucket named `profile-pictures` exists and is private. The baseline migration creates it and applies owner-only policies.

Existing project that was set up with the old `schema.sql` and patch files: the baseline migration is that same schema, so mark it as applied instead of running it (`supabase migration repair --status applied 20261004000000`), then apply the later migrations.

`supabase/legacy-patches` holds the old hand-run patches for history only. Do not run them; see the README in that folder.

Passwords are not stored in `public.profiles`. Supabase Auth stores password hashes securely in its own auth schema.

## Access model

Users do not self-register. Company admins create users from `Yetkilendirme > Kullanıcı tanımlama`. The browser calls the `create-company-user` Edge Function, which checks that the caller has write access to the authorization module and creates the user in the caller's company with the service role.

A new user joins an existing company only through `app_metadata.company_id`, which only the service role can set. Anyone who signs up without it gets a new, separate company and becomes its admin, so a company name typed at sign-up can never be used to join someone else's company.

The first admin of a company can be created in the Supabase dashboard (`Authentication > Users > Add user`). They get their own new company; to put them into an existing company, set `company_id` (and optionally `access_level`) in their app metadata.

## QA commands

```zsh
npm run test
npm run build
```

`npm run test` uses Node's built-in test runner and covers the core feasibility/readiness helpers that do not require a browser or live Supabase project.

## Product flow

The feasibility flow is intentionally simple:

1. Define materials, workforce, machines/equipment, and products in Operations, including product-level flow defaults such as batch size and minimum transfer quantity.
2. Save a process plan for a product with a material recipe plus operation steps or nonzero machine hours.
3. Add product-linked sales channels in Sales Strategy.
4. Save financial assumptions and optional expenses in Financial Modelling.
5. Review dashboard, reports, and simulation views for feasibility signals.
