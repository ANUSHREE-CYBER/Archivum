import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

interface Entry {
  id: string
  type: string
  status: string
  rating: number | null
  year: number | null
  genres: string[] | null
}

const STATUS_LABELS: Record<string, string> = {
  plan_to_watch: 'Plan to Watch',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

const TYPE_LABELS: Record<string, string> = {
  movie: 'Movie',
  tv_show: 'TV Show',
  kdrama: 'K-Drama',
  anime: 'Anime',
  book: 'Book',
  manga: 'Manga',
  manhwa: 'Manhwa',
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#4CAF82',
  in_progress: '#D4AF6A',
  plan_to_watch: '#8B7355',
  on_hold: '#6B6660',
  dropped: '#C0392B',
}

const WARM = ['#D4AF6A', '#C49A5A', '#B88848', '#8B6840', '#E8C87A', '#A07848', '#F0D890', '#6B5030']

const TT_STYLE: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #1E1E1E',
  color: '#F2EFE9',
  borderRadius: '6px',
  fontSize: '13px',
  padding: '6px 10px',
}

const TICK = { fill: '#6B6660', fontSize: 12 }

const card: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #1E1E1E',
  borderRadius: 8,
  padding: 20,
}

const chartLabel: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '0.75rem',
  color: '#6B6660',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

export default function StatsDashboard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('entries')
      .select('id, type, status, rating, year, genres')
      .eq('user_id', userId)
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [userId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, color: '#6B6660' }}>
        Loading…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 10, color: '#6B6660' }}>
        <p style={{ fontSize: '1.05rem', margin: 0, color: '#F2EFE9' }}>No entries yet.</p>
        <p style={{ fontSize: '0.875rem', margin: 0 }}>Add some media to your library to see stats here.</p>
      </div>
    )
  }

  // summary
  const totalCompleted = entries.filter(e => e.status === 'completed').length
  const rated = entries.filter(e => e.rating != null)
  const avgRating = rated.length > 0
    ? (rated.reduce((s, e) => s + e.rating!, 0) / rated.length).toFixed(1)
    : '—'

  // status data
  const statusCounts: Record<string, number> = {}
  for (const e of entries) statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
  const statusData = Object.entries(statusCounts)
    .map(([key, value]) => ({ key, name: STATUS_LABELS[key] ?? key, value }))

  // type data
  const typeCounts: Record<string, number> = {}
  for (const e of entries) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1
  const typeData = Object.entries(typeCounts)
    .map(([key, value]) => ({ name: TYPE_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)

  // year data
  const yearCounts: Record<string, number> = {}
  for (const e of entries) if (e.year != null) yearCounts[e.year] = (yearCounts[e.year] ?? 0) + 1
  const yearData = Object.entries(yearCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Number(a.name) - Number(b.name))

  // genre data
  const genreCounts: Record<string, number> = {}
  for (const e of entries)
    if (e.genres) for (const g of e.genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1
  const genreData = Object.entries(genreCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const noDataMsg = (msg: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: '#6B6660', fontSize: '0.875rem' }}>
      {msg}
    </div>
  )

  return (
    <div style={{ padding: '36px 24px', maxWidth: 980, margin: '0 auto' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
        {[
          { label: 'Total Entries', value: entries.length },
          { label: 'Completed', value: totalCompleted },
          { label: 'Avg Rating', value: avgRating },
        ].map(({ label, value }) => (
          <div key={label} style={{
            ...card,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '28px 16px',
          }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 600, color: '#D4AF6A', lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: '0.78rem', marginTop: 8, color: '#6B6660', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Status donut */}
        <div style={card}>
          <p style={chartLabel}>Status Breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={88}
                dataKey="value"
                stroke="none"
              >
                {statusData.map(entry => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? '#8B7355'} />
                ))}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', justifyContent: 'center', marginTop: 10 }}>
            {statusData.map(entry => (
              <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_COLORS[entry.key] ?? '#8B7355', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: '#6B6660' }}>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type bar */}
        <div style={card}>
          <p style={chartLabel}>By Type</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={typeData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" vertical={false} />
              <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(212,175,106,0.06)' }} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {typeData.map((_, i) => <Cell key={i} fill={WARM[i % WARM.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year bar */}
        <div style={card}>
          <p style={chartLabel}>Entries by Year</p>
          {yearData.length === 0 ? noDataMsg('No year data available') : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={yearData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" vertical={false} />
                <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(212,175,106,0.06)' }} />
                <Bar dataKey="value" name="Entries" fill="#D4AF6A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Genres horizontal bar */}
        <div style={card}>
          <p style={chartLabel}>Top Genres</p>
          {genreData.length === 0 ? noDataMsg('No genre data available') : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={genreData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" horizontal={false} />
                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={76} />
                <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'rgba(212,175,106,0.06)' }} />
                <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                  {genreData.map((_, i) => <Cell key={i} fill={WARM[i % WARM.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
