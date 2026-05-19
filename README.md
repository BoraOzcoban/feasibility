# Atera

New Atera workspace for migrating `atera_v2` piece by piece.

## Run locally

```zsh
cd ~/Desktop/Coding/Atera
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
4. In `Authentication > URL Configuration`, set the site URL to your local Vite URL. This app usually runs at `http://127.0.0.1:5173` or `http://127.0.0.1:5174`.
5. Add these to the redirect URLs:
   - `http://127.0.0.1:5173/login`
   - `http://127.0.0.1:5174/login`
6. Confirm the storage bucket named `profile-pictures` exists. The SQL file creates it.

Passwords are not stored in `public.profiles`. Supabase Auth stores password hashes securely in its own auth schema.

## What changed from `atera_v2`

`atera_v2` uses Supabase email/password login directly from `src/pages/AuthPage.tsx` and reads credentials from `src/services/supabaseClient.ts`.

This new app keeps that same Supabase client pattern, but adds:

- username/password login
- profile fields table
- profile picture storage
- language selector
- remember username option
- forgot password and reset password flow
