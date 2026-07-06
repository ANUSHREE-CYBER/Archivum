import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import MediaSearch from './components/MediaSearch'
import type { Tab } from './components/MediaSearch'
import EntryList from './components/EntryList'
import type { EditableEntry } from './components/EntryEditModal'
import SmoothCursor from './components/SmoothCursor'
import { AuroraBackground } from './components/AuroraBackground'

// Recharts (StatsDashboard's main dependency) is the largest chunk in the
// app and most sessions never open Stats — load it only when they do.
const StatsDashboard = lazy(() => import('./components/StatsDashboard'))

function StatsFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, color: '#6B6660' }}>
      Loading…
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeView, setActiveView] = useState<'library' | 'stats'>('library')
  const [typeFilter, setTypeFilter] = useState<'all' | Tab>('all')
  const [showAdd, setShowAdd] = useState(false)
  // Lifted out of EntryList so the vault header can show live counts;
  // EntryList still does the fetching and mutating through the setter
  const [entries, setEntries] = useState<EditableEntry[]>([])

  const completedCount  = entries.filter(e => e.status === 'completed').length
  const inProgressCount = entries.filter(e => e.status === 'in_progress').length
  const countLine = [
    entries.length > 0 && `${entries.length} ${entries.length === 1 ? 'title' : 'titles'}`,
    completedCount > 0 && `${completedCount} completed`,
    inProgressCount > 0 && `${inProgressCount} in progress`,
  ].filter(Boolean).join(' · ')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // Clear stale counts on sign-out so a subsequent login (same or
      // different account) never briefly flashes the previous session's
      // header numbers before the new fetch completes.
      if (!session) setEntries([])
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
      <AuroraBackground className="h-full flex-col items-stretch justify-start vault-page">
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{
            borderBottom: '1px solid var(--color-border)',
            background: 'rgba(8, 8, 8, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
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
              {/* Vault identity header — title + counts left, +Add toggle right.
                  The Add drawer slides out directly below this row. */}
              <div
                className="flex items-center justify-between gap-3 px-6"
                style={{ minHeight: 40, paddingTop: 14, marginBottom: 16 }}
              >
                <div className="flex items-baseline gap-3">
                  <h1
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: 23,
                      fontWeight: 400,
                      letterSpacing: '0.02em',
                      color: 'var(--color-text)',
                      margin: 0,
                      textShadow: '0 1px 6px rgba(8, 8, 8, 0.9)',
                    }}
                  >
                    The Vault
                  </h1>
                  {countLine && (
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                        textShadow: '0 1px 6px rgba(8, 8, 8, 0.9)',
                      }}
                    >
                      {countLine}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setShowAdd(v => !v)}
                  className="text-sm font-medium cursor-pointer flex-shrink-0"
                  style={{
                    padding: '6px 18px',
                    borderRadius: 6,
                    background: 'var(--color-gold)',
                    color: 'var(--color-background)',
                    border: 'none',
                  }}
                >
                  {showAdd ? 'Close' : '+ Add'}
                </button>
              </div>

              {/* Drawer slide: animating height 0 → auto (clipped by overflow
                  hidden) reads as the panel sliding down from under the tab row */}
              <AnimatePresence>
                {showAdd && (
                  <motion.div
                    key="add-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <MediaSearch
                      userId={session.user.id}
                      onSaved={() => setRefreshKey(k => k + 1)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <EntryList
                userId={session.user.id}
                refreshKey={refreshKey}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
                entries={entries}
                setEntries={setEntries}
              />
            </motion.div>
          ) : (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
              exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.25, ease: 'easeInOut' } }}
            >
              <Suspense fallback={<StatsFallback />}>
                <StatsDashboard userId={session.user.id} />
              </Suspense>
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
      </AuroraBackground>
    </>
  )
}

export default App
