import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import ManualEntryModal from './ManualEntryModal'
import { TYPE_DOT_COLORS } from '../lib/typeColors'
import { useTilt } from '../lib/useTilt'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

export type Tab = 'movie' | 'tv_show' | 'kdrama' | 'anime' | 'book' | 'manga' | 'manhwa'

export const TABS: { value: Tab; label: string }[] = [
  { value: 'movie',   label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'kdrama',  label: 'Kdrama' },
  { value: 'anime',   label: 'Anime' },
  { value: 'book',    label: 'Books' },
  { value: 'manga',   label: 'Manga' },
  { value: 'manhwa',  label: 'Manhwa' },
]

// TMDB genre ID → name maps (stable public lists, no API call needed)
const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
}
const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery',
  10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
}

function tmdbGenreNames(ids: number[], isMovie: boolean): string[] {
  const map = isMovie ? TMDB_MOVIE_GENRES : TMDB_TV_GENRES
  return ids.map(id => map[id]).filter(Boolean)
}

// TMDB shapes
interface TmdbMovie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  genre_ids: number[]
}

interface TmdbTV {
  id: number
  name: string
  first_air_date: string
  poster_path: string | null
  genre_ids: number[]
  origin_country?: string[]
}

type TmdbResult = TmdbMovie | TmdbTV

function isTV(r: TmdbResult): r is TmdbTV {
  return 'name' in r
}

// AniList shape
interface AniListResult {
  id: number
  title: { english: string | null; romaji: string }
  coverImage: { large: string | null; medium: string | null }
  startDate: { year: number | null }
  genres: string[]
  format: string
}

const ANILIST_QUERY = `
  query ($search: String) {
    Page(perPage: 10) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { english romaji }
        coverImage { large medium }
        startDate { year }
        genres
        format
      }
    }
  }
`

const ANILIST_SERIES_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA', 'OVA', 'SPECIAL'])

function anilistFormat(format: string): 'movie' | 'series' | null {
  if (format === 'MOVIE') return 'movie'
  if (ANILIST_SERIES_FORMATS.has(format)) return 'series'
  return null
}

async function searchAniList(search: string): Promise<AniListResult[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
  })
  if (!res.ok) throw new Error('AniList request failed')
  const json = await res.json()
  // GraphQL errors ride inside a 200 OK body, not the HTTP status — check
  // the errors array explicitly or a failed query silently reads as "no results".
  if (json?.errors) throw new Error('AniList query failed')
  return json?.data?.Page?.media ?? []
}

// Open Library shape
interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

async function searchOpenLibrary(query: string): Promise<OpenLibraryDoc[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i`
  )
  if (!res.ok) throw new Error('Open Library request failed')
  const json = await res.json()
  return json?.docs ?? []
}

// MangaDex shape
interface MangaDexResult {
  id: string
  attributes: {
    title: Record<string, string>
    year: number | null
  }
  relationships: Array<{
    type: string
    attributes?: { fileName: string }
  }>
}

type TaggedAniList  = AniListResult  & { _source: 'anilist' }
type TaggedMangaDex = MangaDexResult & { _source: 'mangadex' }
type MangaResult    = TaggedAniList | TaggedMangaDex

// Every result is tagged with the tab that was active when its search was
// kicked off (captured before the debounced fetch runs, not read live at
// select time). handleSelect and the results list read this tag instead of
// the live `tab` state, so a result always parses/saves as what it actually
// is even if it resolves after the user has switched tabs.
type TaggedTmdbResult      = TmdbResult     & { _tab: 'movie' | 'tv_show' | 'kdrama' }
type TaggedAniListAnime    = AniListResult  & { _tab: 'anime' }
type TaggedOpenLibraryDoc  = OpenLibraryDoc & { _tab: 'book' }
type TaggedMangaAniList    = TaggedAniList  & { _tab: 'manga' | 'manhwa' }
type TaggedMangaDexResult  = TaggedMangaDex & { _tab: 'manga' | 'manhwa' }

type SearchResult =
  | TaggedTmdbResult
  | TaggedAniListAnime
  | TaggedOpenLibraryDoc
  | TaggedMangaAniList
  | TaggedMangaDexResult

// Explicit type predicates rather than inline `result._tab === '...'` checks —
// TS's control-flow narrowing doesn't reliably eliminate the manga branch's
// two members (they share one _tab type) from the trailing `else` when the
// check is written inline; a named `is` guard narrows reliably at every call site.
function isAnimeResult(r: SearchResult): r is TaggedAniListAnime {
  return r._tab === 'anime'
}
function isBookResult(r: SearchResult): r is TaggedOpenLibraryDoc {
  return r._tab === 'book'
}
function isMangaResult(r: SearchResult): r is TaggedMangaAniList | TaggedMangaDexResult {
  return r._tab === 'manga' || r._tab === 'manhwa'
}

const ANILIST_MANGA_QUERY = `
  query ($search: String) {
    Page(perPage: 10) {
      media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
        id
        title { english romaji }
        coverImage { large medium }
        startDate { year }
        genres
      }
    }
  }
`

async function searchAniListManga(search: string): Promise<AniListResult[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_MANGA_QUERY, variables: { search } }),
  })
  if (!res.ok) throw new Error('AniList request failed')
  const json = await res.json()
  if (json?.errors) throw new Error('AniList query failed')
  return json?.data?.Page?.media ?? []
}

async function searchMangaDex(query: string): Promise<MangaDexResult[]> {
  const res = await fetch(
    `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&includes[]=cover_art&limit=10`
  )
  if (!res.ok) throw new Error('MangaDex request failed')
  const json = await res.json()
  return json?.data ?? []
}

async function searchMangaWithFallback(query: string): Promise<MangaResult[]> {
  // A failed AniList leg falls through to MangaDex rather than surfacing an
  // error immediately — that mirrors the existing "no AniList results, try
  // MangaDex" fallback intent. Only report failure if MangaDex fails too,
  // since there's nowhere left to fall back to at that point.
  let anilist: AniListResult[] = []
  try {
    anilist = await searchAniListManga(query)
  } catch {
    anilist = []
  }
  if (anilist.length > 0) return anilist.map(r => ({ ...r, _source: 'anilist' as const }))
  const mangadex = await searchMangaDex(query)
  return mangadex.map(r => ({ ...r, _source: 'mangadex' as const }))
}

interface Props {
  userId: string
  onSaved: () => void
  // `${type}|${lowercased title}` for everything already in the vault, so a
  // result can show "In vault ✓" instead of "+ Add". Display only — the
  // unique index (and its 23505 toast) is still what actually blocks dupes.
  vaultKeys?: Set<string>
  // Bumped by App's "/" shortcut; each change focuses the search input
  focusSignal?: number
}

// Rotating placeholder examples per tab: the plain "Search for a …" prompt,
// then each of these as `Try "…"`, one every 2.6s while the field is empty.
const EXAMPLES: Record<Tab, string[]> = {
  movie:   ['Dune', 'Heat', 'Parasite'],
  tv_show: ['Breaking Bad', 'Mindhunter'],
  kdrama:  ['Signal', 'Vincenzo'],
  anime:   ['Frieren', 'Demon Slayer'],
  book:    ['Piranesi', 'Stoner'],
  manga:   ['Berserk', 'Vagabond'],
  manhwa:  ['Solo Leveling', 'Tower of God'],
}
const PLACEHOLDER_MS = 2600

interface ResultView {
  key: string
  title: string
  year: string | null
  subtitle: string | null
  poster: string | null
  inVault: boolean
  result: SearchResult
}

// One search result: 128px poster that flips in (staggered by index), tilts
// with a glare on hover, and carries its own Add pill underneath. The tilt
// sits on an inner div so it never fights the flip-in animation's transform.
function ResultCard({ view, index, tab, saving, onAdd }: {
  view: ResultView
  index: number
  tab: Tab
  saving: boolean
  onAdd: () => void
}) {
  const { tiltRef, glareRef, onMouseMove, onMouseLeave } = useTilt({ max: 7, lift: 'translateZ(20px)', perspective: 700, glare: 0.28 })
  const [imgError, setImgError] = useState(false)
  return (
    <li className="search-result" style={{ animationDelay: `${index * 60}ms` }}>
      <div
        ref={tiltRef}
        className="search-result-poster"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {view.poster && !imgError ? (
          <img src={view.poster} alt="" loading="lazy" decoding="async" onError={() => setImgError(true)} />
        ) : (
          <div
            className="search-result-fallback"
            style={{ background: `linear-gradient(160deg, ${TYPE_DOT_COLORS[tab]}44 0%, #0c0c0c 80%)` }}
          >
            {view.title}
          </div>
        )}
        <div ref={glareRef} className="search-result-glare" />
      </div>
      <span className="search-result-title" title={view.title}>{view.title}</span>
      {view.subtitle && <span className="search-result-sub" title={view.subtitle}>{view.subtitle}</span>}
      <div className="search-result-meta">
        <span>{view.year ?? '—'}</span>
        {view.inVault ? (
          <span className="search-result-pill is-owned">In vault ✓</span>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={saving}
            className="search-result-pill cursor-pointer"
            aria-label={`Add ${view.title}`}
          >
            + Add
          </button>
        )}
      </div>
    </li>
  )
}

export default function MediaSearch({ userId, onSaved, vaultKeys, focusSignal = 0 }: Props) {
  const [tab, setTab] = useState<Tab>('movie')
  const [showManual, setShowManual] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  // True once a search has actually completed (success or failure) for the
  // current query/tab — distinguishes "zero results" from "haven't searched
  // yet" (idle, or still within the debounce window before the fetch fires).
  const [hasSearched, setHasSearched] = useState(false)
  const [searchRetryTick, setSearchRetryTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabLineRef = useRef<HTMLDivElement>(null)
  const [placeholderStep, setPlaceholderStep] = useState(0)

  // "/" from App: focus on every bump (and on mount, if the drawer was
  // opened by the shortcut rather than the button)
  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus()
  }, [focusSignal])

  // Advance the rotating placeholder only while the field is empty; typing
  // stops the interval, and the cleanup restarts it cleanly per tab.
  useEffect(() => {
    if (query) return
    const id = setInterval(() => setPlaceholderStep(n => n + 1), PLACEHOLDER_MS)
    return () => clearInterval(id)
  }, [query, tab])

  // One shared underline that slides to the active tab. Measured from the
  // button's own offsetLeft/offsetWidth (layout effect, so it's placed before
  // paint) and re-measured on resize, since wrapping can move the tabs.
  useLayoutEffect(() => {
    function place() {
      const line = tabLineRef.current
      const btn = tabsRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      if (!line || !btn) return
      line.style.width = `${btn.offsetWidth}px`
      line.style.transform = `translateX(${btn.offsetLeft}px)`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [tab])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])
    setSearching(false)
    setSearchError(null)
    setHasSearched(false)

    if (!query.trim()) return

    // Captured now, not read live inside the timeout/fetch below — so a
    // result is always tagged with the tab it was actually searched under.
    const activeTab = tab
    let cancelled = false

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        let fetched: SearchResult[]
        if (activeTab === 'anime') {
          const raw = await searchAniList(query)
          fetched = raw.map(r => ({ ...r, _tab: 'anime' as const }))
        } else if (activeTab === 'book') {
          const raw = await searchOpenLibrary(query)
          fetched = raw.map(r => ({ ...r, _tab: 'book' as const }))
        } else if (activeTab === 'manga' || activeTab === 'manhwa') {
          const raw = await searchMangaWithFallback(query)
          fetched = raw.map(r => ({ ...r, _tab: activeTab }))
        } else {
          const endpoint = activeTab === 'movie' ? 'search/movie' : 'search/tv'
          const res = await fetch(
            `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
          )
          if (!res.ok) throw new Error('TMDB request failed')
          const data = await res.json()
          let raw = (data.results ?? []) as TmdbResult[]
          // TMDB's discover/tv endpoint supports with_origin_country=KR but
          // not free-text search, so the Kdrama tab filters search/tv results
          // by origin_country instead — otherwise it's just a second TV search.
          if (activeTab === 'kdrama') {
            raw = raw.filter(r => isTV(r) && (r.origin_country ?? []).includes('KR'))
          }
          fetched = raw.map(r => ({ ...r, _tab: activeTab }))
        }
        // Guard against a stale request (superseded by a newer query or tab
        // switch) resolving after cleanup has already fired for this run.
        if (!cancelled) {
          setResults(fetched)
          setSearchError(null)
          setHasSearched(true)
        }
      } catch {
        if (!cancelled) {
          setResults([])
          setSearchError('Search failed — check your connection and try again.')
          setHasSearched(true)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 400)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, tab, searchRetryTick])

  function switchTab(next: Tab) {
    setTab(next)
    setPlaceholderStep(0)
    setQuery('')
    setResults([])
    setSaveError('')
  }

  async function handleSelect(result: SearchResult) {
    if (saving) return
    setSaving(true)
    setSaveError('')

    let title: string
    let year: string | null
    let poster_url: string | null
    let source_api: string
    let source_id: string
    let metadata: Record<string, unknown> | undefined
    let genres: string[] | null = null
    let format: 'movie' | 'series' | 'comic' | null = null

    if (isAnimeResult(result)) {
      const a = result
      title      = a.title.english || a.title.romaji
      year       = a.startDate.year ? String(a.startDate.year) : null
      poster_url = a.coverImage.large ?? a.coverImage.medium ?? null
      source_api = 'anilist'
      source_id  = String(a.id)
      genres     = a.genres.length > 0 ? a.genres : null
      format     = anilistFormat(a.format)
    } else if (isBookResult(result)) {
      const b = result
      const author = b.author_name?.[0] ?? null
      title      = b.title
      year       = b.first_publish_year ? String(b.first_publish_year) : null
      poster_url = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
      source_api = 'openlibrary'
      source_id  = b.key
      metadata   = author ? { author } : undefined
    } else if (isMangaResult(result)) {
      const mr = result
      format = 'comic'
      if (mr._source === 'anilist') {
        const a = mr
        title      = a.title.english || a.title.romaji
        year       = a.startDate.year ? String(a.startDate.year) : null
        poster_url = a.coverImage.large ?? a.coverImage.medium ?? null
        source_api = 'anilist'
        source_id  = String(a.id)
        genres     = a.genres.length > 0 ? a.genres : null
      } else {
        const m = mr
        title      = m.attributes.title.en ?? Object.values(m.attributes.title)[0] ?? ''
        year       = m.attributes.year ? String(m.attributes.year) : null
        const coverRel = m.relationships.find(r => r.type === 'cover_art')
        poster_url = coverRel?.attributes?.fileName
          ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`
          : null
        source_api = 'mangadex'
        source_id  = m.id
      }
    } else {
      const t = result
      title      = isTV(t) ? t.name : t.title
      const date = isTV(t) ? t.first_air_date : t.release_date
      year       = date ? date.slice(0, 4) : null
      poster_url = t.poster_path ? `${TMDB_IMAGE_BASE}${t.poster_path}` : null
      source_api = 'tmdb'
      source_id  = String(t.id)
      genres     = tmdbGenreNames(t.genre_ids ?? [], result._tab === 'movie')
      if (genres.length === 0) genres = null
      format     = result._tab === 'movie' ? 'movie' : 'series'
    }

    const { error } = await supabase.from('entries').insert({
      user_id: userId,
      title,
      year,
      poster_url,
      type: result._tab,
      format,
      status: 'plan_to_watch',
      source_api,
      source_id,
      ...(metadata ? { metadata } : {}),
      ...(genres   ? { genres }   : {}),
    })

    setSaving(false)
    if (error) {
      // 23505 = Postgres unique violation, from the partial unique index on
      // (user_id, source_api, source_id) — the user picked something they've
      // already added, which isn't a failure worth an error state.
      if (error.code === '23505') {
        toast(`${title} is already in your library`, {
          style: { border: '1px solid var(--color-accent)' },
        })
      } else {
        setSaveError(error.message)
        toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
      }
    } else {
      setQuery('')
      setResults([])
      toast.success(`${title} added to your archive`)
      onSaved()
    }
  }

  const examples = EXAMPLES[tab]
  const exampleIdx = placeholderStep % (examples.length + 1)
  const placeholder = exampleIdx > 0
    ? `Try “${examples[exampleIdx - 1]}”`
    : tab === 'movie'   ? 'Search for a movie…' :
      tab === 'anime'   ? 'Search for an anime…' :
      tab === 'book'    ? 'Search for a book…' :
      tab === 'manga'   ? 'Search for a manga…' :
      tab === 'manhwa'  ? 'Search for a manhwa…' :
      tab === 'kdrama'  ? 'Search for a kdrama…' :
      'Search for a TV show…'

  // Flatten the four result shapes into one display row each. Same field
  // picks as handleSelect uses for the insert, so what's shown is what's saved.
  const views: ResultView[] = results.map(result => {
    let key: string
    let title: string
    let year: string | null
    let poster: string | null
    let subtitle: string | null = null

    if (isBookResult(result)) {
      const b = result
      key      = b.key
      title    = b.title
      year     = b.first_publish_year ? String(b.first_publish_year) : null
      poster   = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
      subtitle = b.author_name?.[0] ?? null
    } else if (isAnimeResult(result)) {
      const a = result
      key    = String(a.id)
      title  = a.title.english || a.title.romaji
      year   = a.startDate.year ? String(a.startDate.year) : null
      poster = a.coverImage.large ?? a.coverImage.medium ?? null
    } else if (isMangaResult(result)) {
      const mr = result
      if (mr._source === 'anilist') {
        const a = mr
        key    = String(a.id)
        title  = a.title.english || a.title.romaji
        year   = a.startDate.year ? String(a.startDate.year) : null
        poster = a.coverImage.large ?? a.coverImage.medium ?? null
      } else {
        const m = mr
        key    = m.id
        title  = m.attributes.title.en ?? Object.values(m.attributes.title)[0] ?? ''
        year   = m.attributes.year ? String(m.attributes.year) : null
        const coverRel = m.relationships.find(r => r.type === 'cover_art')
        poster = coverRel?.attributes?.fileName
          ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`
          : null
      }
    } else {
      const t = result
      key    = String(t.id)
      title  = isTV(t) ? t.name : t.title
      const date = isTV(t) ? t.first_air_date : t.release_date
      year   = date ? date.slice(0, 4) : null
      poster = t.poster_path ? `${TMDB_IMAGE_BASE}${t.poster_path}` : null
    }

    const inVault = vaultKeys?.has(`${result._tab}|${title.toLowerCase()}`) ?? false
    return { key, title, year, poster, subtitle, inVault, result }
  })

  const tabLabel = TABS.find(t => t.value === tab)?.label ?? ''

  return (
    <>
    {/* Full-width drawer under the vault header — frosted glass over the
        backdrop. The slide open/close animation lives in App.tsx (AnimatePresence
        around the mount), since exit animations need the component that owns
        the conditional. */}
    <div
      className="w-full"
      style={{
        // No backdrop-filter: the drawer sits over the drifting Quiet wall,
        // which would force a re-blur every frame while it's open
        background: 'rgba(17, 17, 17, 0.94)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="add-bar">
        <span className="add-bar-label">Add to your archive</span>

        {/* API type selector: text tabs with their type dot, and one
            shared underline that slides to whichever is active */}
        <div ref={tabsRef} className="add-tabs" role="tablist" aria-label="Search in">
          {TABS.map(t => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              data-active={tab === t.value}
              onClick={() => switchTab(t.value)}
              className={`add-tab cursor-pointer${tab === t.value ? ' is-active' : ''}`}
            >
              <span className="add-tab-dot" style={{ background: TYPE_DOT_COLORS[t.value] }} />
              {t.label}
            </button>
          ))}
          <div ref={tabLineRef} className="add-tabs-line" aria-hidden="true" />
        </div>

        <div className="add-search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="add-search-icon">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            aria-label={`Search ${tabLabel}`}
            placeholder={placeholder}
            value={query}
            onChange={e => {
              setSaveError('')
              setQuery(e.target.value)
            }}
            className="add-search-input"
          />
          <kbd className="add-search-key" aria-hidden="true">/</kbd>
        </div>

        <button onClick={() => setShowManual(true)} className="add-manual-btn cursor-pointer">
          Add manually
        </button>
      </div>

      {(query.trim() || saveError) && (
        <div className="add-results">
          {searching && <p className="add-results-note">Searching…</p>}

          {!searching && searchError && (
            <div className="flex items-center gap-3">
              <p className="text-sm flex-1" style={{ color: 'var(--color-danger)' }}>
                {searchError}
              </p>
              <button
                type="button"
                onClick={() => setSearchRetryTick(t => t + 1)}
                className="text-xs font-semibold rounded px-2.5 py-1.5 cursor-pointer hover:opacity-90 flex-shrink-0"
                style={{ background: 'var(--color-danger)', color: '#F2EFE9', border: 'none' }}
              >
                Retry
              </button>
            </div>
          )}

          {!searching && !searchError && hasSearched && results.length === 0 && (
            <p className="add-results-note">
              No results found —{' '}
              <button type="button" onClick={() => setShowManual(true)} className="add-results-link cursor-pointer">
                add it manually
              </button>
            </p>
          )}

          {saveError && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {saveError}
            </p>
          )}

          {views.length > 0 && (
            <>
              <div className="add-results-eyebrow">
                {views.length} {views.length === 1 ? 'result' : 'results'} · {tabLabel}
                <span aria-hidden="true" />
              </div>
              <ul className="add-results-row">
                {views.map((view, i) => (
                  <ResultCard
                    key={view.key}
                    view={view}
                    index={i}
                    tab={tab}
                    saving={saving}
                    onAdd={() => handleSelect(view.result)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>

    {showManual && (
      <ManualEntryModal
        userId={userId}
        onClose={() => setShowManual(false)}
        onSaved={() => { setShowManual(false); onSaved() }}
      />
    )}
    </>
  )
}
