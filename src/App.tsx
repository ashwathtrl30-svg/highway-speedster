import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { HighScoreAnalytics } from './HighScoreAnalytics'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import { HUD, MainMenu, PauseMenu, GameOverScreen, TouchControls, UnlockNotification, LoadingScreen, AccountSetup } from './game/UI'
import { actions, getState, getPlayerId } from './game/store'
import { ensureSupabaseAuth } from './supabase'
import { trackEvent } from './game/analytics'

interface GameSceneGuardProps {
  children: ReactNode
}

interface GameSceneGuardState {
  hasError: boolean
  retryCount: number
}

class GameSceneGuard extends Component<GameSceneGuardProps, GameSceneGuardState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  state: GameSceneGuardState = {
    hasError: false,
    retryCount: 0,
  }

  static getDerivedStateFromError(): Partial<GameSceneGuardState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Highway Speedster scene error caught; gameplay will be isolated from the rest of the app.', error, errorInfo)

    if (this.state.retryCount < 2) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.setState((current) => ({
          hasError: false,
          retryCount: current.retryCount + 1,
        }))
      }, 250)
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.state.retryCount < 2) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
          <div className="rounded-xl bg-black/70 px-5 py-4 text-center">
            <div className="text-sm font-semibold">Recovering game renderer…</div>
          </div>
        </div>
      )
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
        <div className="max-w-sm px-6 text-center">
          <div className="text-base font-semibold">3D renderer unavailable</div>
          <div className="mt-2 text-sm text-white/70">
            The game interface is still running. Reloading the page may restore the renderer.
          </div>
        </div>
      </div>
    )
  }
}

function App() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const path = window.location.pathname
    if (path === '/leaderboard') trackEvent('leaderboard_opened')
    if (path === '/highscores') trackEvent('highscores_opened')
  }, [])
  const [accountReady, setAccountReady] = useState(false)
  const [accountBooting, setAccountBooting] = useState(true)
  const [accountBootError, setAccountBootError] = useState('')

  useEffect(() => {
    actions.resetGame()
    const storedPlayerId = getPlayerId()

    const boot = async () => {
      if (storedPlayerId) {
        const device = await actions.ensureCurrentDeviceConnected()
        if (!device.ok) {
          setAccountBootError(device.reason)
          setAccountReady(false)
        } else if (getState().username) {
          await actions.restoreCloudProgress()
          void actions.syncSharedHighScore()
          setAccountReady(true)
        } else {
          setAccountReady(false)
        }
      } else {
        setAccountReady(false)
      }
      setAccountBooting(false)
    }

    void ensureSupabaseAuth()
    void boot()

    const timer = setTimeout(() => setLoaded(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (window.location.pathname === '/leaderboard') return <LeaderboardViewer />
  if (window.location.pathname === '/highscores') return <HighScoreAnalytics />

  if (accountBooting) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-black touch-none">
        <LoadingScreen />
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-black touch-none">
      <div className="absolute inset-0">
        <GameSceneGuard>
          <GameScene />
        </GameSceneGuard>
      </div>
      {!loaded && <LoadingScreen />}
      {!accountReady && (
        <AccountSetup
          initialError={accountBootError}
          onComplete={() => {
            setAccountBootError('')
            setAccountReady(true)
          }}
        />
      )}
      {accountReady && (
        <>
          <MainMenu
            onLogout={() => {
              setAccountBootError('')
              setAccountReady(false)
            }}
          />
          <HUD />
          <PauseMenu />
          <GameOverScreen />
          <TouchControls />
          <UnlockNotification />
        </>
      )}
      <Analytics />
    </div>
  )
}

export default App
