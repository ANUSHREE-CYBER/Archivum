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
- `src/lib/` — `supabase.ts` (Supabase client init), `utils.ts` (`cn()` utility using clsx + tailwind-merge), `useSpotlightEffect.ts` (canvas spotlight hook used by the landing page), `statusColors.ts` (shared `STATUS_COLORS` constant used by both the vault grid and stats dashboard)
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

## Database changes (manual SQL)

There is no migration tooling — schema/index/policy changes are applied by hand in the Supabase dashboard's SQL editor. Every such change gets a dated record file in `supabase/migrations/` (Supabase CLI naming, in case `supabase db push` is adopted later), with an "Applied on:" line filled in once it's been run. Database state is invisible from source code alone (see the Day 9 RLS incident under Known issues) — these files are the repo's only record of it.

- `20260710_entries_unique_source.sql` — partial unique index on `(user_id, source_api, source_id)` where `source_id is not null`, preventing duplicate API-sourced entries (manual entries exempt). Applied 2026-07-10. `MediaSearch.tsx` depends on it: it catches error `23505` on insert and shows "already in your library".

## Vault page

The logged-in view (`App.tsx` + `EntryList.tsx`). Layout top to bottom: identity header ("The Vault" serif wordmark + live counts, "+ Add" toggle on the right) → collapsible Add drawer → single toolbar line (uppercase index tabs with per-tab counts on the left; Status/Genre/Select/Sort on the right) → ornament divider (1px line broken by a gold ◆) → Continue shelf → card grid.

- Gold aurora animated background (Aceternity-based, 40% opacity, `mix-blend-screen`, `position: fixed`) behind everything via `AuroraBackground`
- Card design: `#111111` surface, `#1E1E1E` border, 12px radius, 6–7 cards per row (`repeat(auto-fill, minmax(180px, 1fr))`), 24px grid gap, poster hover zoom 1.05 inside the frame (card itself doesn't scale; gold glow on the card container)
- Status badge colors: Completed gold, In Progress green, Plan to Watch/Read red, On Hold purple, Dropped grey (`STATUS_COLORS` in `src/lib/statusColors.ts`, shared with `StatsDashboard`; `STATUS_TEXT_COLORS` stays local to `EntryList.tsx` for badge text contrast)
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

## Code review and hardening (Day 9)

A full codebase review was done by Claude Fable 5, covering bugs, TypeScript issues, performance, security, accessibility, and UX gaps. Fixes were then implemented and committed one at a time (Sonnet 5), each verified with `npm run build` before commit.

**Critical fixes:**
- `MediaSearch.tsx` search race condition — the debounced search effect had no cleanup, so a stale in-flight fetch could resolve after the user switched tabs or typed further and get mis-parsed under the wrong shape (or silently corrupt an insert). Fixed by tagging every result with a `_tab` discriminant captured at fetch time (not read live from state), plus a proper `cancelled` flag + cleanup function on the effect.
- `EntryList.tsx` and `StatsDashboard.tsx` fetch error handling — both only destructured `{ data }` from Supabase responses, so a failed fetch (network error, expired session, RLS denial) returned `data: null` and rendered identically to a genuinely empty vault/stats view. Both now destructure `{ data, error }`, track a dedicated `fetchError` state with a retry button (`retryTick` pattern), and leave existing data on screen rather than clearing it on failure. `StatsDashboard` also gained a request-cancellation guard it previously lacked entirely.
- Supabase RLS policy incident — see "Known issues" below.

**Important fixes:**
- `MediaSearch.tsx`: search failures (TMDB non-2xx responses, AniList GraphQL errors riding inside a 200 OK body, genuine network failures) now surface a visible `searchError` with a retry button, distinct from a genuine "No results found — try adding manually" state (tracked via a new `hasSearched` flag so it can't flash during the debounce window). The manga fallback chain (AniList → MangaDex) now also falls back to MangaDex on an AniList *error*, not just an empty result.
- `EntryList.tsx`'s `quickSetStatus` and `EntryEditModal.tsx`'s `handleSave` now chain `.select('id')` onto their updates (matching the pattern `handleBulkDelete` already used correctly) to detect a zero-row update — e.g. an entry deleted elsewhere or blocked by RLS — instead of showing a success toast for a change that never persisted.
- Poster `<img>` tags (vault grid and search results) now use `loading="lazy" decoding="async"`.
- `StatsDashboard` is now lazy-loaded via `React.lazy()` + `Suspense` in `App.tsx`, inside the existing AnimatePresence crossfade — recharts no longer ships in the initial bundle (~1024KB → ~642KB main bundle, confirmed via build output).
- Status colors unified in new `src/lib/statusColors.ts`, imported by both `EntryList.tsx` and `StatsDashboard.tsx` — they previously had contradictory local maps (gold meant "completed" in one and "in progress" in the other).
- `App.tsx` clears `entries` state on sign-out (`onAuthStateChange`) so stale counts from a previous session can't flash before the next login's fetch completes.

**Remaining items — completed (2026-07-10):** the seven review items left open after Day 9 are all implemented, committed, and pushed: focus management in both modals (new `src/lib/useModalFocus.ts` — focus trap, initial focus, focus return to trigger, `role="dialog"` + `aria-modal`; native `<dialog>` deliberately avoided because its top layer would cover the SmoothCursor overlay); `Dropdown` accessibility (`aria-activedescendant` with stable `useId`-based option ids, `aria-controls`, Home/End keys); `--color-text-muted` contrast fix (`#6B6660` → `#9A9590`, ~3.5:1 → ~6.8:1, WCAG AA — landing page/StatsDashboard use the old literal and were left as-is); `sharpPoster()` deduplicated into `src/lib/utils.ts`; duplicate-entry prevention (partial unique index on `(user_id, source_api, source_id)` where `source_id is not null` — see "Database changes" — with `23505` caught in `MediaSearch` as an "already in your library" toast); Kdrama tab filters TMDB results by `origin_country` including `KR` (TMDB's `discover/tv` supports origin filtering but not free-text search, hence post-filtering); `ManualEntryModal` gained an optional Format selector (non-book types) and a book-only Author field.

## Visual polish (post-review)

- **3D card tilt on hover** (`EntryCard` in `EntryList.tsx` + `.card-tilt` in `index.css`): cards rotate subtly (max ±7°) following the cursor, hovered side lifting toward it. The transform lives on a dedicated `.card-tilt` wrapper div — it can't go on the entrance-stagger wrapper (whose own transform transition carries a per-card delay) or the Framer Motion `layout` card (FM owns and overwrites that element's inline transform). Written directly to the DOM node via ref + rAF-coalesced mousemove (not React state, which would re-render the card per frame). Applied to both the main grid and the Continue shelf. Gated behind `@media (hover: hover) and (pointer: fine)` (CSS) plus a matching `matchMedia` check (JS); disabled during selection mode, flattening any mid-tilt card.
- **Glassmorphism on modals**: `EntryEditModal` and `ManualEntryModal` use the Add drawer's frosted-glass recipe — `rgba(17,17,17,0.85)` + `backdrop-filter: blur(12px)`, with an `rgba(255,255,255,0.08)` border. Their page scrim was deliberately lightened from `rgba(0,0,0,0.6)` to `rgba(0,0,0,0.4)`: the scrim sits between the glass and the aurora, and at 0.6 it swallowed the glow before the blur had anything to frost. Do **not** "correct" the scrim back to 0.6 — that kills the frosted effect and was the original bug.

## Dependencies added

- `sonner` — toast notifications
- `clsx` + `tailwind-merge` — `cn()` className utility (`src/lib/utils.ts`)
- `framer-motion` — card layout/exit animations, view crossfade, Add drawer slide

## Known issues

- 6 pre-existing lint errors: `EntryEditModal.tsx` and `MediaSearch.tsx` (react-refresh mixed-export warnings from colocated constants), `MediaSearch.tsx` and `EntryList.tsx` (setState directly inside an effect), `SmoothCursor.tsx` (impure `Date.now()` during render). None are from recent work; `npm run build` is unaffected.
- Progress bars only appear on books currently — the edit modal saves `currentPage`/`totalPages` but doesn't save `totalEpisodes`/`totalChapters` for shows/manga, and the bar requires a total.
- Poster fallback (and vault header) use the Georgia serif stack — no custom font loaded yet.
- Tailwind note: `min-[900px]:` is the correct v4 syntax for arbitrary *viewport* breakpoints (compiles to `@media (width >= 900px)`); `@min-[900px]:` is the *container query* variant and silently never matches without an `@container` ancestor.
- **RESOLVED (Day 9):** the RLS policy on `entries` was found to have been silently replaced at some point after Day 2 with an open "Allow all access for now" policy, instead of the originally correct `auth.uid() = user_id` policy. Discovered via the Fable 5 review's recommendation to verify RLS directly (RLS is a database setting, invisible from source code alone) plus manual Supabase dashboard inspection. Fixed by recreating the correct policy and verifying via `select * from pg_policies where tablename = 'entries'`. Lesson: check RLS policies periodically and directly in the Supabase dashboard — don't assume from old documentation, since policies can change independently of any code commit.
- **RESOLVED (2026-07-10):** the seven previously-unaddressed Fable 5 review items (modal focus management, Dropdown `aria-activedescendant`, muted-text contrast, duplicate `sharpPoster()`, duplicate-entry prevention, kdrama origin filtering, ManualEntryModal format/author fields) are all done — see "Code review and hardening" above for details.
- Spotlight cursor on the vault page was deliberately **not** added (decision, not an omission): the landing page keeps its distinct spotlight effect; the vault does not get one.
- Mobile responsiveness is deliberately deprioritized for now — out of scope, not forgotten.

## What's left

- Logo/favicon finalization
- Weekly Supabase ping (GitHub Actions)
- Deploy to Vercel
- Add `totalEpisodes`/`totalChapters` to the edit modal so progress bars work beyond books
- Landing page refinement — needs some polish, specifics TBD

## Code style

- 2-space indent, single quotes, **no semicolons**
- Function components declared as `function ComponentName()`, not arrow consts
- No `React` import needed (React 19 JSX transform)
- Styling is a hybrid of Tailwind utility classes and inline `style={{}}` using CSS custom properties (e.g. `var(--color-gold)`, `var(--color-border)`, `var(--color-text-muted)`) defined in `src/index.css`. Note: inline styles always beat Tailwind `hover:`/`focus:` variants — put any property that needs a state variant in a class, not in `style`.

## Repo conventions

- Solo-dev workflow: commit directly to `main`, no branches or PRs
- Commit messages are imperative and descriptive, often multiple clauses separated by semicolons (e.g. "Add manual entry feature for titles not found via any API; fix JSX fragment syntax error in MediaSearch.tsx."), no type-prefix convention
- Never add `Co-Authored-By: Claude` lines to commit messages
