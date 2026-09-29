import { useEffect, useMemo, useState } from 'react'
import { fetchLeaderboardAnalytics } from './supabase'

type Filter = 'yesterday' | '7d' | '30d' | '90d' | '180d' | '365d' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 3 Months' },
  { key: '180d', label: 'Last 6 Months' },
  { key: '365d', label: 'Last 1 Year' },
  { key: 'all', label: 'Overall' },
]

const GAME_LAUNCH_AT = new Date('2026-09-25T17:19:37Z')

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function getWindow(filter: Filter) {
  const now = new Date()

  if (filter === 'yesterday') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
  }

  if (filter === 'all') return { start: null, end: null }

  const days =
    filter === '7d' ? 7 :
    filter === '30d' ? 30 :
    filter === '90d' ? 90 :
    filter === '180d' ? 180 : 365

  return { start: new Date(now.getTime() - days * 86400000), end: null }
}

function getStoredUsername() {
  try {
    const raw = localStorage.getItem('highway-speedster-progress')
    if (!raw) return ''
    const saved = JSON.parse(raw)
    return typeof saved.username === 'string' ? saved.username.trim() : ''
  } catch {
    return ''
  }
}

export function LeaderboardViewer() {
  const [filter, setFilter] = useState<Filter>('all')
  const [analytics, setAnalytics] = useState<{ users: any[]; events: any[] }>({ users: [], events: [] })
  const [loading, setLoading] = useState(true)
  const [playerName, setPlayerName] = useState('')

  useEffect(() => {
    setPlayerName(getStoredUsername())

    let mounted = true

    const load = async () => {
      const data = await fetchLeaderboardAnalytics()
      if (!mounted) return
      setAnalytics(data)
      setLoading(false)
    }

    load()
    const interval = window.setInterval(load, 10000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const leaderboard = useMemo(() => {
    const { start, end } = getWindow(filter)

    const allEventByUser = analytics.events.reduce((map: Record<string, number>, event: any) => {
      map[event.username] = (map[event.username] || 0) + Number(event.seconds || 0)
      return map
    }, {})

    const overallByUser = analytics.users.reduce((map: Record<string, number>, user: any) => {
      map[user.username] = Math.max(map[user.username] || 0, Number(user.playtime_seconds || 0))
      return map
    }, {})

    Object.entries(allEventByUser).forEach(([username, seconds]) => {
      overallByUser[username] = Math.max(overallByUser[username] || 0, Number(seconds || 0))
    })

    const windowContainsEntireGameLifetime =
      filter === 'all' || (start !== null && start <= GAME_LAUNCH_AT)

    const periodByUser = analytics.events.reduce((map: Record<string, number>, event: any) => {
      const date = new Date(event.recorded_at)
      if ((!start || date >= start) && (!end || date < end)) {
        map[event.username] = (map[event.username] || 0) + Number(event.seconds || 0)
      }
      return map
    }, {})

    const source = windowContainsEntireGameLifetime ? overallByUser : periodByUser

    return Object.entries(source)
      .map(([username, seconds]) => ({ username, seconds: Number(seconds) }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [analytics, filter])

  const totalPlaytime = leaderboard.reduce((sum, user) => sum + user.seconds, 0)
  const topPlayer = leaderboard[0]
  const normalizedPlayer = playerName.trim().toLowerCase()
  const playerIndex = normalizedPlayer
    ? leaderboard.findIndex((user) => user.username.trim().toLowerCase() === normalizedPlayer)
    : -1

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white overflow-y-auto">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-gray-950/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-black">📊 HIGHWAY SPEEDSTER</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Live playtime leaderboard • view-only • refreshes every 10s</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-xl border border-green-400/20 bg-green-400/10 px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-green-300">
                View Only
              </span>
              <a
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-bold text-gray-200 hover:bg-white/10"
              >
                🏍️ Back to Game
              </a>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Players</p>
            <p className="mt-1 text-2xl font-black">{leaderboard.length}</p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Period Playtime</p>
            <p className="mt-1 text-xl font-black text-purple-300">⏱ {formatTime(totalPlaytime)}</p>
          </div>
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Top Player</p>
            <p className="mt-1 text-xl font-black text-yellow-300">{topPlayer?.username || '—'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all ${
                  filter === item.key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white/10 text-gray-400 hover:bg-white/15'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-black">🏆 Playtime Leaderboard</h2>
            <p className="text-[10px] text-gray-500">Rank is determined only by total playtime. This screen has no edit controls.</p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading live rankings…</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No players yet.</div>
          ) : (
            <div>
              {leaderboard.map((user, index) => {
                const isYou = playerIndex === index
                const rank = index + 1

                return (
                  <div
                    key={user.username}
                    className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 border-b border-white/5 ${
                      isYou
                        ? 'bg-yellow-500/15 border-l-4 border-l-yellow-400'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="w-8 sm:w-10 text-center text-base sm:text-lg font-black text-gray-300">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate font-black text-sm sm:text-base ${
                          isYou ? 'text-yellow-300' : 'text-white'
                        }`}>
                          {user.username}
                        </span>
                        {isYou && (
                          <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[9px] font-black text-yellow-300">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500">Playtime in {FILTERS.find((f) => f.key === filter)?.label}</p>
                    </div>
                    <div className="shrink-0 text-right font-black text-purple-300 text-sm sm:text-base tabular-nums">
                      {formatTime(user.seconds)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-bold text-gray-300">
            {playerName
              ? `Your game username is detected automatically as “${playerName}”. Your row is highlighted so you can see your current position.`
              : 'Open the game on this device first so your game username can be highlighted automatically.'}
          </p>
          {playerIndex >= 0 && (
            <p className="mt-2 text-[10px] text-gray-500">
              Your current rank is #{playerIndex + 1} of {leaderboard.length}.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
