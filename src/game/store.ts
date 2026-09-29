import { useState, useEffect, useRef } from 'react'
import { syncAnalyticsToSupabase, recordPlaytimeEvent, fetchUserHighScore } from '../supabase'

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

export interface Car {
  id: string
  name: string
  unlockScore: number
  maxSpeed: number
  acceleration: number
  handling: number
  color: string
  accentColor: string
  description: string
  inspiration: string
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

export const CARS: Car[] = [
  {
    id: 'kanto-zip',
    name: 'Kanto Zip',
    unlockScore: 0,
    maxSpeed: 120,
    acceleration: 0.9,
    handling: 1.0,
    color: '#d7d9dc',
    accentColor: '#1f2937',
    description: 'The urban beginner. Lightweight and agile.',
    inspiration: 'Maruti Suzuki Alto',
  },
  {
    id: 'saber-swift',
    name: 'Saber Swift',
    unlockScore: BIKES[1].unlockScore,
    maxSpeed: 150,
    acceleration: 1.1,
    handling: 0.95,
    color: '#5b7fa8',
    accentColor: '#d9e2ec',
    description: 'The daily performer. Balanced and reliable.',
    inspiration: 'Honda City',
  },
  {
    id: 'goliath-titan',
    name: 'Goliath Titan',
    unlockScore: BIKES[2].unlockScore,
    maxSpeed: 200,
    acceleration: 1.2,
    handling: 0.82,
    color: '#65707a',
    accentColor: '#d1d5db',
    description: 'The terrain conqueror. Tough and unstoppable.',
    inspiration: 'Land Rover Defender 110',
  },
  {
    id: 'kaiser-monarch',
    name: 'Kaiser Monarch',
    unlockScore: BIKES[3].unlockScore,
    maxSpeed: 250,
    acceleration: 1.55,
    handling: 0.78,
    color: '#252a31',
    accentColor: '#bfc5cd',
    description: 'The executive missile. Powerful and refined.',
    inspiration: 'BMW M8 Competition',
  },
  {
    id: 'scuderia-fury',
    name: 'Scuderia Fury',
    unlockScore: BIKES[4].unlockScore,
    maxSpeed: 300,
    acceleration: 1.8,
    handling: 0.72,
    color: '#9b1c22',
    accentColor: '#ffd166',
    description: 'The ultimate apex. Fast and fearless.',
    inspiration: 'Ferrari 296 GTB',
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
  selectedCar: Car
  vehicleMode: 'bike' | 'car'
  selectedSkin: BikeSkin
  unlockedBikes: string[]
  unlockedCars: string[]
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

function loadSavedProgress(): { highScore: number; unlockedBikes: string[]; unlockedCars: string[]; bikeSkins: Record<string, BikeSkin>; totalCoins: number; inventory: PowerUpInventory; username: string; totalPlaytime: number; userPlaytime: Record<string, number>; playtimeHistory: PlaytimeEntry[]; vehicleMode: 'bike' | 'car'; selectedCarId: string } {
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
      const highScore = data.highScore || 0
      const savedUnlockedBikes = (data.unlockedBikes || ['blitz']).map(migrate)
      // Repair legacy/stale unlock state: a high score must always unlock every
      // bike whose threshold has been reached, including scores synced from the server.
      const unlockedBikes = BIKES
        .filter((bike) => bike.unlockScore <= highScore)
        .map((bike) => bike.id)
        .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], [...savedUnlockedBikes])

      // Car progression is independent from bike progression, but uses the same global high score.
      const savedUnlockedCars = Array.isArray(data.unlockedCars) ? data.unlockedCars : ['kanto-zip']
      const unlockedCars = CARS
        .filter((car) => car.unlockScore <= highScore)
        .map((car) => car.id)
        .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], [...savedUnlockedCars])

      return {
        highScore,
        unlockedBikes,
        unlockedCars,
        bikeSkins: data.bikeSkins || { blitz: 'black', apex: 'black', chronos: 'black', stratos: 'black', zenith: 'black' },
        totalCoins: data.totalCoins || data.coins || 0,
        inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0, ...(data.inventory || {}) },
        username: data.username || '',
        totalPlaytime: data.totalPlaytime || 0,
        userPlaytime: data.userPlaytime || {},
        playtimeHistory: data.playtimeHistory || [],
        vehicleMode: data.vehicleMode === 'car' ? 'car' : 'bike',
        selectedCarId: typeof data.selectedCarId === 'string' && CARS.some((car) => car.id === data.selectedCarId) ? data.selectedCarId : CARS[0].id,
      }
    }
  } catch (e) { /* ignore */ }
  return { highScore: 0, unlockedBikes: ['blitz'], unlockedCars: ['kanto-zip'], bikeSkins: { blitz: 'black', apex: 'black', chronos: 'black', stratos: 'black', zenith: 'black' }, totalCoins: 0, inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 }, username: '', totalPlaytime: 0, userPlaytime: {}, playtimeHistory: [], vehicleMode: 'bike', selectedCarId: CARS[0].id }
}

function saveProgress(highScore: number, unlockedBikes: string[], bikeSkins: Record<string, BikeSkin>, totalCoins: number, inventory: PowerUpInventory, username: string, totalPlaytime: number, userPlaytime: Record<string, number>, playtimeHistory: PlaytimeEntry[]) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      highScore,
      unlockedBikes,
      bikeSkins,
      totalCoins,
      inventory,
      username,
      totalPlaytime,
      userPlaytime,
      playtimeHistory,
      vehicleMode: existing.vehicleMode === 'car' ? 'car' : 'bike',
      selectedCarId: typeof existing.selectedCarId === 'string' && CARS.some((car) => car.id === existing.selectedCarId)
        ? existing.selectedCarId
        : CARS[0].id,
    }))
  } catch (e) { /* ignore */ }
}

function saveVehicleSelection(vehicleMode: 'bike' | 'car', selectedVehicleId: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...saved,
      vehicleMode,
      selectedCarId: vehicleMode === 'car'
        ? selectedVehicleId
        : (saved.selectedCarId || CARS[0].id),
    }))
  } catch (e) { /* ignore */ }
}

// Simple store using a listener pattern
type Listener = () => void

const savedProgress = loadSavedProgress()
const initialBike = BIKES[0]
const initialSkin = savedProgress.bikeSkins[initialBike.id] || 'black'
const initialColors = SKIN_COLORS[initialSkin]
const initialCar = CARS.find((car) => car.id === savedProgress.selectedCarId) || CARS[0]
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
  selectedCar: initialCar,
  vehicleMode: savedProgress.vehicleMode,
  selectedSkin: initialSkin,
  unlockedBikes: savedProgress.unlockedBikes,
  unlockedCars: savedProgress.unlockedCars,
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

// Analytics batches playtime into 30-second events so weekly/monthly history is accurate.
let pendingAnalyticsSeconds = 0

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
      
      // Flush any remaining playtime and sync the cumulative user record.
      if (state.username) {
        if (pendingAnalyticsSeconds > 0) {
          const remainingSeconds = pendingAnalyticsSeconds
          pendingAnalyticsSeconds = 0
          recordPlaytimeEvent(state.username, remainingSeconds)
        }
        syncAnalyticsToSupabase(
          state.username,
          state.totalPlaytime,
          state.highScore,
          newTotalCoins
        )
      }
    }
  },

  addScore(points: number) {
    const newScore = state.score + points
    const newHighScore = Math.max(state.highScore, newScore)

    // Unlock cars from the global high score, regardless of which vehicle earned it.
    const newlyUnlockedCars = CARS.filter(
      (car) => newScore >= car.unlockScore && !state.unlockedCars.includes(car.id)
    )
    const newUnlockedCars = newlyUnlockedCars.length > 0
      ? [...state.unlockedCars, ...newlyUnlockedCars.map((car) => car.id)]
      : state.unlockedCars

    // Unlock every bike whose threshold has been reached. This is intentionally
    // based on the score, not on the order/size of individual score events, so
    // large score jumps cannot leave higher-tier bikes incorrectly locked.
    const newlyUnlocked = BIKES.filter(
      (bike) => newScore >= bike.unlockScore && !state.unlockedBikes.includes(bike.id)
    )
    const newUnlocked = newlyUnlocked.length > 0
      ? [...state.unlockedBikes, ...newlyUnlocked.map((bike) => bike.id)]
      : state.unlockedBikes

    setState({
      score: newScore,
      highScore: newHighScore,
      unlockedBikes: newUnlocked,
      unlockedCars: newUnlockedCars,
      newUnlock: newlyUnlocked[0]?.name ?? null,
    })

    if (newHighScore > state.highScore || newlyUnlocked.length > 0) {
      saveProgress(
        newHighScore,
        newUnlocked,
        state.bikeSkins,
        state.totalCoins,
        state.inventory,
        state.username,
        state.totalPlaytime,
        state.userPlaytime,
        state.playtimeHistory
      )
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
      vehicleMode: 'bike',
    })
    saveVehicleSelection('bike', bike.id)
  },

  selectCar(car: Car) {
    if (!state.unlockedCars.includes(car.id)) return
    setState({
      selectedCar: car,
      vehicleMode: 'car',
    })
    saveVehicleSelection('car', car.id)
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

  syncSharedHighScore() {
    const username = state.username.trim()
    if (!username) return

    fetchUserHighScore(username).then((serverHighScore) => {
      if (serverHighScore === null) return

      const current = getState()

      // Ignore a stale response if the player changed username while it was loading.
      if (current.username.trim() !== username) return

      const mergedHighScore = Math.max(current.highScore, serverHighScore)
      const unlockedBikes = BIKES
        .filter((bike) => bike.unlockScore <= mergedHighScore)
        .map((bike) => bike.id)
        .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], [...current.unlockedBikes])
      const unlockedCars = CARS
        .filter((car) => car.unlockScore <= mergedHighScore)
        .map((car) => car.id)
        .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], [...current.unlockedCars])

      if (mergedHighScore !== current.highScore || unlockedBikes.length !== current.unlockedBikes.length || unlockedCars.length !== current.unlockedCars.length) {
        setState({
          highScore: mergedHighScore,
          unlockedBikes,
          unlockedCars,
        })
        saveProgress(
          mergedHighScore,
          unlockedBikes,
          current.bikeSkins,
          current.totalCoins,
          current.inventory,
          current.username,
          current.totalPlaytime,
          current.userPlaytime,
          current.playtimeHistory
        )
      }
    })
  },

  setUsername(username: string) {
    setState({ username })
    saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory, username, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)

    // A username represents the same player across devices.
    actions.syncSharedHighScore()
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
    
    // Record real historical playtime in 30-second batches.
    if (state.username) {
      pendingAnalyticsSeconds += seconds
      if (pendingAnalyticsSeconds >= 30) {
        const eventSeconds = pendingAnalyticsSeconds
        pendingAnalyticsSeconds = 0
        recordPlaytimeEvent(state.username, eventSeconds)
      }
    }
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
