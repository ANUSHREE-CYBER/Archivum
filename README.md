# Archivum

**One vault for every world you've visited.**

🌐 **[Live Demo](https://archivum-theta.vercel.app/)**

Archivum is a personal media archive — a single place to record the films, series, k-dramas, anime, books, manga and manhwa you've actually been through. Not a feed, not a social network, not a recommendation engine. An index of everywhere you've been, kept in order.

It's built as a solo project: a real tool for daily use, and a portfolio piece for the craft that went into it.

---

## Features

**Seven content types, one record.** Movies, TV, k-drama, anime, books, manga and manhwa each get their own section of the vault, sorted alphabetically on one continuous page. A `format` column handles cross-category titles — an anime film appears under both Anime and Movies without being entered twice.

**Progress that follows the medium.** Books track pages, series track episodes, manga and manhwa track chapters. Entries in progress show a thin progress bar on the poster once both a current and a total are recorded.

**Search across four sources, with a way out.** Adding a title searches TMDB (film and television), AniList (anime and manga), Open Library (books) and MangaDex (manga fallback), pulling in posters, years, genres and metadata. Anything the APIs don't have can be entered by hand, so nothing is unrecordable.

**Status tracking.** Completed, In Progress, Plan to Watch/Read, On Hold and Dropped, each with its own colour from a single shared palette — five points around one hue rather than five unrelated signals. Status can be changed inline from a card's hover controls without opening anything.

**A stats dashboard.** Status breakdown, per-type and per-genre distribution, ratings and completion counts, rendered with Recharts and lazy-loaded so the charting library never ships in the initial bundle.

**A landing page that behaves like an exhibit.** A canvas-driven cursor spotlight reveals a collage of posters out of the dark as you move — a flashlight in an archive room — over an index of the collection and a framed preview of the vault itself.

**A deliberate visual identity.** Rose gold on near-black, Georgia serif for anything that speaks, frosted glass on every panel, and a hand-drawn diamond ornament instead of a horizontal rule. Editorial rather than dashboard.

---

## Tech stack

| | |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 8 (Oxc-based `@vitejs/plugin-react`) |
| **Styling** | Tailwind CSS v4 — CSS-based theme, no `tailwind.config.js` |
| **Backend** | Supabase (Postgres + auth, row-level security) |
| **Animation** | Framer Motion |
| **Charts** | Recharts |
| **Toasts** | Sonner |
| **Utilities** | clsx + tailwind-merge |

No router and no state-management library — view switching is local state, and the Supabase client is the data layer.

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is enough)
- A [TMDB](https://www.themoviedb.org/settings/api) API key

AniList, Open Library and MangaDex need no credentials.

### Setup

```bash
git clone https://github.com/ANUSHREE-CYBER/Archivum.git
cd Archivum
npm install
```

Create a `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_TMDB_API_KEY=your-tmdb-api-key
```

Then:

```bash
npm run dev
```

### Other commands

```bash
npm run build     # tsc -b && vite build (the build type-checks)
npm run lint      # ESLint
npm run preview   # preview the production build
```

### Database

The app expects an `entries` table in Supabase with row-level security scoped to `auth.uid() = user_id`. There's no migration tooling — schema changes are applied by hand in the Supabase SQL editor, and each one is recorded as a dated file in `supabase/migrations/`, since database state is otherwise invisible from source.

---

## Single-user by design

There is no public sign-up. The landing page offers sign-in only, and accounts are created directly in Supabase.

Archivum is a personal tool first — one person's archive, with row-level security scoped to a single owner. It runs perfectly well as-is for its intended purpose, but it hasn't been designed or hardened for public multi-user deployment, and shouldn't be treated as if it had.

---

## Project structure

Flat and shallow on purpose — no `hooks/`, `services/` or `types/` directories.

```
src/
├── pages/
│   └── LandingPage.tsx      # hero + spotlight, collection index, vault preview, sign-in
├── components/
│   ├── EntryList.tsx        # the vault: header, filters, sections, cards
│   ├── MediaSearch.tsx      # all four API integrations live here
│   ├── EntryEditModal.tsx
│   ├── ManualEntryModal.tsx
│   ├── StatsDashboard.tsx   # lazy-loaded
│   ├── AuroraBackground.tsx
│   ├── Dropdown.tsx         # themed replacement for native <select>
│   └── SmoothCursor.tsx     # spring-driven cursor, vault only
├── lib/
│   ├── supabase.ts
│   ├── statusColors.ts      # single source of truth for status colours
│   ├── useSpotlightEffect.ts
│   ├── useModalFocus.ts
│   └── utils.ts
└── assets/
```

API integration logic lives inside `MediaSearch.tsx` rather than a separate services layer, with response types colocated above their usage.

`CLAUDE.md` carries the deeper implementation notes — the decisions, the trade-offs and the traps that aren't visible in the source.

---

## Author

Built by [Anushree](https://github.com/ANUSHREE-CYBER).
