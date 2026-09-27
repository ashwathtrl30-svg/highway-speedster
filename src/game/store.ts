import { useState, useEffect, useRef } from 'react'

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
    unlockScore: 30000,
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
    unlockScore: 50000,
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
    unlockScore: 80000,
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
    unlockScore: 100000,
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
  magnet2x: number
  multiplier2x: number
  multiplier4x: number
  shield: number
}

export interface PlaytimeEntry {
  date: string // YYYY-MM-DD format
  seconds: number
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
  selectedPowerUp: 'magnet' | 'magnet2x' | 'multiplier2x' | 'multiplier4x' | 'shield' | null
  playerLane: number
  targetLane: number
  playerX: number
  newUnlock: string | null
  magnetActive: boolean
  magnetTimer: number
  magnet2xActive: boolean
  magnet2xTimer: number
  multiplierActive: boolean
  multiplierTimer: number
  multiplier4x: boolean
  shieldActive: boolean
  shieldCount: number
  username: string
  totalPlaytime: number
  userPlaytime: Record<string, number>
  playtimeHistory: PlaytimeEntry[]
}

const STORAGE_KEY = 'highway-speedster-progress'

function loadSavedProgress(): { highScore: number; unlockedBikes: string[]; bikeSkins: Record<string, BikeSkin>; totalCoins: number; inventory: PowerUpInventory; username: string; totalPlaytime: number; userPlaytime: Record<string, number>; playtimeHistory: PlaytimeEntry[] } {
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
        inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0, ...(data.inventory || {}) },
        username: data.username || '',
        totalPlaytime: data.totalPlaytime || 0,
        userPlaytime: data.userPlaytime || {},
        playtimeHistory: data.playtimeHistory || [],
      }
    }
  } catch (e) { /* ignore */ }
  return { highScore: 0, unlockedBikes: ['blitz'], bikeSkins: { blitz: 'black', apex: 'black', chronos: 'black', stratos: 'black', zenith: 'black' }, totalCoins: 0, inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 }, username: '', totalPlaytime: 0, userPlaytime: {}, playtimeHistory: [] }
}

function saveProgress(highScore: number, unlockedBikes: string[], bikeSkins: Record<string, BikeSkin>, totalCoins: number, inventory: PowerUpInventory, username: string, totalPlaytime: number, userPlaytime: Record<string, number>, playtimeHistory: PlaytimeEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highScore, unlockedBikes, bikeSkins, totalCoins, inventory, username, totalPlaytime, userPlaytime, playtimeHistory }))
  } catch (e) { /* ignore */ }
}

// Simple store using a listener pattern
type Listener = () => void

const savedProgress = loadSavedProgress()
const initialBike = BIKES[0]
const initialSkin = savedProgress.bikeSkins[initialBike.id] || 'black'
const initialColors = SKIN_COLORS[initialSkin]
const defaultInventory = { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 }

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
  inventory: { ...defaultInventory, ...savedProgress.inventory },
  selectedPowerUp: null,
  playerLane: 0,
  targetLane: 0,
  playerX: 0,
  newUnlock: null,
  magnetActive: false,
  magnetTimer: 0,
  magnet2xActive: false,
  magnet2xTimer: 0,
  multiplierActive: false,
  multiplierTimer: 0,
  multiplier4x: false,
  shieldActive: false,
  shieldCount: 0,
  username: savedProgress.username,
  totalPlaytime: savedProgress.totalPlaytime,
  userPlaytime: savedProgress.userPlaytime,
  playtimeHistory: savedProgress.playtimeHistory,
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
      // Add run coins to total coins but keep runCoins visible
      const newTotalCoins = state.totalCoins + state.runCoins
      setState({ totalCoins: newTotalCoins })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, state.inventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
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
        saveProgress(newHighScore, newUnlocked, state.bikeSkins, state.totalCoins, state.inventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
        return
      }
    }
    
    setState({ score: newScore, highScore: newHighScore })
    if (newHighScore > state.highScore) {
      saveProgress(newHighScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
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
    saveProgress(state.highScore, state.unlockedBikes, newBikeSkins, state.totalCoins, state.inventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
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
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    }
  },

  buyMagnet2x() {
    if (state.totalCoins >= 300) {
      const newTotalCoins = state.totalCoins - 300
      const newInventory = { ...state.inventory, magnet2x: state.inventory.magnet2x + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    }
  },

  buyMultiplier() {
    if (state.totalCoins >= 300) {
      const newTotalCoins = state.totalCoins - 300
      const newInventory = { ...state.inventory, multiplier2x: state.inventory.multiplier2x + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    }
  },

  buyMultiplier4x() {
    if (state.totalCoins >= 350) {
      const newTotalCoins = state.totalCoins - 350
      const newInventory = { ...state.inventory, multiplier4x: state.inventory.multiplier4x + 1 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    }
  },

  buyShield() {
    if (state.totalCoins >= 450) {
      const newTotalCoins = state.totalCoins - 450
      const newInventory = { ...state.inventory, shield: state.inventory.shield + 2 }
      setState({ totalCoins: newTotalCoins, inventory: newInventory })
      saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, newTotalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    }
  },

  selectPowerUp(powerUp: 'magnet' | 'magnet2x' | 'multiplier2x' | 'multiplier4x' | 'shield' | null) {
    setState({ selectedPowerUp: powerUp as any })
  },

  useSelectedPowerUp() {
    if (state.selectedPowerUp) {
      const powerUp = state.selectedPowerUp as 'magnet' | 'magnet2x' | 'multiplier2x' | 'multiplier4x' | 'shield'
      if (state.inventory[powerUp] > 0) {
        const newInventory = { ...state.inventory, [powerUp]: state.inventory[powerUp] - 1 }
        
        if (powerUp === 'magnet') {
          setState({ magnetActive: true, magnetTimer: 10, inventory: newInventory })
        } else if (powerUp === 'magnet2x') {
          setState({ magnet2xActive: true, magnet2xTimer: 10, inventory: newInventory })
        } else if (powerUp === 'multiplier2x') {
          setState({ multiplierActive: true, multiplierTimer: 10, multiplier4x: false, inventory: newInventory })
        } else if (powerUp === 'multiplier4x') {
          setState({ multiplierActive: true, multiplierTimer: 10, multiplier4x: true, inventory: newInventory })
        } else if (powerUp === 'shield') {
          setState({ shieldActive: true, shieldCount: 2, inventory: newInventory })
        }
        
        saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, newInventory, state.username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
      }
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
      magnet2xActive: false,
      magnet2xTimer: 0,
      multiplierActive: false,
      multiplierTimer: 0,
      multiplier4x: false,
      shieldActive: false,
      shieldCount: 0,
    })
  },

  clearNewUnlock() { setState({ newUnlock: null }) },

  setUsername(username: string) {
    setState({ username })
    saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory, username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
  },

  // Playtime tracking
  addPlaytime(seconds: number) {
    const newTotalPlaytime = state.totalPlaytime + seconds
    const newUserPlaytime = { ...state.userPlaytime }
    const newPlaytimeHistory = [...state.playtimeHistory]
    
    // Add to total playtime
    if (state.username) {
      newUserPlaytime[state.username] = (newUserPlaytime[state.username] || 0) + seconds
    }
    
    // Track playtime with today's date
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const existingEntry = newPlaytimeHistory.find(entry => entry.date === today)
    
    if (existingEntry) {
      existingEntry.seconds += seconds
    } else {
      newPlaytimeHistory.push({ date: today, seconds })
    }
    
    setState({ 
      totalPlaytime: newTotalPlaytime, 
      userPlaytime: newUserPlaytime,
      playtimeHistory: newPlaytimeHistory
    })
    saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory, state.username, newTotalPlaytime, newUserPlaytime, newPlaytimeHistory)
  },

  activateMagnet() {
    setState({ magnetActive: true, magnetTimer: 10 })
  },

  activateMagnet2x() {
    setState({ magnet2xActive: true, magnet2xTimer: 10 })
  },

  activateMultiplier() {
    setState({ multiplierActive: true, multiplierTimer: 10 })
  },

  activateShield() {
    const newShieldCount = state.shieldCount + 1
    setState({ shieldActive: true, shieldCount: newShieldCount })
  },

  useShield() {
    const newShieldCount = Math.max(0, state.shieldCount - 1)
    if (newShieldCount === 0) {
      setState({ shieldActive: false, shieldCount: 0 })
    } else {
      setState({ shieldCount: newShieldCount })
    }
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
    
    if (state.magnet2xActive) {
      const newTimer = state.magnet2xTimer - delta
      if (newTimer <= 0) {
        updates.magnet2xActive = false
        updates.magnet2xTimer = 0
      } else {
        updates.magnet2xTimer = newTimer
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
