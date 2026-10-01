import { useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { HighScoreAnalytics } from './HighScoreAnalytics'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import { HUD, MainMenu, PauseMenu, GameOverScreen, TouchControls, UnlockNotification, LoadingScreen } from './game/UI'
import { actions, getState } from './game/store'
import { ensureSupabaseAuth } from './supabase'

function App() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Load saved local progress on mount.
    actions.resetGame()

    // Establish an invisible Supabase session for RLS-protected analytics.
    // No Google/Apple/email sign-in UI is shown to players.
    void ensureSupabaseAuth().then(() => {
      if (getState().username) {
        void actions.syncSharedHighScore()
      }
    })

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
