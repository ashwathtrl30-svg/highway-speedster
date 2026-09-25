import { useEffect, useRef, useState } from 'react'
import { useGameStore, actions, BIKES, getState } from './store'

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
        
        <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-200"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ============== HUD ==============
export function HUD() {
  const state = useGameStore()
  
  if (state.gameState !== 'playing') return null

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-2.5 sm:p-4">
        {/* Score */}
        <div className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 border border-white/5">
          <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-medium">Score</div>
          <div className="text-base sm:text-2xl font-bold text-white tabular-nums leading-tight">
            {state.score.toLocaleString()}
          </div>
        </div>

        {/* Speed gauge */}
        <div className="bg-black/70 backdrop-blur-sm rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-right border border-white/5">
          <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-medium">Speed</div>
          <div className="text-base sm:text-2xl font-bold tabular-nums leading-tight">
            <span className="text-white">{Math.floor(state.speed)}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5">km/h</span>
          </div>
          {/* Speed bar */}
          <div className="w-16 sm:w-20 h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(state.speed / state.selectedBike.maxSpeed) * 100}%`,
                background: state.speed > state.selectedBike.maxSpeed * 0.8
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #22c55e, #3b82f6)',
              }}
            />
          </div>
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




    </div>
  )
}

// ============== MAIN MENU ==============
export function MainMenu() {
  const state = useGameStore()
  const [showBikes, setShowBikes] = useState(false)

  if (state.gameState !== 'menu') return null

  if (showBikes) {
    return <BikeSelection onBack={() => setShowBikes(false)} />
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-black/95 backdrop-blur-sm">
      {/* Animated road lines background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-yellow-500 to-transparent animate-pulse" />
        <div className="absolute left-[45%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent" style={{ animationDelay: '0.5s' }} />
        <div className="absolute left-[55%] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/50 to-transparent" style={{ animationDelay: '1s' }} />
      </div>

      {/* Title */}
      <div className="relative z-10 text-center mb-6 sm:mb-10">
        <div className="text-5xl sm:text-6xl mb-2">🏍️</div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500">
          HIGHWAY
        </h1>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 -mt-1 sm:-mt-2">
          SPEEDSTER
        </h1>
        <p className="text-gray-400 text-[10px] sm:text-xs mt-2 tracking-[0.2em] uppercase font-medium">
          Indian Highway Racer
        </p>
      </div>

      {/* Current bike */}
      <div className="relative z-10 mb-5 sm:mb-7">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border border-white/10"
          style={{ background: `linear-gradient(135deg, ${state.selectedBike.color}30, ${state.selectedBike.accentColor}30)` }}>
          <span className="text-3xl sm:text-4xl">🏍️</span>
        </div>
        <p className="text-center text-white font-bold mt-2 text-sm sm:text-base">
          {state.selectedBike.name}
        </p>
      </div>

      {/* High score */}
      {state.highScore > 0 && (
        <div className="relative z-10 mb-4 sm:mb-5 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider font-medium">High Score</p>
          <p className="text-yellow-400 font-bold text-lg sm:text-xl tabular-nums">
            {state.highScore.toLocaleString()}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 w-56 sm:w-64">
        <button
          onClick={() => { actions.resetGame(); actions.setGameState('playing') }}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-base sm:text-lg py-3 sm:py-3.5 rounded-xl shadow-lg shadow-green-500/25 active:scale-95 transition-all border border-green-400/20"
        >
          🏁 RIDE NOW
        </button>
        
        <button
          onClick={() => setShowBikes(true)}
          className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl shadow-lg shadow-purple-500/25 active:scale-95 transition-all border border-purple-400/20"
        >
          🏍️ GARAGE ({state.unlockedBikes.length}/{BIKES.length})
        </button>
      </div>

      {/* Controls hint */}
      <div className="relative z-10 mt-5 sm:mt-7 text-center px-4">
        <p className="text-gray-500 text-[9px] sm:text-[11px] leading-relaxed">
          <span className="hidden sm:inline">← → Arrow Keys or A/D to steer</span>
          <span className="sm:hidden">Tap left/right side to steer</span>
          <span className="mx-1.5">•</span>
          Dodge traffic
          <span className="mx-1.5">•</span>
          Chain near-misses for combos
        </p>
      </div>
    </div>
  )
}

// ============== BIKE SELECTION ==============
function BikeSelection({ onBack }: { onBack: () => void }) {
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
        <h2 className="text-lg sm:text-xl font-bold text-white ml-3">Garage</h2>
        <span className="ml-auto text-xs text-gray-500">{state.unlockedBikes.length}/{BIKES.length} unlocked</span>
      </div>

      {/* Bike list */}
      <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        {BIKES.map((bike) => {
          const isUnlocked = state.unlockedBikes.includes(bike.id)
          const isSelected = state.selectedBike.id === bike.id
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
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl flex items-center justify-center text-2xl sm:text-3xl shrink-0"
                  style={{
                    background: isUnlocked
                      ? `linear-gradient(135deg, ${bike.color}30, ${bike.accentColor}30)`
                      : 'rgba(255,255,255,0.03)',
                  }}
                >
                  {isUnlocked ? '🏍️' : '🔒'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm sm:text-base truncate">
                    {bike.name}
                  </h3>
                  <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                    {isUnlocked ? bike.description : `Unlock at ${bike.unlockScore.toLocaleString()} pts`}
                  </p>
                  
                  {/* Stats */}
                  {isUnlocked && (
                    <div className="flex gap-2 sm:gap-3 mt-1.5">
                      <StatBar label="SPD" value={bike.maxSpeed / 250} color="#ef4444" />
                      <StatBar label="ACC" value={bike.acceleration / 1.6} color="#f59e0b" />
                      <StatBar label="HDL" value={bike.handling / 1.0} color="#3b82f6" />
                    </div>
                  )}

                  {/* Unlock progress */}
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
    </div>
  )
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <span className="text-[8px] sm:text-[9px] text-gray-500 w-5 font-medium">{label}</span>
      <div className="w-8 sm:w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ============== PAUSE MENU ==============
export function PauseMenu() {
  const state = useGameStore()

  if (state.gameState !== 'paused') return null

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-50">
      <div className="text-4xl mb-3">⏸️</div>
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">PAUSED</h2>
      
      <div className="flex flex-col gap-2.5 sm:gap-3 w-52 sm:w-60">
        <button
          onClick={() => actions.setGameState('playing')}
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
      <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-center">
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Score</p>
          <p className="text-white font-bold text-lg tabular-nums">{state.score.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Distance</p>
          <p className="text-white font-bold text-lg tabular-nums">{state.distance.toFixed(1)} km</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Near Misses</p>
          <p className="text-orange-400 font-bold text-lg tabular-nums">{state.nearMisses}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Best Combo</p>
          <p className="text-yellow-400 font-bold text-lg tabular-nums">×{state.combo}</p>
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
      {/* Red flash effect */}
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

        {/* Stats card */}
        <div className="bg-white/[0.05] rounded-xl sm:rounded-2xl p-4 sm:p-5 mt-3 sm:mt-4 mb-5 sm:mb-7 border border-white/10 min-w-[240px] sm:min-w-[280px]">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Score</p>
              <p className="text-white font-bold text-xl sm:text-2xl tabular-nums">{state.score.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Best</p>
              <p className="text-yellow-400 font-bold text-xl sm:text-2xl tabular-nums">{state.highScore.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Distance</p>
              <p className="text-white font-bold text-base sm:text-lg tabular-nums">{state.distance.toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Near Misses</p>
              <p className="text-orange-400 font-bold text-base sm:text-lg tabular-nums">{state.nearMisses}</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
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
    <div className="absolute inset-0 z-10">
      {/* Left tap zone with subtle indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[35%] flex items-center justify-start pl-2 sm:pl-4 opacity-0 active:opacity-100 transition-opacity"
        onTouchStart={(e) => {
          e.preventDefault()
          const now = Date.now()
          if (now - lastTapRef.current > 100) {
            lastTapRef.current = now
            actions.setTargetLane(getState().targetLane - 1)
          }
        }}
        onClick={() => {
          const now = Date.now()
          if (now - lastTapRef.current > 100) {
            lastTapRef.current = now
            actions.setTargetLane(getState().targetLane - 1)
          }
        }}
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 flex items-center justify-center">
          <span className="text-white/30 text-xl sm:text-2xl">‹</span>
        </div>
      </div>
      {/* Right tap zone with subtle indicator */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[35%] flex items-center justify-end pr-2 sm:pr-4 opacity-0 active:opacity-100 transition-opacity"
        onTouchStart={(e) => {
          e.preventDefault()
          const now = Date.now()
          if (now - lastTapRef.current > 100) {
            lastTapRef.current = now
            actions.setTargetLane(getState().targetLane + 1)
          }
        }}
        onClick={() => {
          const now = Date.now()
          if (now - lastTapRef.current > 100) {
            lastTapRef.current = now
            actions.setTargetLane(getState().targetLane + 1)
          }
        }}
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 flex items-center justify-center">
          <span className="text-white/30 text-xl sm:text-2xl">›</span>
        </div>
      </div>
    </div>
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
