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

1. Create a new Supabase project.
2. Open `SQL Editor`.
3. Run `supabase/schema.sql`.
4. Optional: run `supabase/startup_feasibility_seed.sql` to load the functional cold-chain beverage startup test scenario.
5. In `Authentication > URL Configuration`, set the site URL to your local Vite URL. This app usually runs at `http://127.0.0.1:5173` or `http://127.0.0.1:5174`.
6. Add these to the redirect URLs:
   - `http://127.0.0.1:5173/login`
   - `http://127.0.0.1:5174/login`
7. Confirm the storage bucket named `profile-pictures` exists and is private. The SQL file creates it and applies owner-only policies.

Passwords are not stored in `public.profiles`. Supabase Auth stores password hashes securely in its own auth schema.

## Access model

Users do not self-register from the public login screen. Company admins create users from `Yetkilendirme > Kullanıcı tanımlama`, which creates the Supabase Auth user and the matching profile record.

The first company admin should be created through Supabase/Auth setup or an already trusted admin flow. After that, users should be provisioned in the app.

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
