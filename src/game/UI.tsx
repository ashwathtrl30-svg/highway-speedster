import { useEffect, useRef, useState } from 'react'
import { useGameStore, actions, BIKES, CARS, BIKE_SKINS, getState, type Bike, type Car, type BikeSkin, type GameData } from './store'
import { fetchAllAnalytics, fetchMyPlaytimeRank } from '../supabase'
import { HighScoreAnalytics } from '../HighScoreAnalytics'

// ============== LOADING SCREEN ==============
export function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setTimeout(() => setDone(true), 300)
          return 100
        }
        return p + Math.random() * 15 + 5
      })
    }, 100)
    return () => clearInterval(interval)
  }, [])

  if (done) return null

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black z-[100]">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
          HIGHWAY SPEEDSTER
        </h1>
        <p className="text-gray-500 text-xs mb-6">Loading assets...</p>
        
        <div className="w-64 sm:w-80 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="hs-progress-fill h-full origin-left rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
            style={{ transform: `scaleX(${Math.min(100, progress) / 100})` }}
          />
        </div>
      </div>
    </div>
  )
}

// ============== USERNAME INPUT ==============
export function UsernameInput() {
  const state = useGameStore()
  const [inputValue, setInputValue] = useState('')

  if (state.username) return null

  const handleSubmit = () => {
    if (inputValue.trim()) {
      actions.setUsername(inputValue.trim())
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm z-[90]">
      <div className="text-center px-4 max-w-md w-full">
        <div className="text-6xl mb-4">🏍️</div>
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 mb-2">
          HIGHWAY
        </h1>
        <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 mb-6">
          SPEEDSTER
        </h1>
        
        <p className="text-gray-300 text-sm sm:text-base mb-6">Enter your name to start racing!</p>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Your name..."
          maxLength={20}
          className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white text-center text-lg font-bold placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 transition-all"
          autoFocus
        />
        
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          className="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg py-3 rounded-xl shadow-lg shadow-green-500/25 active:scale-95 transition-all"
        >
          🏁 START RACING
        </button>
      </div>
    </div>
  )
}

// ============== HUD ==============
export function HUD() {
  const state = useGameStore()
  const previousCoinsRef = useRef(state.runCoins)
  const [coinBump, setCoinBump] = useState(false)

  useEffect(() => {
    if (state.runCoins > previousCoinsRef.current) {
      setCoinBump(true)
      const timer = window.setTimeout(() => setCoinBump(false), 180)
      previousCoinsRef.current = state.runCoins
      return () => window.clearTimeout(timer)
    }
    previousCoinsRef.current = state.runCoins
  }, [state.runCoins])

  if (state.gameState !== 'playing') return null

  const magnetSeconds = state.magnetActive
    ? state.magnetTimer
    : state.magnet2xActive
    ? state.magnet2xTimer
    : 0

  const magnetMax = 10
  const magnetProgress = Math.max(0, Math.min(1, magnetSeconds / magnetMax))

  return (
    <div
      className="hs-screen absolute inset-0 pointer-events-none select-none z-20 text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <style>{`
        @keyframes hsHudCoinBump {
          0% { transform: scale(1); }
          45% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes hsHudPulse {
          0%,100% { opacity: .72; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Top-left: score first, then coins. Panels match garage/menu surfaces. */}
      <div className="absolute left-2.5 sm:left-4 top-2.5 sm:top-4 flex flex-col gap-2">
        <div className="hs-panel rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-xl shadow-xl shadow-black/20">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Score
          </div>
          <div
            key={`score-${Math.floor(state.score / 100)}`}
            className="hs-score-update mt-0.5 text-xl sm:text-3xl font-black tabular-nums leading-none text-white"
          >
            {state.score.toLocaleString()}
          </div>
        </div>

        <div
          className={`inline-flex w-fit items-center gap-2 hs-card rounded-xl px-3 py-1.5 sm:px-3.5 backdrop-blur-xl transition-transform ${
            coinBump ? 'shadow-lg shadow-amber-400/15' : ''
          }`}
          style={coinBump ? { animation: 'hsHudCoinBump 180ms ease-out' } : undefined}
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" className="text-amber-300" />
            <path d="M12 7.5v9M9.3 9.2h4.1a1.8 1.8 0 0 1 0 3.6H10.6a1.8 1.8 0 0 0 0 3.6H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-amber-100" />
          </svg>
          <span className="text-sm sm:text-base font-black tabular-nums text-amber-200">
            {state.runCoins.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Top-right: speed and pause remain easy to reach. */}
      <div className="absolute right-2.5 sm:right-4 top-2.5 sm:top-4 flex flex-col items-end gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#080a0d]/78 px-3 py-2.5 sm:px-4 sm:py-3 text-right backdrop-blur-xl shadow-xl shadow-black/20">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
            Speed
          </div>
          <div className="mt-0.5 text-xl sm:text-3xl font-black tabular-nums leading-none">
            <span className="text-white">{Math.floor(state.speed)}</span>
            <span className="ml-1 text-[10px] sm:text-xs font-bold text-white/45">km/h</span>
          </div>
        </div>

        <button
          onClick={() => actions.setGameState('paused')}
          className="hs-btn hs-btn-secondary pointer-events-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 backdrop-blur-xl shadow-lg transition-all hover:bg-white/[0.09] active:scale-95"
          aria-label="Pause game"
        >
          <svg className="h-4 w-4 sm:h-4.5 sm:w-4.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" />
            <rect x="14" y="6" width="3" height="12" rx="1" fill="currentColor" />
          </svg>
          <span className="text-[10px] sm:text-xs font-black tracking-wide">PAUSE</span>
        </button>
      </div>

      {/* Combo */}
      {state.combo > 0 && (
        <div className="absolute left-1/2 top-[11.5%] -translate-x-1/2">
          <div className="rounded-full border border-amber-300/25 bg-[#111318]/82 px-3 py-1.5 sm:px-4 backdrop-blur-xl shadow-lg shadow-orange-500/15">
            <span className="text-[10px] sm:text-xs font-black tracking-wide text-amber-200">
              <svg className="mr-1 inline h-3.5 w-3.5 align-[-2px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M13 2 6.5 12h4L9 22l8.5-12h-4L13 2Z" fill="currentColor" />
              </svg>
              NEAR MISS ×{state.combo}
            </span>
          </div>
        </div>
      )}

      {/* Active power-ups: real timing values only. Shield has no remaining timer in store. */}
      <div
        key={`${state.magnetActive ? "m" : ""}${state.magnet2xActive ? "m2" : ""}${state.multiplierActive ? (state.multiplier4x ? "x4" : "x2") : ""}${state.shieldActive ? "s" : ""}`}
        className="hs-powerup-active absolute left-1/2 top-[18%] -translate-x-1/2 flex max-w-[calc(100%-120px)] flex-wrap justify-center gap-2"
      >
        {(state.magnetActive || state.magnet2xActive) && (
          <div className="min-w-[116px] rounded-2xl border border-cyan-300/20 bg-[#071117]/84 px-2.5 py-2 backdrop-blur-xl shadow-lg shadow-cyan-500/10">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-cyan-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 4v6a5 5 0 0 0 10 0V4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M5 4h4M15 4h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/55">
                  {state.magnet2xActive ? '2× Magnet' : 'Magnet'}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="hs-progress-fill h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-200"
                    style={{ transform: `scaleX(${magnetProgress})` }}
                  />
                </div>
              </div>
              <span className="text-xs font-black tabular-nums text-cyan-100">
                {Math.ceil(magnetSeconds)}s
              </span>
            </div>
          </div>
        )}

        {state.multiplierActive && (
          <div className="rounded-2xl border border-amber-300/20 bg-[#151006]/84 px-2.5 py-2 backdrop-blur-xl shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-amber-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m12 3 2.8 5.4 5.9.9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9-4.3-4.2 5.9-.9L12 3Z" fill="currentColor" />
              </svg>
              <span className="text-[10px] sm:text-xs font-black text-amber-100">
                {state.multiplier4x ? '4×' : '2×'}
              </span>
              <span className="text-xs font-black tabular-nums text-white">
                {Math.ceil(state.multiplierTimer)}s
              </span>
            </div>
          </div>
        )}

        {state.shieldActive && (
          <div className="rounded-2xl border border-emerald-300/20 bg-[#07120d]/84 px-2.5 py-2 backdrop-blur-xl shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-emerald-200" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 19 6v5.3c0 4.2-2.8 7.9-7 9.2-4.2-1.3-7-5-7-9.2V6l7-3Z" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="1.8" />
                <path d="m8.7 12.2 2.1 2.1 4.7-4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100/55">
                  Shield
                </div>
                <div className="text-xs font-black text-emerald-100">
                  {state.shieldCount} {state.shieldCount === 1 ? 'charge' : 'charges'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatsScreen({ onBack }: { onBack: () => void }) {
  const state = useGameStore()
  type Filter = '7d' | '30d' | '90d' | '180d' | '365d' | 'all'
  const [timeFilter, setTimeFilter] = useState<Filter>('all')
  const [analytics, setAnalytics] = useState<{ users: any[]; events: any[] }>({ users: [], events: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const data = await fetchAllAnalytics()
      setAnalytics(data)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
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

  const filterLabel: Record<Filter, string> = {    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 3 Months',
    '180d': 'Last 6 Months',
    '365d': 'Last 1 Year',
    all: 'Overall'
  }

  const getStartDate = (filter: Filter): { start: Date | null; end: Date | null } => {
    const now = new Date()
    if (filter === 'all') return { start: null, end: null }
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : filter === '90d' ? 90 : filter === '180d' ? 180 : 365
    return { start: new Date(now.getTime() - days * 86400000), end: null }
  }

  const { start, end } = getStartDate(timeFilter)

  // The repository/game was created on September 25, 2026. Until a time-window
  // moves past that date, every duration filter contains the game's full lifetime.
  // Use the preserved cumulative totals for those windows so they cannot be lower
  // than Overall simply because the event log was introduced later.
  const GAME_LAUNCH_AT = new Date('2026-09-25T17:19:37Z')
  const windowContainsEntireGameLifetime =
    timeFilter === 'all' || (start !== null && start <= GAME_LAUNCH_AT)

  const filteredEvents = analytics.events.filter((event: any) => {
    const date = new Date(event.recorded_at)
    return (!start || date >= start) && (!end || date < end)
  })

  const periodByUser = filteredEvents.reduce((map: Record<string, number>, event: any) => {
    map[event.username] = (map[event.username] || 0) + Number(event.seconds || 0)
    return map
  }, {})

  // Overall must not undercount the event history. Playtime events are written
  // in 30-second batches and the cumulative user row can briefly lag behind.
  // Reconcile both sources without double-counting by taking the larger total
  // for each user. This preserves all existing cumulative/legacy playtime.
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

  const leaderboard = Object.entries(windowContainsEntireGameLifetime ? overallByUser : periodByUser)
    .map(([username, seconds]) => ({ username, seconds }))
    .sort((a, b) => b.seconds - a.seconds)

  const totalPlaytime = leaderboard.reduce((sum, user) => sum + user.seconds, 0)
  const totalUsers = analytics.users.length

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col bg-gradient-to-b from-gray-900 via-gray-950 to-black overflow-y-auto">
      <div className="flex items-center p-3 sm:p-4 border-b border-white/5 sticky top-0 bg-gray-950/95 backdrop-blur z-10">
        <button onClick={onBack} className="text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 flex items-center justify-center rounded-lg bg-white/5">←</button>
        <div className="ml-3">
          <h2 className="text-lg sm:text-xl font-bold text-white">📊 Analytics</h2>
          <p className="text-[10px] text-gray-500">Live Supabase analytics • refreshes every 10s</p>
        </div>
      </div>

      <div className="p-3 sm:p-4 border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(filterLabel) as Filter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all ${
                timeFilter === filter
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {filterLabel[filter]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4">
        <div className="rounded-xl p-3 bg-white/[0.04] border border-white/10">
          <p className="text-gray-500 text-[10px] uppercase">Players</p>
          <p className="text-white text-xl font-black">{totalUsers}</p>
        </div>
        <div className="rounded-xl p-3 bg-purple-500/10 border border-purple-500/20">
          <p className="text-gray-500 text-[10px] uppercase">Period Playtime</p>
          <p className="text-purple-400 text-lg font-black">⏱ {formatTime(totalPlaytime)}</p>
        </div>
        <div className="rounded-xl p-3 bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-gray-500 text-[10px] uppercase">Top Player</p>
          <p className="text-yellow-400 text-lg font-black truncate">{leaderboard[0]?.username || '—'}</p>
        </div>
        <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20">
          <p className="text-gray-500 text-[10px] uppercase">Filter</p>
          <p className="text-green-400 text-sm font-bold">{filterLabel[timeFilter]}</p>
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-6">
        <h3 className="text-white font-bold text-base sm:text-lg mb-3">🏆 Playtime Leaderboard</h3>
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading analytics...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">No playtime recorded for this period.</p>
            <p className="text-gray-600 text-xs mt-2">Play for at least a few seconds, then finish the run.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((user, index) => (
              <div
                key={user.username}
                className={`rounded-xl p-3 sm:p-4 border ${
                  user.username === state.username
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/40'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 text-center font-black text-lg ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold truncate">{user.username}</span>
                        {user.username === state.username && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">YOU</span>}
                      </div>
                      <p className="text-gray-400 text-xs mt-1">Playtime in {filterLabel[timeFilter]}</p>
                    </div>
                  </div>
                  <div className="text-purple-400 font-black text-sm sm:text-base whitespace-nowrap">{formatTime(user.seconds)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============== MAIN MENU ==============
function PlaytimeRankCard({ username }: { username: string }) {
  const [rank, setRank] = useState<{ rank: number; playtimeSeconds: number; totalPlayers: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!username.trim()) return

    fetchMyPlaytimeRank().then((result) => {
      if (!cancelled) setRank(result)
    })

    return () => {
      cancelled = true
    }
  }, [username])

  if (!rank) return null

  const hours = Math.floor(rank.playtimeSeconds / 3600)
  const minutes = Math.floor((rank.playtimeSeconds % 3600) / 60)
  const seconds = rank.playtimeSeconds % 60
  const time = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`

  return (
    <div className="relative z-10 mb-4 rounded-2xl border border-yellow-400/30 bg-black/40 px-5 py-3 text-center backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-yellow-300">Your Playtime Rank</p>
      <p className="text-2xl font-black text-white">#{rank.rank}</p>
      <p className="text-xs text-white/60">of {rank.totalPlayers} players · {time}</p>
    </div>
  )
}

export function MainMenu() {
  const state = useGameStore()
  const [showBikes, setShowBikes] = useState(false)
  const [showStore, setShowStore] = useState(false)
  const [showPowerUpSelection, setShowPowerUpSelection] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const tapCountRef = useRef(0)
  const lastTapTimeRef = useRef(0)

  // Secret keyboard shortcut for admin analytics (preserved).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        setShowStats(!showStats)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showStats])

  // Secret mobile tap gesture (preserved).
  const handleSecretTap = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTimeRef.current

    if (timeSinceLastTap > 2000) {
      tapCountRef.current = 0
    }

    tapCountRef.current += 1
    lastTapTimeRef.current = now

    if (tapCountRef.current >= 5) {
      setShowStats(true)
      tapCountRef.current = 0
    }
  }

  if (state.gameState !== 'menu') return null

  if (showStats) {
    return <StatsScreen onBack={() => setShowStats(false)} />
  }

  if (showBikes) {
    return <GarageSelection onBack={() => setShowBikes(false)} />
  }

  if (showStore) {
    return <Store onBack={() => setShowStore(false)} />
  }

  if (showPowerUpSelection) {
    return (
      <PowerUpSelection
        onBack={() => setShowPowerUpSelection(false)}
        onStart={() => {
          actions.useSelectedPowerUp()
          actions.setGameState('playing')
        }}
      />
    )
  }

  const isCar = state.vehicleMode === 'car'
  const heroVehicle = isCar ? state.selectedCar : state.selectedBike

  return (
    <div
      className="hs-screen-enter absolute inset-0 overflow-hidden bg-[#080a0d] text-white"
      onClick={handleSecretTap}
    >
      <style>{`
        @keyframes hsMenuEntrance {
          0% { opacity: 0; transform: translateY(18px) scale(.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hsMenuRoad {
          0% { transform: translateY(0); opacity: .14; }
          50% { opacity: .21; }
          100% { transform: translateY(24px); opacity: .14; }
        }
        @keyframes hsMenuSkyline {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-10px); }
        }
        @keyframes hsMenuBikeFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
        }
        @keyframes hsMenuGlow {
          0%, 100% { opacity: .18; transform: scale(.94); }
          50% { opacity: .34; transform: scale(1.04); }
        }
        @keyframes hsMenuStreak {
          0% { transform: translateY(-40px); opacity: 0; }
          18% { opacity: .28; }
          100% { transform: translateY(140px); opacity: 0; }
        }
        .hs-menu-enter { animation: hsMenuEntrance 260ms cubic-bezier(.2,.72,.2,1) both; }
        .hs-menu-enter-delay { animation-delay: 110ms; }
        .hs-menu-enter-delay-2 { animation-delay: 190ms; }
        .hs-menu-enter-delay-3 { animation-delay: 280ms; }
      `}</style>

      {/* Live visual backdrop: no external asset loading and no blocking screen. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(244,185,74,.16),transparent_28%),linear-gradient(180deg,#151c23_0%,#0d1318_45%,#080a0d_100%)]" />
        <div
          className="absolute -inset-x-20 top-[40%] h-[68%]"
          style={{
            background: 'linear-gradient(165deg, transparent 0 38%, rgba(17,21,24,.95) 38.2% 39.1%, transparent 39.3% 100%), repeating-linear-gradient(90deg, transparent 0 74px, rgba(229,195,116,.13) 75px 76px, transparent 77px 150px)',
            transform: 'perspective(520px) rotateX(61deg)',
            transformOrigin: 'top center',
            animation: 'hsMenuRoad 4.8s ease-in-out infinite',
          }}
        />

        <div
          className="absolute left-0 right-0 top-[34%] h-28 opacity-70"
          style={{
            background: 'linear-gradient(to top, rgba(8,10,13,.95), transparent), repeating-linear-gradient(90deg, rgba(36,46,53,.78) 0 16px, transparent 16px 28px, rgba(48,58,63,.58) 28px 42px, transparent 42px 58px)',
            clipPath: 'polygon(0 58%, 6% 44%, 11% 57%, 18% 36%, 25% 55%, 34% 41%, 43% 58%, 51% 30%, 60% 52%, 68% 42%, 76% 56%, 83% 36%, 91% 51%, 100% 39%, 100% 100%, 0 100%)',
            animation: 'hsMenuSkyline 12s ease-in-out infinite',
          }}
        />

        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="absolute top-[14%] h-1 rounded-full bg-white/20 blur-[1px]"
            style={{
              left: `${8 + i * 16}%`,
              width: `${28 + (i % 3) * 18}px`,
              animation: `hsMenuStreak ${2.2 + (i % 3) * 0.4}s linear ${i * 0.24}s infinite`,
            }}
          />
        ))}

        <div
          className="absolute left-1/2 top-[50%] h-[190px] w-[190px] -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl"
          style={{ animation: 'hsMenuGlow 4.5s ease-in-out infinite' }}
        />
      </div>

      {/* Existing username flow remains in the same place/function. */}
      <div className="relative z-20">
        <UsernameInput />
      </div>

      {state.username && (
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30">
          <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 backdrop-blur-xl shadow-lg">
            <p className="text-white font-bold text-sm sm:text-base">👤 {state.username}</p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-4 py-8 sm:py-10">
        <div className="hs-menu-enter relative w-full max-w-3xl text-center">
          {/* Strong title treatment */}
          <div className="mb-4 sm:mb-5">
            <p className="mb-2 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.38em] text-amber-200/55">
              Fast Indian Highway Arcade
            </p>
            <h1 className="hs-title text-5xl sm:text-7xl md:text-8xl font-black leading-[0.82] tracking-[-0.06em] text-white">
              HIGHWAY
            </h1>
            <div className="mt-1 flex items-center justify-center gap-2 sm:gap-3">
              <span className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-amber-300/80" />
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black leading-none tracking-[-0.05em] text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-400 to-red-500">
                SPEEDSTER
              </h2>
              <span className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-red-400/80" />
            </div>
          </div>

          {/* Hero vehicle stage — existing selected vehicle, no new ownership state. */}
          <div className="hs-menu-enter hs-menu-enter-delay relative mx-auto mb-5 sm:mb-6 h-[170px] sm:h-[215px] w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-black/20 backdrop-blur-[2px]">
            <div className="absolute inset-x-10 bottom-5 h-10 rounded-[50%] border border-white/[0.08] bg-white/[0.025]" />
            <div
              className="absolute bottom-8 left-1/2 h-20 w-52 sm:w-64 -translate-x-1/2 rounded-[50%] bg-amber-300/10 blur-2xl"
              style={{ animation: 'hsMenuGlow 3.7s ease-in-out infinite' }}
            />
            <div
              key={heroVehicle.id}
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: 'hsMenuVehicleIn 240ms ease-out' }}
            >
              <div
                className="relative h-[125px] w-[225px] sm:h-[155px] sm:w-[285px]"
                style={{ animation: 'hsMenuBikeFloat 4.6s ease-in-out infinite' }}
              >
                {isCar ? <CarIcon car={state.selectedCar} /> : <BikeIcon bike={state.selectedBike} />}
              </div>
            </div>

            <div className="absolute left-4 top-4 text-left">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                Selected Ride
              </p>
              <p className="mt-1 text-sm sm:text-base font-black text-white">{heroVehicle.name}</p>
            </div>

            <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
              {isCar ? 'CAR' : 'BIKE'}
            </div>
          </div>

          {state.username && <div className="hs-menu-enter hs-menu-enter-delay-2 mb-3"><PlaytimeRankCard username={state.username} /></div>}

          {state.highScore > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                window.location.href = '/highscores'
              }}
              className="hs-menu-enter hs-menu-enter-delay-2 relative z-20 mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-center backdrop-blur-md transition-all hover:border-amber-300/20 hover:bg-white/[0.045] active:scale-95"
              aria-label="Open public high score leaderboard"
            >
              <p className="text-gray-400 text-[10px] uppercase tracking-[0.18em] font-semibold">
                Your Highest Score Is Only
              </p>
              <p className="text-amber-300 font-black text-lg sm:text-xl tabular-nums">
                {state.highScore.toLocaleString()}
              </p>
            </button>
          )}

          {/* One obvious primary action; existing handler is unchanged. */}
          <div className="hs-menu-enter hs-menu-enter-delay-3 relative z-20 flex w-full max-w-sm flex-col gap-2.5 sm:gap-3 mx-auto">
            <button
              onClick={() => {
                actions.resetGame()
                const hasPowerUps =
                  state.inventory.magnet > 0 ||
                  state.inventory.magnet2x > 0 ||
                  state.inventory.multiplier2x > 0 ||
                  state.inventory.multiplier4x > 0 ||
                  state.inventory.shield > 0

                if (hasPowerUps) {
                  setShowPowerUpSelection(true)
                } else {
                  actions.setGameState('playing')
                }
              }}
              className="hs-btn hs-btn-primary group relative overflow-hidden rounded-2xl py-3.5 sm:py-4 text-base sm:text-lg font-black tracking-wide shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.015] hover:shadow-orange-500/30"
            >
              <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="relative flex items-center justify-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 6h8.5a4 4 0 0 1 0 8H9l-2.5 4H4l2-4H5a4 4 0 0 1 0-8Z" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M15.5 8.5 20 6v8l-4.5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                RIDE NOW
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                onClick={() => setShowBikes(true)}
                className="hs-btn hs-btn-secondary rounded-2xl py-3 sm:py-3.5 text-sm sm:text-base font-black text-white shadow-lg transition-all"
              >
                <svg className="mx-auto mb-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="6.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
                  <circle cx="17.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
                  <path d="M8.5 16.5 11 10h4l2.5 6.5M11 10 9.5 7.5h3l2 2.5M15 10l2-2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                GARAGE
              </button>

              <button
                onClick={() => setShowStore(true)}
                className="rounded-2xl border border-white/12 bg-white/[0.055] py-3 sm:py-3.5 text-sm sm:text-base font-black text-white shadow-lg transition-all hover:bg-white/[0.09] hover:border-white/20 active:scale-[0.98]"
              >
                <svg className="mx-auto mb-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 8h14l-1 11H6L5 8Z" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                STORE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkinSelector({ bikeId }: { bikeId: string }) {
  const state = useGameStore()
  const availableSkins = BIKE_SKINS[bikeId] || []
  const currentSkin = state.bikeSkins[bikeId] || 'black'

  const skinDisplayColors: Record<string, string> = {
    black: '#1a1a1a',
    blue: '#1e40af',
    red: '#991b1b',
    silver: '#9ca3af',
    gold: '#ffd700',
  }

  return (
    <div className="mt-1.5 flex items-center gap-1">
      {availableSkins.map((skin: BikeSkin) => {
        const isActive = currentSkin === skin
        return (
          <button
            key={skin}
            onClick={() => actions.selectSkin(bikeId, skin)}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 transition-all active:scale-90 ${
              isActive ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
            }`}
            style={{ backgroundColor: skinDisplayColors[skin] }}
            title={skin.charAt(0).toUpperCase() + skin.slice(1)}
          />
        )
      })}
    </div>
  )
}

// ============== GARAGE ==============
function GarageShowroomPreview({
  state,
  section,
}: {
  state: GameData
  section: 'bikes' | 'cars'
}) {
  const isBike = section === 'bikes'
  const vehicle = isBike ? state.selectedBike : state.selectedCar
  const vehicleId = vehicle.id
  const vehicleName = vehicle.name

  return (
    <div className="mx-3 sm:mx-4 mt-3 sm:mt-4">
      <style>{`
        @keyframes hsGarageTurntable {
          0%, 100% {
            transform: perspective(900px) rotateY(-9deg) rotateX(2deg) translateY(0);
          }
          50% {
            transform: perspective(900px) rotateY(9deg) rotateX(-1deg) translateY(-4px);
          }
        }
        @keyframes hsGarageVehicleIn {
          0% {
            opacity: 0;
            transform: translateX(18px) scale(.97);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes hsGarageFloorGlow {
          0%, 100% { transform: scaleX(.94); opacity: .34; }
          50% { transform: scaleX(1.04); opacity: .5; }
        }
      `}</style>

      <div className="relative h-[210px] sm:h-[245px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_50%_15%,rgba(255,210,120,.16),transparent_36%),linear-gradient(180deg,#1a1d22_0%,#0b0d10_56%,#07080a_100%)] shadow-2xl">
        {/* Studio backdrop */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="absolute left-1/2 top-4 h-28 w-[72%] -translate-x-1/2 rounded-full bg-white/[0.025] blur-2xl" />

        {/* Showroom floor */}
        <div className="absolute inset-x-4 bottom-4 h-[72px] rounded-[50%] bg-gradient-to-b from-white/[0.05] to-transparent border-t border-white/[0.06]" />
        <div
          className="absolute left-1/2 bottom-12 h-8 w-44 sm:w-56 -translate-x-1/2 rounded-[50%] bg-yellow-300/10 blur-xl"
          style={{ animation: 'hsGarageFloorGlow 3.6s ease-in-out infinite' }}
        />
        <div className="absolute left-1/2 bottom-10 h-5 w-36 sm:w-48 -translate-x-1/2 rounded-[50%] border border-white/[0.08] bg-black/25" />

        {/* Vehicle turntable */}
        <div
          key={`${section}-${vehicleId}`}
          className="absolute left-1/2 bottom-14 h-[138px] w-[210px] sm:h-[164px] sm:w-[260px] -translate-x-1/2"
          style={{
            animation: 'hsGarageVehicleIn 240ms ease-out',
            perspective: '900px',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transformStyle: 'preserve-3d',
              animation: 'hsGarageTurntable 7.5s ease-in-out infinite',
            }}
          >
            <div
              className="h-[104px] w-[178px] sm:h-[126px] sm:w-[218px] rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(145deg, ${vehicle.color}1f, ${vehicle.accentColor}12)`,
                boxShadow: `0 16px 42px ${vehicle.color}16`,
              }}
            >
              <div className="h-[88px] w-[168px] sm:h-[112px] sm:w-[208px]">
                {isBike ? <BikeIcon bike={state.selectedBike} /> : <CarIcon car={state.selectedCar} />}
              </div>
            </div>
          </div>
        </div>

        {/* Showroom metadata — uses only existing vehicle fields */}
        <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.24em] text-white/40 font-semibold">
            {isBike ? 'Bike Showroom' : 'Car Showroom'}
          </p>
          <p className="mt-1 text-sm sm:text-base font-black text-white">{vehicleName}</p>
        </div>

        <div className="absolute right-4 top-4 sm:right-5 sm:top-5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/55 backdrop-blur-sm">
          Studio
        </div>
      </div>
    </div>
  )
}

function GarageSelection({ onBack }: { onBack: () => void }) {
  const state = useGameStore()
  const [section, setSection] = useState<'bikes' | 'cars'>('bikes')

  return (
    <div className="hs-screen hs-screen-enter absolute inset-0 flex flex-col bg-[#07080a] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center p-3 sm:p-4 border-b border-white/10 bg-[#07080a]/90 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="hs-btn hs-btn-secondary text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 flex items-center justify-center rounded-lg"
        >
          ←
        </button>
        <div className="ml-3">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold">Vehicle Collection</p>
          <h2 className="text-lg sm:text-xl font-black text-white">Garage</h2>
        </div>
      </div>

      {/* Vehicle tabs — handlers and button behavior preserved exactly */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white/[0.035] border border-white/10 shadow-inner">
          <button
            onClick={() => setSection('bikes')}
            className={`rounded-xl py-2.5 text-xs sm:text-sm font-black tracking-wide transition-all ${
              section === 'bikes'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <svg className="mx-auto mb-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
              <circle cx="17.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M8.5 16.5 11 10h4l2.5 6.5M11 10 9.5 7.5h3l2 2.5M15 10l2-2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            BIKES
          </button>
          <button
            onClick={() => setSection('cars')}
            className={`rounded-xl py-2.5 text-xs sm:text-sm font-black tracking-wide transition-all ${
              section === 'cars'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <svg className="mx-auto mb-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 14 1.6-4.5A2.4 2.4 0 0 1 8.9 8h6.2a2.4 2.4 0 0 1 2.3 1.5L19 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M4 14h16v4H4z" stroke="currentColor" strokeWidth="1.7"/>
              <circle cx="7.5" cy="18" r="1.2" fill="currentColor"/>
              <circle cx="16.5" cy="18" r="1.2" fill="currentColor"/>
            </svg>
            CARS
          </button>
        </div>
      </div>

      <GarageShowroomPreview state={state} section={section} />

      {section === 'bikes' ? (
        <>
          <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
            {BIKES.map((bike) => {
              const isUnlocked = state.unlockedBikes.includes(bike.id)
              const isSelected = state.vehicleMode === 'bike' && state.selectedBike.id === bike.id
              const progress = isUnlocked ? 100 : Math.min(100, (state.bikeHighScore / bike.unlockScore) * 100)

              return (
                <div
                  key={bike.id}
                  onClick={() => isUnlocked && !isSelected && actions.selectBike(bike)}
                  className={`hs-card group relative overflow-hidden rounded-2xl sm:rounded-[20px] p-3 sm:p-4 transition-all duration-300 border cursor-${isUnlocked ? 'pointer' : 'default'} ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500/[0.10] to-orange-500/[0.05] border-amber-300/35 shadow-lg shadow-amber-500/10'
                      : isUnlocked
                      ? 'bg-white/[0.035] border-white/[0.07] hover:bg-white/[0.055] hover:border-white/[0.14]'
                      : 'bg-white/[0.018] border-white/[0.045]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 to-orange-500" />
                  )}

                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border ${
                        isSelected
                          ? 'border-amber-300/25'
                          : 'border-white/[0.06]'
                      }`}
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(145deg, ${bike.color}28, ${bike.accentColor}18)`
                          : 'rgba(255,255,255,0.025)',
                      }}
                    >
                      {isUnlocked ? (
                        <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.06]">
                          <BikeIcon bike={bike} />
                        </div>
                      ) : (
                        <>
                          <div className="w-full h-full opacity-25 grayscale">
                            <BikeIcon bike={bike} />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="rounded-full border border-white/15 bg-black/50 px-2 py-1 text-sm shadow-lg">🔒</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-white font-black text-sm sm:text-base truncate"
                      >{bike.name}</h3>
                      <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                        {isUnlocked ? bike.description : `Unlock at ${bike.unlockScore.toLocaleString()} pts`}
                      </p>

                      {isUnlocked && (
                        <>
                          <div className="mt-1.5">
                            <p className="text-[10px] sm:text-xs text-gray-400">
                              Top Speed: <span className="text-white font-semibold">{bike.maxSpeed} kmph</span>
                            </p>
                          </div>
                          <SkinSelector bikeId={bike.id} />
                        </>
                      )}

                      {!isUnlocked && (
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 tabular-nums">
                            {state.bikeHighScore.toLocaleString()} / {bike.unlockScore.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="shrink-0 flex items-center gap-1.5 text-amber-300 text-[10px] sm:text-xs font-black bg-amber-300/10 px-2.5 py-1.5 rounded-full border border-amber-300/15">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-black text-[9px]">✓</span>
                        ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pb-4 pt-1 text-center">
            <span className="text-xs text-gray-500">{new Set(state.unlockedBikes).size} out of {BIKES.length} Bikes unlocked</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
            {CARS.map((car) => {
              const isUnlocked = state.unlockedCars.includes(car.id)
              const isSelected = state.vehicleMode === 'car' && state.selectedCar.id === car.id
              const progress = isUnlocked ? 100 : Math.min(100, (state.carHighScore / car.unlockScore) * 100)

              return (
                <div
                  key={car.id}
                  onClick={() => isUnlocked && !isSelected && actions.selectCar(car)}
                  className={`group relative overflow-hidden rounded-2xl sm:rounded-[20px] p-3 sm:p-4 transition-all duration-300 border cursor-${isUnlocked ? 'pointer' : 'default'} ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500/[0.10] to-orange-500/[0.05] border-amber-300/35 shadow-lg shadow-amber-500/10'
                      : isUnlocked
                      ? 'bg-white/[0.035] border-white/[0.07] hover:bg-white/[0.055] hover:border-white/[0.14]'
                      : 'bg-white/[0.018] border-white/[0.045]'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 to-orange-500" />
                  )}

                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border ${
                        isSelected
                          ? 'border-amber-300/25'
                          : 'border-white/[0.06]'
                      }`}
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(145deg, ${car.color}28, ${car.accentColor}18)`
                          : 'rgba(255,255,255,0.025)',
                      }}
                    >
                      {isUnlocked ? (
                        <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.06]">
                          <CarIcon car={car} />
                        </div>
                      ) : (
                        <>
                          <div className="w-full h-full opacity-25 grayscale">
                            <CarIcon car={car} />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="rounded-full border border-white/15 bg-black/50 px-2 py-1 text-sm shadow-lg">🔒</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-white font-black text-sm sm:text-base truncate"
                      >{car.name}</h3>
                      <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                        {isUnlocked ? car.description : `Unlock at ${car.unlockScore.toLocaleString()} pts`}
                      </p>

                      {isUnlocked && (
                        <div className="mt-1.5">
                          <p className="text-[10px] sm:text-xs text-gray-400">
                            Top Speed: <span className="text-white font-semibold">{car.maxSpeed} kmph</span>
                          </p>
                        </div>
                      )}

                      {!isUnlocked && (
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 tabular-nums">
                            {state.carHighScore.toLocaleString()} / {car.unlockScore.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="shrink-0 flex items-center gap-1.5 text-amber-300 text-[10px] sm:text-xs font-black bg-amber-300/10 px-2.5 py-1.5 rounded-full border border-amber-300/15">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-black text-[9px]">✓</span>
                        ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pb-4 pt-1 text-center">
            <span className="text-xs text-gray-500">
              {new Set(state.unlockedCars).size} out of {CARS.length} Cars unlocked
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function CarIcon({ car }: { car: Car }) {
  const common = { fill: car.color, accent: car.accentColor }

  if (car.id === 'kanto-zip') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="23" cy="46" r="9" fill="#222" stroke="#777" strokeWidth="2"/>
        <circle cx="77" cy="46" r="9" fill="#222" stroke="#777" strokeWidth="2"/>
        <path d="M13 43 L18 33 L28 31 L38 22 L56 21 L66 25 L73 33 L84 38 L87 43Z" fill={common.fill}/>
        <path d="M29 30 L39 22 L55 22 L64 30Z" fill={common.accent}/>
        <path d="M40 23 L53 23 L60 29 L43 29Z" fill="#172330"/>
        <path d="M15 40 L28 40 L28 43 L15 43Z" fill="#303030"/>
        <rect x="18" y="35" width="10" height="3" rx="1.5" fill="#f4f4f4"/>
        <rect x="72" y="37" width="9" height="3" rx="1.5" fill="#d9343a"/>
        <path d="M69 29 L78 34 L81 37 L68 37Z" fill={common.accent} opacity="0.45"/>
      </svg>
    )
  }

  if (car.id === 'saber-swift') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="19" cy="47" r="9" fill="#1d1d1d" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="47" r="9" fill="#1d1d1d" stroke="#777" strokeWidth="2"/>
        <path d="M9 43 L16 35 L29 32 L39 25 L61 25 L72 30 L79 34 L90 38 L92 43Z" fill={common.fill}/>
        <path d="M30 32 L40 25 L60 25 L71 31Z" fill={common.accent}/>
        <path d="M41 26 L58 26 L66 31 L45 31Z" fill="#1e2b3a"/>
        <path d="M15 38 L29 35 L73 35 L86 39 L84 42 L16 42Z" fill={common.accent} opacity="0.28"/>
        <rect x="13" y="40" width="13" height="2.5" rx="1" fill="#f5f5f5"/>
        <rect x="76" y="39" width="10" height="3" rx="1" fill="#c7363d"/>
        <rect x="38" y="38" width="30" height="2" rx="1" fill="#dfe6ee" opacity="0.75"/>
        <path d="M22 31 L26 28 L30 31" stroke="#9ba8b4" strokeWidth="1.3" fill="none"/>
      </svg>
    )
  }

  if (car.id === 'goliath-titan') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="19" cy="47" r="10.5" fill="#202020" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="47" r="10.5" fill="#202020" stroke="#777" strokeWidth="2"/>
        <path d="M10 44 L14 28 L24 24 L24 16 L68 16 L77 22 L82 27 L88 30 L91 44Z" fill={common.fill}/>
        <rect x="28" y="19" width="39" height="14" rx="2" fill="#22313b"/>
        <path d="M17 29 L27 27 L27 38 L16 39Z" fill={common.accent} opacity="0.62"/>
        <rect x="24" y="37" width="50" height="5" rx="2" fill="#3b4147"/>
        <rect x="75" y="35" width="10" height="4" rx="1.5" fill="#cf3434"/>
        <circle cx="82" cy="29" r="3.2" fill="#333" stroke="#8b8b8b" strokeWidth="1"/>
        <path d="M30 15 L37 11 L63 11 L69 15" fill="none" stroke={common.accent} strokeWidth="2"/>
        <path d="M14 42 L14 34 M86 42 L86 34" stroke="#6e7377" strokeWidth="2"/>
      </svg>
    )
  }

  if (car.id === 'kaiser-monarch') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="19" cy="46" r="9" fill="#191919" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="46" r="9" fill="#191919" stroke="#777" strokeWidth="2"/>
        <path d="M8 43 L17 33 L29 30 L45 20 L62 18 L74 23 L82 30 L92 36 L94 43Z" fill={common.fill}/>
        <path d="M32 30 L46 21 L61 19 L72 24 L77 30Z" fill="#16202c"/>
        <path d="M18 35 L31 32 L76 31 L85 35 L82 39 L17 39Z" fill={common.accent} opacity="0.27"/>
        <path d="M75 34 L88 35 L91 38 L76 38Z" fill="#101820"/>
        <rect x="15" y="39" width="13" height="2.5" rx="1" fill="#f2eab7"/>
        <rect x="74" y="39" width="13" height="3" rx="1" fill="#d92f3b"/>
        <rect x="36" y="38" width="29" height="2" rx="1" fill="#c9cdd2"/>
        <path d="M68 25 L80 24 L84 27" stroke={common.accent} strokeWidth="2" fill="none"/>
      </svg>
    )
  }

  // Scuderia Fury — very low wedge supercar with a long nose, wide stance and rear wing.
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full">
      <circle cx="18" cy="46" r="8" fill="#111" stroke="#777" strokeWidth="2"/>
      <circle cx="82" cy="46" r="8" fill="#111" stroke="#777" strokeWidth="2"/>
      <path d="M5 43 L15 36 L28 33 L41 23 L58 18 L70 22 L81 30 L91 35 L95 43Z" fill={common.fill}/>
      <path d="M35 31 L44 24 L58 19 L69 24 L77 30Z" fill="#101820"/>
      <path d="M13 36 L29 33 L75 32 L88 36 L84 39 L11 39Z" fill={common.accent} opacity="0.24"/>
      <path d="M70 34 L87 34 L92 38 L72 38Z" fill="#0c0f12"/>
      <path d="M72 26 L85 28 L90 31" stroke="#252a31" strokeWidth="2.5" fill="none"/>
      <rect x="12" y="39" width="18" height="2.5" rx="1" fill="#f7eeb4"/>
      <rect x="70" y="39" width="18" height="2.5" rx="1" fill="#e12d3b"/>
      <path d="M59 21 L87 21 L89 24 L61 24Z" fill="#111"/>
      <path d="M8 42 L14 39 M92 42 L86 39" stroke={common.accent} strokeWidth="2"/>
    </svg>
  )
}

// ============== STORE ==============
function Store({ onBack }: { onBack: () => void }) {
  const state = useGameStore()

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-gray-900 via-gray-950 to-black overflow-y-auto">
      {/* Header */}
      <div className="flex items-center p-3 sm:p-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 flex items-center justify-center rounded-lg bg-white/5"
        >
          ←
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-white ml-3">Store</h2>
      </div>

      {/* Total Coins */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b border-yellow-500/20">
        <div className="text-center">
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-1">Total Coins Collected</p>
          <p className="text-yellow-400 font-black text-3xl sm:text-4xl tabular-nums flex items-center justify-center gap-2">
            <span className="text-4xl sm:text-5xl">🪙</span>
            {state.totalCoins.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Power-ups Section */}
      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6">
        <h3 className="text-white font-bold text-base sm:text-lg mb-4">Power-Ups</h3>
        
        <div className="space-y-3">
          {/* 2x Magnet - 300 coins */}
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🧲</div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-base">2x Magnet</h4>
                <p className="text-gray-400 text-xs mt-0.5">Double coins collected for 10 seconds</p>
                <p className="text-blue-400 text-xs mt-1 font-semibold">Owned: {state.inventory.magnet2x}</p>
              </div>
              <button
                onClick={() => actions.buyMagnet2x()}
                disabled={state.totalCoins < 300}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-blue-500/25"
              >
                🪙 300
              </button>
            </div>
          </div>

          {/* 4x Score - 350 coins */}
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="text-4xl">💎</div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-base">4× Score</h4>
                <p className="text-gray-400 text-xs mt-0.5">Quadruple your score for 10 seconds</p>
                <p className="text-purple-400 text-xs mt-1 font-semibold">Owned: {state.inventory.multiplier4x}</p>
              </div>
              <button
                onClick={() => actions.buyMultiplier4x()}
                disabled={state.totalCoins < 350}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-purple-500/25"
              >
                🪙 350
              </button>
            </div>
          </div>

          {/* 2x Shield - 450 coins */}
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🛡️</div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-base">2× Shield</h4>
                <p className="text-gray-400 text-xs mt-0.5">Protect from 2 crashes</p>
                <p className="text-green-400 text-xs mt-1 font-semibold">Owned: {state.inventory.shield}</p>
              </div>
              <button
                onClick={() => actions.buyShield()}
                disabled={state.totalCoins < 450}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-green-500/25"
              >
                🪙 450
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============== POWER-UP SELECTION ==============
function PowerUpSelection({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const state = useGameStore()

  const hasPowerUps = state.inventory.magnet > 0 || state.inventory.magnet2x > 0 || state.inventory.multiplier2x > 0 || state.inventory.multiplier4x > 0 || state.inventory.shield > 0

  if (!hasPowerUps) {
    // No power-ups, just start the game
    onStart()
    return null
  }

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center p-3 sm:p-4">
        <button
          onClick={onBack}
          className="text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 flex items-center justify-center rounded-lg bg-white/5"
        >
          ←
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-white ml-3">Select Power-Up</h2>
      </div>

      {/* Power-ups */}
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6 flex flex-col justify-center">
        <div className="space-y-3 max-w-md mx-auto w-full">
          {/* Magnet */}
          <div 
            onClick={() => state.inventory.magnet > 0 && actions.selectPowerUp(state.selectedPowerUp === 'magnet' ? null : 'magnet')}
            className={`bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-xl p-4 border-2 hs-selection-card cursor-pointer ${
              state.selectedPowerUp === 'magnet' ? 'border-blue-400 scale-105' : 'border-blue-500/30'
            } ${state.inventory.magnet === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">🧲</div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">COIN MAGNET</h3>
                <p className="text-gray-300 text-xs mt-1">Auto-collect coins for 10s</p>
                <p className="text-blue-400 text-sm mt-2 font-bold">Available: {state.inventory.magnet}</p>
              </div>
              {state.selectedPowerUp === 'magnet' && (
                <div className="text-blue-400 text-2xl">✓</div>
              )}
            </div>
          </div>

          {/* 2x Magnet */}
          <div 
            onClick={() => state.inventory.magnet2x > 0 && actions.selectPowerUp(state.selectedPowerUp === 'magnet2x' ? null : 'magnet2x')}
            className={`bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl p-4 border-2 hs-selection-card cursor-pointer ${
              state.selectedPowerUp === 'magnet2x' ? 'border-cyan-400 scale-105' : 'border-cyan-500/30'
            } ${state.inventory.magnet2x === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">🧲</div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">2× COIN MAGNET</h3>
                <p className="text-gray-300 text-xs mt-1">Double coins collected for 10s</p>
                <p className="text-cyan-400 text-sm mt-2 font-bold">Available: {state.inventory.magnet2x}</p>
              </div>
              {state.selectedPowerUp === 'magnet2x' && (
                <div className="text-cyan-400 text-2xl">✓</div>
              )}
            </div>
          </div>

          {/* 2x Multiplier */}
          <div 
            onClick={() => state.inventory.multiplier2x > 0 && actions.selectPowerUp(state.selectedPowerUp === 'multiplier2x' ? null : 'multiplier2x')}
            className={`bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border-2 hs-selection-card cursor-pointer ${
              state.selectedPowerUp === 'multiplier2x' ? 'border-yellow-400 scale-105' : 'border-yellow-500/30'
            } ${state.inventory.multiplier2x === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">⭐</div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">2× SCORE</h3>
                <p className="text-gray-300 text-xs mt-1">Double score for 10s</p>
                <p className="text-yellow-400 text-sm mt-2 font-bold">Available: {state.inventory.multiplier2x}</p>
              </div>
              {state.selectedPowerUp === 'multiplier2x' && (
                <div className="text-yellow-400 text-2xl">✓</div>
              )}
            </div>
          </div>

          {/* 4x Multiplier */}
          <div 
            onClick={() => state.inventory.multiplier4x > 0 && actions.selectPowerUp(state.selectedPowerUp === 'multiplier4x' ? null : 'multiplier4x')}
            className={`bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border-2 hs-selection-card cursor-pointer ${
              state.selectedPowerUp === 'multiplier4x' ? 'border-purple-400 scale-105' : 'border-purple-500/30'
            } ${state.inventory.multiplier4x === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">💎</div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">4× SCORE</h3>
                <p className="text-gray-300 text-xs mt-1">Quadruple score for 10s</p>
                <p className="text-purple-400 text-sm mt-2 font-bold">Available: {state.inventory.multiplier4x}</p>
              </div>
              {state.selectedPowerUp === 'multiplier4x' && (
                <div className="text-purple-400 text-2xl">✓</div>
              )}
            </div>
          </div>

          {/* Shield */}
          <div 
            onClick={() => state.inventory.shield > 0 && actions.selectPowerUp(state.selectedPowerUp === 'shield' ? null : 'shield')}
            className={`bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border-2 hs-selection-card cursor-pointer ${
              state.selectedPowerUp === 'shield' ? 'border-green-400 scale-105' : 'border-green-500/30'
            } ${state.inventory.shield === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">🛡️</div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">SHIELD</h3>
                <p className="text-gray-300 text-xs mt-1">Protect from 1 crash</p>
                <p className="text-green-400 text-sm mt-2 font-bold">Available: {state.inventory.shield}</p>
              </div>
              {state.selectedPowerUp === 'shield' && (
                <div className="text-green-400 text-2xl">✓</div>
              )}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="mt-6 max-w-md mx-auto w-full">
          <button
            onClick={onStart}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-green-500/30 active:scale-95 transition-all border border-green-400/20"
          >
            🏁 START RIDE
          </button>
        </div>
      </div>
    </div>
  )
}

// Bike icon component with distinct visuals for each bike
function BikeIcon({ bike }: { bike: Bike }) {
  if (bike.id === 'blitz') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="25" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="75" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <path d="M 25 45 L 40 30 L 60 30 L 75 45" fill="none" stroke={bike.color} strokeWidth="3"/>
        <ellipse cx="50" cy="32" rx="15" ry="8" fill={bike.color}/>
        <ellipse cx="50" cy="32" rx="12" ry="6" fill={bike.accentColor}/>
        <ellipse cx="55" cy="28" rx="8" ry="4" fill="#1a1a1a"/>
        <line x1="35" y1="25" x2="45" y2="20" stroke="#666" strokeWidth="2"/>
        <circle cx="45" cy="20" r="2" fill="#888"/>
        <circle cx="38" cy="28" r="3" fill="#ffffcc" opacity="0.8"/>
      </svg>
    )
  }
  
  if (bike.id === 'apex') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="22" cy="45" r="11" fill="#333" stroke="#555" strokeWidth="2"/>
        <circle cx="78" cy="45" r="11" fill="#333" stroke="#555" strokeWidth="2"/>
        <path d="M 22 45 L 38 28 L 62 28 L 78 45" fill="none" stroke={bike.color} strokeWidth="4"/>
        <rect x="42" y="32" width="16" height="10" fill="#2a2a2a" rx="2"/>
        <rect x="44" y="34" width="12" height="6" fill="#444"/>
        <ellipse cx="50" cy="30" rx="18" ry="10" fill={bike.color}/>
        <ellipse cx="50" cy="30" rx="15" ry="8" fill={bike.accentColor}/>
        <rect x="35" y="29" width="30" height="2" fill="#ccc" opacity="0.6"/>
        <ellipse cx="58" cy="26" rx="10" ry="5" fill="#1a1a1a"/>
        <line x1="32" y1="22" x2="48" y2="18" stroke="#777" strokeWidth="2.5"/>
        <circle cx="48" cy="18" r="2.5" fill="#999"/>
        <circle cx="35" cy="26" r="4" fill="#ffffcc" opacity="0.8"/>
        <line x1="60" y1="38" x2="70" y2="42" stroke="#bbb" strokeWidth="2"/>
        <line x1="58" y1="40" x2="68" y2="44" stroke="#bbb" strokeWidth="2"/>
      </svg>
    )
  }
  
  if (bike.id === 'chronos') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="25" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="75" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <path d="M 30 40 L 35 25 L 50 20 L 65 25 L 70 40 Z" fill={bike.color}/>
        <path d="M 35 38 L 38 27 L 50 23 L 62 27 L 65 38 Z" fill={bike.accentColor}/>
        <path d="M 40 25 L 45 18 L 55 18 L 60 25" fill="#333" opacity="0.5"/>
        <ellipse cx="58" cy="32" rx="8" ry="3" fill="#1a1a1a"/>
        <path d="M 65 30 L 72 35 L 70 40" fill={bike.color}/>
        <line x1="38" y1="22" x2="45" y2="20" stroke="#666" strokeWidth="1.5"/>
        <circle cx="37" cy="28" r="2.5" fill="#ffffcc" opacity="0.9"/>
        <circle cx="42" cy="26" r="2.5" fill="#ffffcc" opacity="0.9"/>
        <line x1="62" y1="38" x2="68" y2="42" stroke="#aaa" strokeWidth="1.5"/>
      </svg>
    )
  }
  
  if (bike.id === 'stratos') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="23" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="77" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <path d="M 25 42 L 30 22 L 48 16 L 68 22 L 75 42 Z" fill={bike.color}/>
        <path d="M 32 40 L 35 25 L 48 20 L 63 25 L 68 40 Z" fill={bike.accentColor}/>
        <path d="M 36 22 L 42 14 L 54 14 L 58 22" fill="#222" opacity="0.6"/>
        <ellipse cx="60" cy="30" rx="9" ry="2.5" fill="#1a1a1a"/>
        <path d="M 68 28 L 78 32 L 75 40" fill={bike.color}/>
        <line x1="35" y1="20" x2="44" y2="17" stroke="#555" strokeWidth="1.5"/>
        <path d="M 33 26 L 38 24 L 38 28 Z" fill="#ffffcc" opacity="0.9"/>
        <line x1="65" y1="36" x2="73" y2="40" stroke="#999" strokeWidth="2"/>
        <line x1="40" y1="30" x2="60" y2="30" stroke={bike.accentColor} strokeWidth="1.5" opacity="0.7"/>
      </svg>
    )
  }
  
  if (bike.id === 'zenith') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="22" cy="45" r="10" fill="#222" stroke="#444" strokeWidth="1.5"/>
        <circle cx="78" cy="45" r="10" fill="#222" stroke="#444" strokeWidth="1.5"/>
        <line x1="22" y1="38" x2="22" y2="52" stroke="#555" strokeWidth="0.5"/>
        <line x1="15" y1="45" x2="29" y2="45" stroke="#555" strokeWidth="0.5"/>
        <line x1="78" y1="38" x2="78" y2="52" stroke="#555" strokeWidth="0.5"/>
        <line x1="71" y1="45" x2="85" y2="45" stroke="#555" strokeWidth="0.5"/>
        <path d="M 22 43 L 28 18 L 46 12 L 70 18 L 78 43 Z" fill={bike.color}/>
        <path d="M 30 41 L 33 22 L 46 16 L 64 22 L 70 41 Z" fill={bike.accentColor}/>
        <path d="M 34 18 L 40 10 L 52 10 L 56 18" fill="#111" opacity="0.7"/>
        <ellipse cx="62" cy="28" rx="10" ry="2" fill="#0a0a0a"/>
        <path d="M 70 25 L 82 28 L 78 40" fill={bike.color}/>
        <line x1="33" y1="16" x2="42" y2="13" stroke="#444" strokeWidth="1.5"/>
        <rect x="30" y="22" width="8" height="2" rx="1" fill="#ffffcc" opacity="0.9"/>
        <line x1="68" y1="34" x2="76" y2="38" stroke="#888" strokeWidth="1.5"/>
        <line x1="66" y1="36" x2="74" y2="40" stroke="#888" strokeWidth="1.5"/>
        <line x1="38" y1="28" x2="62" y2="28" stroke={bike.accentColor} strokeWidth="1" opacity="0.8"/>
        <line x1="40" y1="32" x2="60" y2="32" stroke={bike.accentColor} strokeWidth="1" opacity="0.5"/>
      </svg>
    )
  }
  
  return <span className="text-2xl sm:text-3xl">🏍️</span>
}

// ============== PAUSE MENU ==============
export function PauseMenu() {
  const state = useGameStore()
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (countdown === null) return

    if (countdown === 0) {
      actions.setGameState('playing')
      setCountdown(null)
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  const handleResume = () => {
    setCountdown(3)
  }

  if (state.gameState !== 'paused') return null

  if (countdown !== null) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50">
        <div className="text-center">
          {countdown > 0 ? (
            <div className="hs-pop-in text-8xl sm:text-9xl font-black text-white animate-pulse">
              {countdown}
            </div>
          ) : (
            <div className="hs-pop-in text-6xl sm:text-7xl font-black text-green-400 animate-bounce">
              GO!
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col items-center bg-black/85 backdrop-blur-md z-50 overflow-y-auto">
      <div className="flex flex-col items-center py-6 sm:py-8 px-4 w-full max-w-md">
        <div className="text-4xl mb-3">⏸️</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">PAUSED</h2>
        
        {/* Coins Display */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl px-4 py-2 mb-4 border border-yellow-500/30 flex items-center gap-2">
          <span className="text-xl">🪙</span>
          <span className="text-yellow-400 font-bold text-lg tabular-nums">{state.totalCoins.toLocaleString()} coins</span>
        </div>

        {/* Power-Ups Shop */}
        <div className="w-full mb-4">
          <h3 className="text-white font-bold text-base sm:text-lg mb-3 text-center">⚡ Power-Ups Shop</h3>
          
          <div className="space-y-2">
            {/* 2x Magnet */}
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-3 border border-blue-500/30">
              <div className="flex items-center gap-2">
                <div className="text-2xl">🧲</div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">2x Magnet</h4>
                  <p className="text-blue-400 text-xs">Owned: {state.inventory.magnet2x}</p>
                </div>
                <button
                  onClick={() => actions.buyMagnet2x()}
                  disabled={state.totalCoins < 300}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  🪙 300
                </button>
              </div>
            </div>

            {/* 4x Score */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-3 border border-purple-500/30">
              <div className="flex items-center gap-2">
                <div className="text-2xl">💎</div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">4× Score</h4>
                  <p className="text-purple-400 text-xs">Owned: {state.inventory.multiplier4x}</p>
                </div>
                <button
                  onClick={() => actions.buyMultiplier4x()}
                  disabled={state.totalCoins < 350}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  🪙 350
                </button>
              </div>
            </div>

            {/* 2x Shield */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-3 border border-green-500/30">
              <div className="flex items-center gap-2">
                <div className="text-2xl">🛡️</div>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">2× Shield</h4>
                  <p className="text-green-400 text-xs">Owned: {state.inventory.shield}</p>
                </div>
                <button
                  onClick={() => actions.buyShield()}
                  disabled={state.totalCoins < 450}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  🪙 450
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
          <button
            onClick={handleResume}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base sm:text-lg py-3 rounded-xl active:scale-95 transition-all shadow-lg shadow-green-500/20"
          >
            ▶ RESUME
          </button>
          <button
            onClick={() => { actions.resetGame(); actions.setGameState('menu') }}
            className="bg-white/10 hover:bg-white/15 text-white font-bold text-base sm:text-lg py-3 rounded-xl active:scale-95 transition-all border border-white/10"
          >
            🏠 MAIN MENU
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-center w-full">
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Score</p>
            <p className="text-white font-bold text-base tabular-nums">{state.score.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Distance</p>
            <p className="text-white font-bold text-base tabular-nums">{state.distance.toFixed(1)} km</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Near Misses</p>
            <p className="text-orange-400 font-bold text-base tabular-nums">{state.nearMisses}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Best Combo</p>
            <p className="text-yellow-400 font-bold text-base tabular-nums">×{state.combo}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============== GAME OVER ==============
export function GameOverScreen() {
  const state = useGameStore()
  const isNewHighScore = state.score >= state.highScore && state.score > 0

  if (state.gameState !== 'gameover') return null

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 to-transparent" />
      </div>

      <div className="relative z-10 text-center px-4">
        <div className="text-4xl sm:text-5xl mb-2">💥</div>
        <h2 className="text-3xl sm:text-4xl font-black text-red-500 mb-1">CRASHED!</h2>
        
        {isNewHighScore && (
          <div className="animate-pulse mb-3 sm:mb-4">
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-lg shadow-yellow-500/30">
              🏆 NEW HIGH SCORE!
            </span>
          </div>
        )}

        <div className="bg-white/[0.05] rounded-xl sm:rounded-2xl p-4 sm:p-5 mt-3 sm:mt-4 mb-5 sm:mb-7 border border-white/10 min-w-[240px] sm:min-w-[280px]">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3">
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Score</p>
              <p className="text-white font-bold text-xl sm:text-2xl tabular-nums">{state.score.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Best</p>
              <p className="text-yellow-400 font-bold text-xl sm:text-2xl tabular-nums">{state.highScore.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-center pt-2 border-t border-white/10">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Near Misses</p>
            <p className="text-orange-400 font-bold text-xl sm:text-2xl tabular-nums">{state.nearMisses}</p>
          </div>
          <div className="text-center pt-2 mt-2 border-t border-white/10">
            <p className="text-gray-500 text-[10px] uppercase tracking-wider">Coins Collected</p>
            <p className="text-yellow-400 font-bold text-xl sm:text-2xl tabular-nums">🪙 {state.runCoins}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:gap-3 w-52 sm:w-56 mx-auto">
          <button
            onClick={() => { actions.resetGame(); actions.setGameState('playing') }}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base sm:text-lg py-3 rounded-xl shadow-lg shadow-green-500/25 active:scale-95 transition-all"
          >
            🔄 RIDE AGAIN
          </button>
          <button
            onClick={() => { actions.resetGame(); actions.setGameState('menu') }}
            className="bg-white/10 hover:bg-white/15 text-white font-bold text-base sm:text-lg py-3 rounded-xl active:scale-95 transition-all border border-white/10"
          >
            🏠 MAIN MENU
          </button>
        </div>
      </div>
    </div>
  )
}

// ============== TOUCH CONTROLS ==============
export function TouchControls() {
  const state = useGameStore()
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const lastSwipeRef = useRef(0)
  const lastTapRef = useRef(0)

  useEffect(() => {
    if (state.gameState !== 'playing') return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          actions.setTargetLane(getState().targetLane - 1)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          actions.setTargetLane(getState().targetLane + 1)
          break
        case 'Escape':
        case 'p':
        case 'P':
          if (getState().gameState === 'playing') {
            e.preventDefault()
            actions.setGameState('paused')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.gameState])

  const changeLane = (direction: -1 | 1) => {
    const now = Date.now()
    if (now - lastTapRef.current < 120) return
    lastTapRef.current = now
    actions.setTargetLane(getState().targetLane + direction)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0]
    if (!touch) return
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0]
    const startX = touchStartXRef.current
    const startY = touchStartYRef.current
    touchStartXRef.current = null
    touchStartYRef.current = null

    if (!touch || startX === null || startY === null) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const now = Date.now()

    // Deliberate horizontal swipe: change exactly one lane.
    const SWIPE_THRESHOLD = 45
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (now - lastSwipeRef.current < 120) return

    lastSwipeRef.current = now
    actions.setTargetLane(getState().targetLane + (deltaX > 0 ? 1 : -1))
  }

  if (state.gameState !== 'playing') return null

  return (
    <>
      {/* Full game-area swipe surface */}
      <div
        className="absolute left-0 right-0 bottom-0 top-24 sm:top-28 z-10"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
        aria-label="Swipe left or right to steer"
      >
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 backdrop-blur-sm sm:hidden">
          ← Swipe to steer →
        </div>
      </div>

      {/* Mobile arrow controls remain available alongside swipe steering */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-between px-6 z-20 sm:hidden">
        <button
          type="button"
          aria-label="Steer left"
          onTouchStart={(e) => {
            e.preventDefault()
            changeLane(-1)
          }}
          onClick={() => changeLane(-1)}
          className="w-16 h-16 bg-white/20 backdrop-blur-sm border-2 border-white/40 rounded-full flex items-center justify-center active:scale-90 active:bg-white/30 transition-all shadow-lg"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Steer right"
          onTouchStart={(e) => {
            e.preventDefault()
            changeLane(1)
          }}
          onClick={() => changeLane(1)}
          className="w-16 h-16 bg-white/20 backdrop-blur-sm border-2 border-white/40 rounded-full flex items-center justify-center active:scale-90 active:bg-white/30 transition-all shadow-lg"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  )
}

// ============== NEW UNLOCK NOTIFICATION ==============
export function UnlockNotification() {
  const state = useGameStore()
  const [visible, setVisible] = useState(false)
  const [bikeName, setBikeName] = useState('')

  useEffect(() => {
    if (!state.newUnlock || !state.newUnlockUntil) {
      setVisible(false)
      return
    }

    setBikeName(state.newUnlock)
    const remaining = Math.max(0, state.newUnlockUntil - Date.now())
    setVisible(remaining > 0)

    if (remaining <= 0) {
      actions.clearNewUnlock()
      return
    }

    const timer = window.setTimeout(() => {
      setVisible(false)
      actions.clearNewUnlock()
    }, remaining)

    return () => window.clearTimeout(timer)
  }, [state.newUnlock, state.newUnlockUntil])

  if (!visible) return null

  return (
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-[60]">
      <div className="hs-unlock-enter bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl sm:rounded-2xl px-5 py-3 sm:px-6 sm:py-4 shadow-2xl shadow-orange-500/50 text-center border border-yellow-400/30">
        <p className="text-white/80 text-[10px] sm:text-xs uppercase tracking-wider font-medium">🔓 New Vehicle Unlocked!</p>
        <p className="text-white font-black text-lg sm:text-2xl mt-0.5">{bikeName}</p>
        <p className="text-white/60 text-[9px] sm:text-[10px] mt-0.5">Check the Garage</p>
      </div>
    </div>
  )
}
