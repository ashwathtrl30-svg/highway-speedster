import { useEffect, useState } from 'react'
import { LeaderboardViewer } from './LeaderboardViewer'
import { HighScoreAnalytics } from './HighScoreAnalytics'
import { Analytics } from '@vercel/analytics/react'
import { GameScene } from './game/Scene'
import { HUD, MainMenu, PauseMenu, GameOverScreen, TouchControls, UnlockNotification, LoadingScreen } from './game/UI'
import { actions, getState, getPlayerId, setPlayerId } from './game/store'
import { AuthScreen } from './AuthScreen'
import { getSession, watchAuth, claimPlayerForAccount } from './supabase'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [accountReady, setAccountReady] = useState(false)

  useEffect(() => {
    let active = true
    const finishAuth = async (session: any) => {
      if (!active) return
      setAuthenticated(!!session)
      if (!session) { setAccountReady(false); setAuthReady(true); return }
      try {
        const claim = await claimPlayerForAccount(getPlayerId(), getState().username)
        if (!claim?.player_id) throw new Error('Account could not be assigned a player record')
        setPlayerId(claim.player_id)
        if (claim.username && claim.username !== getState().username) actions.setUsername(claim.username)
        setAccountReady(true)
      } catch (error) {
        console.error('Account claim failed; existing local save remains untouched:', error)
        setAccountReady(false)
      }
      setAuthReady(true)
    }
    getSession().then(finishAuth).catch(error => {
      console.error('Unable to initialize authentication:', error)
      if (active) setAuthReady(true)
    })
    const { data } = watchAuth(finishAuth)
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!authenticated || !accountReady) return
    if (getState().username) {
      void actions.restoreCloudProgress(getState().username).then(() => actions.syncSharedHighScore())
    }
    const timer = setTimeout(() => setLoaded(true), 1500)
    return () => clearTimeout(timer)
  }, [authenticated, accountReady])

  if (window.location.pathname === '/highscores') return <HighScoreAnalytics />
  if (window.location.pathname === '/leaderboard' && authReady && authenticated && accountReady) return <LeaderboardViewer />
  if (!authReady) return <LoadingScreen />
  if (!authenticated) return <AuthScreen />
  if (!accountReady) return <LoadingScreen />

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <div className="absolute inset-0"><GameScene /></div>
      {!loaded && <LoadingScreen />}
      <MainMenu /><HUD /><PauseMenu /><GameOverScreen /><TouchControls /><UnlockNotification /><Analytics />
    </div>
  )
}

export default App
