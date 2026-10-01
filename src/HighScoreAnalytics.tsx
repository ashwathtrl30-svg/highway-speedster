import { useEffect, useMemo, useState } from 'react'
import { fetchHighScoreLeaderboard } from './supabase'

type Filter = 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Overall' },
]

type Player = {
  username: string
  high_score: number
  is_me?: boolean
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

function formatScore(score: number) {
  return Math.max(0, Math.floor(score || 0)).toLocaleString()
}

export function HighScoreAnalytics() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [playerName, setPlayerName] = useState('')

  const filter: Filter = 'all'

  useEffect(() => {
    setPlayerName(getStoredUsername())

    let mounted = true

    const load = async () => {
      const data = await fetchHighScoreLeaderboard()
      if (!mounted) return
      setPlayers(data)
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
    return players
      .map((player) => ({
        isMe: Boolean(player.is_me),
        username: player.username,
        highScore: Math.max(0, Number(player.high_score || 0)),
      }))
      .sort((a, b) => {
        if (b.highScore !== a.highScore) return b.highScore - a.highScore
        return a.username.localeCompare(b.username)
      })
  }, [players])

  const topPlayer = leaderboard[0]
  const normalizedPlayer = playerName.trim().toLowerCase()
  const playerIndex = leaderboard.findIndex((user: any) => user.isMe)
  const fallbackPlayerIndex = playerIndex >= 0 ? playerIndex : normalizedPlayer
    ? leaderboard.findIndex((user) => user.username.trim().toLowerCase() === normalizedPlayer)
    : -1

  return (
    <div className="hs-scroll-page bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-gray-950/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-black">🏆 HIGHWAY SPEEDSTER</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Live high-score leaderboard • view-only • refreshes every 10s</p>
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
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Top High Score</p>
            <p className="mt-1 text-xl font-black text-yellow-300 tabular-nums">
              🏆 {formatScore(topPlayer?.highScore || 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Top Player</p>
            <p className="mt-1 text-xl font-black text-purple-300">{topPlayer?.username || '—'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className="shrink-0 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-all bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-black">🏆 High Score Leaderboard</h2>
            <p className="text-[10px] text-gray-500">
              Rank is determined only by highest score. This screen has no edit controls.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">Loading live rankings…</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No players yet.</div>
          ) : (
            <div>
              {leaderboard.map((user, index) => {
                const isYou = (playerIndex >= 0 ? playerIndex : fallbackPlayerIndex) === index
                const rank = index + 1

                return (
                  <div
                    key={`${user.username}-${index}`}
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
                      <p className="text-[10px] text-gray-500">High score in Overall</p>
                    </div>
                    <div className="shrink-0 text-right font-black text-yellow-300 text-sm sm:text-base tabular-nums">
                      {formatScore(user.highScore)}
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
