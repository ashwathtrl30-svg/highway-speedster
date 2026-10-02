import { useState, useEffect, useRef } from 'react'
import { syncAnalyticsToSupabase, recordPlaytimeEvent, fetchUserHighScore, fetchUserGameProgress, saveUserGameProgress, registerGameDevice, logoutGameAccount, changeGameUsername, type CloudGameProgress } from '../supabase'

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

export type BikeSkin =
  | 'black' | 'blue' | 'red' | 'silver' | 'gold'
  | 'drifter-blue' | 'getaway-orange' | 'marine' | 'matte-black'
  | 'aurora-green' | 'charcoal-black' | 'rock-matte-black' | 'canyon-red'
  | 'metallic-galaxy-gray' | 'pearl-vigor-blue' | 'candy-daring-red' | 'glass-sparkle-black'
  | 'mirror-coated-matte-spark-black' | 'mirror-coated-spark-black-carbon-edition' | 'custom-midnight' | 'rainbow-finish'
  | 'deep-crimson' | 'candy-flat-blazed-green'
  | 'ducati-red' | 'tricolore-livery' | 'racing-black' | 'winter-test'


export interface CarColorOption {
  id: string
  name: string
  color: string
  accentColor: string
}

export const CAR_COLORS: Record<string, CarColorOption[]> = {
  'kanto-zip': [
    { id: 'green', name: 'Green', color: '#2f7d32', accentColor: '#78b77b' },
    { id: 'blue', name: 'Blue', color: '#2563eb', accentColor: '#60a5fa' },
    { id: 'red', name: 'Red', color: '#dc2626', accentColor: '#f87171' },
    { id: 'black', name: 'Black', color: '#111111', accentColor: '#3a3a3a' },
  ],
  'saber-swift': [
    { id: 'orange', name: 'Orange', color: '#f97316', accentColor: '#fdba74' },
    { id: 'red', name: 'Red', color: '#dc2626', accentColor: '#f87171' },
    { id: 'blue', name: 'Blue', color: '#2563eb', accentColor: '#60a5fa' },
    { id: 'black', name: 'Black', color: '#111111', accentColor: '#3a3a3a' },
  ],
  'goliath-titan': [
    { id: 'santorini-black', name: 'Santorini Black', color: '#0f1112', accentColor: '#3b4146' },
    { id: 'pangea-green', name: 'Pangea Green', color: '#354238', accentColor: '#728173' },
    { id: 'carpathian-grey', name: 'Carpathian Grey', color: '#4b5055', accentColor: '#9aa0a6' },
    { id: 'tasman-blue', name: 'Tasman Blue', color: '#214560', accentColor: '#6687a0' },
  ],
  'kaiser-monarch': [
    { id: 'dravit-grey-metallic', name: 'Dravit Grey Metallic', color: '#4b4d50', accentColor: '#93969b' },
    { id: 'brooklyn-grey-metallic', name: 'Brooklyn Grey Metallic', color: '#6b7075', accentColor: '#b9bec4' },
    { id: 'black-sapphire-metallic', name: 'Black Sapphire Metallic', color: '#0b0f14', accentColor: '#46505c' },
    { id: 'marina-bay-blue-metallic', name: 'Marina Bay Blue Metallic', color: '#245ca8', accentColor: '#72a7e3' },
  ],
  'scuderia-fury': [
    { id: 'rosso-corsa', name: 'Rosso Corsa', color: '#cc1f24', accentColor: '#ff686d' },
    { id: 'giallo-modena', name: 'Giallo Modena', color: '#f6c90e', accentColor: '#ffe98a' },
    { id: 'rosso-imola', name: 'Rosso Imola', color: '#8f171b', accentColor: '#d66367' },
    { id: 'azzurro-california', name: 'Azzurro California', color: '#1f6fae', accentColor: '#70b4e5' },
  ],
}

function normalizeCarColorSelections(raw: Record<string, unknown> = {}): Record<string, string> {
  return Object.fromEntries(
    CARS.map((car) => {
      const available = CAR_COLORS[car.id] || []
      const saved = typeof raw[car.id] === 'string' ? raw[car.id] : ''
      const fallback = available[0]?.id || ''
      const valid = available.some((option) => option.id === saved)
      return [car.id, valid ? saved : fallback]
    })
  ) as Record<string, string>
}

function getCarColorOption(carId: string, colorId?: string): CarColorOption | null {
  const available = CAR_COLORS[carId] || []
  return available.find((option) => option.id === colorId) || available[0] || null
}


export const BIKE_SKINS: Record<string, BikeSkin[]> = {
  blitz: ['drifter-blue', 'getaway-orange', 'marine', 'matte-black'],
  apex: ['aurora-green', 'charcoal-black', 'rock-matte-black', 'canyon-red'],
  chronos: ['metallic-galaxy-gray', 'pearl-vigor-blue', 'candy-daring-red', 'glass-sparkle-black'],
  stratos: ['deep-crimson', 'mirror-coated-spark-black-carbon-edition', 'custom-midnight', 'candy-flat-blazed-green'],
  zenith: ['ducati-red', 'tricolore-livery', 'racing-black', 'winter-test'],
}

export const SKIN_COLORS: Record<BikeSkin, { color: string; accentColor: string }> = {
  black: { color: '#1a1a1a', accentColor: '#333333' },
  blue: { color: '#1e40af', accentColor: '#3b82f6' },
  red: { color: '#991b1b', accentColor: '#ef4444' },
  silver: { color: '#6b7280', accentColor: '#9ca3af' },
  gold: { color: '#b8860b', accentColor: '#ffd700' },

  'drifter-blue': { color: '#1f6fc4', accentColor: '#70b6f5' },
  'getaway-orange': { color: '#e66a1f', accentColor: '#ffb15c' },
  marine: { color: '#164e63', accentColor: '#3b82a0' },
  'matte-black': { color: '#111315', accentColor: '#35383d' },

  'aurora-green': { color: '#2e7d5b', accentColor: '#75c99f' },
  'charcoal-black': { color: '#232629', accentColor: '#565c61' },
  'rock-matte-black': { color: '#17191b', accentColor: '#444a4f' },
  'canyon-red': { color: '#9e2d2d', accentColor: '#e16a62' },

  'metallic-galaxy-gray': { color: '#59616a', accentColor: '#aeb6bf' },
  'pearl-vigor-blue': { color: '#2f6fba', accentColor: '#90c3f5' },
  'candy-daring-red': { color: '#c5212a', accentColor: '#ff6c72' },
  'glass-sparkle-black': { color: '#0d1014', accentColor: '#49505a' },
  'mirror-coated-matte-spark-black': { color: '#8f1725', accentColor: '#e34b5d' },
  'rainbow-finish': { color: '#17191c', accentColor: '#39c56a' },

  'deep-crimson': { color: '#8f1725', accentColor: '#e34b5d' },
  'mirror-coated-spark-black-carbon-edition': { color: '#16191c', accentColor: '#6f767c' },
  'custom-midnight': { color: '#101a2c', accentColor: '#49627f' },
  'candy-flat-blazed-green': { color: '#17191c', accentColor: '#39c56a' },

  'ducati-red': { color: '#c9141d', accentColor: '#ff686d' },
  'tricolore-livery': { color: '#f4f4f1', accentColor: '#c81422' },
  'racing-black': { color: '#111315', accentColor: '#4a4f54' },
  'winter-test': { color: '#17191c', accentColor: '#e21a2f' },
}

export const SKIN_NAMES: Record<BikeSkin, string> = {
  black: 'Black',
  blue: 'Blue',
  red: 'Red',
  silver: 'Silver',
  gold: 'Gold',
  'drifter-blue': 'Drifter Blue',
  'getaway-orange': 'Getaway Orange',
  marine: 'Marine',
  'matte-black': 'Matte Black',
  'aurora-green': 'Aurora Green',
  'charcoal-black': 'Charcoal Black',
  'rock-matte-black': 'Rock Matte Black',
  'canyon-red': 'Canyon Red',
  'metallic-galaxy-gray': 'Metallic Galaxy Gray',
  'pearl-vigor-blue': 'Pearl Vigor Blue',
  'candy-daring-red': 'Candy Daring Red',
  'glass-sparkle-black': 'Glass Sparkle Black',
  'mirror-coated-matte-spark-black': 'Mirror Coated Matte Spark Black',
  'rainbow-finish': 'Rainbow Finish',
  'deep-crimson': 'Deep Crimson',
  'mirror-coated-spark-black-carbon-edition': 'Mirror Coated Spark Black (Carbon Edition)',
  'custom-midnight': 'Custom Midnight',
  'candy-flat-blazed-green': 'Candy Flat Blazed Green',
  'ducati-red': 'Ducati Red',
  'tricolore-livery': 'Tricolore Livery',
  'racing-black': 'Racing Black',
  'winter-test': 'Winter Test',
}

export const SKIN_SWATCHES: Record<BikeSkin, string> = {
  black: '#1a1a1a', blue: '#1e40af', red: '#991b1b', silver: '#9ca3af', gold: '#ffd700',
  'drifter-blue': '#2878c7', 'getaway-orange': '#f07a2a', marine: '#1d647d', 'matte-black': '#111315',
  'aurora-green': '#3d946f', 'charcoal-black': '#2a2d30', 'rock-matte-black': '#191b1d', 'canyon-red': '#a93434',
  'metallic-galaxy-gray': 'linear-gradient(145deg,#9aa2aa,#4c545c)',
  'pearl-vigor-blue': 'linear-gradient(145deg,#93c6f4,#2c6db5)',
  'candy-daring-red': 'linear-gradient(145deg,#ff5b64,#bd1922)',
  'glass-sparkle-black': 'linear-gradient(145deg,#5b636c,#090c10)',
  'mirror-coated-matte-spark-black': 'linear-gradient(145deg,#d95767,#64101b)',
  'rainbow-finish': 'linear-gradient(145deg,#1c2024 0%,#0d1114 58%,#35c968 59%,#8bea9f 100%)',
  'deep-crimson': 'linear-gradient(145deg,#d95767,#64101b)',
  'mirror-coated-spark-black-carbon-edition': 'linear-gradient(145deg,#59636b,#0d1013)',
  'custom-midnight': 'linear-gradient(145deg,#314b70,#0d1627)',
  'candy-flat-blazed-green': 'linear-gradient(145deg,#1c2024 0%,#0d1114 58%,#35c968 59%,#8bea9f 100%)',
  'ducati-red': '#c9141d',
  'tricolore-livery': 'linear-gradient(105deg,#15834a 0 28%,#f4f4f1 28% 66%,#d52234 66% 100%)',
  'racing-black': '#111315',
  'winter-test': 'linear-gradient(145deg,#0f1215 0 58%,#24282c 58% 78%,#d4d7d9 78% 88%,#e21a2f 88% 100%)',
}

function migrateBikeSkin(skin: unknown): BikeSkin | null {
  if (typeof skin !== 'string') return null
  if (skin === 'rainbow-finish') return 'candy-flat-blazed-green'
  if (skin === 'mirror-coated-matte-spark-black') return 'deep-crimson'
  return skin as BikeSkin
}

function normalizeBikeSkinSelections(raw: Record<string, unknown> = {}): Record<string, BikeSkin> {
  return Object.fromEntries(
    BIKES.map((bike) => {
      const available = BIKE_SKINS[bike.id] || []
      const saved = migrateBikeSkin(raw[bike.id])
      const valid = saved && available.includes(saved)
      return [bike.id, valid ? saved : available[0]]
    })
  ) as Record<string, BikeSkin>
}

function getBikeSkinOption(bikeId: string, skinId?: string): BikeSkin {
  const available = BIKE_SKINS[bikeId] || []
  const migrated = migrateBikeSkin(skinId)
  return (migrated && available.includes(migrated) ? migrated : available[0])
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
    unlockScore: 30000,
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
    unlockScore: 50000,
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
    unlockScore: 80000,
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
    unlockScore: 100000,
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

export type PowerUpType = 'magnet' | 'magnet2x' | 'multiplier2x' | 'multiplier4x' | 'shield'

export interface PlaytimeEntry {
  date: string // YYYY-MM-DD format
  seconds: number
}

export interface GameData {
  gameState: GameState
  score: number
  highScore: number
  bikeHighScore: number
  carHighScore: number
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
  carColors: Record<string, string>
  selectedCarColor: string
  totalCoins: number
  runCoins: number
  inventory: PowerUpInventory
  selectedPowerUps: Record<PowerUpType, number>
  playerLane: number
  targetLane: number
  playerX: number
  newUnlock: string | null
  newUnlockUntil: number | null
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
  nameEditsUsed: number
  totalPlaytime: number
  userPlaytime: Record<string, number>
  playtimeHistory: PlaytimeEntry[]
}

const STORAGE_KEY = 'highway-speedster-progress'

export function getPlayerId(): string {
  try {
    return localStorage.getItem('highway-speedster-player-id')?.trim() || ''
  } catch {
    return ''
  }
}

export function generatePlayerId(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    localStorage.setItem('highway-speedster-player-id', id)
  } catch {}
  return id
}

export function getDeviceId(): string {
  try {
    return localStorage.getItem('highway-speedster-device-id')?.trim() || ''
  } catch {
    return ''
  }
}

export function generateDeviceId(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    localStorage.setItem('highway-speedster-device-id', id)
  } catch {}
  return id
}

function getOrCreateDeviceId(): string {
  return getDeviceId() || generateDeviceId()
}

function loadSavedProgress(): { highScore: number; bikeHighScore: number; carHighScore: number; unlockedBikes: string[]; unlockedCars: string[]; bikeSkins: Record<string, BikeSkin>; totalCoins: number; inventory: PowerUpInventory; username: string; totalPlaytime: number; userPlaytime: Record<string, number>; playtimeHistory: PlaytimeEntry[]; vehicleMode: 'bike' | 'car'; selectedBikeId: string; selectedCarId: string; selectedSkin: BikeSkin; carColors: Record<string, string>; selectedCarColor: string } {
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
      const legacyHighScore = Number(data.highScore || 0)
      // Keep bike and car progression separate, but recover legacy/global bike scores.
      // Some saves contain a valid global highScore alongside an outdated 0 bikeHighScore.
      const storedBikeHighScore = typeof data.bikeHighScore === 'number' ? data.bikeHighScore : 0
      const bikeHighScore = Math.max(0, legacyHighScore, storedBikeHighScore)
      const carHighScore = typeof data.carHighScore === 'number' ? Math.max(0, data.carHighScore) : 0
      const highScore = Math.max(legacyHighScore, bikeHighScore, carHighScore)

      const savedUnlockedBikes = [...new Set<string>(
        (Array.isArray(data.unlockedBikes) ? data.unlockedBikes : ['blitz'])
          .map((id: unknown) => migrate(String(id)))
          .filter((id: string) => BIKES.some((bike) => bike.id === id))
      )]
      const unlockedBikes = [...new Set<string>([
        'blitz',
        ...BIKES
          .filter((bike) => bike.unlockScore <= bikeHighScore)
          .map((bike) => bike.id),
        ...savedUnlockedBikes,
      ])].slice(0, BIKES.length)

      // Every profile always owns the starter car.
      // Car progression is calculated only from the car high score.
      const unlockedCars = [...new Set<string>([
        'kanto-zip',
        ...CARS
          .filter((car) => car.unlockScore <= carHighScore)
          .map((car) => car.id),
      ])].slice(0, CARS.length)

      const selectedCarId =
        typeof data.selectedCarId === 'string' && CARS.some((car) => car.id === data.selectedCarId)
          ? data.selectedCarId
          : CARS[0].id
      const carColors = normalizeCarColorSelections(
        data.carColors && typeof data.carColors === 'object' ? data.carColors : {}
      )
      const selectedCarColor =
        typeof data.selectedCarColor === 'string' &&
        (CAR_COLORS[selectedCarId] || []).some((option) => option.id === data.selectedCarColor)
          ? data.selectedCarColor
          : carColors[selectedCarId]

      return {
        highScore,
        bikeHighScore,
        carHighScore,
        unlockedBikes,
        unlockedCars,
        bikeSkins: normalizeBikeSkinSelections(
          data.bikeSkins && typeof data.bikeSkins === 'object' ? data.bikeSkins : {}
        ),
        totalCoins: data.totalCoins || data.coins || 0,
        inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0, ...(data.inventory || {}) },
        username: data.username || '',
        nameEditsUsed: Math.max(0, Math.min(2, Number(data.nameEditsUsed || 0))),
        totalPlaytime: data.totalPlaytime || 0,
        userPlaytime: data.userPlaytime || {},
        playtimeHistory: data.playtimeHistory || [],
        vehicleMode: data.vehicleMode === 'car' ? 'car' : 'bike',
        selectedBikeId: typeof data.selectedBikeId === 'string' && BIKES.some((bike) => bike.id === migrate(data.selectedBikeId)) ? migrate(data.selectedBikeId) : BIKES[0].id,
        selectedSkin: getBikeSkinOption(
          migrate(data.selectedBikeId && typeof data.selectedBikeId === 'string' ? data.selectedBikeId : BIKES[0].id),
          migrateBikeSkin(data.selectedSkin) || undefined
        ),
        selectedCarId,
        carColors,
        selectedCarColor,
      }
    }
  } catch (e) { /* ignore */ }
  const defaultCarColors = normalizeCarColorSelections()
  const defaultBikeSkins = normalizeBikeSkinSelections()
  return { highScore: 0, nameEditsUsed: 0, bikeHighScore: 0, carHighScore: 0, unlockedBikes: ['blitz'], unlockedCars: ['kanto-zip'], bikeSkins: defaultBikeSkins, totalCoins: 0, inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 }, username: '', totalPlaytime: 0, userPlaytime: {}, playtimeHistory: [], vehicleMode: 'bike', selectedBikeId: BIKES[0].id, selectedCarId: CARS[0].id, selectedSkin: defaultBikeSkins[BIKES[0].id], carColors: defaultCarColors, selectedCarColor: defaultCarColors[CARS[0].id] }
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
      nameEditsUsed: state.nameEditsUsed,
      totalPlaytime,
      userPlaytime,
      playtimeHistory,
      vehicleMode: existing.vehicleMode === 'car' ? 'car' : 'bike',
      selectedBikeId: state.selectedBike.id,
      selectedCarId: state.selectedCar.id,
      selectedSkin: state.selectedSkin,
      carColors: state.carColors,
      selectedCarColor: state.selectedCarColor,
      bikeHighScore: state.bikeHighScore,
      carHighScore: state.carHighScore,
      unlockedCars: state.unlockedCars,
    }))
  } catch (e) { /* ignore */ }
  if (username.trim()) queueCloudSave()
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
      carColors: state.carColors,
      selectedCarColor: state.selectedCarColor,
    }))
  } catch (e) { /* ignore */ }
  if (state.username.trim()) queueCloudSave()
}

// Simple store using a listener pattern
type Listener = () => void

const savedProgress = loadSavedProgress()
const initialBike = BIKES[0]
const initialSkin = savedProgress.bikeSkins[initialBike.id] || 'black'
const initialColors = SKIN_COLORS[getBikeSkinOption(initialBike.id, initialSkin)]
const initialCar = CARS.find((car) => car.id === savedProgress.selectedCarId) || CARS[0]
const initialCarColor = getCarColorOption(initialCar.id, savedProgress.selectedCarColor)
const defaultInventory = { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 }

let state: GameData = {
  gameState: 'menu',
  score: 0,
  highScore: savedProgress.highScore,
  bikeHighScore: savedProgress.bikeHighScore,
  carHighScore: savedProgress.carHighScore,
  distance: 0,
  speed: 0,
  nearMisses: 0,
  combo: 0,
  comboTimer: 0,
  selectedBike: { ...initialBike, color: initialColors.color, accentColor: initialColors.accentColor },
  selectedCar: initialCarColor ? { ...initialCar, color: initialCarColor.color, accentColor: initialCarColor.accentColor } : initialCar,
  vehicleMode: savedProgress.vehicleMode,
  selectedSkin: initialSkin,
  carColors: savedProgress.carColors,
  selectedCarColor: savedProgress.selectedCarColor,
  unlockedBikes: savedProgress.unlockedBikes,
  unlockedCars: savedProgress.unlockedCars,
  bikeSkins: savedProgress.bikeSkins,
  totalCoins: savedProgress.totalCoins,
  runCoins: 0,
  inventory: { ...defaultInventory, ...savedProgress.inventory },
  selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
  playerLane: 0,
  targetLane: 0,
  playerX: 0,
  newUnlock: null,
  newUnlockUntil: null,
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
  nameEditsUsed: savedProgress.nameEditsUsed,
  totalPlaytime: savedProgress.totalPlaytime,
  userPlaytime: savedProgress.userPlaytime,
  playtimeHistory: savedProgress.playtimeHistory,
}

let playerId = getPlayerId()

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null
let cloudHydratingUser = ''

function buildCloudProgress(): CloudGameProgress | null {
  const current = getState()
  if (!current.username.trim()) return null

  return {
    highScore: current.highScore,
    bikeHighScore: current.bikeHighScore,
    carHighScore: current.carHighScore,
    unlockedBikes: current.unlockedBikes,
    unlockedCars: current.unlockedCars,
    bikeSkins: current.bikeSkins,
    totalCoins: current.totalCoins,
    inventory: current.inventory,
    vehicleMode: current.vehicleMode,
    selectedBikeId: current.selectedBike.id,
    selectedCarId: current.selectedCar.id,
    selectedSkin: current.selectedSkin,
    carColors: current.carColors,
    selectedCarColor: current.selectedCarColor,
    nameEditsUsed: current.nameEditsUsed,
    usernameChangeCount: current.nameEditsUsed,
    totalPlaytime: current.totalPlaytime,
    userPlaytime: current.userPlaytime,
    playtimeHistory: current.playtimeHistory,
  }
}

function saveCloudProgressNow() {
  const current = getState()
  const progress = buildCloudProgress()
  if (!playerId || !progress || !current.username.trim()) return
  void saveUserGameProgress(playerId, current.username, progress, getOrCreateDeviceId())
}

const CLOUD_ANALYTICS_SYNC_MS = 10_000

function queueCloudSave() {
  if (cloudHydratingUser || cloudSaveTimer) return

  // Throttle cloud persistence to one write per 10 seconds while still
  // persisting the latest in-memory state. This keeps Supabase analytics
  // continuously current without creating a write on every game frame.
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null
    if (!cloudHydratingUser) saveCloudProgressNow()
  }, CLOUD_ANALYTICS_SYNC_MS)
}

async function loadCloudProgress(username = state.username): Promise<boolean> {
  cloudHydratingUser = username.trim()
  const cloud = await fetchUserGameProgress(playerId)

  if (!cloud) {
    cloudHydratingUser = ''
    return false
  }

  const resolvedUsername = cloud.username.trim() || username.trim()
  const resolvedNameEditsUsed = Math.max(0, Math.min(2, Number(cloud.nameEditsUsed ?? cloud.usernameChangeCount ?? 0)))
  const current = getState()
  if (username.trim() && current.username.trim() && current.username.trim() !== username.trim()) {
    cloudHydratingUser = ''
    return false
  }

  const cloudGlobalHighScore = Number(cloud.highScore || 0)
  const cloudBikeHighScore = Number(cloud.bikeHighScore || 0)
  const cloudCarHighScore = Number(cloud.carHighScore || 0)
  const mergedBikeHighScore = Math.max(current.bikeHighScore, cloudBikeHighScore, Number.isFinite(cloudGlobalHighScore) ? cloudGlobalHighScore : 0)
  const mergedCarHighScore = Math.max(current.carHighScore, cloudCarHighScore)
  const mergedHighScore = Math.max(current.highScore, Number.isFinite(cloudGlobalHighScore) ? cloudGlobalHighScore : 0, mergedBikeHighScore, mergedCarHighScore)

  const unlockedBikes = BIKES
    .filter((bike) => bike.unlockScore <= mergedBikeHighScore)
    .map((bike) => bike.id)
    .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], ['blitz'])
  const unlockedCars = CARS
    .filter((car) => car.unlockScore <= mergedCarHighScore)
    .map((car) => car.id)
    .reduce((ids, id) => ids.includes(id) ? ids : [...ids, id], ['kanto-zip'])

  const bikeId = typeof cloud.selectedBikeId === 'string' && BIKES.some((bike) => bike.id === cloud.selectedBikeId) ? cloud.selectedBikeId : current.selectedBike.id
  const carId = typeof cloud.selectedCarId === 'string' && CARS.some((car) => car.id === cloud.selectedCarId) ? cloud.selectedCarId : current.selectedCar.id
  const carColors = normalizeCarColorSelections({ ...current.carColors, ...((cloud.carColors || {}) as Record<string, unknown>) })
  const selectedCarColor = typeof cloud.selectedCarColor === 'string' && (CAR_COLORS[carId] || []).some((option) => option.id === cloud.selectedCarColor) ? cloud.selectedCarColor : carColors[carId]
  const carColor = getCarColorOption(carId, selectedCarColor)
  const bikeSkin = getBikeSkinOption(
    bikeId,
    migrateBikeSkin(cloud.selectedSkin) || migrateBikeSkin(cloud.bikeSkins?.[bikeId]) || migrateBikeSkin(current.bikeSkins[bikeId]) || undefined
  )
  const bike = BIKES.find((item) => item.id === bikeId) || BIKES[0]
  const colors = SKIN_COLORS[bikeSkin]

  const mergedTotalCoins = Math.max(current.totalCoins, Number(cloud.totalCoins || 0))
  const mergedTotalPlaytime = Math.max(current.totalPlaytime, Number(cloud.totalPlaytime || 0))
  const mergedUserPlaytime = { ...current.userPlaytime, ...(cloud.userPlaytime || {}) }
  const mergedHistory = cloud.playtimeHistory?.length ? cloud.playtimeHistory : current.playtimeHistory

  setState({
    highScore: mergedHighScore,
    bikeHighScore: mergedBikeHighScore,
    carHighScore: mergedCarHighScore,
    unlockedBikes,
    unlockedCars,
    bikeSkins: { ...current.bikeSkins, ...(cloud.bikeSkins || {}) },
    totalCoins: mergedTotalCoins,
    inventory: { ...current.inventory, ...(cloud.inventory || {}) },
    selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
    selectedCar: carColor ? { ...(CARS.find((item) => item.id === carId) || current.selectedCar), color: carColor.color, accentColor: carColor.accentColor } : CARS.find((item) => item.id === carId) || current.selectedCar,
    selectedSkin: bikeSkin,
    carColors,
    selectedCarColor,
    vehicleMode: cloud.vehicleMode === 'car' ? 'car' : current.vehicleMode,
    username: resolvedUsername,
    nameEditsUsed: resolvedNameEditsUsed,
    totalPlaytime: mergedTotalPlaytime,
    userPlaytime: mergedUserPlaytime,
    playtimeHistory: mergedHistory,
  })

  saveProgress(
    mergedHighScore,
    unlockedBikes,
    { ...current.bikeSkins, ...(cloud.bikeSkins || {}) },
    mergedTotalCoins,
    { ...current.inventory, ...(cloud.inventory || {}) },
    resolvedUsername,
    mergedTotalPlaytime,
    mergedUserPlaytime,
    mergedHistory
  )

  cloudHydratingUser = ''
  return true
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
export function setPlayerId(id: string) {
  const trimmed = id.trim()
  if (!trimmed) return
  playerId = trimmed
  try { localStorage.setItem('highway-speedster-player-id', trimmed) } catch {}
}

export function getCurrentPlayerId(): string {
  return playerId
}

export const actions = {
  async ensureCurrentDeviceConnected() {
    if (!playerId) return { ok: false as const, reason: 'Account is not ready.' }
    const result = await registerGameDevice(playerId, getOrCreateDeviceId())
    if (!result.success) {
      return { ok: false as const, reason: result.reason || 'This account cannot be connected on this device.' }
    }
    return { ok: true as const, deviceCount: result.deviceCount }
  },

  async logoutAccount() {
    if (!playerId) return { ok: true as const }
    const accountId = playerId
    const deviceId = getOrCreateDeviceId()

    if (cloudSaveTimer) {
      clearTimeout(cloudSaveTimer)
      cloudSaveTimer = null
    }
    cloudHydratingUser = ''
    pendingAnalyticsSeconds = 0

    const result = await logoutGameAccount(accountId, deviceId)
    if (!result.success) {
      return { ok: false as const, reason: result.reason || 'Unable to log out right now.' }
    }

    playerId = ''
    try {
      localStorage.removeItem('highway-speedster-player-id')
      localStorage.removeItem(STORAGE_KEY)
    } catch {}

    const defaultCarColors = normalizeCarColorSelections()
    const defaultBikeSkins = normalizeBikeSkinSelections()
    const bike = BIKES[0]
    const skin = defaultBikeSkins[bike.id] || BIKE_SKINS[bike.id][0]
    const colors = SKIN_COLORS[skin]
    const car = CARS[0]
    const carColor = getCarColorOption(car.id, defaultCarColors[car.id])

    setState({
      highScore: 0,
      bikeHighScore: 0,
      carHighScore: 0,
      unlockedBikes: ['blitz'],
      unlockedCars: ['kanto-zip'],
      bikeSkins: defaultBikeSkins,
      totalCoins: 0,
      inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      vehicleMode: 'bike',
      selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
      selectedCar: carColor ? { ...car, color: carColor.color, accentColor: carColor.accentColor } : car,
      selectedSkin: skin,
      carColors: defaultCarColors,
      selectedCarColor: defaultCarColors[car.id],
      username: '',
      nameEditsUsed: 0,
      totalPlaytime: 0,
      userPlaytime: {},
      playtimeHistory: [],
      score: 0,
      distance: 0,
      speed: 0,
      nearMisses: 0,
      combo: 0,
      comboTimer: 0,
      runCoins: 0,
      selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      playerLane: 0,
      targetLane: 0,
      playerX: 0,
      newUnlock: null,
      newUnlockUntil: null,
      magnetActive: false,
      magnetTimer: 0,
      magnet2xActive: false,
      magnet2xTimer: 0,
      multiplierActive: false,
      multiplierTimer: 0,
      multiplier4x: false,
      shieldActive: false,
      shieldCount: 0,
      gameState: 'menu',
    })

    return { ok: true as const, deviceCount: result.deviceCount }
  },
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
          recordPlaytimeEvent(playerId, state.username, remainingSeconds)
        }
        syncAnalyticsToSupabase(
          playerId,
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
    const isCar = state.vehicleMode === 'car'
    const bikeHighScore = isCar ? state.bikeHighScore : Math.max(state.bikeHighScore, newScore)
    const carHighScore = isCar ? Math.max(state.carHighScore, newScore) : state.carHighScore
    const newHighScore = Math.max(bikeHighScore, carHighScore)

    // Vehicle progression is independent:
    // bike runs can unlock bikes; car runs can unlock cars.
    const newlyUnlockedBikes = isCar
      ? []
      : BIKES.filter(
          (bike) => newScore >= bike.unlockScore && !state.unlockedBikes.includes(bike.id)
        )

    const newlyUnlockedCars = isCar
      ? CARS.filter(
          (car) => newScore >= car.unlockScore && !state.unlockedCars.includes(car.id)
        )
      : []

    const newUnlockedBikes = newlyUnlockedBikes.length > 0
      ? [...state.unlockedBikes, ...newlyUnlockedBikes.map((bike) => bike.id)]
      : state.unlockedBikes

    const newUnlockedCars = newlyUnlockedCars.length > 0
      ? [...state.unlockedCars, ...newlyUnlockedCars.map((car) => car.id)]
      : state.unlockedCars

    setState({
      score: newScore,
      highScore: newHighScore,
      bikeHighScore,
      carHighScore,
      unlockedBikes: newUnlockedBikes,
      unlockedCars: newUnlockedCars,
      newUnlock: isCar
        ? (newlyUnlockedCars[0]?.name ?? null)
        : (newlyUnlockedBikes[0]?.name ?? null),
      newUnlockUntil: (newlyUnlockedBikes.length > 0 || newlyUnlockedCars.length > 0)
        ? Date.now() + 4000
        : state.newUnlockUntil,
    })

    if (
      newHighScore !== state.highScore ||
      bikeHighScore !== state.bikeHighScore ||
      carHighScore !== state.carHighScore ||
      newlyUnlockedBikes.length > 0 ||
      newlyUnlockedCars.length > 0
    ) {
      saveProgress(
        newHighScore,
        newUnlockedBikes,
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
    actions.addScore(bonus)
    setState({
      nearMisses: state.nearMisses + 1,
      combo: newCombo,
      comboTimer: 2.0,
    })
  },

  resetCombo() { setState({ combo: 0, comboTimer: 0 }) },

  setTargetLane(lane: number) {
    setState({ targetLane: Math.max(-1, Math.min(1, lane)) })
  },

  setPlayerX(x: number) { setState({ playerX: x }) },

  selectBike(bike: Bike) {
    const skin = getBikeSkinOption(bike.id, state.bikeSkins[bike.id])
    const colors = SKIN_COLORS[skin]
    setState({ 
      selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
      selectedSkin: skin,
      vehicleMode: 'bike',
    })
    saveVehicleSelection('bike', bike.id)
  },

  selectCar(car: Car) {
    // The starter car is always selectable; later cars require car-specific progress.
    const isStarterCar = car.id === CARS[0].id
    if (!isStarterCar && !state.unlockedCars.includes(car.id)) return

    const unlockedCars = state.unlockedCars.includes(car.id)
      ? state.unlockedCars
      : [...state.unlockedCars, car.id]

    const selectedColorId = state.carColors[car.id] || getCarColorOption(car.id)?.id || ''
    const color = getCarColorOption(car.id, selectedColorId)

    setState({
      selectedCar: color ? { ...car, color: color.color, accentColor: color.accentColor } : car,
      selectedCarColor: selectedColorId,
      vehicleMode: 'car',
      unlockedCars,
    })
    saveVehicleSelection('car', car.id)
  },

  selectCarColor(carId: string, colorId: string) {
    const car = CARS.find((item) => item.id === carId)
    const color = getCarColorOption(carId, colorId)
    if (!car || !color) return
    if (car.id !== CARS[0].id && !state.unlockedCars.includes(car.id)) return

    const carColors = { ...state.carColors, [carId]: color.id }
    const updates: Partial<GameData> = { carColors }

    if (state.selectedCar.id === carId) {
      updates.selectedCar = { ...state.selectedCar, color: color.color, accentColor: color.accentColor }
      updates.selectedCarColor = color.id
    }

    setState(updates)
    saveProgress(
      state.highScore,
      state.unlockedBikes,
      state.bikeSkins,
      state.totalCoins,
      state.inventory,
      state.username,
      state.totalPlaytime,
      state.userPlaytime,
      state.playtimeHistory
    )
  },

  selectSkin(bikeId: string, skin: BikeSkin) {
    if (!(BIKE_SKINS[bikeId] || []).includes(skin)) return
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

  setPowerUpQuantity(powerUp: PowerUpType, quantity: number) {
    const owned = Math.max(0, Math.floor(state.inventory[powerUp]))
    const requested = Math.max(0, Math.min(owned, Math.floor(quantity)))

    // There is no per-run quantity cap. The player's inventory is the only limit.
    // Alternate versions of the same effect remain mutually exclusive.
    const nextSelection = { ...state.selectedPowerUps }

    if (requested === 0) {
      nextSelection[powerUp] = 0
    } else {
      const isMagnetVariant = powerUp === 'magnet' || powerUp === 'magnet2x'
      const isMultiplierVariant = powerUp === 'multiplier2x' || powerUp === 'multiplier4x'

      if (isMagnetVariant) {
        nextSelection.magnet = 0
        nextSelection.magnet2x = 0
      }
      if (isMultiplierVariant) {
        nextSelection.multiplier2x = 0
        nextSelection.multiplier4x = 0
      }

      nextSelection[powerUp] = requested
    }

    setState({ selectedPowerUps: nextSelection })
  },

  useSelectedPowerUps() {
    const selectedPowerUps = (Object.keys(state.selectedPowerUps) as PowerUpType[]).filter(
      (powerUp) => state.selectedPowerUps[powerUp] > 0 && state.inventory[powerUp] > 0
    )

    if (selectedPowerUps.length === 0) {
      setState({ selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 } })
      return
    }

    const newInventory = { ...state.inventory }
    const updates: Partial<GameData> = {}

    selectedPowerUps.forEach((powerUp) => {
      const quantity = Math.min(
        Math.max(0, Math.floor(state.selectedPowerUps[powerUp])),
        Math.max(0, Math.floor(state.inventory[powerUp]))
      )
      if (quantity <= 0) return

      newInventory[powerUp] -= quantity

      if (powerUp === 'magnet') {
        updates.magnetActive = true
        updates.magnetTimer = 10 * quantity
      } else if (powerUp === 'magnet2x') {
        updates.magnet2xActive = true
        updates.magnet2xTimer = 10 * quantity
      } else if (powerUp === 'multiplier2x') {
        updates.multiplierActive = true
        updates.multiplierTimer = 10 * quantity
        updates.multiplier4x = false
      } else if (powerUp === 'multiplier4x') {
        updates.multiplierActive = true
        updates.multiplierTimer = 10 * quantity
        updates.multiplier4x = true
      } else if (powerUp === 'shield') {
        updates.shieldActive = true
        updates.shieldCount = 2 * quantity
      }
    })

    setState({
      ...updates,
      inventory: newInventory,
      selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
    })

    saveProgress(
      state.highScore,
      state.unlockedBikes,
      state.bikeSkins,
      state.totalCoins,
      newInventory,
      state.username,
      state.totalPlaytime,
      state.userPlaytime,
      state.playtimeHistory
    )
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
      selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
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

  clearNewUnlock() { setState({ newUnlock: null, newUnlockUntil: null }) },

  restoreCloudProgress(username = state.username) {
    const trimmed = username.trim()
    if (!trimmed) return Promise.resolve()
    return loadCloudProgress(trimmed).then(() => undefined)
  },

  startNewAccount() {
    const id = generatePlayerId()
    const defaultCarColors = normalizeCarColorSelections()
    const defaultBikeSkins = normalizeBikeSkinSelections()
    const bike = BIKES[0]
    const skin = defaultBikeSkins[bike.id] || BIKE_SKINS[bike.id][0]
    const colors = SKIN_COLORS[skin]
    const car = CARS[0]
    const carColor = getCarColorOption(car.id, defaultCarColors[car.id])

    setState({
      highScore: 0,
      bikeHighScore: 0,
      carHighScore: 0,
      unlockedBikes: ['blitz'],
      unlockedCars: ['kanto-zip'],
      bikeSkins: defaultBikeSkins,
      totalCoins: 0,
      inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      vehicleMode: 'bike',
      selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
      selectedCar: carColor ? { ...car, color: carColor.color, accentColor: carColor.accentColor } : car,
      selectedSkin: skin,
      carColors: defaultCarColors,
      selectedCarColor: defaultCarColors[car.id],
      username: '',
      nameEditsUsed: 0,
      totalPlaytime: 0,
      userPlaytime: {},
      playtimeHistory: [],
      score: 0,
      distance: 0,
      speed: 0,
      nearMisses: 0,
      combo: 0,
      comboTimer: 0,
      runCoins: 0,
      selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      playerLane: 0,
      targetLane: 0,
      playerX: 0,
      newUnlock: null,
      newUnlockUntil: null,
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
    try {
      localStorage.setItem('highway-speedster-progress', JSON.stringify({
        highScore: 0,
        bikeHighScore: 0,
        carHighScore: 0,
        unlockedBikes: ['blitz'],
        unlockedCars: ['kanto-zip'],
        bikeSkins: defaultBikeSkins,
        totalCoins: 0,
        inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
        username: '',
        totalPlaytime: 0,
        userPlaytime: {},
        playtimeHistory: [],
        vehicleMode: 'bike',
        selectedBikeId: bike.id,
        selectedCarId: car.id,
        selectedSkin: skin,
        carColors: defaultCarColors,
        selectedCarColor: defaultCarColors[car.id],
      }))
    } catch {}
    return id
  },

  async connectAccount(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return { ok: false as const, reason: 'Enter an account ID.' }

    const previousId = playerId
    const previous = { ...getState() }
    setPlayerId(trimmed)

    // Never merge another local profile into the account being connected.
    // Start from a clean profile, then hydrate exactly what belongs to this ID.
    const defaultCarColors = normalizeCarColorSelections()
    const defaultBikeSkins = normalizeBikeSkinSelections()
    const bike = BIKES[0]
    const skin = defaultBikeSkins[bike.id] || BIKE_SKINS[bike.id][0]
    const colors = SKIN_COLORS[skin]
    const car = CARS[0]
    const carColor = getCarColorOption(car.id, defaultCarColors[car.id])
    setState({
      highScore: 0, bikeHighScore: 0, carHighScore: 0,
      unlockedBikes: ['blitz'], unlockedCars: ['kanto-zip'],
      bikeSkins: defaultBikeSkins, totalCoins: 0,
      inventory: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      vehicleMode: 'bike',
      selectedBike: { ...bike, color: colors.color, accentColor: colors.accentColor },
      selectedCar: carColor ? { ...car, color: carColor.color, accentColor: carColor.accentColor } : car,
      selectedSkin: skin, carColors: defaultCarColors, selectedCarColor: defaultCarColors[car.id],
      username: '', totalPlaytime: 0, userPlaytime: {}, playtimeHistory: [],
      score: 0, distance: 0, speed: 0, nearMisses: 0, combo: 0, comboTimer: 0, runCoins: 0,
      selectedPowerUps: { magnet: 0, magnet2x: 0, multiplier2x: 0, multiplier4x: 0, shield: 0 },
      playerLane: 0, targetLane: 0, playerX: 0, newUnlock: null, newUnlockUntil: null,
      magnetActive: false, magnetTimer: 0, magnet2xActive: false, magnet2xTimer: 0,
      multiplierActive: false, multiplierTimer: 0, multiplier4x: false, shieldActive: false, shieldCount: 0,
    })

    const connected = await loadCloudProgress()
    if (!connected || !getState().username.trim()) {
      setPlayerId(previousId)
      setState(previous)
      if (!previousId) {
        try { localStorage.removeItem('highway-speedster-player-id') } catch {}
      }
      return { ok: false as const, reason: 'Account not found. Check the account ID and try again.' }
    }

    return { ok: true as const, username: getState().username }
  },

  syncSharedHighScore() {
    const username = state.username.trim()
    if (!username) return

    fetchUserHighScore(playerId).then((serverHighScore) => {
      if (serverHighScore === null) return
      const current = getState()

      // Shared analytics stores only the global high score, so it cannot determine
      // whether that score came from a bike or a car. Never use it for unlocks.
      if (current.username.trim() !== username) return

      const mergedHighScore = Math.max(current.highScore, serverHighScore)
      if (mergedHighScore > current.highScore) {
        setState({ highScore: mergedHighScore })
        saveProgress(
          mergedHighScore,
          current.unlockedBikes,
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
    const trimmed = username.trim()
    if (!trimmed || !playerId) return
    setState({ username: trimmed })
    saveProgress(state.highScore, state.unlockedBikes, state.bikeSkins, state.totalCoins, state.inventory, trimmed, state.totalPlaytime, state.userPlaytime, state.playtimeHistory)
    void loadCloudProgress(trimmed).then(() => actions.syncSharedHighScore())
  },

  async editDisplayName(newUsername: string) {
    const trimmed = newUsername.trim()
    if (!playerId || !state.username.trim()) return { ok: false as const, reason: 'Account is not ready.' }
    if (!trimmed || trimmed.length > 40) return { ok: false as const, reason: 'Name must be between 1 and 40 characters.' }
    if (trimmed === state.username.trim()) return { ok: true as const, remaining: Math.max(0, 2 - state.nameEditsUsed) }
    if (state.nameEditsUsed >= 2) return { ok: false as const, reason: 'You have used both username changes.' }

    const result = await changeGameUsername(playerId, trimmed)
    if (!result.success) return { ok: false as const, reason: result.message || 'Unable to change username.' }

    setState({
      username: result.username,
      nameEditsUsed: Math.max(0, Math.min(2, 2 - result.remainingChanges)),
    })
    const current = getState()
    saveProgress(current.highScore, current.unlockedBikes, current.bikeSkins, current.totalCoins, current.inventory, current.username, current.totalPlaytime, current.userPlaytime, current.playtimeHistory)
    return { ok: true as const, remaining: result.remainingChanges }
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
    
    // Record real historical playtime in 10-second batches so the
    // rolling analytics windows update at the same cadence as the profile.
    if (state.username) {
      pendingAnalyticsSeconds += seconds
      if (pendingAnalyticsSeconds >= 10) {
        const eventSeconds = pendingAnalyticsSeconds
        pendingAnalyticsSeconds = 0
        recordPlaytimeEvent(playerId, state.username, eventSeconds)
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
