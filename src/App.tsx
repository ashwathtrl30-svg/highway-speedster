import { useEffect, useState } from 'react'
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
import { actions } from './game/store'

function App() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Load saved progress on mount
    actions.resetGame()
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
    </div>
  )
}

export default App
