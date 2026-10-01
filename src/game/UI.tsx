import { useEffect, useRef, useState } from 'react'
import { useGameStore, actions, BIKES, CARS, BIKE_SKINS, SKIN_NAMES, SKIN_SWATCHES, SKIN_COLORS, CAR_COLORS, getState, type Bike, type Car, type BikeSkin, type CarColorOption, type GameData, type PowerUpType } from './store'
import { BikeIcon, CarIcon } from './VehicleArt'
import { fetchLeaderboardAnalytics, fetchMyPlaytimeRank } from '../supabase'
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
  const [analytics, setAnalytics] = useState<{
    users: Array<{ player_id: string; username: string; playtime_seconds: number; is_me: boolean }>
  }>({ users: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      const data = await fetchLeaderboardAnalytics(timeFilter)
      if (!mounted) return
      setAnalytics({ users: data.users })
      setLoading(false)
    }

    void load()
    const interval = window.setInterval(load, 10000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [timeFilter])

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

  const filterLabel: Record<Filter, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 3 Months',
    '180d': 'Last 6 Months',
    '365d': 'Last 1 Year',
    all: 'Overall'
  }

  const leaderboard = analytics.users
    .filter((user) => user.username.trim())
    .map((user) => ({
      playerId: user.player_id,
      username: user.username.trim(),
      seconds: Math.max(0, Math.trunc(Number(user.playtime_seconds || 0))),
      isMe: Boolean(user.is_me),
    }))
    .sort((a, b) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds
      if (a.username !== b.username) return a.username.localeCompare(b.username)
      return a.playerId.localeCompare(b.playerId)
    })

  const totalPlaytime = leaderboard.reduce((sum, user) => sum + user.seconds, 0)
  const totalUsers = leaderboard.length

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
                key={user.playerId || `${user.username}-${index}`}
                className={`rounded-xl p-3 sm:p-4 border ${
                  user.isMe || user.username === state.username && !leaderboard.some((row) => row.isMe)
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
  const [navTransition, setNavTransition] = useState<'garage' | 'store' | null>(null)
  const navTransitionTimerRef = useRef<number | null>(null)
  const tapCountRef = useRef(0)
  const lastTapTimeRef = useRef(0)
  const previousGameStateRef = useRef(state.gameState)

  useEffect(() => {
    const previousGameState = previousGameStateRef.current

    // Returning to Main Menu after a crash must always show the normal Home screen,
    // not the power-up selection overlay left open from the previous ride.
    if (state.gameState === 'menu' && previousGameState === 'gameover') {
      setShowPowerUpSelection(false)
      setShowBikes(false)
      setShowStore(false)
      setNavTransition(null)
    }

    previousGameStateRef.current = state.gameState
  }, [state.gameState])

  const startMenuNavigation = (destination: 'garage' | 'store') => {
    if (navTransition) return

    setNavTransition(destination)
    navTransitionTimerRef.current = window.setTimeout(() => {
      if (destination === 'garage') {
        setShowBikes(true)
      } else {
        setShowStore(true)
      }
      setNavTransition(null)
      navTransitionTimerRef.current = null
    }, 420)
  }

  useEffect(() => {
    return () => {
      if (navTransitionTimerRef.current !== null) {
        window.clearTimeout(navTransitionTimerRef.current)
      }
    }
  }, [])

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

  if (showPowerUpSelection && previousGameStateRef.current !== 'gameover') {
    return (
      <PowerUpSelection
        onBack={() => setShowPowerUpSelection(false)}
        onStart={() => {
          actions.useSelectedPowerUps()
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
        @keyframes hsMenuExhaustSmoke {
          0% { transform: translate3d(0, 4px, 0) scale(.34); opacity: 0; filter: blur(1px); }
          10% { opacity: .72; }
          34% { opacity: .54; }
          68% { opacity: .28; }
          100% { transform: translate3d(-34px, -48px, 0) scale(1.8); opacity: 0; filter: blur(6px); }
        }
        .hs-vehicle-facing-right {
          transform: scaleX(-1);
          transform-origin: center;
          display: block;
        }
        .hs-menu-exhaust-smoke {
          animation: hsMenuExhaustSmoke 2.65s ease-out infinite;
          transform-origin: center;
          mix-blend-mode: screen;
        }
        .hs-menu-hero-glow {
          background:
            radial-gradient(circle at 50% 72%, rgba(255,178,72,.24) 0%, rgba(255,143,48,.10) 22%, transparent 48%),
            radial-gradient(circle at 73% 42%, rgba(111,180,219,.25) 0%, transparent 34%),
            linear-gradient(180deg, rgba(19,31,41,.97) 0%, rgba(25,38,48,.94) 48%, rgba(10,15,19,.98) 100%);
        }
        .hs-menu-hero-surface {
          background:
            linear-gradient(180deg, transparent 0%, transparent 55%, rgba(255,187,87,.10) 55.5%, transparent 56.5%),
            repeating-linear-gradient(90deg, transparent 0 11%, rgba(255,255,255,.055) 11.15% 11.35%, transparent 11.6% 28%),
            repeating-linear-gradient(180deg, transparent 0 20px, rgba(255,188,94,.045) 21px, transparent 22px 44px);
          mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 100%);
          animation: hsMenuRoadRush 2.9s linear infinite;
          opacity: .9;
        }
        .hs-menu-hero-horizon {
          box-shadow: 0 0 45px rgba(255,186,95,.22), 0 0 90px rgba(84,150,190,.12);
          animation: hsMenuHorizonPulse 4.2s ease-in-out infinite;
        }
        .hs-menu-smoke-core {
          background: radial-gradient(circle at 34% 30%, rgba(255,255,255,.98) 0%, rgba(232,238,240,.82) 28%, rgba(193,206,212,.56) 56%, rgba(135,151,160,.10) 100%);
          box-shadow: 0 0 18px rgba(224,235,241,.34), 0 0 36px rgba(178,196,207,.16);
        }
        @media (prefers-reduced-motion: reduce) {
          .hs-menu-exhaust-smoke { animation: none; opacity: .42; transform: scale(.9); }
          .hs-menu-hero-surface { animation: none; }
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
        @keyframes hsMenuRoadRush { from { background-position: 0 0, 0 0; } to { background-position: 0 120px, 0 240px; } }
        @keyframes hsMenuSideFlow { 0%,100% { transform: translate3d(0,0,0) scaleX(.98); opacity:.22; } 50% { transform: translate3d(16px,5px,0) scaleX(1.02); opacity:.38; } }
        @keyframes hsMenuHorizonPulse { 0%,100% { transform: scaleX(.9); opacity:.12; } 50% { transform: scaleX(1.05); opacity:.25; } }
        @keyframes hsMenuLightSweep { 0% { transform:translateX(-24vw); opacity:0; } 18% {opacity:.16;} 76% {opacity:.08;} 100% {transform:translateX(124vw); opacity:0;} }
        .hs-menu-road-depth { background: repeating-linear-gradient(90deg,transparent 0 14%,rgba(223,186,108,.16) 14.15% 14.35%,transparent 14.5% 36%,rgba(125,151,165,.11) 36.15% 36.35%,transparent 36.5% 50%), repeating-linear-gradient(180deg,transparent 0 70px,rgba(235,191,92,.14) 71px 74px,transparent 75px 150px); background-size:100% 180px,100% 180px; animation:hsMenuRoadRush 2.7s linear infinite; mask-image:linear-gradient(to bottom,transparent 0%,black 22%,black 100%); }
        .hs-menu-road-edge-left { animation:hsMenuSideFlow 5.5s ease-in-out infinite; }
        .hs-menu-road-edge-right { animation:hsMenuSideFlow 6.4s ease-in-out -1.4s infinite reverse; }
        .hs-menu-horizon-pulse { animation:hsMenuHorizonPulse 4.2s ease-in-out infinite; }
        .hs-menu-light-sweep-1 { animation:hsMenuLightSweep 5.5s linear infinite; }
        .hs-menu-light-sweep-2 { animation:hsMenuLightSweep 6.4s linear 1.4s infinite; }
        .hs-menu-light-sweep-3 { animation:hsMenuLightSweep 7.3s linear 2.8s infinite; }
        @keyframes hsMenuTrafficPass { 0% { transform:translate3d(-18vw,0,0) scaleY(.5); opacity:0; } 14% { opacity:.55; } 72% { opacity:.18; } 100% { transform:translate3d(118vw,0,0) scaleY(1.1); opacity:0; } }
        @keyframes hsMenuRoadsideDepth { 0%,100% { transform:translate3d(0,0,0) scaleY(.94); opacity:.18; } 50% { transform:translate3d(-8px,-10px,0) scaleY(1.04); opacity:.34; } }
        @keyframes hsMenuForegroundRush { 0% { transform:translate3d(-8%,0,0) scaleX(.84); opacity:0; } 16% { opacity:.4; } 100% { transform:translate3d(108%,0,0) scaleX(1.35); opacity:0; } }
        @keyframes hsMenuSkylineDrift { 0%,100% { transform:translate3d(0,0,0); } 50% { transform:translate3d(-28px,-2px,0); } }
        @keyframes hsMenuDustFloat { 0%,100% { transform:translate3d(0,16px,0) scale(.75); opacity:0; } 35% { opacity:.2; } 70% { opacity:.08; } 100% { transform:translate3d(18px,-64px,0) scale(1.15); opacity:0; } }
        @keyframes hsMenuNearLight { 0% { transform:translate3d(0,-20px,0) scale(.55); opacity:0; } 20% { opacity:.46; } 100% { transform:translate3d(0,150px,0) scale(1.2); opacity:0; } }
        .hs-menu-traffic-pass { animation:hsMenuTrafficPass 4.8s linear infinite; }
        .hs-menu-roadside-depth { animation:hsMenuRoadsideDepth 4.7s ease-in-out infinite; transform-origin:center bottom; }
        .hs-menu-foreground-rush { animation:hsMenuForegroundRush 3.4s cubic-bezier(.2,.65,.18,1) infinite; }
        .hs-menu-skyline-drift { animation:hsMenuSkylineDrift 9s ease-in-out infinite; }
        .hs-menu-dust-float { animation:hsMenuDustFloat 3.8s ease-out infinite; }
        .hs-menu-near-light { animation:hsMenuNearLight 2.6s ease-in infinite; }
        @keyframes hsMenuNavButtonLaunch {
          0% { transform:scale(1); filter:brightness(1); box-shadow:0 12px 30px rgba(0,0,0,.24); }
          22% { transform:scale(.965) translateY(1px); filter:brightness(1.2); }
          48% { transform:scale(1.035) translateY(-1px); filter:brightness(1.5); box-shadow:0 0 42px rgba(255,205,120,.34); }
          100% { transform:scale(.985) translateY(-2px); filter:brightness(1.1); }
        }
        @keyframes hsMenuNavWipe {
          0% { transform:translateX(-118%) skewX(-16deg); opacity:0; }
          14% { opacity:.48; }
          58% { opacity:.26; }
          100% { transform:translateX(118%) skewX(-16deg); opacity:0; }
        }
        @keyframes hsMenuNavCore {
          0% { transform:translateX(-36%) scaleX(.55); opacity:0; }
          18% { opacity:.8; }
          58% { opacity:.28; }
          100% { transform:translateX(36%) scaleX(1.15); opacity:0; }
        }
        @keyframes hsMenuNavShock {
          0% { transform:translate(-50%,-50%) scale(.18); opacity:0; }
          18% { opacity:.8; }
          54% { opacity:.28; }
          100% { transform:translate(-50%,-50%) scale(1.35); opacity:0; }
        }
        @keyframes hsMenuNavMicroStreak {
          0% { transform:translateX(-90vw); opacity:0; }
          18% { opacity:.5; }
          100% { transform:translateX(110vw); opacity:0; }
        }
        .hs-menu-nav-launch { animation:hsMenuNavButtonLaunch 420ms cubic-bezier(.16,.8,.18,1) both; }
        .hs-menu-nav-wipe { animation:hsMenuNavWipe 420ms cubic-bezier(.2,.75,.16,1) both; }
        .hs-menu-nav-core { animation:hsMenuNavCore 420ms cubic-bezier(.2,.8,.18,1) both; }
        .hs-menu-nav-shock { animation:hsMenuNavShock 420ms cubic-bezier(.16,.8,.18,1) both; }
        .hs-menu-nav-streak { animation:hsMenuNavMicroStreak 360ms cubic-bezier(.2,.7,.18,1) both; }


      `}</style>

      {/* Static highway backdrop: restrained metallic tones with no continuous background motion. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(216,154,62,.18),transparent_24%),radial-gradient(circle_at_18%_72%,rgba(54,86,103,.18),transparent_30%),linear-gradient(145deg,#10161b_0%,#182129_42%,#0c1014_72%,#07090b_100%)]" />
        <div className="absolute left-1/2 top-[18%] h-[54%] w-[118%] -translate-x-1/2 [perspective:620px]">
          <div className="hs-menu-road-depth absolute inset-0 [transform:rotateX(67deg)] [transform-origin:center_top]" />
        </div>
        <div className="hs-menu-road-edge-left absolute left-[7%] top-[30%] h-[44%] w-[18%] border-l border-amber-300/15" />
        <div className="hs-menu-road-edge-right absolute right-[7%] top-[30%] h-[44%] w-[18%] border-r border-amber-300/15" />
        <div className="hs-menu-horizon-pulse absolute left-1/2 top-[26%] h-12 w-[42%] -translate-x-1/2 rounded-full bg-amber-200/10 blur-2xl" />
        <div className="hs-menu-light-sweep-1 absolute top-[34%] left-[12%] h-px w-[28%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="hs-menu-light-sweep-2 absolute top-[37%] left-[40%] h-px w-[26%] bg-gradient-to-r from-transparent via-slate-200/16 to-transparent" />
        <div className="hs-menu-light-sweep-3 absolute top-[32%] left-[61%] h-px w-[30%] bg-gradient-to-r from-transparent via-amber-200/14 to-transparent" />
        <div className="absolute inset-x-0 top-[28%] h-px bg-gradient-to-r from-transparent via-slate-400/20 to-transparent" />
        <div className="absolute left-[7%] top-[30%] h-[48%] w-px bg-gradient-to-b from-transparent via-amber-300/18 to-transparent" />
        <div className="absolute right-[12%] top-[22%] h-[58%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div
          className="absolute bottom-[-10%] left-1/2 h-[58%] w-[120%] -translate-x-1/2"
          style={{
            background: 'linear-gradient(176deg, transparent 0 48%, rgba(4,7,9,.96) 48.5% 49.2%, transparent 49.7% 100%), linear-gradient(90deg, transparent 0 23%, rgba(224,178,87,.12) 23.2% 23.5%, transparent 23.7% 76.3%, rgba(224,178,87,.12) 76.5% 76.8%, transparent 77% 100%)',
            transform: 'perspective(700px) rotateX(58deg)',
            transformOrigin: 'top center',
          }}
        />

        {/* Layered racing-depth elements: distant structures, passing traffic lights, dust and foreground streaks. */}
        <div className="absolute inset-x-0 top-[13%] h-[21%] overflow-hidden opacity-40">
          <div className="hs-menu-skyline-drift absolute left-[-6%] bottom-0 h-[72%] w-[112%]">
            <div className="absolute inset-x-0 bottom-0 h-[18%] bg-white/[0.035]" />
            <div className="absolute left-[6%] bottom-[14%] h-[44%] w-[7%] border border-white/[0.08] bg-black/15" />
            <div className="absolute left-[16%] bottom-[14%] h-[66%] w-[10%] border border-white/[0.07] bg-black/20" />
            <div className="absolute left-[31%] bottom-[14%] h-[52%] w-[8%] border border-white/[0.06] bg-black/20" />
            <div className="absolute left-[49%] bottom-[14%] h-[76%] w-[11%] border border-white/[0.07] bg-black/20" />
            <div className="absolute left-[68%] bottom-[14%] h-[48%] w-[8%] border border-white/[0.06] bg-black/20" />
            <div className="absolute left-[82%] bottom-[14%] h-[61%] w-[12%] border border-white/[0.07] bg-black/20" />
          </div>
        </div>

        <div className="hs-menu-roadside-depth absolute left-[10%] top-[34%] h-[34%] w-[3px] rounded-full bg-gradient-to-b from-transparent via-white/20 to-amber-200/35" />
        <div className="hs-menu-roadside-depth absolute left-[18%] top-[39%] h-[28%] w-[2px] rounded-full bg-gradient-to-b from-transparent via-slate-200/20 to-amber-200/25" style={{ animationDelay: '-1.8s' }} />
        <div className="hs-menu-roadside-depth absolute right-[17%] top-[36%] h-[31%] w-[3px] rounded-full bg-gradient-to-b from-transparent via-white/18 to-amber-200/30" style={{ animationDelay: '-2.6s' }} />
        <div className="hs-menu-roadside-depth absolute right-[9%] top-[31%] h-[39%] w-[2px] rounded-full bg-gradient-to-b from-transparent via-slate-100/18 to-amber-200/28" style={{ animationDelay: '-.9s' }} />

        <div className="hs-menu-traffic-pass absolute left-[8%] top-[39%] h-1 w-[19%] rounded-full bg-gradient-to-r from-transparent via-white/38 to-transparent blur-[1px]" />
        <div className="hs-menu-traffic-pass absolute left-[26%] top-[43%] h-px w-[14%] rounded-full bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" style={{ animationDelay: '-1.3s' }} />
        <div className="hs-menu-traffic-pass absolute left-[55%] top-[37%] h-1 w-[22%] rounded-full bg-gradient-to-r from-transparent via-white/28 to-transparent blur-[1px]" style={{ animationDelay: '-2.4s' }} />

        <div className="hs-menu-near-light absolute left-[32%] top-[42%] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_20px_rgba(255,215,140,.6)]" />
        <div className="hs-menu-near-light absolute left-[71%] top-[39%] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,.5)]" style={{ animationDelay: '-1.1s' }} />
        <div className="hs-menu-near-light absolute left-[84%] top-[48%] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_20px_rgba(255,215,140,.45)]" style={{ animationDelay: '-1.9s' }} />

        <div className="hs-menu-foreground-rush absolute left-[-15%] bottom-[23%] h-1.5 w-[28%] rounded-full bg-gradient-to-r from-transparent via-white/22 to-transparent blur-[2px]" />
        <div className="hs-menu-foreground-rush absolute left-[-5%] bottom-[28%] h-px w-[20%] rounded-full bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" style={{ animationDelay: '-1.6s' }} />

        <div className="hs-menu-dust-float absolute left-[26%] top-[60%] h-1.5 w-1.5 rounded-full bg-white/30" />
        <div className="hs-menu-dust-float absolute left-[67%] top-[56%] h-1 w-1 rounded-full bg-white/22" style={{ animationDelay: '-1.4s' }} />
        <div className="hs-menu-dust-float absolute left-[76%] top-[62%] h-1.5 w-1.5 rounded-full bg-amber-200/25" style={{ animationDelay: '-2.5s' }} />

        <div className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      </div>

      {navTransition && (
        <div
          className="absolute inset-0 z-[80] pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={[
              'absolute inset-0',
              navTransition === 'garage'
                ? 'bg-[radial-gradient(circle_at_50%_52%,rgba(255,201,120,.20),transparent_34%),linear-gradient(90deg,transparent,rgba(255,159,61,.08),transparent)]'
                : 'bg-[radial-gradient(circle_at_50%_52%,rgba(90,210,255,.18),transparent_34%),linear-gradient(90deg,transparent,rgba(63,164,205,.08),transparent)]',
            ].join(' ')}
          />
          <div
            className={[
              'absolute top-0 h-full w-[58%] blur-[1px]',
              navTransition === 'garage'
                ? 'bg-gradient-to-r from-transparent via-amber-200/18 to-transparent'
                : 'bg-gradient-to-r from-transparent via-cyan-200/16 to-transparent',
              'hs-menu-nav-wipe',
            ].join(' ')}
          />
          <div
            className={[
              'absolute left-1/2 top-1/2 h-10 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[2px]',
              navTransition === 'garage'
                ? 'bg-gradient-to-r from-transparent via-amber-200/48 to-transparent'
                : 'bg-gradient-to-r from-transparent via-cyan-200/42 to-transparent',
              'hs-menu-nav-core',
            ].join(' ')}
          />
          <div
            className={[
              'absolute left-1/2 top-1/2 h-24 w-24 rounded-full border',
              navTransition === 'garage'
                ? 'border-amber-200/30 shadow-[0_0_40px_rgba(255,191,88,.30)]'
                : 'border-cyan-200/28 shadow-[0_0_40px_rgba(72,195,255,.26)]',
              'hs-menu-nav-shock',
            ].join(' ')}
          />
          <div
            className={[
              'absolute top-[31%] h-px w-[42%] bg-gradient-to-r from-transparent to-transparent',
              navTransition === 'garage'
                ? 'via-amber-200/42'
                : 'via-cyan-200/38',
              'hs-menu-nav-streak',
            ].join(' ')}
          />
          <div
            className={[
              'absolute top-[64%] h-px w-[28%] bg-gradient-to-r from-transparent to-transparent',
              navTransition === 'garage'
                ? 'via-white/25'
                : 'via-sky-100/22',
              'hs-menu-nav-streak',
            ].join(' ')}
            style={{ animationDelay: '-120ms' }}
          />
        </div>
      )}

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
          <div className="hs-menu-enter hs-menu-enter-delay relative mx-auto mb-5 sm:mb-6 h-[170px] sm:h-[215px] w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200/10 bg-slate-950/80 backdrop-blur-[2px]">
            <div className="absolute inset-0 hs-menu-hero-glow" />
            <div className="absolute inset-x-0 top-[20%] h-[52%] hs-menu-hero-surface pointer-events-none" />
            <div className="absolute left-1/2 top-[44%] h-px w-[62%] -translate-x-1/2 rounded-full bg-amber-200/30 hs-menu-hero-horizon pointer-events-none" />
            <div className="absolute inset-x-10 bottom-5 h-10 rounded-[50%] border border-white/[0.12] bg-white/[0.05]" />
            <div
              className="absolute bottom-8 left-1/2 h-20 w-52 sm:w-64 -translate-x-1/2 rounded-[50%] bg-amber-300/10 blur-2xl"
              style={{ animation: 'hsMenuGlow 3.7s ease-in-out infinite' }}
            />
            <div className="absolute inset-0 pointer-events-none z-[4]" aria-hidden="true">
              <div className="absolute left-[30%] top-[53%] h-7 w-7 sm:left-[31%] sm:top-[53%]">
                <span className="absolute -inset-3 rounded-full bg-slate-200/10 blur-xl" />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="hs-menu-exhaust-smoke hs-menu-smoke-core absolute left-0 top-0 block rounded-full"
                    style={{
                      width: `${7 + (i % 3) * 3}px`,
                      height: `${7 + (i % 3) * 3}px`,
                      animationDelay: `${i * 0.34 - 1.7}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              key={heroVehicle.id}
              className="absolute inset-0 z-[8] flex items-center justify-center"
              style={{ animation: 'hsMenuVehicleIn 240ms ease-out' }}
            >
              <div
                className="relative h-[125px] w-[225px] sm:h-[155px] sm:w-[285px]"
              >
                {isCar
  ? <CarIcon car={state.selectedCar} />
  : <BikeIcon bike={state.selectedBike} skin={state.selectedSkin} />}
              </div>
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
                onClick={() => startMenuNavigation('garage')}
                className={[
                  'hs-btn hs-btn-secondary rounded-2xl py-3 sm:py-3.5 text-sm sm:text-base font-black text-white shadow-lg transition-all',
                  navTransition === 'garage' ? 'hs-menu-nav-launch' : '',
                  navTransition ? 'pointer-events-none' : '',
                ].join(' ')}
              >
                <svg className="mx-auto mb-0.5 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="6.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
                  <circle cx="17.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
                  <path d="M8.5 16.5 11 10h4l2.5 6.5M11 10 9.5 7.5h3l2 2.5M15 10l2-2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                GARAGE
              </button>

              <button
                onClick={() => startMenuNavigation('store')}
                className={[
                  'rounded-2xl border border-white/12 bg-white/[0.055] py-3 sm:py-3.5 text-sm sm:text-base font-black text-white shadow-lg transition-all hover:bg-white/[0.09] hover:border-white/20 active:scale-[0.98]',
                  navTransition === 'store' ? 'hs-menu-nav-launch' : '',
                  navTransition ? 'pointer-events-none' : '',
                ].join(' ')}
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

function SkinSelector({ bikeId, isSelected }: { bikeId: string; isSelected: boolean }) {
  const state = useGameStore()
  const availableSkins = BIKE_SKINS[bikeId] || []
  // Only the currently selected bike's equipped paint gets an active highlight.
  const currentSkin = isSelected ? state.selectedSkin : null

  return (
    <div className="mt-1.5 flex items-center gap-1">
      {availableSkins.map((skin: BikeSkin) => {
        const isActive = isSelected && currentSkin === skin
        return (
          <button
            key={skin}
            onClick={() => actions.selectSkin(bikeId, skin)}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 transition-all active:scale-90 ${
              isActive ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
            }`}
            style={{
              background: SKIN_SWATCHES[skin],
              boxShadow: isActive ? `0 0 12px ${SKIN_COLORS[skin]?.color || '#ffffff'}66` : undefined,
            }}
            title={SKIN_NAMES[skin] || skin}
            aria-label={SKIN_NAMES[skin] || skin}
          />
        )
      })}
    </div>
  )
}


function CarColorSelector({ carId, isSelected }: { carId: string; isSelected: boolean }) {
  const state = useGameStore()
  const availableColors = CAR_COLORS[carId] || []
  // Only the currently selected car's equipped paint gets an active highlight.
  const currentColor = isSelected ? state.selectedCarColor : null

  return (
    <div className="mt-1.5 flex items-center gap-1">
      {availableColors.map((paint: CarColorOption) => {
        const isActive = isSelected && currentColor === paint.id
        return (
          <button
            key={paint.id}
            onClick={() => actions.selectCarColor(carId, paint.id)}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 transition-all active:scale-90 ${isActive ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'}`}
            style={{
              background: `linear-gradient(145deg, ${paint.accentColor}, ${paint.color})`,
              boxShadow: isActive ? `0 0 12px ${paint.color}66` : undefined,
            }}
            title={paint.name}
            aria-label={paint.name}
          />
        )
      })}
    </div>
  )
}

// ============== GARAGE ==============
function GarageVehicleArt({
  children,
  className = '',
}: {
  section: 'bikes' | 'cars'
  vehicleId: string
  children: React.ReactNode
  className?: string
}) {
  // Shared vehicle artwork already owns its right-facing orientation.
  return <div className={className}>{children}</div>
}

function GarageShowroomPreview({
  state,
  section,
}: {
  state: GameData
  section: 'bikes' | 'cars'
}) {
  const isBike = section === 'bikes'
  const selectedMode = isBike ? 'bike' : 'car'
  const isSectionSelected = state.vehicleMode === selectedMode
  const vehicle = isSectionSelected
    ? (isBike ? state.selectedBike : state.selectedCar)
    : null
  const vehicleId = vehicle?.id ?? null

  type GarageVehicleSnapshot = {
    section: 'bikes' | 'cars'
    vehicle: Bike | Car
    id: string
    skin?: BikeSkin
  }

  const previousVehicleRef = useRef<GarageVehicleSnapshot | null>(
    isSectionSelected
      ? { section, vehicle: vehicle as Bike | Car, id: vehicleId as string }
      : null
  )
  const switchNonceRef = useRef(0)
  const [switchFx, setSwitchFx] = useState<GarageVehicleSnapshot | null>(null)
  const selectedPaintId = isBike ? state.selectedSkin : state.selectedCarColor
  const previousSkinRef = useRef<string | null>(
    isSectionSelected ? selectedPaintId : null
  )
  const skinFxNonceRef = useRef(0)
  const [skinFx, setSkinFx] = useState(false)

  useEffect(() => {
    const previous = previousVehicleRef.current

    // Changing the BIKES/CARS filter must not select the previously saved
    // vehicle from the other category.
    if (!isSectionSelected || !vehicle || !vehicleId) {
      previousVehicleRef.current = null
      setSwitchFx(null)
      return
    }

    const changedSameSection =
      previous !== null &&
      previous.section === section &&
      previous.id !== vehicleId

    const nonce = ++switchNonceRef.current

    if (changedSameSection) {
      setSwitchFx(previous)
    } else {
      setSwitchFx(null)
    }

    previousVehicleRef.current = {
      section,
      vehicle,
      id: vehicleId,
      skin: isBike ? state.selectedSkin : undefined,
    }

    if (!changedSameSection) return

    const timer = window.setTimeout(() => {
      if (switchNonceRef.current === nonce) {
        setSwitchFx(null)
      }
    }, 470)

    return () => window.clearTimeout(timer)
  }, [section, vehicleId, isSectionSelected])

  useEffect(() => {
    if (!isSectionSelected) {
      previousSkinRef.current = null
      setSkinFx(false)
      return
    }

    const previousSkin = previousSkinRef.current
    const changed = previousSkin !== null && previousSkin !== selectedPaintId
    previousSkinRef.current = selectedPaintId

    if (!changed) return

    const nonce = ++skinFxNonceRef.current
    setSkinFx(true)

    const timer = window.setTimeout(() => {
      if (skinFxNonceRef.current === nonce) {
        setSkinFx(false)
      }
    }, 420)

    return () => window.clearTimeout(timer)
  }, [isSectionSelected, selectedPaintId])

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

        @keyframes hsGarageSwitchOld {
          0% {
            opacity: 1;
            transform: perspective(900px) translate3d(0, 0, 0) scale(1) rotateY(0deg);
            filter: blur(0);
          }
          42% {
            opacity: .94;
            transform: perspective(900px) translate3d(-16px, -2px, 36px) scale(1.02) rotateY(-4deg);
            filter: blur(.1px);
          }
          100% {
            opacity: 0;
            transform: perspective(900px) translate3d(-150px, -12px, 72px) scale(.82) rotateY(-14deg);
            filter: blur(2px);
          }
        }

        @keyframes hsGarageSwitchNew {
          0% {
            opacity: 0;
            transform: perspective(900px) translate3d(150px, 12px, 72px) scale(.82) rotateY(14deg);
            filter: blur(2px);
          }
          34% {
            opacity: .9;
            transform: perspective(900px) translate3d(18px, 2px, 28px) scale(1.03) rotateY(4deg);
            filter: blur(.25px);
          }
          70% {
            opacity: 1;
            transform: perspective(900px) translate3d(-2px, 0, 0) scale(1.005) rotateY(-1deg);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: perspective(900px) translate3d(0, 0, 0) scale(1) rotateY(0deg);
            filter: blur(0);
          }
        }

        @keyframes hsGarageSwitchBurst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(.35);
          }
          18% {
            opacity: .9;
          }
          58% {
            opacity: .42;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.48);
          }
        }

        @keyframes hsGarageSwitchRing {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(.52) rotateX(64deg);
          }
          18% {
            opacity: .75;
          }
          70% {
            opacity: .22;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.65) rotateX(64deg);
          }
        }

        @keyframes hsGarageSwitchStreak {
          0% {
            opacity: 0;
            transform: translate3d(0, 34px, 0) scaleX(.25);
          }
          20% {
            opacity: .72;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -38px, 0) scaleX(1.15);
          }
        }

        @keyframes hsGarageSwitchSpark {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(.35);
          }
          24% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--dx), var(--dy), 0) scale(0);
          }
        }

        @keyframes hsGarageSwitchFlash {
          0% {
            opacity: 0;
          }
          16% {
            opacity: .34;
          }
          45% {
            opacity: .08;
          }
          100% {
            opacity: 0;
          }
        }

        .hs-garage-switch-reduced {
          @media (prefers-reduced-motion: reduce) {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }

        @keyframes hsGarageFloorGlow {
          0%, 100% { transform: scaleX(.94); opacity: .34; }
          50% { transform: scaleX(1.04); opacity: .5; }
        }

        @keyframes hsGaragePaintChange {
          0% {
            transform: scale(1);
            filter: saturate(.72) brightness(.92);
          }
          28% {
            transform: scale(1.035);
            filter: saturate(1.45) brightness(1.16);
          }
          62% {
            transform: scale(1.012);
            filter: saturate(1.12) brightness(1.05);
          }
          100% {
            transform: scale(1);
            filter: saturate(1) brightness(1);
          }
        }

        @keyframes hsGaragePaintSweep {
          0% {
            transform:translateX(-130%) skewX(-18deg);
            opacity:0;
          }
          18% { opacity:.42; }
          58% { opacity:.18; }
          100% {
            transform:translateX(130%) skewX(-18deg);
            opacity:0;
          }
        }

        @keyframes hsGaragePaintPulse {
          0% {
            transform:translate(-50%,-50%) scale(.72);
            opacity:0;
          }
          22% { opacity:.34; }
          55% { opacity:.16; }
          100% {
            transform:translate(-50%,-50%) scale(1.25);
            opacity:0;
          }
        }

        .hs-garage-paint-change { animation:hsGaragePaintChange 420ms cubic-bezier(.16,.8,.18,1) both; }
        .hs-garage-paint-sweep { animation:hsGaragePaintSweep 360ms cubic-bezier(.2,.72,.18,1) both; }
        .hs-garage-paint-pulse { animation:hsGaragePaintPulse 420ms cubic-bezier(.16,.8,.18,1) both; }
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

        {switchFx && (
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_54%,rgba(255,255,255,.22),transparent_20%),linear-gradient(90deg,transparent,rgba(255,210,120,.10),transparent)]"
              style={{ animation: 'hsGarageSwitchFlash 470ms ease-out both' }}
            />

            <div
              className="absolute left-1/2 top-[58%] h-24 w-40 sm:h-28 sm:w-52 rounded-full border border-white/25 bg-white/[0.025] blur-[1px]"
              style={{
                color: switchFx.vehicle.accentColor,
                borderColor: `color-mix(in srgb, currentColor 48%, white 20%)`,
                boxShadow: `0 0 38px color-mix(in srgb, currentColor 28%, transparent)`,
                animation: 'hsGarageSwitchRing 470ms cubic-bezier(.16,.8,.18,1) both',
              }}
            />

            <div
              className="absolute left-1/2 top-[52%] h-16 w-16 rounded-full border-2 border-white/25"
              style={{
                color: switchFx.vehicle.color,
                boxShadow: `0 0 40px 10px color-mix(in srgb, currentColor 24%, transparent)`,
                animation: 'hsGarageSwitchBurst 470ms cubic-bezier(.16,.8,.18,1) both',
              }}
            />

            <div
              className="absolute left-1/2 top-[57%] h-1 w-[62%] rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent blur-[1px]"
              style={{ animation: 'hsGarageSwitchStreak 420ms cubic-bezier(.2,.75,.2,1) 25ms both' }}
            />

            {[
              { dx: '-68px', dy: '-42px', left: '39%', top: '55%', delay: '0ms' },
              { dx: '76px', dy: '-34px', left: '61%', top: '55%', delay: '20ms' },
              { dx: '-92px', dy: '24px', left: '42%', top: '58%', delay: '42ms' },
              { dx: '98px', dy: '18px', left: '58%', top: '59%', delay: '58ms' },
              { dx: '-44px', dy: '58px', left: '46%', top: '56%', delay: '78ms' },
              { dx: '48px', dy: '56px', left: '54%', top: '56%', delay: '92ms' },
            ].map((spark, index) => (
              <span
                key={index}
                className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,.9)]"
                style={{
                  left: spark.left,
                  top: spark.top,
                  ['--dx' as string]: spark.dx,
                  ['--dy' as string]: spark.dy,
                  animation: 'hsGarageSwitchSpark 430ms cubic-bezier(.16,.8,.18,1) both',
                  animationDelay: spark.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* Previous vehicle leaves through the same racing-stage while the new one arrives. */}
        {switchFx && (
          <div
            className="absolute left-1/2 bottom-14 z-[21] h-[138px] w-[210px] sm:h-[164px] sm:w-[260px] -translate-x-1/2 pointer-events-none"
            style={{ perspective: '900px', animation: 'hsGarageSwitchOld 470ms cubic-bezier(.18,.78,.2,1) both' }}
          >
            <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
              <div
                className="h-[104px] w-[178px] sm:h-[126px] sm:w-[218px] rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, ${switchFx.vehicle.color}26, ${switchFx.vehicle.accentColor}16)`,
                  boxShadow: `0 16px 42px ${switchFx.vehicle.color}1a`,
                }}
              >
                <div className="h-[88px] w-[168px] sm:h-[112px] sm:w-[208px]">
                  <GarageVehicleArt section={switchFx.section} vehicleId={switchFx.id} className="h-full w-full">
                    {switchFx.section === 'bikes'
                      ? <BikeIcon bike={switchFx.vehicle as Bike} skin={switchFx.skin} />
                      : <CarIcon car={switchFx.vehicle as Car} />}
                  </GarageVehicleArt>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle turntable / arrival stage. A category with no
            active selection stays visibly empty until the player picks a vehicle. */}
        {vehicle ? (
          <div
            key={`garage-vehicle-${section}-${vehicleId}-${switchNonceRef.current}`}
            className="absolute left-1/2 bottom-14 z-[22] h-[138px] w-[210px] sm:h-[164px] sm:w-[260px] -translate-x-1/2"
            style={{
              animation: switchFx
                ? 'hsGarageSwitchNew 470ms cubic-bezier(.16,.8,.18,1) both'
                : skinFx
                ? 'hsGaragePaintChange 420ms cubic-bezier(.16,.8,.18,1) both'
                : 'hsGarageVehicleIn 240ms ease-out',
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
                  <GarageVehicleArt section={section} vehicleId={vehicleId as string} className="h-full w-full">
                    {isBike
                      ? <BikeIcon bike={state.selectedBike} skin={state.selectedSkin} />
                      : <CarIcon car={state.selectedCar} />}
                  </GarageVehicleArt>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-14 z-[22] flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="h-20 w-32 sm:h-24 sm:w-40 rounded-[50%] border border-white/[0.08] bg-white/[0.02] shadow-[0_16px_42px_rgba(0,0,0,.25)]" />
            <p className="mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
              Select a {isBike ? 'bike' : 'car'} below
            </p>
          </div>
        )}

        {skinFx && vehicle && (
          <div className="absolute inset-0 z-[25] pointer-events-none overflow-hidden">
            <div
              className="absolute left-1/2 top-[53%] h-20 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
              style={{
                background: `radial-gradient(circle, ${vehicle.color}35 0%, ${vehicle.accentColor}16 42%, transparent 72%)`,
                animation: 'hsGaragePaintPulse 420ms cubic-bezier(.16,.8,.18,1) both',
              }}
            />
            <div
              className="absolute left-[-20%] top-[34%] h-[46%] w-[28%] bg-gradient-to-r from-transparent via-white/32 to-transparent blur-[1px] hs-garage-paint-sweep"
            />
          </div>
        )}

        {/* Showroom metadata */}
        <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.24em] text-white/40 font-semibold">
            {isBike ? 'Bike Showroom' : 'Car Showroom'}
          </p>
          {vehicle ? (
            <p className="mt-1 text-sm sm:text-base font-black text-white">{vehicle.name}</p>
          ) : (
            <p className="mt-1 text-sm sm:text-base font-black text-white/40">No {isBike ? 'bike' : 'car'} selected</p>
          )}
        </div>
      </div>
    </div>
  )
}

function GarageSelection({ onBack }: { onBack: () => void }) {
  const state = useGameStore()
  const [section, setSection] = useState<'bikes' | 'cars'>('bikes')

  return (
    <div className="hs-screen hs-screen-enter absolute inset-0 flex flex-col overflow-y-auto bg-[#0a0f13]">
      <style>{`
        @keyframes hsGarageFloorFlow { from { background-position:0 0,0 0; } to { background-position:0 180px,120px 0; } }
        @keyframes hsGarageLightSweep { 0%,100% { transform:translateX(-24px); opacity:.10; } 50% { transform:translateX(18px); opacity:.22; } }
        @keyframes hsGarageVehicleDrift { 0%,100% { transform:translate3d(0,0,0) scale(.98); } 50% { transform:translate3d(-18px,5px,0) scale(1.01); } }
        @keyframes hsGarageReflection { 0% { transform:translateX(-30%); opacity:0; } 25% { opacity:.12; } 75% { opacity:.06; } 100% { transform:translateX(130%); opacity:0; } }
        .hs-garage-floor-depth { background:linear-gradient(rgba(159,178,190,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(159,178,190,.06) 1px,transparent 1px); background-size:84px 58px; animation:hsGarageFloorFlow 5.5s linear infinite; mask-image:linear-gradient(to top,black,transparent 92%); }
        @keyframes hsGarageBayTraverse { 0%,100% { transform:translate3d(-3%,0,0) rotateY(0deg); opacity:.16; } 50% { transform:translate3d(3%,0,0) rotateY(-4deg); opacity:.3; } }
        @keyframes hsGarageCeilingSweep { 0% { transform:translate3d(-38vw,0,0); opacity:0; } 16% { opacity:.26; } 82% { opacity:.09; } 100% { transform:translate3d(138vw,0,0); opacity:0; } }
        @keyframes hsGaragePanelGlow { 0%,100% { transform:scaleY(.85); opacity:.11; } 50% { transform:scaleY(1.04); opacity:.3; } }
        @keyframes hsGarageDustDrift { 0% { transform:translate3d(0,28px,0) scale(.65); opacity:0; } 25% { opacity:.18; } 75% { opacity:.06; } 100% { transform:translate3d(28px,-70px,0) scale(1.08); opacity:0; } }
        @keyframes hsGarageFloorReflection { 0% { transform:translateX(-46%); opacity:0; } 18% { opacity:.16; } 72% { opacity:.07; } 100% { transform:translateX(146%); opacity:0; } }
        .hs-garage-bay-traverse { animation:hsGarageBayTraverse 8.5s ease-in-out infinite; }
        .hs-garage-ceiling-sweep { animation:hsGarageCeilingSweep 5.8s linear infinite; }
        .hs-garage-panel-glow { animation:hsGaragePanelGlow 3.9s ease-in-out infinite; }
        .hs-garage-dust-drift { animation:hsGarageDustDrift 4.4s ease-out infinite; }
        .hs-garage-floor-reflection { animation:hsGarageFloorReflection 6.2s linear infinite; }

      `}</style>
      {/* Static garage environment. Selected vehicle is visible in the background, offset from labels. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(211,157,71,.14),transparent_27%),radial-gradient(circle_at_16%_65%,rgba(48,81,99,.17),transparent_34%),linear-gradient(135deg,#0c1217_0%,#17212a_50%,#080b0e_100%)]" />
        <div className="absolute inset-x-0 top-[8.5rem] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-[-4%] h-[56%] [perspective:720px]">
          <div className="hs-garage-floor-depth absolute inset-[-10%] [transform:rotateX(68deg)] [transform-origin:center_bottom]" />
        </div>
        <div className="absolute left-[10%] top-[17%] h-[68%] w-px bg-gradient-to-b from-transparent via-slate-200/16 to-transparent" style={{ animation: "hsGarageLightSweep 4.8s ease-in-out infinite" }} />
        <div className="absolute right-[13%] top-[14%] h-[72%] w-px bg-gradient-to-b from-transparent via-amber-300/20 to-transparent" style={{ animation: "hsGarageLightSweep 5.6s ease-in-out -1.7s infinite reverse" }} />
        <div className="absolute top-[18%] left-[-20%] h-px w-[58%] bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" style={{ animation: "hsGarageReflection 7s linear infinite" }} />
        <div className="absolute right-[-6%] top-[15%] h-44 w-[42%] max-w-[360px] opacity-[0.13] saturate-50 sm:right-[2%] sm:top-[13%] sm:h-56 sm:w-[34%]" style={{ animation: "hsGarageVehicleDrift 7s ease-in-out infinite" }}>
          <GarageVehicleArt section={section} vehicleId={section === 'bikes' ? state.selectedBike.id : state.selectedCar.id} className="h-full w-full">
            {section === "bikes"
            ? <BikeIcon bike={state.selectedBike} skin={state.selectedSkin} />
            : <CarIcon car={state.selectedCar} />}
          </GarageVehicleArt>
        </div>

        {/* Multi-layer garage depth: ceiling bays, moving reflections and foreground particles. */}
        <div className="hs-garage-bay-traverse absolute inset-x-[4%] top-[8%] h-[34%] [perspective:900px]" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-full [transform:rotateX(58deg)] [transform-origin:center_top]">
            <div className="absolute inset-x-[5%] top-0 h-1/2 border-t border-white/[0.08] bg-gradient-to-b from-white/[0.025] to-transparent" />
            <div className="absolute left-[8%] top-0 h-[82%] w-px bg-gradient-to-b from-white/15 to-transparent" />
            <div className="absolute left-[27%] top-0 h-[82%] w-px bg-gradient-to-b from-white/12 to-transparent" />
            <div className="absolute left-[50%] top-0 h-[82%] w-px bg-gradient-to-b from-white/12 to-transparent" />
            <div className="absolute left-[74%] top-0 h-[82%] w-px bg-gradient-to-b from-white/12 to-transparent" />
            <div className="absolute right-[8%] top-0 h-[82%] w-px bg-gradient-to-b from-white/15 to-transparent" />
          </div>
        </div>

        <div className="hs-garage-ceiling-sweep absolute top-[11%] left-[-30%] h-px w-[44%] bg-gradient-to-r from-transparent via-white/24 to-transparent blur-[1px]" />
        <div className="hs-garage-ceiling-sweep absolute top-[19%] left-[-24%] h-px w-[34%] bg-gradient-to-r from-transparent via-amber-200/24 to-transparent" style={{ animationDelay: '-2.2s' }} />
        <div className="hs-garage-ceiling-sweep absolute top-[27%] left-[-20%] h-px w-[30%] bg-gradient-to-r from-transparent via-slate-200/18 to-transparent" style={{ animationDelay: '-3.6s' }} />

        <div className="hs-garage-panel-glow absolute left-[7%] top-[25%] h-[22%] w-1 rounded-full bg-gradient-to-b from-transparent via-white/25 to-transparent" />
        <div className="hs-garage-panel-glow absolute left-[18%] top-[20%] h-[28%] w-px rounded-full bg-gradient-to-b from-transparent via-amber-200/24 to-transparent" style={{ animationDelay: '-1.2s' }} />
        <div className="hs-garage-panel-glow absolute right-[19%] top-[18%] h-[31%] w-px rounded-full bg-gradient-to-b from-transparent via-slate-200/20 to-transparent" style={{ animationDelay: '-2.1s' }} />
        <div className="hs-garage-panel-glow absolute right-[8%] top-[24%] h-[23%] w-1 rounded-full bg-gradient-to-b from-transparent via-amber-200/20 to-transparent" style={{ animationDelay: '-.7s' }} />

        <div className="hs-garage-floor-reflection absolute left-[-20%] bottom-[14%] h-1 w-[46%] rounded-full bg-gradient-to-r from-transparent via-white/18 to-transparent blur-[3px]" />
        <div className="hs-garage-floor-reflection absolute left-[-12%] bottom-[20%] h-px w-[34%] rounded-full bg-gradient-to-r from-transparent via-amber-200/16 to-transparent" style={{ animationDelay: '-3.1s' }} />

        <div className="hs-garage-dust-drift absolute left-[28%] top-[48%] h-1.5 w-1.5 rounded-full bg-white/28" />
        <div className="hs-garage-dust-drift absolute left-[64%] top-[43%] h-1 w-1 rounded-full bg-amber-100/22" style={{ animationDelay: '-1.7s' }} />
        <div className="hs-garage-dust-drift absolute left-[79%] top-[51%] h-1.5 w-1.5 rounded-full bg-white/20" style={{ animationDelay: '-3.0s' }} />

        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-black/55 to-transparent" />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center p-3 sm:p-4 border-b border-white/10 bg-[#0a0f13]/88 backdrop-blur-xl">
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

      {/* Vehicle filters — always visible above the showroom */}
      <div className="relative z-30 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/15 bg-[#0a1116]/92 p-1.5 shadow-xl shadow-black/30 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setSection('bikes')}
            aria-pressed={section === 'bikes'}
            className={`min-h-[58px] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-black tracking-[0.08em] transition-all ${
              section === 'bikes'
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/25 ring-1 ring-amber-200/40'
                : 'bg-white/[0.045] text-white/55 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <svg className="mx-auto mb-1 h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
              <circle cx="17.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M8.5 16.5 11 10h4l2.5 6.5M11 10 9.5 7.5h3l2 2.5M15 10l2-2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            BIKES
          </button>
          <button
            type="button"
            onClick={() => setSection('cars')}
            aria-pressed={section === 'cars'}
            className={`min-h-[58px] rounded-xl px-3 py-2.5 text-xs sm:text-sm font-black tracking-[0.08em] transition-all ${
              section === 'cars'
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/25 ring-1 ring-amber-200/40'
                : 'bg-white/[0.045] text-white/55 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <svg className="mx-auto mb-1 h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                        <div
                          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.06]"
                          style={{ transform: 'none' }}
                        >
                          <BikeIcon bike={bike} />
                        </div>
                      ) : (
                        <>
                          <div
                            className="w-full h-full opacity-25 grayscale"
                            style={{ transform: 'none' }}
                          >
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
                          <SkinSelector bikeId={bike.id} isSelected={isSelected} />
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
                        <div
                          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.06]"
                          style={{ transform: 'none' }}
                        >
                          <CarIcon car={car} />
                        </div>
                      ) : (
                        <>
                          <div
                            className="w-full h-full opacity-25 grayscale"
                            style={{ transform: 'none' }}
                          >
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
                        <>
                          <div className="mt-1.5">
                            <p className="text-[10px] sm:text-xs text-gray-400">
                              Top Speed: <span className="text-white font-semibold">{car.maxSpeed} kmph</span>
                            </p>
                          </div>
                          <CarColorSelector carId={car.id} isSelected={isSelected} />
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

// ============== STORE ==============
function Store({ onBack }: { onBack: () => void }) {
  const state = useGameStore()

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-[#0b1015]">
      <style>{`
        @keyframes hsStoreLaneFlow { from { background-position:0 0,0 0; } to { background-position:0 130px,-160px 0; } }
        @keyframes hsStoreScanner { 0% { transform:translateX(-24vw); opacity:0; } 18% { opacity:.18; } 82% { opacity:.08; } 100% { transform:translateX(124vw); opacity:0; } }
        @keyframes hsStoreSignal { 0%,100% { opacity:.20; transform:scaleY(.85); } 50% { opacity:.50; transform:scaleY(1); } }
        @keyframes hsStoreBadgeFloat { 0%,100% { transform:translate3d(0,0,0); } 50% { transform:translate3d(-10px,5px,0); } }
        .hs-store-floor-depth { background:repeating-linear-gradient(90deg,transparent 0 8%,rgba(214,178,93,.13) 8.2% 8.5%,transparent 8.8% 24%),repeating-linear-gradient(180deg,transparent 0 54px,rgba(142,165,177,.10) 55px 56px,transparent 57px 108px); background-size:100% 180px,100% 108px; animation:hsStoreLaneFlow 4.4s linear infinite; mask-image:linear-gradient(to bottom,transparent 0%,black 18%,black 100%); }
        @keyframes hsStorePitLaneRush { 0% { transform:translate3d(-36vw,0,0) skewX(-18deg); opacity:0; } 15% { opacity:.34; } 100% { transform:translate3d(136vw,0,0) skewX(-18deg); opacity:0; } }
        @keyframes hsStoreShelfDepth { 0%,100% { transform:translate3d(0,0,0) rotateY(-4deg); opacity:.18; } 50% { transform:translate3d(-14px,-3px,0) rotateY(4deg); opacity:.32; } }
        @keyframes hsStoreBeaconFloat { 0%,100% { transform:translate3d(0,0,0) scale(.9); opacity:.18; } 50% { transform:translate3d(7px,-11px,0) scale(1.06); opacity:.48; } }
        @keyframes hsStoreCrateSlide { 0% { transform:translate3d(-18vw,8px,0) rotate(-5deg); opacity:0; } 16% { opacity:.22; } 82% { opacity:.1; } 100% { transform:translate3d(118vw,-6px,0) rotate(3deg); opacity:0; } }
        @keyframes hsStoreScannerDeep { 0% { transform:scaleX(.55) translateX(-34%); opacity:0; } 25% { opacity:.24; } 70% { opacity:.12; } 100% { transform:scaleX(1.2) translateX(34%); opacity:0; } }
        .hs-store-pit-lane-rush { animation:hsStorePitLaneRush 4.2s linear infinite; }
        .hs-store-shelf-depth { animation:hsStoreShelfDepth 7.4s ease-in-out infinite; }
        .hs-store-beacon-float { animation:hsStoreBeaconFloat 3.2s ease-in-out infinite; }
        .hs-store-crate-slide { animation:hsStoreCrateSlide 7.2s cubic-bezier(.16,.7,.18,1) infinite; }
        .hs-store-scanner-deep { animation:hsStoreScannerDeep 4.6s ease-in-out infinite; }

      `}</style>
      {/* Static performance-store backdrop: steel, road-night and restrained amber accents. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(63,98,117,.18),transparent_28%),radial-gradient(circle_at_20%_72%,rgba(211,157,71,.11),transparent_30%),linear-gradient(145deg,#0d1419_0%,#17232b_48%,#090c10_100%)]" />
        <div className="absolute right-[-12%] top-[18%] h-52 w-1/2 max-w-[420px] opacity-[0.08]">
          <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden="true">
            <path d="M5 43 15 36 28 33 41 23 58 18 70 22 81 30 91 35 95 43Z" fill="#cbd5dc" />
            <path d="M35 31 44 24 58 19 69 24 77 30Z" fill="#0b1116" />
            <circle cx="18" cy="46" r="8" fill="#07090b" stroke="#64717a" strokeWidth="2" />
            <circle cx="82" cy="46" r="8" fill="#07090b" stroke="#64717a" strokeWidth="2" />
          </svg>
        </div>
        <div className="absolute inset-x-0 top-[8.5rem] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-[-8%] h-[60%] [perspective:700px]">
          <div className="hs-store-floor-depth absolute inset-[-5%] [transform:rotateX(64deg)] [transform-origin:center_top]" />
        </div>
        <div className="absolute right-[8%] top-[31%] h-20 w-px bg-gradient-to-b from-transparent via-amber-300/25 to-transparent" style={{ animation: "hsStoreSignal 2.8s ease-in-out infinite" }} />
        <div className="absolute left-[8%] top-[40%] h-14 w-px bg-gradient-to-b from-transparent via-slate-200/15 to-transparent" style={{ animation: "hsStoreSignal 3.5s ease-in-out -1s infinite" }} />
        <div className="absolute top-[24%] left-[6%] h-px w-[34%] bg-gradient-to-r from-transparent via-sky-200/20 to-transparent" style={{ animation: "hsStoreScanner 5.5s linear infinite" }} />
        <div className="absolute top-[28%] left-[37%] h-px w-[34%] bg-gradient-to-r from-transparent via-sky-200/20 to-transparent" style={{ animation: "hsStoreScanner 6.3s linear 1.1s infinite" }} />
        <div className="absolute top-[22%] left-[68%] h-px w-[34%] bg-gradient-to-r from-transparent via-sky-200/20 to-transparent" style={{ animation: "hsStoreScanner 7.1s linear 2.2s infinite" }} />

        {/* Moving pit-lane depth: shelves, scanning passes, floating beacons and foreground cargo. */}
        <div className="hs-store-shelf-depth absolute left-[5%] top-[14%] h-[38%] w-[24%] [perspective:700px]" aria-hidden="true">
          <div className="absolute inset-0 [transform:rotateY(12deg)] border border-white/[0.06] bg-white/[0.015] shadow-2xl">
            <div className="absolute left-0 right-0 top-[22%] h-px bg-white/[0.08]" />
            <div className="absolute left-0 right-0 top-[49%] h-px bg-white/[0.07]" />
            <div className="absolute left-0 right-0 top-[76%] h-px bg-white/[0.06]" />
            <div className="absolute left-[18%] top-[10%] h-2.5 w-8 rounded-sm bg-amber-200/20 shadow-[0_0_18px_rgba(255,210,120,.18)]" />
            <div className="absolute left-[52%] top-[37%] h-2.5 w-11 rounded-sm bg-white/10" />
            <div className="absolute left-[28%] top-[63%] h-2.5 w-9 rounded-sm bg-slate-200/10" />
          </div>
        </div>

        <div className="hs-store-shelf-depth absolute right-[6%] top-[20%] h-[31%] w-[20%] [perspective:700px]" style={{ animationDelay: '-2.8s' }} aria-hidden="true">
          <div className="absolute inset-0 [transform:rotateY(-10deg)] border border-white/[0.05] bg-black/[0.12]">
            <div className="absolute left-0 right-0 top-[33%] h-px bg-white/[0.07]" />
            <div className="absolute left-0 right-0 top-[66%] h-px bg-white/[0.06]" />
          </div>
        </div>

        <div className="hs-store-pit-lane-rush absolute left-[-30%] top-[17%] h-px w-[42%] bg-gradient-to-r from-transparent via-amber-200/32 to-transparent blur-[1px]" />
        <div className="hs-store-pit-lane-rush absolute left-[-35%] top-[24%] h-1 w-[27%] bg-gradient-to-r from-transparent via-white/22 to-transparent" style={{ animationDelay: '-1.7s' }} />
        <div className="hs-store-pit-lane-rush absolute left-[-20%] top-[33%] h-px w-[34%] bg-gradient-to-r from-transparent via-slate-200/22 to-transparent" style={{ animationDelay: '-2.6s' }} />

        <div className="hs-store-scanner-deep absolute left-[22%] top-[55%] h-1 w-[56%] rounded-full bg-gradient-to-r from-transparent via-amber-200/18 to-transparent blur-[2px]" />
        <div className="hs-store-scanner-deep absolute left-[27%] top-[64%] h-px w-[46%] rounded-full bg-gradient-to-r from-transparent via-white/14 to-transparent" style={{ animationDelay: '-1.8s' }} />

        <div className="hs-store-beacon-float absolute left-[38%] top-[29%] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_24px_rgba(255,210,120,.5)]" />
        <div className="hs-store-beacon-float absolute left-[57%] top-[22%] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,.4)]" style={{ animationDelay: '-1.1s' }} />
        <div className="hs-store-beacon-float absolute right-[27%] top-[43%] h-2 w-2 rounded-full bg-sky-200/80 shadow-[0_0_22px_rgba(180,220,255,.32)]" style={{ animationDelay: '-2.1s' }} />

        <div className="hs-store-crate-slide absolute left-[-18%] bottom-[24%] h-7 w-11 rounded-md border border-white/10 bg-white/[0.035] shadow-xl" />
        <div className="hs-store-crate-slide absolute left-[-26%] bottom-[31%] h-4 w-7 rounded-sm border border-amber-200/10 bg-amber-200/[0.035]" style={{ animationDelay: '-3.4s' }} />

        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/58 to-transparent" />
      </div>
      {/* Header */}
      <div className="relative z-10 flex items-center p-3 sm:p-4 border-b border-white/10 bg-[#0b1015]/78 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 flex items-center justify-center rounded-lg bg-white/5"
        >
          ←
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-white ml-3">Store</h2>
      </div>

      {/* Total Coins */}
      <div className="relative z-10 p-4 sm:p-6 bg-gradient-to-r from-amber-500/10 to-slate-400/5 border-b border-amber-500/15 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-1">Total Coins Collected</p>
          <p className="text-yellow-400 font-black text-3xl sm:text-4xl tabular-nums flex items-center justify-center gap-2">
            <span className="text-4xl sm:text-5xl">🪙</span>
            {state.totalCoins.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Power-ups Section */}
      <div className="relative z-10 flex-1 px-3 sm:px-4 py-4 sm:py-6">
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
          <div className="bg-gradient-to-r from-slate-500/10 to-blue-500/10 rounded-xl p-4 border border-slate-400/20">
            <div className="flex items-center gap-3">
              <div className="text-4xl">💎</div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-base">4× Score</h4>
                <p className="text-gray-400 text-xs mt-0.5">Quadruple your score for 10 seconds</p>
                <p className="text-sky-300 text-xs mt-1 font-semibold">Owned: {state.inventory.multiplier4x}</p>
              </div>
              <button
                onClick={() => actions.buyMultiplier4x()}
                disabled={state.totalCoins < 350}
                className="bg-gradient-to-r from-slate-500 to-blue-600 hover:from-slate-400 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-purple-500/25"
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
  const [editingPowerUp, setEditingPowerUp] = useState<PowerUpType | null>(null)
  const [draftQuantity, setDraftQuantity] = useState('')

  const beginQuantityEdit = (powerUp: PowerUpType, quantity: number) => {
    setEditingPowerUp(powerUp)
    setDraftQuantity(String(quantity))
  }

  const commitQuantityEdit = (powerUp: PowerUpType, owned: number) => {
    const parsed = Number.parseInt(draftQuantity, 10)
    const quantity = Number.isFinite(parsed) ? Math.max(0, Math.min(owned, parsed)) : 0
    actions.setPowerUpQuantity(powerUp, quantity)
    setEditingPowerUp(null)
    setDraftQuantity('')
  }

  // Only the three store special power-ups are selectable before a run.
  // The normal Magnet and 2× Score remain gameplay pickups and are intentionally
  // not offered on this pre-run screen.
  const powerUps: Array<{
    type: PowerUpType
    icon: string
    title: string
    description: string
    availableClass: string
    borderClass: string
    selectedBorderClass: string
  }> = [
    {
      type: 'magnet2x',
      icon: '🧲',
      title: '2× COIN MAGNET',
      description: 'Collect 2 coins per coin for 10s per unit',
      availableClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
      selectedBorderClass: 'border-cyan-400',
    },
    {
      type: 'multiplier4x',
      icon: '💎',
      title: '4× SCORE',
      description: 'Quadruple score for 10s per unit',
      availableClass: 'text-purple-400',
      borderClass: 'border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20',
      selectedBorderClass: 'border-purple-400',
    },
    {
      type: 'shield',
      icon: '🛡️',
      title: '2× SHIELD',
      description: 'Protects from 2 crashes per unit',
      availableClass: 'text-green-400',
      borderClass: 'border-green-500/30 bg-gradient-to-r from-green-500/20 to-emerald-500/20',
      selectedBorderClass: 'border-green-400',
    },
  ]

  const selectedCount = (Object.values(state.selectedPowerUps) as number[]).reduce(
    (sum, quantity) => sum + Math.max(0, Math.floor(quantity || 0)),
    0
  )

  return (
    <div className="hs-screen-enter absolute inset-0 flex flex-col bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b border-white/5">
        <div className="flex items-center min-w-0">
          <button
            onClick={onBack}
            className="text-white text-xl sm:text-2xl active:scale-90 transition-transform w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white/5"
            aria-label="Back"
          >
            ←
          </button>
          <div className="ml-3 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white">Select Power-Ups</h2>
            <p className="text-[10px] sm:text-xs text-white/45 mt-0.5">Choose exactly how many units to use • no per-run limit</p>
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs sm:text-sm font-black text-amber-200">
          {selectedCount} SELECTED
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="space-y-3 max-w-md mx-auto w-full">
          {powerUps.map((powerUp) => {
            const owned = Math.max(0, Math.floor(state.inventory[powerUp.type] || 0))
            const quantity = Math.max(0, Math.floor(state.selectedPowerUps[powerUp.type] || 0))
            const plusDisabled =
              owned <= quantity ||
              (powerUp.type === 'magnet' && state.selectedPowerUps.magnet2x > 0) ||
              (powerUp.type === 'magnet2x' && state.selectedPowerUps.magnet > 0) ||
              (powerUp.type === 'multiplier2x' && state.selectedPowerUps.multiplier4x > 0) ||
              (powerUp.type === 'multiplier4x' && state.selectedPowerUps.multiplier2x > 0)
            const minusDisabled = quantity <= 0

            return (
              <div
                key={powerUp.type}
                className={[
                  'w-full rounded-xl p-4 border-2 hs-selection-card transition-all',
                  powerUp.borderClass,
                  quantity > 0 ? powerUp.selectedBorderClass + ' shadow-lg' : '',
                  owned <= 0 ? 'opacity-45' : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-4xl sm:text-5xl shrink-0">{powerUp.icon}</div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-base sm:text-xl">{powerUp.title}</h3>
                    <p className="text-gray-300 text-[11px] sm:text-xs mt-1">{powerUp.description}</p>
                    <p className={powerUp.availableClass + ' text-xs sm:text-sm mt-2 font-bold'}>
                      Available: {owned}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => actions.setPowerUpQuantity(powerUp.type, quantity - 1)}
                      disabled={minusDisabled}
                      aria-label={'Use fewer ' + powerUp.title + ' power-ups'}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-white/15 bg-black/20 text-xl sm:text-2xl font-black text-white transition-all hover:bg-white/10 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    {editingPowerUp === powerUp.type ? (
                      <input
                        type="number"
                        min="0"
                        max={owned}
                        step="1"
                        inputMode="numeric"
                        value={draftQuantity}
                        onChange={(event) => setDraftQuantity(event.target.value)}
                        onBlur={() => commitQuantityEdit(powerUp.type, owned)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitQuantityEdit(powerUp.type, owned)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setEditingPowerUp(null)
                            setDraftQuantity('')
                          }
                        }}
                        autoFocus
                        aria-label={'Type quantity for ' + powerUp.title}
                        className="h-9 w-16 sm:h-10 sm:w-20 rounded-lg border border-amber-300/50 bg-black/45 px-2 text-center text-base sm:text-lg font-black text-white tabular-nums outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => beginQuantityEdit(powerUp.type, quantity)}
                        aria-label={'Edit quantity: ' + quantity + ' ' + powerUp.title + ' selected'}
                        className="h-9 min-w-9 sm:h-10 sm:min-w-10 rounded-lg border border-white/20 bg-black/30 px-2 text-base sm:text-lg font-black text-white tabular-nums transition-all hover:bg-white/10 active:scale-95"
                      >
                        {quantity}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => actions.setPowerUpQuantity(powerUp.type, quantity + 1)}
                      disabled={plusDisabled}
                      aria-label={'Use more ' + powerUp.title + ' power-ups'}
                      className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-white/15 bg-black/20 text-xl sm:text-2xl font-black text-white transition-all hover:bg-white/10 active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 sm:mt-6 max-w-md mx-auto w-full pb-2">
          <button
            onClick={onStart}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-lg sm:text-xl py-4 rounded-xl shadow-lg shadow-green-500/30 active:scale-95 transition-all border border-green-400/20"
          >
            🏁 START RIDE{selectedCount > 0 ? ' • ' + selectedCount + ' EQUIPPED' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
// Bike icon component with distinct visuals for each bike
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
