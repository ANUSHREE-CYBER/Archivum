import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MediaSearch from './components/MediaSearch'
import EntryList from './components/EntryList'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  if (!session) return <LoginPage />

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex justify-end px-6 py-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Log out
        </button>
      </header>
      <main className="flex-1 overflow-y-auto">
        <MediaSearch userId={session.user.id} onSaved={() => setRefreshKey(k => k + 1)} />
        <EntryList userId={session.user.id} refreshKey={refreshKey} />
      </main>
      <footer
        className="px-6 py-2 text-xs text-center"
        style={{
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        This product uses the TMDB API but is not endorsed or certified by TMDB. Additional data from AniList and Open Library.
      </footer>
    </div>
  )
}

export default App
