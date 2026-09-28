import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import MediaSearch from './components/MediaSearch'
import EntryList from './components/EntryList'
import type { EditableEntry } from './components/EntryEditModal'
import RingCursor from './components/RingCursor'
import QuietWallBackground from './components/QuietWallBackground'

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
  // Lifted out of EntryList so the backdrop can build its poster wall;
  // EntryList still does the fetching and mutating through the setter
  const [entries, setEntries] = useState<EditableEntry[]>([])

  // The backdrop's poster wall is built from the user's own posters
  const backdropPosters = useMemo(
    () => entries.flatMap(e => (e.poster_url ? [e.poster_url] : [])),
    [entries],
  )

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

  if (!session) return (
    <>
      <RingCursor />
      <LandingPage />
    </>
  )

  return (
    <>
      <RingCursor />
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
      <div className="flex h-full flex-col text-[#F2EFE9] vault-page">
        <QuietWallBackground posters={backdropPosters} scrollRef={mainRef} />
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-wordmark">A<span className="app-wordmark-sc">RCHIVUM.</span></span>
            {/* One segmented control. The rose pill is a single element that
                slides between the two buttons (left 4 → 100), so switching
                reads as one thing moving rather than two buttons swapping
                colours. The buttons sit above it and only change text colour. */}
            <div className="view-switch" role="tablist" aria-label="View">
              <span
                aria-hidden="true"
                className="view-switch-indicator"
                style={{ left: activeView === 'library' ? 4 : 100 }}
              />
              {(['library', 'stats'] as const).map(view => (
                <button
                  key={view}
                  role="tab"
                  aria-selected={activeView === view}
                  onClick={() => {
                    setActiveView(view)
                    // The two views share one scroll container. Switching swaps
                    // the content out from under it, so reset both the position
                    // and the collapse state rather than landing in the new view
                    // mid-scroll with a header collapsed for a page that's gone.
                    mainRef.current?.scrollTo({ top: 0 })
                    setHeaderCollapsed(false)
                  }}
                  className={`view-switch-btn cursor-pointer${activeView === view ? ' is-active' : ''}`}
                >
                  {view === 'library' ? 'Library' : 'Stats'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="app-logout cursor-pointer"
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
      </div>
    </>
  )
}

export default App
