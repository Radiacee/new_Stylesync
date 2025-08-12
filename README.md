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

Add an API route (`src/app/api/paraphrase/route.ts`) that calls an LLM with a system prompt including style knobs. Ensure you:

- Log & audit usage
- Rate limit & authenticate
- Provide user transparency & opt-out
- Avoid claims about bypassing detection

## License

MIT (add file if you decide to open source).
