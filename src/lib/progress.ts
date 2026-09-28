// Which metadata fields hold an entry's progress, per medium. Books store
// currentPage/totalPages, comics chapter/totalChapters, serials (TV, kdrama,
// anime) episode/totalEpisodes. A movie has no unit of progress, so it gets
// no +1 and no bar. Shared by the card progress bar, the Continue stage and
// the edit modal so all three read (and write) the same keys.
export interface ProgressKeys {
  current: string
  total: string
  unit: 'page' | 'chapter' | 'episode'
}

export function progressKeys(type: string): ProgressKeys | null {
  if (type === 'movie') return null
  if (type === 'book') return { current: 'currentPage', total: 'totalPages', unit: 'page' }
  if (type === 'manga' || type === 'manhwa') return { current: 'chapter', total: 'totalChapters', unit: 'chapter' }
  return { current: 'episode', total: 'totalEpisodes', unit: 'episode' }
}

export interface ProgressInfo extends ProgressKeys {
  currentValue: number | null
  totalValue: number | null
  // 0–100, or null without both a current and a total
  percent: number | null
}

const positive = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null)

export function readProgress(entry: { type: string; metadata: Record<string, unknown> | null }): ProgressInfo | null {
  const keys = progressKeys(entry.type)
  if (!keys) return null
  const meta = entry.metadata ?? {}
  const currentValue = positive(meta[keys.current])
  const totalValue = positive(meta[keys.total])
  const percent = currentValue !== null && totalValue !== null
    ? Math.min(100, (currentValue / totalValue) * 100)
    : null
  return { ...keys, currentValue, totalValue, percent }
}

// "Episode 16 of 26", "Chapter 40", or null when nothing has been logged
export function progressLabel(info: ProgressInfo): string | null {
  if (info.currentValue === null) return null
  const unit = info.unit[0].toUpperCase() + info.unit.slice(1)
  return info.totalValue !== null
    ? `${unit} ${info.currentValue} of ${info.totalValue}`
    : `${unit} ${info.currentValue}`
}
