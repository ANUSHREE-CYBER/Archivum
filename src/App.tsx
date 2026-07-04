import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage' // kept for reference
import MediaSearch, { TABS } from './components/MediaSearch'
import type { Tab } from './components/MediaSearch'
import EntryList from './components/EntryList'
import StatsDashboard from './components/StatsDashboard'
import SmoothCursor from './components/SmoothCursor'
import Meteors from './components/Meteors'

const TYPE_FILTER_TABS: { value: 'all' | Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  ...TABS,
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeView, setActiveView] = useState<'library' | 'stats'>('library')
  const [typeFilter, setTypeFilter] = useState<'all' | Tab>('all')
  const [showAdd, setShowAdd] = useState(false)

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

  if (!session) return <LandingPage />

  return (
    <>
      <SmoothCursor />
      <Toaster
        position="bottom-right"
        duration={3000}
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-gold)',
            color: 'var(--color-text)',
          },
        }}
      />
      <div className="flex flex-col h-full vault-page">
        <Meteors number={35} />
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {(['library', 'stats'] as const).map(view => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className="text-base cursor-pointer"
                style={{
                  padding: '7px 20px',
                  borderRadius: 6,
                  border: 'none',
                  fontWeight: activeView === view ? 600 : 500,
                  letterSpacing: '0.01em',
                  color: activeView === view ? '#080808' : 'var(--color-text)',
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
          <AnimatePresence mode="wait">
          {activeView === 'library' ? (
            <motion.div
              key="library"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
              exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.25, ease: 'easeInOut' } }}
            >
              <div
                className="flex items-center justify-between gap-3 px-6 py-3 flex-wrap"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex gap-1.5 flex-wrap">
                  {TYPE_FILTER_TABS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTypeFilter(t.value)}
                      className="text-xs cursor-pointer"
                      style={{
                        padding: '4px 11px',
                        borderRadius: 999,
                        border: '1px solid var(--color-border)',
                        fontWeight: typeFilter === t.value ? 500 : 400,
                        color: typeFilter === t.value ? 'var(--color-text)' : 'var(--color-text-muted)',
                        background: typeFilter === t.value ? 'var(--color-border)' : 'transparent',
                        transition: 'background-color 0.15s, color 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAdd(v => !v)}
                  className="text-sm font-medium cursor-pointer flex-shrink-0"
                  style={{
                    padding: '6px 18px',
                    borderRadius: 6,
                    background: showAdd ? 'var(--color-surface)' : 'var(--color-gold)',
                    color: showAdd ? 'var(--color-text)' : 'var(--color-background)',
                    border: showAdd ? '1px solid var(--color-border)' : 'none',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  {showAdd ? 'Close' : '+ Add'}
                </button>
              </div>

              {showAdd && (
                <MediaSearch
                  userId={session.user.id}
                  onSaved={() => setRefreshKey(k => k + 1)}
                  onClose={() => setShowAdd(false)}
                />
              )}

              <EntryList userId={session.user.id} refreshKey={refreshKey} typeFilter={typeFilter} />
            </motion.div>
          ) : (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
              exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.25, ease: 'easeInOut' } }}
            >
              <StatsDashboard userId={session.user.id} />
            </motion.div>
          )}
          </AnimatePresence>
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
    </>
  )
}

export default App
