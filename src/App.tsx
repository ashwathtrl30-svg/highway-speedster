import { useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { HighScoreAnalytics } from './HighScoreAnalytics'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import { HUD, MainMenu, PauseMenu, GameOverScreen, TouchControls, UnlockNotification, LoadingScreen, AccountSetup } from './game/UI'
import { actions, getState, getPlayerId } from './game/store'
import { ensureSupabaseAuth } from './supabase'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [accountReady, setAccountReady] = useState(false)
  const [accountBooting, setAccountBooting] = useState(true)
  const [accountBootError, setAccountBootError] = useState('')

  useEffect(() => {
    actions.resetGame()
    const storedPlayerId = getPlayerId()

    const boot = async () => {
      if (storedPlayerId) {
        // Existing devices must remain one of the account's maximum three
        // registered devices. Reclaim/verify the current installation before
        // hydrating cloud progress.
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
        // A device with no account ID must explicitly choose New User or
        // Already Have an Account. This prevents silent UUID duplication.
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
      <div className="absolute inset-0"><GameScene /></div>
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
