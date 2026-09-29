import { useEffect, useRef, useState } from 'react'
import { useGameStore, actions, BIKES, CARS, BIKE_SKINS, getState, type Bike, type Car, type BikeSkin } from './store'
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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black z-[100]">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
          HIGHWAY SPEEDSTER
        </h1>
        <p className="text-gray-500 text-xs mb-6">Loading assets...</p>
        
        <div className="w-64 sm:w-80 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, progress)}%` }}
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
  
  if (state.gameState !== 'playing') return null

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2.5 sm:p-4 pointer-events-auto">
        {/* Score & Coins */}
        <div className="flex flex-col gap-1.5">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 border border-white/5">
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-medium">Score</div>
            <div className="text-base sm:text-2xl font-bold text-white tabular-nums leading-tight">
              {state.score.toLocaleString()}
            </div>
          </div>
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1 sm:px-3 sm:py-1.5 border border-yellow-500/20 flex items-center gap-1.5">
            <span className="text-sm sm:text-base">🪙</span>
            <span className="text-sm sm:text-lg font-bold text-yellow-400 tabular-nums">{state.runCoins}</span>
          </div>
        </div>

        {/* Speed gauge & Pause */}
        <div className="flex flex-col gap-1.5 items-end">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-right border border-white/5">
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-medium">Speed</div>
            <div className="text-base sm:text-2xl font-bold tabular-nums leading-tight">
              <span className="text-white">{Math.floor(state.speed)}</span>
              <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5">km/h</span>
            </div>
          </div>
          <button
            onClick={() => actions.setGameState('paused')}
            className="pointer-events-auto bg-black/70 backdrop-blur-sm rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 border border-white/10 active:scale-95 transition-all"
          >
            <span className="text-white text-sm sm:text-base font-bold">⏸ PAUSE</span>
          </button>
        </div>
      </div>

      {/* Combo indicator */}
      {state.combo > 0 && (
        <div className="absolute top-14 sm:top-20 left-1/2 -translate-x-1/2">
          <div className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-sm rounded-full px-3 py-1 sm:px-5 sm:py-1.5 shadow-lg shadow-orange-500/40 border border-yellow-400/30">
            <span className="text-white font-bold text-xs sm:text-base">
              🔥 NEAR MISS ×{state.combo}
            </span>
          </div>
        </div>
      )}

      {/* Active Power-ups */}
      <div className="absolute top-28 sm:top-36 left-1/2 -translate-x-1/2 flex gap-2">
        {state.magnetActive && (
          <div className="bg-blue-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg shadow-blue-500/40 border border-blue-400/30 animate-pulse">
            <span className="text-white font-bold text-xs sm:text-sm">
              🧲 {Math.ceil(state.magnetTimer)}s
            </span>
          </div>
        )}
        {state.magnet2xActive && (
          <div className="bg-cyan-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg shadow-cyan-500/40 border border-cyan-400/30 animate-pulse">
            <span className="text-white font-bold text-xs sm:text-sm">
              🧲 2× {Math.ceil(state.magnet2xTimer)}s
            </span>
          </div>
        )}
        {state.multiplierActive && (
          <div className="bg-yellow-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg shadow-yellow-500/40 border border-yellow-400/30 animate-pulse">
            <span className="text-white font-bold text-xs sm:text-sm">
              ⭐ {state.multiplier4x ? '4' : '2'}× {Math.ceil(state.multiplierTimer)}s
            </span>
          </div>
        )}
        {state.shieldActive && (
          <div className="bg-green-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg shadow-green-500/40 border border-green-400/30">
            <span className="text-white font-bold text-xs sm:text-sm">
              🛡️ {state.shieldCount} {state.shieldCount === 1 ? 'Shield' : 'Shields'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============== STATS SCREEN ==============
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

  const getStartDate = (filter: Filter) => {
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
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-gray-900 via-gray-950 to-black overflow-y-auto">
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

    fetchMyPlaytimeRank(username).then((result) => {
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

  // Secret keyboard shortcut for admin analytics (Ctrl+Shift+S or Cmd+Shift+S)
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

  // Secret mobile tap gesture (5 quick taps)
  const handleSecretTap = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapTimeRef.current
    
    // Reset if too much time has passed (more than 2 seconds)
    if (timeSinceLastTap > 2000) {
      tapCountRef.current = 0
    }
    
    tapCountRef.current += 1
    lastTapTimeRef.current = now
    
    // If 5 taps in quick succession, show stats
    if (tapCountRef.current >= 5) {
      setShowStats(true)
      tapCountRef.current = 0
    }
  }

  if (state.gameState !== 'menu') return null

  // Show stats screen if accessed via secret shortcut
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
    return <PowerUpSelection onBack={() => setShowPowerUpSelection(false)} onStart={() => {
      actions.useSelectedPowerUp()
      actions.setGameState('playing')
    }} />
  }

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm"
      onClick={handleSecretTap}
    >
      {/* Username Input (shows if no username set) */}
      <UsernameInput />
      
      {/* Animated road lines background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-yellow-500 to-transparent animate-pulse" />
        <div className="absolute left-[45%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent" style={{ animationDelay: '0.5s' }} />
        <div className="absolute left-[55%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent" style={{ animationDelay: '1s' }} />
      </div>

      {state.username && <PlaytimeRankCard username={state.username} />}

      {/* Username Display */}
      {state.username && (
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <p className="text-white font-bold text-sm sm:text-base">
              👤 {state.username}
            </p>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="relative z-10 text-center mb-6 sm:mb-10 mt-12">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500">
          HIGHWAY
        </h1>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 -mt-1 sm:-mt-2">
          SPEEDSTER
        </h1>
      </div>

      {/* Current vehicle */}
      <div className="relative z-10 mb-5 sm:mb-7">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden"
          style={{
            background: state.vehicleMode === 'car'
              ? `linear-gradient(135deg, ${state.selectedCar.color}30, ${state.selectedCar.accentColor}30)`
              : `linear-gradient(135deg, ${state.selectedBike.color}30, ${state.selectedBike.accentColor}30)`,
          }}>
          {state.vehicleMode === 'car' ? <CarIcon car={state.selectedCar} /> : <BikeIcon bike={state.selectedBike} />}
        </div>
        <p className="text-center text-white font-bold mt-2 text-sm sm:text-base">
          {state.vehicleMode === 'car' ? state.selectedCar.name : state.selectedBike.name}
        </p>
      </div>

      {/* High score */}
      {state.highScore > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = '/highscores'
          }}
          className="relative z-10 mb-4 sm:mb-5 text-center cursor-pointer rounded-xl px-3 py-1 hover:bg-white/5 active:scale-95 transition-all"
          aria-label="Open public high score leaderboard"
        >
          <p className="text-gray-500 text-[10px] uppercase tracking-wider font-medium">
            Your Highest Score Is Only
          </p>
          <p className="text-yellow-400 font-bold text-lg sm:text-xl tabular-nums">
            {state.highScore.toLocaleString()}
          </p>
        </button>
      )}

      {/* Buttons */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 w-56 sm:w-64">
        <button
          onClick={() => { 
            actions.resetGame()
            // Check if user has any power-ups
            const hasPowerUps = state.inventory.magnet > 0 || state.inventory.magnet2x > 0 || state.inventory.multiplier2x > 0 || state.inventory.multiplier4x > 0 || state.inventory.shield > 0
            if (hasPowerUps) {
              setShowPowerUpSelection(true)
            } else {
              actions.setGameState('playing')
            }
          }}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-base sm:text-lg py-3 sm:py-3.5 rounded-xl shadow-lg shadow-green-500/25 active:scale-95 transition-all border border-green-400/20"
        >
          🏁 RIDE NOW
        </button>
        
        <button
          onClick={() => setShowBikes(true)}
          className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl shadow-lg shadow-purple-500/25 active:scale-95 transition-all border border-purple-400/20"
        >
          🏍️ GARAGE
        </button>

        <button
          onClick={() => setShowStore(true)}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl shadow-lg shadow-yellow-500/25 active:scale-95 transition-all border border-yellow-400/20"
        >
          🛒 STORE
        </button>
      </div>
    </div>
  )
}

// ============== SKIN SELECTOR ==============
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
function GarageSelection({ onBack }: { onBack: () => void }) {
  const state = useGameStore()
  const [section, setSection] = useState<'bikes' | 'cars'>('bikes')

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
        <h2 className="text-lg sm:text-xl font-bold text-white ml-3">Garage</h2>
      </div>

      {/* Vehicle tabs */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/5">
          <button
            onClick={() => setSection('bikes')}
            className={`rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
              section === 'bikes'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🏍️ BIKES
          </button>
          <button
            onClick={() => setSection('cars')}
            className={`rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
              section === 'cars'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🚗 CARS
          </button>
        </div>
      </div>

      {section === 'bikes' ? (
        <>
          {/* Bike list — same card layout as the original garage */}
          <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
            {BIKES.map((bike) => {
              const isUnlocked = state.unlockedBikes.includes(bike.id)
              const isSelected = state.vehicleMode === 'bike' && state.selectedBike.id === bike.id
              const progress = isUnlocked ? 100 : Math.min(100, (state.highScore / bike.unlockScore) * 100)

              return (
                <div
                  key={bike.id}
                  className={`relative rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 ring-1 ring-yellow-400/40'
                      : isUnlocked
                      ? 'bg-white/[0.04] hover:bg-white/[0.07]'
                      : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Bike icon */}
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${bike.color}30, ${bike.accentColor}30)`
                          : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {isUnlocked ? <BikeIcon bike={bike} /> : <span className="text-2xl sm:text-3xl">🔒</span>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-sm sm:text-base truncate">{bike.name}</h3>
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
                          <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 tabular-nums">
                            {state.highScore.toLocaleString()} / {bike.unlockScore.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    {isUnlocked && !isSelected && (
                      <button
                        onClick={() => actions.selectBike(bike)}
                        className="bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg active:scale-95 transition-all shrink-0"
                      >
                        SELECT
                      </button>
                    )}
                    {isSelected && (
                      <div className="text-yellow-400 text-[10px] sm:text-xs font-bold shrink-0 bg-yellow-400/10 px-2 py-1 rounded-md">
                        ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pb-4 pt-2 text-center">
            <span className="text-xs text-gray-500">{state.unlockedBikes.length} out of {BIKES.length} Bikes unlocked</span>
          </div>
        </>
      ) : (
        <>
          {/* Car list — same card spacing/arrangement as the Bike garage */}
          <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
            {CARS.map((car) => {
              const isUnlocked = state.highScore >= car.unlockScore
              const isSelected = state.vehicleMode === 'car' && state.selectedCar.id === car.id
              const progress = isUnlocked ? 100 : Math.min(100, (state.highScore / car.unlockScore) * 100)

              return (
                <div
                  key={car.id}
                  className={`relative rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 ring-1 ring-yellow-400/40'
                      : isUnlocked
                      ? 'bg-white/[0.04] hover:bg-white/[0.07]'
                      : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Car icon */}
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${car.color}30, ${car.accentColor}30)`
                          : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      {isUnlocked ? <CarIcon car={car} /> : <span className="text-2xl sm:text-3xl">🔒</span>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-sm sm:text-base truncate">{car.name}</h3>
                      <p className="text-gray-400 text-[10px] sm:text-xs truncate">{isUnlocked ? car.description : `Unlock at ${car.unlockScore.toLocaleString()} pts`}</p>

                      {isUnlocked && (
                        <>
                          <div className="mt-1.5">
                            <p className="text-[10px] sm:text-xs text-gray-400">
                              Top Speed: <span className="text-white font-semibold">{car.maxSpeed} kmph</span>
                            </p>
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 truncate">Inspired by {car.inspiration}</p>
                        </>
                      )}

                      {!isUnlocked && (
                        <div className="mt-1.5">
                          <div className="h-1 sm:h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5 tabular-nums">
                            {state.highScore.toLocaleString()} / {car.unlockScore.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    {isUnlocked && !isSelected && (
                      <button
                        onClick={() => actions.selectCar(car)}
                        className="bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-semibold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg active:scale-95 transition-all shrink-0"
                      >
                        SELECT
                      </button>
                    )}
                    {isSelected && (
                      <div className="text-yellow-400 text-[10px] sm:text-xs font-bold shrink-0 bg-yellow-400/10 px-2 py-1 rounded-md">
                        ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pb-4 pt-2 text-center">
            <span className="text-xs text-gray-500">
              {CARS.filter((car) => state.highScore >= car.unlockScore).length} out of {CARS.length} Cars unlocked
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// Car icon component with five distinct silhouettes inspired by the requested real-life vehicles.
function CarIcon({ car }: { car: Car }) {
  const common = { fill: car.color, accent: car.accentColor }

  if (car.id === 'kanto-zip') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="23" cy="46" r="9" fill="#222" stroke="#555" strokeWidth="2"/>
        <circle cx="77" cy="46" r="9" fill="#222" stroke="#555" strokeWidth="2"/>
        <path d="M15 42 L20 29 L36 25 L56 25 L68 31 L82 38 L85 43 L15 43Z" fill={common.fill}/>
        <path d="M28 29 L39 20 L57 20 L67 30 L30 30Z" fill={common.accent} opacity="0.95"/>
        <path d="M40 22 L55 22 L62 28 L43 28Z" fill="#1b2638"/>
        <rect x="19" y="35" width="10" height="3" rx="1.5" fill="#eee"/>
        <rect x="72" y="37" width="8" height="3" rx="1.5" fill="#d33"/>
        <rect x="31" y="40" width="38" height="3" rx="1.5" fill="#2b2b2b"/>
      </svg>
    )
  }

  if (car.id === 'saber-swift') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="21" cy="46" r="9.5" fill="#1e1e1e" stroke="#555" strokeWidth="2"/>
        <circle cx="79" cy="46" r="9.5" fill="#1e1e1e" stroke="#555" strokeWidth="2"/>
        <path d="M13 42 L19 31 L33 27 L44 20 L64 21 L72 29 L85 36 L87 43 L13 43Z" fill={common.fill}/>
        <path d="M31 28 L44 21 L61 22 L69 29 L35 29Z" fill="#1e2b3a"/>
        <path d="M17 34 L30 30 L70 30 L82 36 L82 39 L18 39Z" fill={common.accent} opacity="0.35"/>
        <path d="M16 40 L29 40 L29 43 L16 43Z" fill="#222"/>
        <path d="M72 39 L84 39 L84 42 L72 42Z" fill="#c7363d"/>
        <rect x="41" y="34" width="29" height="3" rx="1.5" fill="#dfe6ee" opacity="0.65"/>
      </svg>
    )
  }

  if (car.id === 'goliath-titan') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="21" cy="47" r="10" fill="#202020" stroke="#555" strokeWidth="2"/>
        <circle cx="79" cy="47" r="10" fill="#202020" stroke="#555" strokeWidth="2"/>
        <path d="M12 43 L17 28 L29 24 L29 17 L68 17 L78 25 L86 29 L89 43 L12 43Z" fill={common.fill}/>
        <rect x="30" y="20" width="34" height="13" rx="2" fill="#23303a"/>
        <path d="M18 29 L29 27 L29 36 L17 37Z" fill={common.accent} opacity="0.55"/>
        <rect x="28" y="36" width="45" height="5" rx="2" fill="#3b4147"/>
        <rect x="75" y="34" width="9" height="4" rx="1.5" fill="#cf3434"/>
        <circle cx="83" cy="29" r="3.2" fill="#333" stroke="#777" strokeWidth="1"/>
        <rect x="33" y="15" width="34" height="2" rx="1" fill="#141414"/>
        <rect x="19" y="40" width="12" height="3" fill="#ddd"/>
      </svg>
    )
  }

  if (car.id === 'kaiser-monarch') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <circle cx="21" cy="46" r="9.5" fill="#191919" stroke="#555" strokeWidth="2"/>
        <circle cx="79" cy="46" r="9.5" fill="#191919" stroke="#555" strokeWidth="2"/>
        <path d="M11 42 L18 31 L34 28 L46 20 L65 21 L74 29 L85 34 L89 42 L11 42Z" fill={common.fill}/>
        <path d="M31 29 L46 21 L63 22 L71 29Z" fill="#16202c"/>
        <path d="M17 34 L30 31 L75 31 L83 35 L81 39 L18 39Z" fill={common.accent} opacity="0.32"/>
        <rect x="36" y="38" width="44" height="2.2" rx="1" fill="#bfc5cd" opacity="0.75"/>
        <rect x="14" y="39" width="11" height="2.5" rx="1" fill="#f4f0c8"/>
        <path d="M74 37 L85 37 L85 40 L74 40Z" fill="#d92f3b"/>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 100 60" className="w-full h-full">
      <circle cx="20" cy="46" r="9.5" fill="#121212" stroke="#555" strokeWidth="2"/>
      <circle cx="80" cy="46" r="9.5" fill="#121212" stroke="#555" strokeWidth="2"/>
      <path d="M9 42 L18 31 L29 28 L39 19 L59 16 L72 23 L80 31 L89 35 L92 42 L9 42Z" fill={common.fill}/>
      <path d="M31 28 L42 20 L58 17 L70 24 L75 29Z" fill="#18222b"/>
      <path d="M15 35 L29 31 L75 31 L86 35 L83 39 L16 39Z" fill={common.accent} opacity="0.28"/>
      <path d="M68 35 L85 35 L88 38 L69 38Z" fill="#111" />
      <rect x="18" y="39" width="16" height="2.5" rx="1" fill="#f5edb8"/>
      <rect x="68" y="39" width="16" height="2.5" rx="1" fill="#e42f3f"/>
      <rect x="37" y="38.2" width="28" height="2" rx="1" fill="#d4d4d4" opacity="0.7"/>
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
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm">
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
            className={`bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-xl p-4 border-2 transition-all cursor-pointer ${
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
            className={`bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl p-4 border-2 transition-all cursor-pointer ${
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
            className={`bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border-2 transition-all cursor-pointer ${
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
            className={`bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border-2 transition-all cursor-pointer ${
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
            className={`bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border-2 transition-all cursor-pointer ${
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
            <div className="text-8xl sm:text-9xl font-black text-white animate-pulse">
              {countdown}
            </div>
          ) : (
            <div className="text-6xl sm:text-7xl font-black text-green-400 animate-bounce">
              GO!
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center bg-black/85 backdrop-blur-md z-50 overflow-y-auto">
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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
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
  const lastTapRef = useRef(0)
  const lastLaneChangeRef = useRef(0)
  const tiltEnabledRef = useRef(false)
  const lastTiltLaneRef = useRef(0)
  const [showTiltPrompt, setShowTiltPrompt] = useState(false)
  const hasPromptedRef = useRef(false)

  // Tilt / Gyroscope controls - only prompt once per session
  useEffect(() => {
    if (state.gameState !== 'playing') return
    if (hasPromptedRef.current) return

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0
      
      const now = Date.now()
      if (now - lastLaneChangeRef.current < 300) return
      
      const currentLane = getState().targetLane
      
      if (gamma < -15 && currentLane > -1) {
        if (lastTiltLaneRef.current !== -1) {
          lastTiltLaneRef.current = -1
          lastLaneChangeRef.current = now
          actions.setTargetLane(currentLane - 1)
        }
      } else if (gamma > 15 && currentLane < 1) {
        if (lastTiltLaneRef.current !== 1) {
          lastTiltLaneRef.current = 1
          lastLaneChangeRef.current = now
          actions.setTargetLane(currentLane + 1)
        }
      } else if (gamma > -10 && gamma < 10) {
        lastTiltLaneRef.current = 0
      }
    }

    const enableTilt = async () => {
      hasPromptedRef.current = true
      
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setShowTiltPrompt(true)
      } else if ('DeviceOrientationEvent' in window) {
        const testHandler = (e: DeviceOrientationEvent) => {
          if (e.gamma !== null) {
            tiltEnabledRef.current = true
            window.removeEventListener('deviceorientation', testHandler)
            window.addEventListener('deviceorientation', handleOrientation)
          }
        }
        window.addEventListener('deviceorientation', testHandler)
        setTimeout(() => {
          window.removeEventListener('deviceorientation', testHandler)
        }, 1000)
      }
    }

    enableTilt()

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [state.gameState])

  const handleEnableTilt = async () => {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission()
      if (permission === 'granted') {
        tiltEnabledRef.current = true
        hasPromptedRef.current = true
        setShowTiltPrompt(false)
        
        const handleOrientation = (e: DeviceOrientationEvent) => {
          const gamma = e.gamma || 0
          const now = Date.now()
          if (now - lastLaneChangeRef.current < 300) return
          
          const currentLane = getState().targetLane
          
          if (gamma < -15 && currentLane > -1) {
            if (lastTiltLaneRef.current !== -1) {
              lastTiltLaneRef.current = -1
              lastLaneChangeRef.current = now
              actions.setTargetLane(currentLane - 1)
            }
          } else if (gamma > 15 && currentLane < 1) {
            if (lastTiltLaneRef.current !== 1) {
              lastTiltLaneRef.current = 1
              lastLaneChangeRef.current = now
              actions.setTargetLane(currentLane + 1)
            }
          } else if (gamma > -10 && gamma < 10) {
            lastTiltLaneRef.current = 0
          }
        }
        
        window.addEventListener('deviceorientation', handleOrientation)
      }
    } catch (e) {
      setShowTiltPrompt(false)
    }
  }

  const handleSkipTilt = () => {
    hasPromptedRef.current = true
    setShowTiltPrompt(false)
  }

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

  if (state.gameState !== 'playing') return null

  return (
    <>
      {showTiltPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm border border-white/10">
            <div className="text-center">
              <div className="text-5xl mb-3">📱</div>
              <h3 className="text-white font-bold text-lg mb-2">Enable Tilt Controls?</h3>
              <p className="text-gray-400 text-sm mb-4">
                Tilt your phone to steer the bike for the best experience!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleEnableTilt}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-2.5 rounded-xl active:scale-95 transition-all"
                >
                  Enable Tilt
                </button>
                <button
                  onClick={handleSkipTilt}
                  className="flex-1 bg-white/10 text-white font-bold py-2.5 rounded-xl active:scale-95 transition-all"
                >
                  Use Tap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute left-0 right-0 bottom-0 top-24 sm:top-28 z-10">
        <div
          className="absolute left-0 top-0 bottom-0 w-[35%] flex items-center justify-start pl-2 sm:pl-4 opacity-0 active:opacity-100 transition-opacity"
          onTouchStart={(e) => {
            if (tiltEnabledRef.current) return
            e.preventDefault()
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane - 1)
            }
          }}
          onClick={() => {
            if (tiltEnabledRef.current) return
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane - 1)
            }
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-[35%] flex items-center justify-end pr-2 sm:pr-4 opacity-0 active:opacity-100 transition-opacity"
          onTouchStart={(e) => {
            if (tiltEnabledRef.current) return
            e.preventDefault()
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane + 1)
            }
          }}
          onClick={() => {
            if (tiltEnabledRef.current) return
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane + 1)
            }
          }}
        />
      </div>

      {/* Mobile Arrow Controls - Only visible on small screens */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-between px-6 z-20 sm:hidden">
        {/* Left Arrow */}
        <button
          onTouchStart={(e) => {
            e.preventDefault()
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane - 1)
            }
          }}
          onClick={() => {
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane - 1)
            }
          }}
          className="w-16 h-16 bg-white/20 backdrop-blur-sm border-2 border-white/40 rounded-full flex items-center justify-center active:scale-90 active:bg-white/30 transition-all shadow-lg"
        >
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right Arrow */}
        <button
          onTouchStart={(e) => {
            e.preventDefault()
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane + 1)
            }
          }}
          onClick={() => {
            const now = Date.now()
            if (now - lastTapRef.current > 150) {
              lastTapRef.current = now
              actions.setTargetLane(getState().targetLane + 1)
            }
          }}
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
    if (state.newUnlock) {
      setBikeName(state.newUnlock)
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        actions.clearNewUnlock()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.newUnlock])

  if (!visible) return null

  return (
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-[60]">
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl sm:rounded-2xl px-5 py-3 sm:px-6 sm:py-4 shadow-2xl shadow-orange-500/50 text-center border border-yellow-400/30">
        <p className="text-white/80 text-[10px] sm:text-xs uppercase tracking-wider font-medium">🔓 New Bike Unlocked!</p>
        <p className="text-white font-black text-lg sm:text-2xl mt-0.5">{bikeName}</p>
        <p className="text-white/60 text-[9px] sm:text-[10px] mt-0.5">Check the Garage</p>
      </div>
    </div>
  )
}
