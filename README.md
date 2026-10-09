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

To work against a local database instead, start it as described under [Browser tests](#browser-tests) and put the `API_URL` and `ANON_KEY` that `npx supabase status` prints into `.env`.

## Try it with demo data

With Docker Desktop running:

```zsh
npm install
npm run local
```

This starts a database on this computer with the cold-chain beverage demo data (`supabase/seeds/startup_feasibility_seed.sql`), then the app, and opens the login page. Sign in with `demo@atera.local` / `atera-demo`. Nothing touches the hosted project, and `.env` is not needed or changed.

The first run downloads the database images (a few GB) and takes several minutes; later runs take seconds. Stop the app with Ctrl+C and the database with `npm run local:stop`. Changes you make are kept for next time; `npx supabase db reset` brings back the original demo data (run `npm run local` again afterwards to recreate the demo account).

## Supabase setup

Database changes live in `supabase/migrations` and are applied in file-name order.

New project:

1. Create a new Supabase project.
2. Apply the migrations, either with the Supabase CLI (`supabase link --project-ref <ref>`, then `supabase db push`) or by running each file in `supabase/migrations` in order in the SQL Editor.
3. Optional: run `supabase/seeds/startup_feasibility_seed.sql` to load the functional cold-chain beverage startup test scenario.
4. Deploy the Edge Functions: `supabase functions deploy create-company-user` (user provisioning) and `supabase functions deploy tcmb-rates` (TCMB exchange rates; tcmb.gov.tr cannot be read from the browser because it sends no CORS headers, so the deployed app fetches it through this function).
5. In `Authentication > Sign In / Providers`, turn off **Allow new users to sign up**. Company users are created by the function above, not by public sign-up. Leave the **Email** provider itself enabled: turning it off also stops everyone from signing in with email and password.
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

The first admin of a company can be created in the Supabase dashboard (`Authentication > Users > Add user`). They get their own new company; to move them into an existing company, set `company_id` (and optionally `access_level`) in their app metadata.

## QA commands

```zsh
npm run lint
npm run format:check   # npm run format fixes it
npm run test
npm run build
```

`npm run test` uses Node's built-in test runner and covers the core feasibility/readiness helpers that do not require a browser or live Supabase project.

## Browser tests

`npm run e2e` runs the Playwright tests in `e2e/` against a local Supabase, which needs Docker. The tests sign in, save and delete records, so they refuse to run against a hosted project.

```zsh
npx supabase start                # first run downloads the Docker images
npx supabase db reset             # migrations + supabase/seeds/startup_feasibility_seed.sql
npx playwright install chromium   # once per machine
npm run e2e
```

The run starts its own Vite server on port 5180, pointed at the local Supabase, and creates two test admins in the seeded company (`e2e/support/users.js`). The tests can be run again without a reset; reset when the seed data has drifted. `npx playwright show-report` opens the last report, and a failed test keeps a trace in `test-results/`.

They cover sign-in and deep links, every page and old link, the unsaved-changes prompt (including the Back button), saving and deleting records, simulation variants, the XLSX and printable reports, roles and users, and the 1280 px / 390 px layout check.

- `E2E_SKIP_EDGE_FUNCTIONS=1` skips the one test that needs the `create-company-user` Edge Function. The function downloads its imports from jsr.io when it starts, which fails behind a proxy that intercepts TLS.
- `PLAYWRIGHT_CHROMIUM_PATH` points the tests at an installed Chromium instead of the one Playwright downloads.

`supabase/config.toml` configures this local stack only; it does not change the hosted project.

## Product flow

The feasibility flow is intentionally simple:

1. Define materials, workforce, machines/equipment, and products in Operations, including product-level flow defaults such as batch size and minimum transfer quantity.
2. Save a process plan for a product with a material recipe plus operation steps or nonzero machine hours.
3. Add product-linked sales channels in Sales Strategy.
4. Save financial assumptions and optional expenses in Financial Modelling.
5. Review dashboard, reports, and simulation views for feasibility signals.
