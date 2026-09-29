import { useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import {
  HUD,
  MainMenu,
  PauseMenu,
  GameOverScreen,
  TouchControls,
  UnlockNotification,
  LoadingScreen,
} from './game/UI'
import { actions, getState } from './game/store'

function App() {
  const [loaded, setLoaded] = useState(false)

  if (window.location.pathname === '/leaderboard') {
    return <LeaderboardViewer />
  }

  useEffect(() => {
    // Load saved progress on mount
    actions.resetGame()
    // Reconcile the local high score with the shared username record every time
    // the game is opened, so another device cannot show a stale lower score.
    if (getState().username) {
      actions.syncSharedHighScore()
    }
    // Simulate loading time for 3D assets
    const timer = setTimeout(() => setLoaded(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {/* 3D Scene - always rendered */}
      <div className="absolute inset-0">
        <GameScene />
      </div>

      {/* UI Overlays */}
      {!loaded && <LoadingScreen />}
      <MainMenu />
      <HUD />
      <PauseMenu />
      <GameOverScreen />
      <TouchControls />
      <UnlockNotification />
      <Analytics />
    </div>
  )
}

export default App
