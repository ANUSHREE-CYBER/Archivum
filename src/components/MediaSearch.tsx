import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92'

type Tab = 'movie' | 'tv_show' | 'kdrama'

const TABS: { value: Tab; label: string }[] = [
  { value: 'movie',   label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'kdrama',  label: 'Kdrama' },
]

interface TmdbMovie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

interface TmdbTV {
  id: number
  name: string
  first_air_date: string
  poster_path: string | null
}

type TmdbResult = TmdbMovie | TmdbTV

function isTV(r: TmdbResult): r is TmdbTV {
  return 'name' in r
}

interface Props {
  userId: string
  onSaved: () => void
}

export default function MediaSearch({ userId, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('movie')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
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
        const endpoint = tab === 'movie' ? 'search/movie' : 'search/tv'
        const res = await fetch(
          `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
        )
        const data = await res.json()
        setResults(data.results ?? [])
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

  async function handleSelect(result: TmdbResult) {
    if (saving) return
    setSaving(true)
    setSaved(null)
    setSaveError('')

    const title = isTV(result) ? result.name : result.title
    const date = isTV(result) ? result.first_air_date : result.release_date
    const year = date ? date.slice(0, 4) : null

    const poster_url = result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null

    const { error } = await supabase.from('entries').insert({
      user_id: userId,
      title,
      year,
      poster_url,
      type: tab,
      status: 'plan_to_watch',
      source_api: 'tmdb',
      source_id: String(result.id),
    })

    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(result.id)
      setQuery('')
      setResults([])
      onSaved()
    }
  }

  const placeholder = tab === 'movie' ? 'Search for a movie…' : 'Search for a TV show…'

  return (
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
            const title = isTV(result) ? result.name : result.title
            const date  = isTV(result) ? result.first_air_date : result.release_date
            return (
              <li key={result.id}>
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
                  {result.poster_path ? (
                    <img
                      src={`${TMDB_IMAGE_BASE}${result.poster_path}`}
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
                    {date && (
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {date.slice(0, 4)}
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
  )
}
