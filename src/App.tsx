import { useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { HighScoreAnalytics } from './HighScoreAnalytics'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import { HUD, MainMenu, PauseMenu, GameOverScreen, TouchControls, UnlockNotification, LoadingScreen, UsernameInput } from './game/UI'
import { actions, getState } from './game/store'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [needsUsername, setNeedsUsername] = useState(() => !getState().username)

  useEffect(() => {
    // Load saved local progress on mount.
    actions.resetGame()

    // Reconcile the local high score with the shared username record every time
    // the game is opened.
    if (getState().username) {
      void actions.syncSharedHighScore()
    }

    // Simulate loading time for 3D assets.
    const timer = setTimeout(() => setLoaded(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (window.location.pathname === '/leaderboard') return <LeaderboardViewer />
  if (window.location.pathname === '/highscores') return <HighScoreAnalytics />

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <div className="absolute inset-0"><GameScene /></div>
      {!loaded && <LoadingScreen />}
      {loaded && needsUsername ? (
        <UsernameInput onComplete={() => setNeedsUsername(false)} />
      ) : loaded ? (
        <>
          <MainMenu />
          <HUD />
          <PauseMenu />
          <GameOverScreen />
          <TouchControls />
          <UnlockNotification />
        </>
      ) : null}
      <Analytics />
    </div>
  )
}

export default App
