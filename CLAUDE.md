# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Archivum is a personal media-tracking app (movies, TV, anime, manga, k-drama) backed by Supabase, with search/import from TMDB, AniList, Open Library, and MangaDex.

## Stack

- React 19 + Vite 8 (Oxc-based `@vitejs/plugin-react`) + TypeScript (strict-ish: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`; theme is CSS-based (`@theme` block in `src/index.css`)
- No router — view switching is local state (`activeView` in `App.tsx`)
- No state-management library — plain `useState`/`useEffect`; Supabase client (`src/lib/supabase.ts`) is the data layer
- Path alias `@/*` → `src/*`

## Commands

- `npm run dev` — start dev server
- `npm run build` — `tsc -b && vite build` (build also type-checks)
- `npm run lint` — ESLint (flat config, not type-checked)
- `npm run preview` — preview production build
- No test framework is set up in this repo.

## Project structure

Flat, shallow layout — no `hooks/`, `utils/`, `types/`, or `services/` directories:

- `src/pages/` — `LandingPage.tsx` (active); `LoginPage.tsx` is unused dead code kept for reference
- `src/components/` — `MediaSearch.tsx`, `EntryList.tsx`, `EntryEditModal.tsx`, `ManualEntryModal.tsx`, `StatsDashboard.tsx`, `SmoothCursor.tsx`
- `src/lib/` — Supabase client init
- `src/assets/` — static SVGs and `Posters/` images

## External APIs

All integration logic lives directly inside `src/components/MediaSearch.tsx` — there is no separate API/services layer. Types are colocated above their usage in the same file.

- **TMDB** (movies/TV) — REST, key from `import.meta.env.VITE_TMDB_API_KEY`
- **AniList** (anime) — GraphQL POST to `https://graphql.anilist.co`, no key required
- **Open Library** (books) — no key required
- **MangaDex** (manga) — genre support not yet implemented (deferred as of recent commits)

## Required env vars

Set in `.env.local` (gitignored, no `.env.example` exists yet):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TMDB_API_KEY`

## Code style

- 2-space indent, single quotes, **no semicolons**
- Function components declared as `function ComponentName()`, not arrow consts
- No `React` import needed (React 19 JSX transform)
- Styling is a hybrid of Tailwind utility classes and inline `style={{}}` using CSS custom properties (e.g. `var(--color-gold)`, `var(--color-border)`, `var(--color-text-muted)`) defined in `src/index.css`

## Repo conventions

- Solo-dev workflow: commit directly to `main`, no branches or PRs
- Commit messages are imperative and descriptive, often multiple clauses separated by semicolons (e.g. "Add manual entry feature for titles not found via any API; fix JSX fragment syntax error in MediaSearch.tsx."), no type-prefix convention
- Never add `Co-Authored-By: Claude` lines to commit messages
