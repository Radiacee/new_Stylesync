# Stylesync

Prototype web app for creating a lightweight personal writing style profile and applying it to paraphrasing (ethical use focus).

## Goals

- Let a user define style attributes (formality, pacing, descriptiveness, directness, tone keyword)
- Capture a sample excerpt & custom lexicon words
- Apply heuristic paraphrasing influenced by the profile (no external AI API by default)
- Modern, accessible, glass + gradient UI with Tailwind CSS
- Store profile locally (no backend persistence yet)

## Non-Goals / Ethics

This project is NOT intended to help users evade AI detection systems or misrepresent AI-generated work as exclusively human authored. Always disclose AI assistance & respect academic / professional integrity policies.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + typography & forms plugins

## Running

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Visit http://localhost:3000

## Structure

```
src/app
  /page.tsx              # Landing
  /style/onboarding      # Style profile questionnaire
  /paraphrase            # Paraphrasing interface
  /about                 # Ethics & info
src/lib
  styleProfile.ts        # LocalStorage persistence
  paraphrase.ts          # Heuristic paraphrasing
```

## Extending

The project now includes an API route (`/api/paraphrase`) that will call OpenAI if `OPENAI_API_KEY` is set, otherwise it falls back to the heuristic engine. Configure environment via `.env` (see `.env.example`).

Supabase auth + persistence (optional):
1. Create a Supabase project, copy `SUPABASE_URL` & `SUPABASE_ANON_KEY` into `.env`.
2. Run SQL (SQL editor):
```
create extension if not exists pgcrypto;
create table if not exists public.style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tone text not null,
  formality real not null,
  pacing real not null,
  descriptiveness real not null,
  directness real not null,
  sample_excerpt text,
  custom_lexicon text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table style_profiles enable row level security;
create policy "own read" on style_profiles for select using (auth.uid() = user_id);
create policy "own upsert" on style_profiles for insert with check (auth.uid() = user_id);
create policy "own update" on style_profiles for update using (auth.uid() = user_id);
```

Ethics: log & audit usage, rate limit, provide transparency & opt-out, and avoid claims about bypassing detection.

## License

MIT (add file if you decide to open source).
