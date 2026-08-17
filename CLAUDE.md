# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Archivum is a personal media-tracking app (movies, TV, anime, manga, k-drama) backed by Supabase, with search/import from TMDB, AniList, Open Library, and MangaDex.

## Stack

- React 19 + Vite 8 (Oxc-based `@vitejs/plugin-react`) + TypeScript (strict-ish: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`)
- Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`; theme is CSS-based (`@theme` block in `src/index.css`)
- No router — view switching is local state (`activeView` in `App.tsx`)
- No state-management library — plain `useState`/`useEffect`; Supabase client (`src/lib/supabase.ts`) is the data layer. Entries state is lifted to `App.tsx` (for the header count line) but `EntryList` owns fetching and all mutations via the passed-down setter.
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
- `src/components/` — `MediaSearch.tsx`, `EntryList.tsx`, `EntryEditModal.tsx`, `ManualEntryModal.tsx`, `StatsDashboard.tsx`, `SmoothCursor.tsx`, `AuroraBackground.tsx` (animated rose gold aurora background for the vault page), `Dropdown.tsx` (custom themed dropdown, replaces native selects)
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

The logged-in view (`App.tsx` + `EntryList.tsx`). One continuous scrolling page — there is no tab filtering and no sort control. Layout top to bottom: merged sticky header → collapsible Add drawer → ornament divider (1px line broken by a rose ◆) → Continue shelf → seven labeled type sections.

**Header** (one row, assembled in `EntryList` but fed by `App`):
- Left: "The Vault" serif wordmark + live count line. Right: Status, Genre, Curate, + Archive.
- The row lives in `EntryList` because the filter/selection state does; `App` passes `countLine`, `showAdd`, `onToggleAdd`, `collapsed`, and the drawer itself as an `addDrawer: ReactNode` prop. Lifting the seven pieces of filter state into `App` instead would have put the bulk-delete logic through a refactor for a layout change.
- Sticky against `<main>` (the scroll container, **not** the window). Nothing between the header and `<main>` may set `overflow`, or sticky silently dies.
- Collapses on scroll: `App` owns the `onScroll` handler and passes `collapsed` down. **Hysteresis band — collapse at 96px, expand at 40px** — a single threshold sits exactly where the collapse's own height reduction bounces content back across it and flaps.
- Collapsed state shrinks the title (23px → 15px), drops the count line (`max-width` → 0, not `display: none`, so it collapses along the row), compacts every control, and adds `rgba(8,8,8,0.88)` + `blur(8px)` so cards can't read through. Library/Stats + Log out never scroll — they're in `App`'s `<header>`, outside `<main>` entirely.
- `+ Archive` scrolls `main` back to top when opening, since the drawer it opens lives at the top of the page.

**Sections** (replaced the tab bar):
- Fixed order: Anime, Kdrama, Movies, TV, Books, Manga, Manhwa (`VAULT_SECTIONS`). Always A–Z within a section.
- Status/Genre filters apply to the whole vault *before* the split, so a filter narrows what's in each section rather than which sections exist.
- **Sections with zero entries are not rendered at all** — no heading, no empty state. Covers both "filters excluded this type" and "you've never added one". The seven per-type empty messages were deleted with the tab bar; only the whole-vault empty state and "No entries match these filters." remain.
- **An entry can render in two sections** (an anime film matches both Anime and Movies via `matchesTypeTab()`). This is safe because every cross-section behaviour is keyed on entry id, not card identity: selection is a `Set<string>`, the counter reads `selectedIds.size`, and bulk delete filters state by id — so both renderings stay in lockstep and delete once.
- Entrance stagger is scoped per section: each `VaultSection` holds `useInView(ref, { once: true, amount: 0.05 })` and passes it down as `EntryCard`'s `revealed` prop. **`amount` must stay small** — it's the fraction of the *section* that must be visible, and a section taller than the viewport can never reach a high ratio, so `0.5` would simply never fire.

**Visual:**
- Rose gold aurora animated background (Aceternity-based, 40% opacity, `mix-blend-screen`, `position: fixed`) via `AuroraBackground`. Rose gold is ~half the luminance of the old gold, and `mix-blend-screen` is luminance-driven — if it ever reads too faint, `opacity-40` → `opacity-50` is the dial.
- Card design: `#111111` surface, `#1E1E1E` border, 12px radius, 6–7 cards per row (`repeat(auto-fill, minmax(180px, 1fr))`), 24px grid gap, poster hover zoom 1.05 inside the frame (card itself doesn't scale; rose glow on the card container)
- Status badges: Completed `#C97684`, In Progress `#9B2F5C`, Plan to Watch/Read `#A99BAE`, On Hold `#5B3E8C`, Dropped `#6B6660`. Both `STATUS_COLORS` **and `STATUS_TEXT_COLORS`** live in `src/lib/statusColors.ts` — the text map moved there when the landing page's Plate mockup became a second consumer, since a background and the text colour it requires are one decision. Three of the five text colours flipped in the rebrand; the ratios are recorded in that file.
- Type indicator dots: 7 muted per-type colors (`TYPE_DOT_COLORS`), top-left of poster. **kdrama is `#C173A8`, not a rose** — its old `#C48793` sat at hue 348°, within 3° of both `--color-accent` (351°) and the Completed badge (350°), so the dot read as a status cue. 319° is the midpoint between the rose it must escape and the manga dot's 288°.
- Continue shelf: horizontal scrollable row of all in-progress entries. It has never been narrowed by Status/Genre (filtering it by status would empty it for any status but "Watching / Reading").
- `format` column: nullable `'movie' | 'series' | 'comic'` for cross-category classification (e.g. anime films)
- Custom `Dropdown` replaces all native selects (neutral theming, no accent; keyboard support with focus kept on the trigger; optional decorative `icon` slot)
- Header controls share one shell: `.dropdown-trigger` and `.vault-control` are the same surface/border/8px radius/hover. `+ Archive` is the one filled accent control. These rules are **unlayered** in `index.css`, which is how they beat Tailwind's layered utilities without `!important` — but inline styles still beat them, which is why `+ Archive`'s padding lives in `.vault-add-btn` rather than a `style` prop.
- Control icons (funnel / tag / ticked box) are hand-written inline SVG on `currentColor`. **There is no icon library in this project** and none should be added for a handful of glyphs — `Dropdown`'s chevron established the idiom.
- Toast notifications via sonner (dark theme, rose accent border)
- Card entrance: CSS transitions with per-card stagger delay (not Framer Motion variants); layout/exit animation via Framer Motion `layout` + `AnimatePresence`
- Library/Stats crossfade via `AnimatePresence mode="wait"`
- Hover quick actions: status mini-dropdown + edit button rise over the poster on card hover, gated behind `@media (hover: hover) and (pointer: fine)`; hidden in selection mode
- Progress bars: 3px rose bar at the poster's bottom edge on in-progress entries when metadata has a current + total pair
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
- **Glassmorphism on modals**: `EntryEditModal`, `ManualEntryModal` and the landing page's sign-in modal all use the Add drawer's frosted-glass recipe — `rgba(17,17,17,0.85)` + `backdrop-filter: blur(12px)`, with an `rgba(255,255,255,0.08)` border. Their page scrim was deliberately lightened from `rgba(0,0,0,0.6)` to `rgba(0,0,0,0.4)`: the scrim sits between the glass and the aurora, and at 0.6 it swallowed the glow before the blur had anything to frost. Do **not** "correct" the scrim back to 0.6 — that kills the frosted effect and was the original bug.
- **A scrim must never carry its own `backdrop-filter`.** An element with `backdrop-filter` becomes a *backdrop root* for its descendants, so blurring the scrim leaves the card's own blur sampling nothing but the scrim's flat colour — the frost silently does nothing regardless of opacity. All three scrims are plain tints for this reason. (The sign-in modal's scrim had `blur(6px)` and was fixed during its redesign.)

## Landing page

`src/pages/LandingPage.tsx` — one file, self-contained styles in a `<style>` block. Scroll order: hero → Collection → Plate (vault peek). Rose gold Pass 1 lives here (logo/tagline/CTA are live text with a clipped gradient sheen, not the original Figma SVG exports).

- **Root uses `overflow-x: clip`, NOT `hidden`.** `hidden` on one axis forces the other axis's `visible` to compute to `auto`, which turned the root into a page-wide scroll container — that silently swallowed `scrollIntoView` and broke the "See how it works" cue. `clip` has no such side effect. For the same reason the cue now uses `window.scrollTo` (+ `NAV_OFFSET`) rather than `scrollIntoView`, which scrolls whichever container it meets first.
- The hero hides the OS cursor (the spotlight canvas *is* the cursor) via the global `* { cursor: none !important }`. `.lp-section` restores `cursor: auto` below the hero — a class selector outranks the universal one. **The sign-in modal is not covered by that override**, so it has no visible cursor except in its inputs; deliberate for now, one rule to change if unwanted.
- The spotlight canvas is `position: absolute` inside the hero, not fixed — fixed, its dark overlay would follow the scroll and black out both sections below.
- Plate mockup colours import from `statusColors.ts`; only its labels are local (the vault derives labels from entry type, and a static mockup has none).
- Sign-in modal: serif heading in `--color-accent-light`, the hero CTA's own `.lp-cta` class reused for the button (via `.lp-cta-block`, which unpins its 308px width), `◆` ornament, and a password visibility toggle. That toggle's `type="button"` is load-bearing — a bare button in a form defaults to `type="submit"`.

## Dependencies added

- `sonner` — toast notifications
- `clsx` + `tailwind-merge` — `cn()` className utility (`src/lib/utils.ts`)
- `framer-motion` — card layout/exit animations, view crossfade, Add drawer slide

## Known issues

- 8 pre-existing lint errors (this was documented as 6 — `StatsDashboard.tsx` and the `no-useless-assignment` were missed): `EntryEditModal.tsx` (×2) and `MediaSearch.tsx` (react-refresh mixed-export warnings from colocated constants), `MediaSearch.tsx`, `EntryList.tsx` and `StatsDashboard.tsx` (setState directly inside an effect), `MediaSearch.tsx` (`no-useless-assignment` on the AniList fallback), `SmoothCursor.tsx` (impure `Date.now()` during render). None are from recent work; `npm run build` is unaffected.
- Progress bars only appear on books currently — the edit modal saves `currentPage`/`totalPages` but doesn't save `totalEpisodes`/`totalChapters` for shows/manga, and the bar requires a total.
- Poster fallback (and vault header) use the Georgia serif stack — no custom font loaded yet.
- Tailwind note: `min-[900px]:` is the correct v4 syntax for arbitrary *viewport* breakpoints (compiles to `@media (width >= 900px)`); `@min-[900px]:` is the *container query* variant and silently never matches without an `@container` ancestor.
- **RESOLVED (Day 9):** the RLS policy on `entries` was found to have been silently replaced at some point after Day 2 with an open "Allow all access for now" policy, instead of the originally correct `auth.uid() = user_id` policy. Discovered via the Fable 5 review's recommendation to verify RLS directly (RLS is a database setting, invisible from source code alone) plus manual Supabase dashboard inspection. Fixed by recreating the correct policy and verifying via `select * from pg_policies where tablename = 'entries'`. Lesson: check RLS policies periodically and directly in the Supabase dashboard — don't assume from old documentation, since policies can change independently of any code commit.
- **RESOLVED (2026-07-10):** the seven previously-unaddressed Fable 5 review items (modal focus management, Dropdown `aria-activedescendant`, muted-text contrast, duplicate `sharpPoster()`, duplicate-entry prevention, kdrama origin filtering, ManualEntryModal format/author fields) are all done — see "Code review and hardening" above for details.
- Spotlight cursor on the vault page was deliberately **not** added (decision, not an omission): the landing page keeps its distinct spotlight effect; the vault does not get one.
- Mobile responsiveness is deliberately deprioritized for now — out of scope, not forgotten.

## What's left

- Deploy to Vercel
- Add `totalEpisodes`/`totalChapters` to the edit modal so progress bars work beyond books
All four loose ends from the previous session are now cleared: `--color-success` and `public/icons.svg` deleted, vault modal inputs given a focus state (`.vault-input` in `index.css`), and `matchesTypeTab()` narrowed to `Tab`.

Note `EntryEditModal` still uses a native `<select>` for Status — the only one left, despite the note above that `Dropdown` replaced all native selects. It now shares `.vault-input`, so it is at least styled and focusable consistently.

## Code style

- 2-space indent, single quotes, **no semicolons**
- Function components declared as `function ComponentName()`, not arrow consts
- No `React` import needed (React 19 JSX transform)
- Styling is a hybrid of Tailwind utility classes and inline `style={{}}` using CSS custom properties (e.g. `var(--color-accent)`, `var(--color-border)`, `var(--color-text-muted)`) defined in `src/index.css`. Note: inline styles always beat Tailwind `hover:`/`focus:` variants — put any property that needs a state variant in a class, not in `style`.
- **`--color-gold` no longer exists.** The rose gold rebrand retired it; `--color-accent` (`#B76E79`) plus `-light` / `-dark` / `-pale` is the single accent family. The only remaining `var(--color-gold)` references are in `LoginPage.tsx`, which is dead code and never rendered — they resolve to nothing, harmlessly.
- Seven `rgba(183,110,121,α)` literals remain where a variable can't express an alpha without `color-mix()` — a future hue change is not a one-line edit.

## Repo conventions

- Solo-dev workflow: commit directly to `main`, no branches or PRs
- Commit messages are imperative and descriptive, often multiple clauses separated by semicolons (e.g. "Add manual entry feature for titles not found via any API; fix JSX fragment syntax error in MediaSearch.tsx."), no type-prefix convention
- Never add `Co-Authored-By: Claude` lines to commit messages
