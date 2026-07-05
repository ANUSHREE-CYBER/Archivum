# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Archivum is a personal media-tracking app (movies, TV, anime, manga, k-drama) backed by Supabase, with search/import from TMDB, AniList, Open Library, and MangaDex.

## Stack

- React 19 + Vite 8 (Oxc-based `@vitejs/plugin-react`) + TypeScript (strict-ish: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`; theme is CSS-based (`@theme` block in `src/index.css`)
- No router — view switching is local state (`activeView` in `App.tsx`)
- No state-management library — plain `useState`/`useEffect`; Supabase client (`src/lib/supabase.ts`) is the data layer. Entries state is lifted to `App.tsx` (for header counts/tab counts) but `EntryList` owns fetching and all mutations via the passed-down setter.
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
- `src/components/` — `MediaSearch.tsx`, `EntryList.tsx`, `EntryEditModal.tsx`, `ManualEntryModal.tsx`, `StatsDashboard.tsx`, `SmoothCursor.tsx`, `AuroraBackground.tsx` (animated gold aurora background for the vault page), `Dropdown.tsx` (custom themed dropdown, replaces native selects)
- `src/lib/` — `supabase.ts` (Supabase client init), `utils.ts` (`cn()` utility using clsx + tailwind-merge), `useSpotlightEffect.ts` (canvas spotlight hook used by the landing page)
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

## Vault page

The logged-in view (`App.tsx` + `EntryList.tsx`). Layout top to bottom: identity header ("The Vault" serif wordmark + live counts, "+ Add" toggle on the right) → collapsible Add drawer → single toolbar line (uppercase index tabs with per-tab counts on the left; Status/Genre/Select/Sort on the right) → ornament divider (1px line broken by a gold ◆) → Continue shelf → card grid.

- Gold aurora animated background (Aceternity-based, 40% opacity, `mix-blend-screen`, `position: fixed`) behind everything via `AuroraBackground`
- Card design: `#111111` surface, `#1E1E1E` border, 12px radius, 6–7 cards per row (`repeat(auto-fill, minmax(180px, 1fr))`), 24px grid gap, poster hover zoom 1.05 inside the frame (card itself doesn't scale; gold glow on the card container)
- Status badge colors: Completed gold, In Progress green, Plan to Watch/Read red, On Hold purple, Dropped grey (`STATUS_STYLES` in `EntryList.tsx`)
- Type indicator dots: 7 muted per-type colors (`TYPE_DOT_COLORS`), top-left of poster
- Continue shelf: horizontal scrollable row of in-progress entries, respects the active tab filter
- `format` column: nullable `'movie' | 'series' | 'comic'` for cross-category classification (e.g. anime films)
- Tabs filter the grid by type via `matchesTypeTab()`; the Movie tab includes `format: 'movie'` crossovers, TV includes `format: 'series'` (kdrama excluded from the TV crossover)
- Custom `Dropdown` component replaces all native selects (neutral theming, no gold; keyboard support with focus kept on the trigger)
- Toast notifications via sonner (dark theme, gold accent border)
- Card entrance: CSS transitions with per-card stagger delay (not Framer Motion variants); layout/exit animation via Framer Motion `layout` + `AnimatePresence`
- Library/Stats crossfade via `AnimatePresence mode="wait"`
- Hover quick actions: status mini-dropdown + edit button rise over the poster on card hover, gated behind `@media (hover: hover) and (pointer: fine)`; hidden in selection mode
- Progress bars: 3px gold bar at the poster's bottom edge on in-progress entries when metadata has a current + total pair
- Per-tab empty states with the tab's type-dot color as an accent; the generic "No entries match these filters." only shows when filters exclude a non-empty tab
- Skeleton loading states with CSS shimmer animation

## Dependencies added

- `sonner` — toast notifications
- `clsx` + `tailwind-merge` — `cn()` className utility (`src/lib/utils.ts`)
- `framer-motion` — card layout/exit animations, view crossfade, Add drawer slide

## Known issues

- 6 pre-existing lint errors: `EntryEditModal.tsx` and `MediaSearch.tsx` (react-refresh mixed-export warnings from colocated constants), `MediaSearch.tsx` and `EntryList.tsx` (setState directly inside an effect), `SmoothCursor.tsx` (impure `Date.now()` during render). None are from recent work; `npm run build` is unaffected.
- Progress bars only appear on books currently — the edit modal saves `currentPage`/`totalPages` but doesn't save `totalEpisodes`/`totalChapters` for shows/manga, and the bar requires a total.
- Poster fallback (and vault header) use the Georgia serif stack — no custom font loaded yet.
- Tailwind note: `min-[900px]:` is the correct v4 syntax for arbitrary *viewport* breakpoints (compiles to `@media (width >= 900px)`); `@min-[900px]:` is the *container query* variant and silently never matches without an `@container` ancestor.

## What's left

- 3D card tilt on hover
- Spotlight cursor on vault page
- Glassmorphism on modals
- Logo/favicon finalization
- Mobile responsiveness
- Weekly Supabase ping (GitHub Actions)
- Deploy to Vercel
- Add `totalEpisodes`/`totalChapters` to the edit modal so progress bars work beyond books

## Code style

- 2-space indent, single quotes, **no semicolons**
- Function components declared as `function ComponentName()`, not arrow consts
- No `React` import needed (React 19 JSX transform)
- Styling is a hybrid of Tailwind utility classes and inline `style={{}}` using CSS custom properties (e.g. `var(--color-gold)`, `var(--color-border)`, `var(--color-text-muted)`) defined in `src/index.css`. Note: inline styles always beat Tailwind `hover:`/`focus:` variants — put any property that needs a state variant in a class, not in `style`.

## Repo conventions

- Solo-dev workflow: commit directly to `main`, no branches or PRs
- Commit messages are imperative and descriptive, often multiple clauses separated by semicolons (e.g. "Add manual entry feature for titles not found via any API; fix JSX fragment syntax error in MediaSearch.tsx."), no type-prefix convention
- Never add `Co-Authored-By: Claude` lines to commit messages
