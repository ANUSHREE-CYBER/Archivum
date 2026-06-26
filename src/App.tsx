import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import MediaSearch from './components/MediaSearch'
import EntryList from './components/EntryList'
import StatsDashboard from './components/StatsDashboard'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeView, setActiveView] = useState<'library' | 'stats'>('library')

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
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {(['library', 'stats'] as const).map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className="text-sm cursor-pointer"
              style={{
                padding: '5px 16px',
                borderRadius: 6,
                border: 'none',
                fontWeight: activeView === view ? 500 : 400,
                color: activeView === view ? '#080808' : 'var(--color-text-muted)',
                backgroundColor: activeView === view ? 'var(--color-gold)' : 'transparent',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              {view === 'library' ? 'Library' : 'Stats'}
            </button>
          ))}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Log out
        </button>
      </header>
      <main className="flex-1 overflow-y-auto">
        {activeView === 'library' ? (
          <>
            <MediaSearch userId={session.user.id} onSaved={() => setRefreshKey(k => k + 1)} />
            <EntryList userId={session.user.id} refreshKey={refreshKey} />
          </>
        ) : (
          <StatsDashboard userId={session.user.id} />
        )}
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
