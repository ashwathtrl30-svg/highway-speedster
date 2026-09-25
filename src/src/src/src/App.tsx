import { useEffect, useState } from 'react'
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
import { actions } from './game/store'

function App() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    actions.resetGame()
    const timer = setTimeout(() => setLoaded(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <div className="absolute inset-0">
        <GameScene />
      </div>

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
