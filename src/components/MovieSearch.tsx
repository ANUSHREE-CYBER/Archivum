import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w92'

interface TmdbMovie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

interface Props {
  userId: string
  onSaved: () => void
}

export default function MovieSearch({ userId, onSaved }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
        )
        const data = await res.json()
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [query])

  async function handleSelect(movie: TmdbMovie) {
    if (saving) return
    setSaving(true)
    setSaved(null)
    setSaveError('')

    const year = movie.release_date ? movie.release_date.slice(0, 4) : null
    const poster_url = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null

    const { error } = await supabase.from('entries').insert({
      user_id: userId,
      title: movie.title,
      year,
      poster_url,
      type: 'movie',
      status: 'plan_to_watch',
      source_api: 'tmdb',
      source_id: String(movie.id),
    })

    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(movie.id)
      setQuery('')
      setResults([])
      onSaved()
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto mt-10 px-4">
      <input
        type="text"
        placeholder="Search for a movie…"
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
          {results.map(movie => (
            <li key={movie.id}>
              <button
                onClick={() => handleSelect(movie)}
                disabled={saving}
                className="flex items-center gap-3 w-full text-left rounded px-3 py-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                {movie.poster_path ? (
                  <img
                    src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
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
                  <span className="font-medium">{movie.title}</span>
                  {movie.release_date && (
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {movie.release_date.slice(0, 4)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
