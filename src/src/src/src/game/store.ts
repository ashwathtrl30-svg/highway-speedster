import { create } from 'zustand'

export interface Bike {
  id: string
  name: string
  speed: number
  handling: number
  color: string
  unlockScore: number
}

export const BIKES: Bike[] = [
  { id: 'starter', name: 'Starter Bike', speed: 1.0, handling: 1.0, color: '#3b82f6', unlockScore: 0 },
  { id: 'sport', name: 'Sport Bike', speed: 1.2, handling: 0.9, color: '#ef4444', unlockScore: 5000 },
  { id: 'cruiser', name: 'Cruiser', speed: 0.9, handling: 1.1, color: '#8b5cf6', unlockScore: 15000 },
  { id: 'racer', name: 'Racer', speed: 1.4, handling: 0.8, color: '#f59e0b', unlockScore: 30000 },
  { id: 'superbike', name: 'Superbike', speed: 1.6, handling: 1.0, color: '#10b981', unlockScore: 50000 },
]

type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

interface GameStore {
  gameState: GameState
  score: number
  highScore: number
  distance: number
  speed: number
  targetLane: number
  playerX: number
  nearMisses: number
  combo: number
  selectedBike: Bike
  unlockedBikes: string[]
  newUnlock: Bike | null
}

const useGameStore = create<GameStore>(() => ({
  gameState: 'menu',
  score: 0,
  highScore: parseInt(localStorage.getItem('highScore') || '0', 10),
  distance: 0,
  speed: 0,
  targetLane: 1,
  playerX: 0,
  nearMisses: 0,
  combo: 0,
  selectedBike: BIKES[0],
  unlockedBikes: JSON.parse(localStorage.getItem('unlockedBikes') || '["starter"]'),
  newUnlock: null,
}))

export const getState = () => useGameStore.getState()

export const actions = {
  setGameState: (gameState: GameState) => useGameStore.setState({ gameState }),
  
  addScore: (points: number) => {
    const state = getState()
    const newScore = state.score + points
    useGameStore.setState({ score: newScore })
    
    // Check for bike unlocks
    BIKES.forEach((bike) => {
      if (
        newScore >= bike.unlockScore &&
        !state.unlockedBikes.includes(bike.id) &&
        bike.id !== 'starter'
      ) {
        const newUnlockedBikes = [...state.unlockedBikes, bike.id]
        useGameStore.setState({ 
          unlockedBikes: newUnlockedBikes,
          newUnlock: bike 
        })
        localStorage.setItem('unlockedBikes', JSON.stringify(newUnlockedBikes))
      }
    })
  },
  
  setDistance: (distance: number) => useGameStore.setState({ distance }),
  setSpeed: (speed: number) => useGameStore.setState({ speed }),
  setTargetLane: (targetLane: number) => {
    const clampedLane = Math.max(-1, Math.min(1, targetLane))
    useGameStore.setState({ targetLane: clampedLane })
  },
  setPlayerX: (playerX: number) => useGameStore.setState({ playerX }),
  
  addNearMiss: () => {
    const state = getState()
    const newCombo = state.combo + 1
    const bonusPoints = newCombo * 50
    useGameStore.setState({ 
      nearMisses: state.nearMisses + 1,
      combo: newCombo,
      score: state.score + bonusPoints
    })
  },
  
  resetCombo: () => useGameStore.setState({ combo: 0 }),
  
  selectBike: (bike: Bike) => useGameStore.setState({ selectedBike: bike }),
  
  clearNewUnlock: () => useGameStore.setState({ newUnlock: null }),
  
  resetGame: () => {
    const state = getState()
    const highScore = Math.max(state.score, state.highScore)
    if (highScore > state.highScore) {
      localStorage.setItem('highScore', highScore.toString())
    }
    
    useGameStore.setState({
      score: 0,
      distance: 0,
      speed: 0,
      targetLane: 1,
      playerX: 0,
      nearMisses: 0,
      combo: 0,
      highScore,
      newUnlock: null,
    })
  },
}

export { useGameStore }
