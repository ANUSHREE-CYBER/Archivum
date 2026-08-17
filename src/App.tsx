import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import MediaSearch from './components/MediaSearch'
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
  const [showAdd, setShowAdd] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
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

  // Hysteresis band: collapse on the way down at 96px, expand on the way back
  // up at 40px. setState with an unchanged boolean is a no-op in React, so this
  // costs one comparison per scroll event and re-renders only on a real flip.
  function handleVaultScroll(e: React.UIEvent<HTMLElement>) {
    const y = e.currentTarget.scrollTop
    setHeaderCollapsed(prev => (prev ? y > 40 : y > 96))
  }

  // The +Add button rides along in the collapsed header, but the drawer it
  // opens sits at the top of the page — tapping it from 2000px down would
  // otherwise open a panel nowhere near the viewport. Opening returns to the
  // top; closing leaves the scroll position alone.
  function handleToggleAdd() {
    setShowAdd(open => {
      if (!open) {
        mainRef.current?.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }
      return !open
    })
  }

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
            border: '1px solid var(--color-accent)',
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
                onClick={() => {
                  setActiveView(view)
                  // The two views share one scroll container. Switching swaps
                  // the content out from under it, so reset both the position
                  // and the collapse state rather than landing in the new view
                  // mid-scroll with a header collapsed for a page that's gone.
                  mainRef.current?.scrollTo({ top: 0 })
                  setHeaderCollapsed(false)
                }}
                className="text-base cursor-pointer"
                style={{
                  padding: '7px 20px',
                  borderRadius: 6,
                  border: 'none',
                  fontWeight: activeView === view ? 600 : 500,
                  letterSpacing: '0.01em',
                  color: activeView === view ? '#080808' : 'var(--color-text)',
                  backgroundColor: activeView === view ? 'var(--color-accent)' : 'transparent',
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
        {/* <main> is the scroll container (not the window), so the collapse
            threshold is read from here and handed down rather than measured
            inside EntryList. Two thresholds, not one: collapsing shortens the
            header, which shortens the page, and a single threshold would sit
            right where that shrink can bounce the content back across it. */}
        <main ref={mainRef} className="flex-1 overflow-y-auto" onScroll={handleVaultScroll}>
          <AnimatePresence mode="wait">
          {activeView === 'library' ? (
            <motion.div
              key="library"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
              exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.25, ease: 'easeInOut' } }}
            >
              {/* The identity row, the filter controls and the Add toggle are
                  now one sticky header, assembled inside EntryList (the filter
                  state lives there). App still owns the drawer and hands it
                  down to be rendered directly under that row. */}
              <EntryList
                userId={session.user.id}
                refreshKey={refreshKey}
                entries={entries}
                setEntries={setEntries}
                countLine={countLine}
                showAdd={showAdd}
                onToggleAdd={handleToggleAdd}
                collapsed={headerCollapsed}
                addDrawer={
                  /* Drawer slide: animating height 0 → auto (clipped by
                     overflow hidden) reads as the panel sliding down from
                     under the header row */
                  <AnimatePresence>
                    {showAdd && (
                      <motion.div
                        key="add-panel"
                        className="vault-drawer"
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
                }
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
