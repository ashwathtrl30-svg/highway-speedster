import { useState, useCallback, useEffect, useRef } from 'react'

// Bike definitions - 3 iconic Indian bikes
export interface Bike {
  id: string
  name: string
  unlockScore: number
  maxSpeed: number
  acceleration: number
  handling: number
  color: string
  accentColor: string
  description: string
}

export const BIKES: Bike[] = [
  {
    id: 'thunderbird',
    name: 'Thunderbird 350',
    unlockScore: 0,
    maxSpeed: 120,
    acceleration: 0.8,
    handling: 1.0,
    color: '#c0392b',
    accentColor: '#e74c3c',
    description: 'The classic cruiser. Balanced and reliable.',
  },
  {
    id: 'dominar',
    name: 'Dominar 400',
    unlockScore: 15000,
    maxSpeed: 160,
    acceleration: 1.2,
    handling: 0.9,
    color: '#2c3e50',
    accentColor: '#3498db',
    description: 'Muscular sport-tourer. Raw power.',
  },
  {
    id: 'hayabusa',
    name: 'Hayabusa',
    unlockScore: 50000,
    maxSpeed: 220,
    acceleration: 1.6,
    handling: 0.8,
    color: '#f39c12',
    accentColor: '#e67e22',
    description: 'The legendary speed demon. Unleash the beast.',
  },
]

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

export interface GameData {
  gameState: GameState
  score: number
  highScore: number
  distance: number
  speed: number
  nearMisses: number
  combo: number
  comboTimer: number
  selectedBike: Bike
  unlockedBikes: string[]
  playerLane: number
  targetLane: number
  playerX: number
  newUnlock: string | null
}

const STORAGE_KEY = 'highway-speedster-progress'

function loadSavedProgress(): { highScore: number; unlockedBikes: string[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) { /* ignore */ }
  return { highScore: 0, unlockedBikes: ['thunderbird'] }
}

function saveProgress(highScore: number, unlockedBikes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore, unlockedBikes }))
  } catch (e) { /* ignore */ }
}

// Simple store using a listener pattern
type Listener = () => void

let state: GameData = {
  gameState: 'menu',
  score: 0,
  highScore: loadSavedProgress().highScore,
  distance: 0,
  speed: 0,
  nearMisses: 0,
  combo: 0,
  comboTimer: 0,
  selectedBike: BIKES[0],
  unlockedBikes: loadSavedProgress().unlockedBikes,
  playerLane: 0,
  targetLane: 0,
  playerX: 0,
  newUnlock: null,
}

const listeners: Set<Listener> = new Set()

function notify() {
  listeners.forEach((l) => l())
}

function setState(partial: Partial<GameData>) {
  state = { ...state, ...partial }
  notify()
}

export function getState(): GameData {
  return state
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Actions
export const actions = {
  setGameState(gameState: GameState) {
    setState({ gameState })
    // Save progress when game ends
    if (gameState === 'gameover') {
      saveProgress(state.highScore, state.unlockedBikes)
    }
  },

  addScore(points: number) {
    const newScore = state.score + points
    const newHighScore = Math.max(state.highScore, newScore)
    let newUnlock: string | null = null
    
    // Check bike unlocks
    for (const bike of BIKES) {
      if (newScore >= bike.unlockScore && !state.unlockedBikes.includes(bike.id)) {
        const newUnlocked = [...state.unlockedBikes, bike.id]
        setState({
          score: newScore,
          highScore: newHighScore,
          unlockedBikes: newUnlocked,
          newUnlock: bike.name,
        })
        saveProgress(newHighScore, newUnlocked)
        return
      }
    }
    
    setState({ score: newScore, highScore: newHighScore })
    if (newHighScore > state.highScore) {
      saveProgress(newHighScore, state.unlockedBikes)
    }
  },

  setDistance(d: number) { setState({ distance: d }) },
  setSpeed(s: number) { setState({ speed: s }) },

  addNearMiss() {
    const newCombo = state.combo + 1
    const bonus = 100 * newCombo
    setState({
      nearMisses: state.nearMisses + 1,
      combo: newCombo,
      comboTimer: 2.0,
      score: state.score + bonus,
      highScore: Math.max(state.highScore, state.score + bonus),
    })
  },

  resetCombo() { setState({ combo: 0, comboTimer: 0 }) },

  setTargetLane(lane: number) {
    setState({ targetLane: Math.max(-1, Math.min(1, lane)) })
  },

  setPlayerX(x: number) { setState({ playerX: x }) },

  selectBike(bike: Bike) { setState({ selectedBike: bike }) },

  resetGame() {
    setState({
      score: 0,
      distance: 0,
      speed: 0,
      nearMisses: 0,
      combo: 0,
      comboTimer: 0,
      playerLane: 0,
      targetLane: 0,
      playerX: 0,
      newUnlock: null,
    })
  },

  clearNewUnlock() { setState({ newUnlock: null }) },
}

// React hook
export function useGameStore(): GameData
export function useGameStore<T>(selector: (state: GameData) => T): T
export function useGameStore<T>(selector?: (state: GameData) => T): T | GameData {
  const [, forceUpdate] = useState(0)
  
  useEffect(() => {
    const unsub = subscribe(() => forceUpdate((n) => n + 1))
    return unsub
  }, [])

  if (selector) {
    return selector(state)
  }
  return state
}

// Hook for specific actions that need stable references
export function useGameActions() {
  return useRef(actions).current
}
