import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import ManualEntryModal from './ManualEntryModal'

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
}

export default function MediaSearch({ userId, onSaved }: Props) {
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
  const [saved, setSaved] = useState<number | string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          const raw = (data.results ?? []) as TmdbResult[]
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
    setQuery('')
    setResults([])
    setSaved(null)
    setSaveError('')
  }

  async function handleSelect(result: SearchResult) {
    if (saving) return
    setSaving(true)
    setSaved(null)
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
      setSaveError(error.message)
      toast.error(error.message, { style: { border: '1px solid var(--color-danger)' } })
    } else {
      setSaved(
        isBookResult(result) ? result.key :
        isMangaResult(result) && result._source === 'mangadex' ? result.id :
        (result as TaggedTmdbResult | TaggedAniListAnime).id
      )
      setQuery('')
      setResults([])
      toast.success(`Added ${title} to your library`)
      onSaved()
    }
  }

  const placeholder =
    tab === 'movie'   ? 'Search for a movie…' :
    tab === 'anime'   ? 'Search for an anime…' :
    tab === 'book'    ? 'Search for a book…' :
    tab === 'manga'   ? 'Search for a manga…' :
    tab === 'manhwa'  ? 'Search for a manhwa…' :
    'Search for a TV show…'

  return (
    <>
    {/* Full-width drawer under the filter tab row — frosted glass over the
        aurora. The slide open/close animation lives in App.tsx (AnimatePresence
        around the mount), since exit animations need the component that owns
        the conditional. */}
    <div
      className="flex flex-col gap-4 w-full px-6 py-5"
      style={{
        background: 'rgba(17, 17, 17, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-4 flex-nowrap">
        <span
          className="hidden min-[900px]:inline flex-shrink-0 italic"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 13,
            color: 'var(--color-text-muted)',
          }}
        >
          Add to your archive
        </span>

        {/* API type selector — minimal text tabs, the underline is the only
            active marker so the gold stays quiet */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => switchTab(t.value)}
              className={`text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
                tab === t.value ? 'text-[#D4AF6A]' : 'text-[#6B6660] hover:text-[#F2EFE9]'
              }`}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 0 4px',
                borderBottom: tab === t.value ? '2px solid #D4AF6A' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setSaved(null)
            setSaveError('')
            setQuery(e.target.value)
          }}
          className="flex-1 min-w-0 rounded-lg px-3 text-sm outline-none transition-colors bg-[#0D0D0D] border border-[#1E1E1E] focus:border-[#3A3A3A] placeholder:text-[#6B6660]"
          style={{ height: 40, color: 'var(--color-text)' }}
        />

        <button
          onClick={() => setShowManual(true)}
          className="text-xs cursor-pointer hover:bg-[var(--color-gold)] hover:text-[var(--color-background)] whitespace-nowrap rounded px-3 py-2 flex-shrink-0"
          style={{
            background: 'none',
            border: '1px solid var(--color-gold)',
            color: 'var(--color-gold)',
            transition: 'background-color 0.15s, color 0.15s',
          }}
        >
          Add manually
        </button>
      </div>

      {searching && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Searching…
        </p>
      )}

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
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No results found — try{' '}
          <button
            type="button"
            onClick={() => setShowManual(true)}
            className="cursor-pointer underline"
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-gold)' }}
          >
            adding manually
          </button>
          .
        </p>
      )}

      {saved !== null && (
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
          Added to your list.
        </p>
      )}

      {saveError && (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {saveError}
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map(result => {
            let rowKey: string
            let title: string
            let displayYear: string | null
            let posterSrc: string | null
            let subtitle: string | null = null

            if (isBookResult(result)) {
              const b = result
              rowKey      = b.key
              title       = b.title
              displayYear = b.first_publish_year ? String(b.first_publish_year) : null
              posterSrc   = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
              subtitle    = b.author_name?.[0] ?? null
            } else if (isAnimeResult(result)) {
              const a = result
              rowKey      = String(a.id)
              title       = a.title.english || a.title.romaji
              displayYear = a.startDate.year ? String(a.startDate.year) : null
              posterSrc   = a.coverImage.large ?? a.coverImage.medium ?? null
            } else if (isMangaResult(result)) {
              const mr = result
              if (mr._source === 'anilist') {
                const a = mr
                rowKey      = String(a.id)
                title       = a.title.english || a.title.romaji
                displayYear = a.startDate.year ? String(a.startDate.year) : null
                posterSrc   = a.coverImage.large ?? a.coverImage.medium ?? null
              } else {
                const m = mr
                rowKey      = m.id
                title       = m.attributes.title.en ?? Object.values(m.attributes.title)[0] ?? ''
                displayYear = m.attributes.year ? String(m.attributes.year) : null
                const coverRel = m.relationships.find(r => r.type === 'cover_art')
                posterSrc   = coverRel?.attributes?.fileName
                  ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`
                  : null
              }
            } else {
              const t = result
              rowKey      = String(t.id)
              title       = isTV(t) ? t.name : t.title
              const date  = isTV(t) ? t.first_air_date : t.release_date
              displayYear = date ? date.slice(0, 4) : null
              posterSrc   = t.poster_path ? `${TMDB_IMAGE_BASE}${t.poster_path}` : null
            }

            return (
              <li key={rowKey}>
                <button
                  onClick={() => handleSelect(result)}
                  disabled={saving}
                  className="flex items-center gap-3 w-full text-left rounded px-3 py-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                >
                  {posterSrc ? (
                    <img
                      src={posterSrc}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-14 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-14 rounded flex-shrink-0"
                      style={{ background: 'var(--color-border)' }}
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{title}</span>
                    {subtitle && (
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {subtitle}
                      </span>
                    )}
                    {displayYear && (
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {displayYear}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
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
