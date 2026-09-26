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

export type BikeSkin = 'black' | 'blue' | 'red' | 'silver' | 'gold'

export const BIKE_SKINS: Record<string, BikeSkin[]> = {
  blitz: ['black', 'blue', 'red'],
  apex: ['black', 'blue', 'red'],
  chronos: ['black', 'blue', 'red'],
  stratos: ['black', 'blue', 'red', 'silver'],
  zenith: ['black', 'blue', 'red', 'silver', 'gold'],
}

export const SKIN_COLORS: Record<BikeSkin, { color: string; accentColor: string }> = {
  black: { color: '#1a1a1a', accentColor: '#333333' },
  blue: { color: '#1e40af', accentColor: '#3b82f6' },
  red: { color: '#991b1b', accentColor: '#ef4444' },
  silver: { color: '#6b7280', accentColor: '#9ca3af' },
  gold: { color: '#b8860b', accentColor: '#ffd700' },
}

export const BIKES: Bike[] = [
  {
    id: 'blitz',
    name: 'Blitz',
    unlockScore: 0,
    maxSpeed: 100,
    acceleration: 0.8,
    handling: 1.0,
    color: '#1a1a1a',
    accentColor: '#333333',
    description: 'The classic cruiser. Balanced and reliable.',
  },
  {
    id: 'apex',
    name: 'Apex',
    unlockScore: 20000,
    maxSpeed: 120,
    acceleration: 1.2,
    handling: 0.9,
    color: '#1a1a1a',
    accentColor: '#333333',
    description: 'Muscular sport-tourer. Raw power.',
  },
  {
    id: 'chronos',
    name: 'Chronos',
    unlockScore: 30000,
    maxSpeed: 150,
    acceleration: 1.4,
    handling: 0.85,
    color: '#1a1a1a',
    accentColor: '#333333',
    description: 'Agile street fighter. Quick and nimble.',
  },
  {
    id: 'stratos',
    name: 'Stratos',
    unlockScore: 40000,
    maxSpeed: 180,
    acceleration: 1.5,
    handling: 0.8,
    color: '#1a1a1a',
    accentColor: '#333333',
    description: 'High-performance machine. Built for speed.',
  },
  {
    id: 'zenith',
    name: 'Zenith',
    unlockScore: 50000,
    maxSpeed: 250,
    acceleration: 1.8,
    handling: 0.75,
    color: '#1a1a1a',
    accentColor: '#333333',
    description: 'The ultimate speed demon. Unmatched power.',
  },
]

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

export interface PowerUpInventory {
  magnet: number
  multiplier: number
  shield: number
}

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
  selectedSkin: BikeSkin
  unlockedBikes: string[]
  bikeSkins: Record<string, BikeSkin>
  totalCoins: number
  runCoins: number
  inventory: PowerUpInventory
  selectedPowerUp: 'magnet' | 'multiplier' | 'shield' | null
  playerLane: number
  targetLane: number
  playerX: number
  newUnlock: string | null
  magnetActive: boolean
  magnetTimer: number
  multiplierActive: boolean
  multiplierTimer: number
  shieldActive: boolean
}

const STORAGE_KEY = 'highway-speedster-progress'

function loadSavedProgress(): { highScore: number; unlockedBikes: string[]; bikeSkins: Record<string, BikeSkin>; totalCoins: number; inventory: PowerUpInventory } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      // Migrate old bike IDs to new names
      const migrate = (id: string) => {
        if (id === 'thunderbird') return 'blitz'
        if (id === 'dominar') return 'apex'
        if (id === 'hayabusa') return 'chronos'
        return id
      }
      return {
        highScore: data.highScore || 0,
        unlockedBikes: (data.unlockedBikes || ['blitz']).map(migrate),
        bikeSkins: data.bikeSkins || { blitz: 'black', apex: 'black', chronos: 'black', stratos: 'black', zenith: 'black' },
        totalCoins: data.totalCoins || data.coins || 0,
        inventory: data.inventory || { magnet: 0, multiplier: 0, shield: 0 },
      }
    }
  } catch (e) { /* ignore */ }
  return { highScore: 0, unlockedBikes: ['blitz'], bikeSkins: { blitz: 'black', apex: 'black', chronos: 'black', stratos: 'black', zenith: 'black' }, totalCoins: 0, inventory: { magnet: 0, multiplier: 0, shield: 0 } }
}

function saveProgress(highScore: number, unlockedBikes: string[], bikeSkins: Record<string, BikeSkin>, totalCoins: number, inventory: PowerUpInventory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore, unlockedBikes, bikeSkins, totalCoins, inventory }))
  } catch (e) { /* ignore */ }
}

// Simple store using a listener pattern
type Listener = () => void

const savedProgress = loadSavedProgress()
const initialBike = BIKES[0]
const initialSkin = savedProgress.bikeSkins[initialBike.id] || 'black'
const initialColors = SKIN_COLORS[initialSkin]

let state: GameData = {
  gameState: 'menu',
  score: 0,
  highScore: savedProgress.highScore,
  distance: 0,
  speed: 0,
  nearMisses: 0,
  combo: 0,
  comboTimer: 0,
  selectedBike: { ...initialBike, color: initialColors.color, accentColor: initialColors.accentColor },
  selectedSkin: initialSkin,
  unlockedBikes: savedProgress.unlockedBikes,
  bikeSkins: savedProgress.bikeSkins,
  totalCoins: savedProgress.totalCoins,
  runCoins: 0,
  inventory: savedProgress.inventory,
  selectedPowerUp: null,
  playerLane: 0,
  targetLane: 0,
  playerX: 0,
  newUnlock: null,
  magnetActive: false,
  magnetTimer: 0,
  multiplierActive: false,
  multiplierTimer: 0,
  shieldActive: false,
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
      // Add run coins to total coins
      const newTotalCoins = state.totalCoins + state.runCoins
      setState({ totalCoins: newTotalCoins, runCoins: 0 })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, state.inventory)
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
        saveProgress(newHighScore, newUnlocked, state.bikeSkins, state.totalCoins, state.inventory)
        return
      }
    }
    
    setState({ score: newScore, highScore: newHighScore })
    if (newHighScore > state.highScore) {
      saveProgress(newHighScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory)
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

  selectBike(bike: Bike) {
    const skin = state.bikeSkins[bike.id] || 'black'
    const colors = SKIN_COLORS[skin]
    setState({ 
      selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
      selectedSkin: skin,
    })
  },

  selectSkin(bikeId: string, skin: BikeSkin) {
    const colors = SKIN_COLORS[skin]
    const newBikeSkins = { ...state.bikeSkins, [bikeId]: skin }
    const updates: Partial<GameData> = { bikeSkins: newBikeSkins }
    
    // If this is the currently selected bike, update its colors
    if (state.selectedBike.id === bikeId) {
      updates.selectedBike = { ...state.selectedBike, color: colors.color, accentColor: colors.accentColor }
      updates.selectedSkin = skin
    }
    
    setState(updates)
    saveProgress(state.highScore, state.unlockedBikes, newBikeSkins, state.totalCoins, state.inventory)
  },

  addCoins(amount: number) {
    const newRunCoins = state.runCoins + amount
    setState({ runCoins: newRunCoins })
  },

  buyMagnet() {
    if (state.totalCoins >= 300) {
      const newTotalCoins = state.totalCoins - 300
      const newInventory = { ...state.inventory, magnet: state.inventory.magnet + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory)
    }
  },

  buyMultiplier() {
    if (state.totalCoins >= 350) {
      const newTotalCoins = state.totalCoins - 350
      const newInventory = { ...state.inventory, multiplier: state.inventory.multiplier + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory)
    }
  },

  buyShield() {
    if (state.totalCoins >= 450) {
      const newTotalCoins = state.totalCoins - 450
      const newInventory = { ...state.inventory, shield: state.inventory.shield + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory)
    }
  },

  selectPowerUp(powerUp: 'magnet' | 'multiplier' | 'shield' | null) {
    setState({ selectedPowerUp: powerUp })
  },

  useSelectedPowerUp() {
    if (state.selectedPowerUp && state.inventory[state.selectedPowerUp] > 0) {
      const newInventory = { ...state.inventory, [state.selectedPowerUp]: state.inventory[state.selectedPowerUp] - 1 }
      
      if (state.selectedPowerUp === 'magnet') {
        setState({ magnetActive: true, magnetTimer: 10, inventory: newInventory })
      } else if (state.selectedPowerUp === 'multiplier') {
        setState({ multiplierActive: true, multiplierTimer: 15, inventory: newInventory })
      } else if (state.selectedPowerUp === 'shield') {
        setState({ shieldActive: true, inventory: newInventory })
      }
      
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, newInventory)
    }
  },

  resetGame() {
    setState({
      score: 0,
      distance: 0,
      speed: 0,
      nearMisses: 0,
      combo: 0,
      comboTimer: 0,
      runCoins: 0,
      playerLane: 0,
      targetLane: 0,
      playerX: 0,
      newUnlock: null,
      magnetActive: false,
      magnetTimer: 0,
      multiplierActive: false,
      multiplierTimer: 0,
      shieldActive: false,
    })
  },

  clearNewUnlock() { setState({ newUnlock: null }) },

  activateMagnet() {
    setState({ magnetActive: true, magnetTimer: 10 })
  },

  activateMultiplier() {
    setState({ multiplierActive: true, multiplierTimer: 15 })
  },

  activateShield() {
    setState({ shieldActive: true })
  },

  useShield() {
    setState({ shieldActive: false })
  },

  tickPowerUps(delta: number) {
    const updates: Partial<GameData> = {}
    
    if (state.magnetActive) {
      const newTimer = state.magnetTimer - delta
      if (newTimer <= 0) {
        updates.magnetActive = false
        updates.magnetTimer = 0
      } else {
        updates.magnetTimer = newTimer
      }
    }
    
    if (state.multiplierActive) {
      const newTimer = state.multiplierTimer - delta
      if (newTimer <= 0) {
        updates.multiplierActive = false
        updates.multiplierTimer = 0
      } else {
        updates.multiplierTimer = newTimer
      }
    }
    
    if (Object.keys(updates).length > 0) {
      setState(updates)
    }
  },
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
