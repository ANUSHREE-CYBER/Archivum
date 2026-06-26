import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import ManualEntryModal from './ManualEntryModal'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

type Tab = 'movie' | 'tv_show' | 'kdrama' | 'anime' | 'book' | 'manga' | 'manhwa'

const TABS: { value: Tab; label: string }[] = [
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
      }
    }
  }
`

async function searchAniList(search: string): Promise<AniListResult[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
  })
  const json = await res.json()
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
  const json = await res.json()
  return json?.data?.Page?.media ?? []
}

async function searchMangaDex(query: string): Promise<MangaDexResult[]> {
  const res = await fetch(
    `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&includes[]=cover_art&limit=10`
  )
  const json = await res.json()
  return json?.data ?? []
}

async function searchMangaWithFallback(query: string): Promise<MangaResult[]> {
  const anilist = await searchAniListManga(query)
  if (anilist.length > 0) return anilist.map(r => ({ ...r, _source: 'anilist' as const }))
  const mangadex = await searchMangaDex(query)
  return mangadex.map(r => ({ ...r, _source: 'mangadex' as const }))
}

interface Props {
  userId: string
  onSaved: () => void
}

export default function MediaSearch({ userId, onSaved }: Props) {
  const [tab, setTab]           = useState<Tab>('movie')
  const [showManual, setShowManual] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[] | AniListResult[] | OpenLibraryDoc[] | MangaResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved] = useState<number | string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setResults([])

    if (!query.trim()) return

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        if (tab === 'anime') {
          setResults(await searchAniList(query))
        } else if (tab === 'book') {
          setResults(await searchOpenLibrary(query))
        } else if (tab === 'manga' || tab === 'manhwa') {
          setResults(await searchMangaWithFallback(query))
        } else {
          const endpoint = tab === 'movie' ? 'search/movie' : 'search/tv'
          const res = await fetch(
            `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
          )
          const data = await res.json()
          setResults(data.results ?? [])
        }
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [query, tab])

  function switchTab(next: Tab) {
    setTab(next)
    setQuery('')
    setResults([])
    setSaved(null)
    setSaveError('')
  }

  async function handleSelect(result: TmdbResult | AniListResult | OpenLibraryDoc | MangaResult) {
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

    if (tab === 'anime') {
      const a = result as AniListResult
      title      = a.title.english || a.title.romaji
      year       = a.startDate.year ? String(a.startDate.year) : null
      poster_url = a.coverImage.large ?? a.coverImage.medium ?? null
      source_api = 'anilist'
      source_id  = String(a.id)
      genres     = a.genres.length > 0 ? a.genres : null
    } else if (tab === 'book') {
      const b = result as OpenLibraryDoc
      const author = b.author_name?.[0] ?? null
      title      = b.title
      year       = b.first_publish_year ? String(b.first_publish_year) : null
      poster_url = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
      source_api = 'openlibrary'
      source_id  = b.key
      metadata   = author ? { author } : undefined
    } else if (tab === 'manga' || tab === 'manhwa') {
      const mr = result as MangaResult
      if (mr._source === 'anilist') {
        const a = mr as TaggedAniList
        title      = a.title.english || a.title.romaji
        year       = a.startDate.year ? String(a.startDate.year) : null
        poster_url = a.coverImage.large ?? a.coverImage.medium ?? null
        source_api = 'anilist'
        source_id  = String(a.id)
        genres     = a.genres.length > 0 ? a.genres : null
      } else {
        const m = mr as TaggedMangaDex
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
      const t = result as TmdbResult
      title      = isTV(t) ? t.name : t.title
      const date = isTV(t) ? t.first_air_date : t.release_date
      year       = date ? date.slice(0, 4) : null
      poster_url = t.poster_path ? `${TMDB_IMAGE_BASE}${t.poster_path}` : null
      source_api = 'tmdb'
      source_id  = String(t.id)
      genres     = tmdbGenreNames(t.genre_ids ?? [], tab === 'movie')
      if (genres.length === 0) genres = null
    }

    const { error } = await supabase.from('entries').insert({
      user_id: userId,
      title,
      year,
      poster_url,
      type: tab,
      status: 'plan_to_watch',
      source_api,
      source_id,
      ...(metadata ? { metadata } : {}),
      ...(genres   ? { genres }   : {}),
    })

    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(
        tab === 'book' ? (result as OpenLibraryDoc).key :
        (tab === 'manga' || tab === 'manhwa') && (result as MangaResult)._source === 'mangadex' ? (result as TaggedMangaDex).id :
        (result as TmdbResult | AniListResult).id
      )
      setQuery('')
      setResults([])
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
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto mt-10 px-4">
      <div
        className="flex rounded overflow-hidden self-start"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => switchTab(t.value)}
            className="px-4 py-1.5 text-sm font-medium cursor-pointer"
            style={{
              background: tab === t.value ? 'var(--color-gold)' : 'var(--color-surface)',
              color: tab === t.value ? 'var(--color-background)' : 'var(--color-text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowManual(true)}
        className="text-xs self-start cursor-pointer hover:opacity-80"
        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-text-muted)' }}
      >
        Can't find it? Add manually
      </button>

      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => {
          setSaved(null)
          setSaveError('')
          setQuery(e.target.value)
        }}
        className="rounded px-3 py-2 outline-none"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
      />

      {searching && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Searching…
        </p>
      )}

      {saved !== null && (
        <p className="text-sm" style={{ color: 'var(--color-gold)' }}>
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

            if (tab === 'book') {
              const b = result as OpenLibraryDoc
              rowKey      = b.key
              title       = b.title
              displayYear = b.first_publish_year ? String(b.first_publish_year) : null
              posterSrc   = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null
              subtitle    = b.author_name?.[0] ?? null
            } else if (tab === 'anime') {
              const a = result as AniListResult
              rowKey      = String(a.id)
              title       = a.title.english || a.title.romaji
              displayYear = a.startDate.year ? String(a.startDate.year) : null
              posterSrc   = a.coverImage.large ?? a.coverImage.medium ?? null
            } else if (tab === 'manga' || tab === 'manhwa') {
              const mr = result as MangaResult
              if (mr._source === 'anilist') {
                const a = mr as TaggedAniList
                rowKey      = String(a.id)
                title       = a.title.english || a.title.romaji
                displayYear = a.startDate.year ? String(a.startDate.year) : null
                posterSrc   = a.coverImage.large ?? a.coverImage.medium ?? null
              } else {
                const m = mr as TaggedMangaDex
                rowKey      = m.id
                title       = m.attributes.title.en ?? Object.values(m.attributes.title)[0] ?? ''
                displayYear = m.attributes.year ? String(m.attributes.year) : null
                const coverRel = m.relationships.find(r => r.type === 'cover_art')
                posterSrc   = coverRel?.attributes?.fileName
                  ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.256.jpg`
                  : null
              }
            } else {
              const t = result as TmdbResult
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
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                >
                  {posterSrc ? (
                    <img
                      src={posterSrc}
                      alt=""
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
