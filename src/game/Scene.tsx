import { useRef, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getState, actions, useGameStore, type Bike, type Car } from './store'

// Constants
const LANE_WIDTH = 3.5
const ROAD_WIDTH = 14
const SEGMENT_LENGTH = 20
const NUM_SEGMENTS = 30
const VISIBLE_DISTANCE = 400
const PLAYER_Z = 5

// [GFX] Mobile vehicle rendering budgets: player bike <=8k triangles,
// traffic vehicle <=4k triangles, vehicle set <=120 draw calls.
// The visual additions below stay far below these per-vehicle geometry limits.
const PLAYER_BIKE_TRIANGLE_BUDGET = 8000
const TRAFFIC_VEHICLE_TRIANGLE_BUDGET = 4000
const VEHICLE_DRAW_CALL_BUDGET = 120

// Bike-specific spawn configurations
const getSpawnConfig = (vehicleId: string) => {
  switch (vehicleId) {
    // Bikes
    case 'blitz':
    case 'apex':
      return { baseDistance: 25, reductionRate: 3.5 }
    case 'chronos':
      return { baseDistance: 50, reductionRate: 2 }
    case 'stratos':
      return { baseDistance: 60, reductionRate: 2.5 }
    case 'zenith':
      return { baseDistance: 70, reductionRate: 2.5 }

    // Cars
    case 'kanto-zip':
      return { baseDistance: 25, reductionRate: 3.5 }
    case 'saber-swift':
      return { baseDistance: 55, reductionRate: 2 }
    case 'goliath-titan':
      return { baseDistance: 53, reductionRate: 2.5 }
    case 'kaiser-monarch':
      return { baseDistance: 73, reductionRate: 2.5 }
    case 'scuderia-fury':
      return { baseDistance: 100, reductionRate: 3 }
    default:
      return { baseDistance: 40, reductionRate: 3 }
  }
}

// Traffic vehicle types
interface TrafficVehicle {
  id: number
  lane: number
  z: number
  speed: number
  type: 'car' | 'truck' | 'auto' | 'bus' | 'bike' | 'scooter'
  color: string
  passed: boolean
}

// Power-up types
interface PowerUp {
  id: number
  lane: number
  z: number
  type: 'magnet' | 'multiplier' | 'shield'
  collected: boolean
}

// ============== HIGHWAY ==============
// [GFX] Visual-only graphics master switch. Gameplay systems never read this flag.
const GFX_UPGRADE_ENABLED = true

// [GFX] Procedural, seam-safe asphalt generated once at startup.
function createRoadTextures(anisotropy: number) {
  const width = 256
  const height = 512

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = width
  colorCanvas.height = height
  const colorCtx = colorCanvas.getContext('2d')
  if (!colorCtx) throw new Error('Unable to create road color texture')

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = width
  roughCanvas.height = height
  const roughCtx = roughCanvas.getContext('2d')
  if (!roughCtx) throw new Error('Unable to create road roughness texture')

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = width
  bumpCanvas.height = height
  const bumpCtx = bumpCanvas.getContext('2d')
  if (!bumpCtx) throw new Error('Unable to create road bump texture')

  const colorData = colorCtx.createImageData(width, height)
  const roughData = roughCtx.createImageData(width, height)
  const bumpData = bumpCtx.createImageData(width, height)

  const hash = (n: number) => {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
  }

  const gauss = (x: number, center: number, radius: number) => {
    const d = (x - center) / radius
    return Math.exp(-d * d)
  }

  const patchSeeds = Array.from({ length: 8 }, (_, i) => ({
    x: 0.08 + hash(i * 7 + 1) * 0.84,
    y: 0.1 + hash(i * 7 + 2) * 0.8,
    size: 0.06 + hash(i * 7 + 3) * 0.14,
    strength: 2.5 + hash(i * 7 + 4) * 4.5,
  }))

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1)
    const seamFade = 0.5 - 0.5 * Math.cos(v * Math.PI * 2)

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1)

      // Periodic base pattern: texture borders meet cleanly when recycled.
      const periodic =
        Math.sin(u * Math.PI * 14) * 2.2 +
        Math.sin(v * Math.PI * 18) * 1.9 +
        Math.sin((u + v) * Math.PI * 9) * 1.3 +
        Math.cos((u - v) * Math.PI * 13) * 1.1

      // Deliberate, low-frequency tire wear rather than high-frequency noise.
      const tireWear =
        gauss(u, 0.29, 0.07) * 2.1 +
        gauss(u, 0.71, 0.07) * 2.1 +
        gauss(u, 0.50, 0.10) * 0.8

      let patches = 0
      for (const patch of patchSeeds) {
        const dx = u - patch.x
        const dy = v - patch.y
        const d = Math.sqrt(dx * dx + dy * dy)
        patches += Math.max(0, 1 - d / patch.size) * patch.strength * seamFade
      }

      const value = Math.max(31, Math.min(86, Math.round(56 + periodic - tireWear + patches)))
      const index = (y * width + x) * 4

      colorData.data[index] = value
      colorData.data[index + 1] = Math.min(92, value + 2)
      colorData.data[index + 2] = Math.min(96, value + 5)
      colorData.data[index + 3] = 255

      const roughnessValue = Math.max(
        170,
        Math.min(245, Math.round(224 - periodic * 2.8 + tireWear * 3 - patches * 1.5))
      )
      roughData.data[index] = roughnessValue
      roughData.data[index + 1] = roughnessValue
      roughData.data[index + 2] = roughnessValue
      roughData.data[index + 3] = 255

      const bumpValue = Math.max(
        96,
        Math.min(170, Math.round(132 + periodic * 4 - tireWear * 2 + patches))
      )
      bumpData.data[index] = bumpValue
      bumpData.data[index + 1] = bumpValue
      bumpData.data[index + 2] = bumpValue
      bumpData.data[index + 3] = 255
    }
  }

  colorCtx.putImageData(colorData, 0, 0)
  roughCtx.putImageData(roughData, 0, 0)
  bumpCtx.putImageData(bumpData, 0, 0)

  // Sparse, deliberately faint cracks positioned away from tile boundaries.
  colorCtx.save()
  colorCtx.strokeStyle = 'rgba(180, 184, 188, 0.085)'
  colorCtx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const y = 72 + hash(i + 40) * (height - 144)
    const x = 24 + hash(i + 70) * (width - 48)
    colorCtx.beginPath()
    colorCtx.moveTo(x, y)
    colorCtx.lineTo(
      x + 22 + hash(i + 90) * 46,
      y + 4 + hash(i + 100) * 12
    )
    colorCtx.stroke()
  }
  colorCtx.restore()

  const configure = (texture: THREE.CanvasTexture, sRGB = false) => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = anisotropy
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    if (sRGB) texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas)
  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  const bumpMap = new THREE.CanvasTexture(bumpCanvas)

  configure(colorMap, true)
  configure(roughnessMap)
  configure(bumpMap)

  return { colorMap, roughnessMap, bumpMap }
}

function Highway() {
  const segmentsRef = useRef<THREE.Group>(null)
  const offsetRef = useRef(0)
  const textureScrollRef = useRef(0)
  const { gl } = useThree()

  const roadTextures = useMemo(
    () => createRoadTextures(Math.min(8, gl.capabilities.getMaxAnisotropy())),
    [gl]
  )

  useEffect(() => {
    return () => {
      roadTextures.colorMap.dispose()
      roadTextures.roughnessMap.dispose()
      roadTextures.bumpMap.dispose()
    }
  }, [roadTextures])

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing') return

    const speed = state.speed
    offsetRef.current += speed * delta * 0.5

    if (GFX_UPGRADE_ENABLED) {
      // [GFX] Read-only use of the existing speed value.
      textureScrollRef.current = (textureScrollRef.current + speed * delta * 0.0018) % 1
      roadTextures.colorMap.offset.y = textureScrollRef.current
      roadTextures.roughnessMap.offset.y = textureScrollRef.current * 0.94
      roadTextures.bumpMap.offset.y = textureScrollRef.current * 0.96
    }

    if (segmentsRef.current) {
      segmentsRef.current.position.z = (offsetRef.current % SEGMENT_LENGTH)
    }
  })

  const segments = useMemo(() => {
    const segs = []
    for (let i = -5; i < NUM_SEGMENTS; i++) {
      segs.push(i * SEGMENT_LENGTH)
    }
    return segs
  }, [])

  return (
    <group ref={segmentsRef}>
      {segments.map((z, i) => {
        const zone = 0.5 + 0.5 * Math.sin((i * SEGMENT_LENGTH) / 135)
        const roadTint = new THREE.Color('#2f3437').lerp(
          new THREE.Color('#343b38'),
          zone * 0.32
        )

        return (
          <group key={i} position={[0, 0, z]}>
            {/* [GFX] Road geometry dimensions are intentionally unchanged. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
              <planeGeometry args={[ROAD_WIDTH, SEGMENT_LENGTH]} />
              {GFX_UPGRADE_ENABLED ? (
                <meshStandardMaterial
                  map={roadTextures.colorMap}
                  roughnessMap={roadTextures.roughnessMap}
                  bumpMap={roadTextures.bumpMap}
                  bumpScale={0.035}
                  color={roadTint}
                  metalness={0.09}
                  roughness={0.76}
                />
              ) : (
                <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
              )}
            </mesh>

            {/* [GFX] Narrow asphalt shoulder transition. */}
            {[-1, 1].map((side) => (
              <mesh
                key={`asphalt-shoulder-${side}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[side * (ROAD_WIDTH / 2 + 0.38), -0.006, 0]}
              >
                <planeGeometry args={[0.76, SEGMENT_LENGTH]} />
                <meshStandardMaterial
                  color={zone > 0.55 ? '#4d5052' : '#494c4f'}
                  roughness={0.88}
                  metalness={0.02}
                />
              </mesh>
            ))}

            {/* [GFX] Crisp edge paint. */}
            {[-ROAD_WIDTH / 2 + 0.3, ROAD_WIDTH / 2 - 0.3].map((x, li) => (
              <mesh
                key={`edge-${li}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[x, 0.014, 0]}
                renderOrder={2}
              >
                <planeGeometry args={[0.18, SEGMENT_LENGTH]} />
                <meshStandardMaterial
                  color="#e6e8e9"
                  roughness={0.48}
                  metalness={0.02}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            ))}

            {/* [GFX] Lane markings. */}
            {[-LANE_WIDTH, 0, LANE_WIDTH].map((x, li) => (
              <group key={`dash-${li}`}>
                {Array.from({ length: 5 }, (_, di) => (
                  <mesh
                    key={di}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[
                      x,
                      0.016,
                      -SEGMENT_LENGTH / 2 + di * (SEGMENT_LENGTH / 5) + SEGMENT_LENGTH / 10,
                    ]}
                    renderOrder={2}
                  >
                    <planeGeometry args={[0.12, SEGMENT_LENGTH / 7]} />
                    <meshStandardMaterial
                      color="#e2bb32"
                      roughness={0.4}
                      metalness={0.02}
                      polygonOffset
                      polygonOffsetFactor={-2}
                      polygonOffsetUnits={-2}
                    />
                  </mesh>
                ))}
              </group>
            ))}

            {/* [GFX] Restrained rumble strips outside the gameplay lanes. */}
            {[-1, 1].map((side) => (
              <group key={`rumble-${side}`}>
                {Array.from({ length: 10 }, (_, ri) => (
                  <mesh
                    key={ri}
                    rotation={[-Math.PI / 2, 0, side * 0.05]}
                    position={[
                      side * (ROAD_WIDTH / 2 + 0.78),
                      0.006,
                      -SEGMENT_LENGTH / 2 + ri * 2 + 1,
                    ]}
                  >
                    <planeGeometry args={[0.16, 0.9]} />
                    <meshStandardMaterial
                      color="#777473"
                      roughness={0.85}
                      metalness={0.01}
                    />
                  </mesh>
                ))}
              </group>
            ))}

            {/* [GFX] Gravel/dirt border. */}
            {[-ROAD_WIDTH / 2 - 1, ROAD_WIDTH / 2 + 1].map((x, si) => (
              <mesh
                key={`shoulder-${si}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[x, -0.005, 0]}
              >
                <planeGeometry args={[2, SEGMENT_LENGTH]} />
                <meshStandardMaterial
                  color={zone > 0.55 ? '#5b5650' : '#615a52'}
                  roughness={1}
                />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* [GFX] Reusable roadside environment follows the existing segment
          recycling transform and is fully visual-only. */}
      {GFX_UPGRADE_ENABLED && <RoadsideVisualInstances segmentOffsets={segments} />}
    </group>
  )
}

// [GFX] Lightweight vehicle lighting: additive billboard glows and restrained
// specular/rim accents. No gameplay transform, collision, or input dependency.
let headGlowTexture: THREE.CanvasTexture | null = null
let tailGlowTexture: THREE.CanvasTexture | null = null

function getGlowTexture(kind: 'head' | 'tail') {
  const cached = kind === 'head' ? headGlowTexture : tailGlowTexture
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create glow texture')

  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  if (kind === 'head') {
    gradient.addColorStop(0, 'rgba(255,255,240,0.98)')
    gradient.addColorStop(0.22, 'rgba(255,248,205,0.72)')
    gradient.addColorStop(0.58, 'rgba(255,235,145,0.22)')
    gradient.addColorStop(1, 'rgba(255,224,120,0)')
  } else {
    gradient.addColorStop(0, 'rgba(255,80,72,0.98)')
    gradient.addColorStop(0.22, 'rgba(255,50,45,0.68)')
    gradient.addColorStop(0.58, 'rgba(255,25,25,0.18)')
    gradient.addColorStop(1, 'rgba(255,0,0,0)')
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true

  if (kind === 'head') headGlowTexture = texture
  else tailGlowTexture = texture
  return texture
}

function VehicleLightingAccents({ vehicleMode }: { vehicleMode: 'bike' | 'car' }) {
  const isCar = vehicleMode === 'car'
  const frontZ = isCar ? -1.65 : -1.05
  const rearZ = isCar ? 1.75 : 1.08
  const y = isCar ? 0.58 : 0.64
  const spread = isCar ? 0.52 : 0.32
  const highlightX = isCar ? 0.72 : 0.5
  const highlightLength = isCar ? 2.6 : 1.65

  const headMaterial = useMemo(
    () => new THREE.SpriteMaterial({
      map: getGlowTexture('head'),
      color: '#fff8d6',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )
  const tailMaterial = useMemo(
    () => new THREE.SpriteMaterial({
      map: getGlowTexture('tail'),
      color: '#ff433d',
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  useEffect(() => {
    return () => {
      headMaterial.dispose()
      tailMaterial.dispose()
    }
  }, [headMaterial, tailMaterial])

  return (
    <group>
      <sprite position={[-spread, y, frontZ]} scale={[0.42, 0.42, 1]} material={headMaterial} />
      <sprite position={[spread, y, frontZ]} scale={[0.42, 0.42, 1]} material={headMaterial} />
      <sprite position={[-spread, y * 0.9, rearZ]} scale={[0.32, 0.32, 1]} material={tailMaterial} />
      <sprite position={[spread, y * 0.9, rearZ]} scale={[0.32, 0.32, 1]} material={tailMaterial} />

      {/* [GFX] Thin highlight rails read as specular accents without adding lights. */}
      <mesh position={[-highlightX, isCar ? 0.55 : 0.52, 0]}>
        <boxGeometry args={[0.035, 0.06, highlightLength]} />
        <meshStandardMaterial
          color="#eef1f1"
          metalness={0.9}
          roughness={0.16}
          transparent
          opacity={0.42}
        />
      </mesh>
      <mesh position={[highlightX, isCar ? 0.55 : 0.52, 0]}>
        <boxGeometry args={[0.035, 0.06, highlightLength]} />
        <meshStandardMaterial
          color="#eef1f1"
          metalness={0.9}
          roughness={0.16}
          transparent
          opacity={0.42}
        />
      </mesh>
    </group>
  )
}

function LightingRig() {
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const targetRef = useRef<THREE.Object3D>(null)

  useEffect(() => {
    if (keyRef.current && targetRef.current) {
      keyRef.current.target = targetRef.current
    }
  }, [])

  useFrame(() => {
    const state = getState()
    const playerX = state.playerX

    if (keyRef.current && targetRef.current) {
      keyRef.current.position.set(playerX + 18, 28, PLAYER_Z + 18)
      targetRef.current.position.set(playerX, 0, PLAYER_Z - 9)
      targetRef.current.updateMatrixWorld()
    }
  })

  return (
    <group>
      <hemisphereLight
        color="#b9d9ec"
        groundColor="#53664a"
        intensity={0.72}
      />
      <ambientLight intensity={0.14} color="#e9e2d5" />
      <directionalLight
        ref={keyRef}
        position={[18, 28, PLAYER_Z + 18]}
        color="#ffd9ad"
        intensity={1.65}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={12}
        shadow-camera-bottom={-8}
      />
      <object3D ref={targetRef} position={[0, 0, PLAYER_Z - 9]} />
    </group>
  )
}

// [GFX] Vehicle quality selection uses an optional safe localStorage override.
// It never touches the game's persisted progress schema or gameplay state.
type VehicleGfxQuality = 'high' | 'medium' | 'low'

function getVehicleGfxQuality(gl: THREE.WebGLRenderer): VehicleGfxQuality {
  try {
    const stored = window.localStorage.getItem('hs_gfx_quality')
    if (stored === 'high' || stored === 'medium' || stored === 'low') return stored
  } catch {
    // Storage access is optional; fall back to capability detection.
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const highCapability =
    gl.capabilities.getMaxAnisotropy() >= 4 &&
    gl.capabilities.maxTextureSize >= 2048 &&
    dpr <= 2

  return highCapability ? 'high' : 'medium'
}

let vehicleMatcapTexture: THREE.CanvasTexture | null = null
function getVehicleMatcapTexture() {
  if (vehicleMatcapTexture) return vehicleMatcapTexture

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create vehicle matcap')

  const gradient = ctx.createRadialGradient(22, 20, 3, 34, 38, 38)
  gradient.addColorStop(0, '#fff7e3')
  gradient.addColorStop(0.22, '#cbd4db')
  gradient.addColorStop(0.52, '#66737d')
  gradient.addColorStop(0.78, '#293038')
  gradient.addColorStop(1, '#11161a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  vehicleMatcapTexture = new THREE.CanvasTexture(canvas)
  vehicleMatcapTexture.colorSpace = THREE.SRGBColorSpace
  vehicleMatcapTexture.minFilter = THREE.LinearFilter
  vehicleMatcapTexture.magFilter = THREE.LinearFilter
  vehicleMatcapTexture.needsUpdate = true
  return vehicleMatcapTexture
}

let contactShadowTexture: THREE.CanvasTexture | null = null
function getContactShadowTexture() {
  if (contactShadowTexture) return contactShadowTexture

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create contact shadow')

  const gradient = ctx.createRadialGradient(64, 32, 2, 64, 32, 62)
  gradient.addColorStop(0, 'rgba(18,22,24,0.38)')
  gradient.addColorStop(0.5, 'rgba(18,22,24,0.16)')
  gradient.addColorStop(1, 'rgba(18,22,24,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 64)

  contactShadowTexture = new THREE.CanvasTexture(canvas)
  contactShadowTexture.colorSpace = THREE.SRGBColorSpace
  contactShadowTexture.minFilter = THREE.LinearFilter
  contactShadowTexture.magFilter = THREE.LinearFilter
  contactShadowTexture.needsUpdate = true
  return contactShadowTexture
}

const PLAYER_FINISH_PROFILES: Record<string, {
  body: [number, number, number]
  bodyPosition: [number, number, number]
  accent: [number, number, number]
  accentPosition: [number, number, number]
}> = {
  blitz: {
    body: [0.44, 0.24, 0.96],
    bodyPosition: [0, 0.64, -0.02],
    accent: [0.29, 0.055, 0.58],
    accentPosition: [0, 0.78, -0.1],
  },
  apex: {
    body: [0.58, 0.28, 1.05],
    bodyPosition: [0, 0.66, -0.04],
    accent: [0.36, 0.06, 0.65],
    accentPosition: [0, 0.81, -0.12],
  },
  chronos: {
    body: [0.52, 0.32, 1.06],
    bodyPosition: [0, 0.68, -0.17],
    accent: [0.30, 0.05, 0.58],
    accentPosition: [0, 0.84, -0.32],
  },
  stratos: {
    body: [0.50, 0.31, 1.06],
    bodyPosition: [0, 0.66, -0.12],
    accent: [0.29, 0.05, 0.58],
    accentPosition: [0, 0.81, -0.26],
  },
  zenith: {
    body: [0.52, 0.32, 1.08],
    bodyPosition: [0, 0.64, -0.09],
    accent: [0.29, 0.05, 0.59],
    accentPosition: [0, 0.79, -0.24],
  },
}

function PlayerVehicleFinish({
  bike,
  car,
  quality,
}: {
  bike: Bike
  car: Car
  quality: VehicleGfxQuality
}) {
  const isCar = car.id !== 'none' && getState().vehicleMode === 'car'
  const profile = PLAYER_FINISH_PROFILES[bike.id] ?? PLAYER_FINISH_PROFILES.blitz
  const bodySize: [number, number, number] = isCar
    ? [1.42, 0.26, 2.35]
    : profile.body
  const bodyPosition: [number, number, number] = isCar
    ? [0, 0.59, 0]
    : profile.bodyPosition
  const accentSize: [number, number, number] = isCar
    ? [0.86, 0.045, 1.15]
    : profile.accent
  const accentPosition: [number, number, number] = isCar
    ? [0, 0.76, -0.36]
    : profile.accentPosition

  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(
      bodySize[0],
      bodySize[1],
      bodySize[2],
      0.055,
      2
    ),
    [bodySize[0], bodySize[1], bodySize[2]]
  )
  const accentGeometry = useMemo(
    () => new RoundedBoxGeometry(
      accentSize[0],
      accentSize[1],
      accentSize[2],
      0.018,
      2
    ),
    [accentSize[0], accentSize[1], accentSize[2]]
  )

  const bodyMaterial = useMemo<THREE.Material>(() => {
    if (quality === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: isCar ? car.color : bike.color,
        metalness: 0.5,
        roughness: 0.24,
        clearcoat: 0.72,
        clearcoatRoughness: 0.16,
        envMapIntensity: 0.85,
      })
    }

    return new THREE.MeshMatcapMaterial({
      color: isCar ? car.color : bike.color,
      matcap: getVehicleMatcapTexture(),
    })
  }, [quality, isCar, bike.color, car.color])

  const accentMaterial = useMemo<THREE.Material>(() => {
    if (quality === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: isCar ? car.accentColor : bike.accentColor,
        metalness: 0.68,
        roughness: 0.2,
        clearcoat: 0.58,
        clearcoatRoughness: 0.18,
      })
    }

    return new THREE.MeshMatcapMaterial({
      color: isCar ? car.accentColor : bike.accentColor,
      matcap: getVehicleMatcapTexture(),
    })
  }, [quality, isCar, bike.accentColor, car.accentColor])

  useEffect(() => {
    return () => {
      bodyGeometry.dispose()
      accentGeometry.dispose()
      bodyMaterial.dispose()
      accentMaterial.dispose()
    }
  }, [bodyGeometry, accentGeometry, bodyMaterial, accentMaterial])

  return (
    <group>
      <mesh
        geometry={bodyGeometry}
        material={bodyMaterial}
        position={bodyPosition}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={accentGeometry}
        material={accentMaterial}
        position={accentPosition}
        castShadow
      />
    </group>
  )
}

function PlayerWheelEffects({ vehicleMode, speed }: { vehicleMode: 'bike' | 'car'; speed: number }) {
  const blurFrontRef = useRef<THREE.Mesh>(null)
  const blurRearRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const intensity = THREE.MathUtils.clamp((speed - 60) / 70, 0, 1)
    const opacity = 0.01 + intensity * 0.11
    if (blurFrontRef.current) {
      const material = blurFrontRef.current.material as THREE.MeshBasicMaterial
      material.opacity = opacity
      blurFrontRef.current.visible = intensity > 0.02
    }
    if (blurRearRef.current) {
      const material = blurRearRef.current.material as THREE.MeshBasicMaterial
      material.opacity = opacity
      blurRearRef.current.visible = intensity > 0.02
    }
  })

  const wheelZ = vehicleMode === 'car' ? 0.8 : 0.92
  const radius = vehicleMode === 'car' ? 0.42 : 0.25

  return (
    <>
      <mesh
        ref={blurFrontRef}
        position={[0, 0.25, -wheelZ]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[radius, vehicleMode === 'car' ? 0.075 : 0.045, 8, 16]} />
        <meshBasicMaterial
          color="#e4e7e8"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={blurRearRef}
        position={[0, 0.25, wheelZ]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <torusGeometry args={[radius, vehicleMode === 'car' ? 0.075 : 0.05, 8, 16]} />
        <meshBasicMaterial
          color="#e4e7e8"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function PlayerContactShadow({ vehicleMode }: { vehicleMode: 'bike' | 'car' }) {
  return (
    <mesh
      position={[0, 0.012, vehicleMode === 'car' ? 0.08 : 0.1]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    >
      <planeGeometry args={vehicleMode === 'car' ? [2.2, 3.8] : [1.2, 2.35]} />
      <meshBasicMaterial
        map={getContactShadowTexture()}
        transparent
        opacity={0.48}
        depthWrite={false}
      />
    </mesh>
  )
}

// ============== MOTORCYCLE ==============
type ShieldImpactVisual = {
  id: number
  position: THREE.Vector3
}

let shieldImpactVisual: ShieldImpactVisual | null = null

function emitShieldImpact(position: THREE.Vector3) {
  shieldImpactVisual = {
    id: (shieldImpactVisual?.id ?? 0) + 1,
    position: position.clone(),
  }
}

// [GFX] Persistent visual shield. Gameplay state controls only the active flag;
// the short in/out animation is purely cosmetic.
function ShieldBubble({
  vehicleMode,
  active,
}: {
  vehicleMode: 'bike' | 'car'
  active: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const particleRef = useRef<THREE.Points>(null)
  const rippleRef = useRef<THREE.Mesh>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const lastActiveRef = useRef(false)
  const transitionStartRef = useRef(0)
  const lastImpactIdRef = useRef(0)
  const impactRef = useRef(0)
  const impactLocalRef = useRef(new THREE.Vector3())
  const { camera } = useThree()

  // [GFX] Existing shield footprint is unchanged.
  const radius = vehicleMode === 'car' ? 1.85 : 1.2

  const particleGeometry = useMemo(() => {
    const count = 10
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const r = radius * (0.68 + (i % 3) * 0.07)
      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = 0.12 + (i % 4) * 0.34
      positions[i * 3 + 2] = Math.sin(angle) * r
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
  }, [radius])

  const shellMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color('#66cfff') },
      },
      vertexShader: shellVS,
      fragmentShader: shellFS,
    }),
    []
  )

  const innerMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color('#d8f5ff') },
      },
      vertexShader: innerVS,
      fragmentShader: innerFS,
    }),
    []
  )

  const particleMaterial = useMemo(
    () => new THREE.PointsMaterial({
      color: '#a5e9ff',
      size: 0.072,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
    []
  )

  const rippleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#dff9ff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  const flashMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  useEffect(() => {
    return () => {
      particleGeometry.dispose()
      shellMaterial.dispose()
      innerMaterial.dispose()
      particleMaterial.dispose()
      rippleMaterial.dispose()
      flashMaterial.dispose()
    }
  }, [
    particleGeometry,
    shellMaterial,
    innerMaterial,
    particleMaterial,
    rippleMaterial,
    flashMaterial,
  ])

  useFrame((_, delta) => {
    const now = performance.now()
    if (!groupRef.current) return

    if (active !== lastActiveRef.current) {
      lastActiveRef.current = active
      transitionStartRef.current = now
    }

    const transition = Math.min((now - transitionStartRef.current) / 220, 1)
    const progress = active
      ? 1 - Math.pow(1 - transition, 3)
      : Math.pow(1 - transition, 2)

    const pulse = 1 + Math.sin(now * 0.0028) * 0.012
    const visualAlpha = Math.max(0, progress) * pulse

    groupRef.current.visible = active || transition < 1
    groupRef.current.position.set(getState().playerX, 0.95, PLAYER_Z)
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.0, progress))

    shellMaterial.uniforms.uTime.value = now * 0.001
    shellMaterial.uniforms.uOpacity.value = visualAlpha
    innerMaterial.uniforms.uTime.value = now * 0.001
    innerMaterial.uniforms.uOpacity.value = visualAlpha * 0.68

    if (shellRef.current) {
      shellRef.current.scale.setScalar(1 + Math.sin(now * 0.0038) * 0.012)
    }

    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.16
      innerRef.current.scale.setScalar(1.006 + Math.sin(now * 0.0021) * 0.01)
    }

    if (particleRef.current) {
      const position = particleRef.current.geometry.getAttribute('position')
      const array = position.array as Float32Array

      for (let i = 0; i < 10; i++) {
        const base = i * 3
        const angle = now * (0.00062 + (i % 2) * 0.00015) + i * 0.63
        const drift = Math.sin(now * 0.0012 + i) * 0.045
        const r = radius * (0.68 + (i % 3) * 0.07)

        array[base] = Math.cos(angle) * r
        array[base + 1] = 0.12 + (i % 4) * 0.34 + drift
        array[base + 2] = Math.sin(angle) * r
      }

      position.needsUpdate = true
      particleMaterial.opacity = visualAlpha * 0.38
      particleRef.current.visible = visualAlpha > 0.01
    }

    if (
      shieldImpactVisual &&
      shieldImpactVisual.id !== lastImpactIdRef.current
    ) {
      lastImpactIdRef.current = shieldImpactVisual.id
      impactRef.current = 1
      impactLocalRef.current
        .copy(shieldImpactVisual.position)
        .sub(groupRef.current.position)
    }

    impactRef.current = Math.max(0, impactRef.current - delta * 5.0)

    if (rippleRef.current && flashRef.current) {
      const impact = impactRef.current
      const local = impactLocalRef.current

      rippleRef.current.position.set(
        local.x * 0.92,
        THREE.MathUtils.clamp(local.y, 0.15, 1.8),
        local.z * 0.92
      )
      rippleRef.current.quaternion.copy(camera.quaternion)
      rippleRef.current.scale.setScalar(0.12 + (1 - impact) * radius * 0.62)

      flashRef.current.position.copy(rippleRef.current.position)
      flashRef.current.scale.setScalar(0.12 + impact * 0.38)

      rippleMaterial.opacity = impact * 0.5
      flashMaterial.opacity = impact * 0.32
      rippleRef.current.visible = impact > 0.02
      flashRef.current.visible = impact > 0.02
    }

    if (!active && transition >= 1) {
      groupRef.current.visible = false
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.95, PLAYER_Z]} visible={false}>
      <mesh ref={shellRef}>
        <sphereGeometry args={[radius, 24, 16]} />
        <primitive object={shellMaterial} attach="material" />
      </mesh>

      <mesh ref={innerRef} scale={1.012}>
        <sphereGeometry args={[radius, 20, 14]} />
        <primitive object={innerMaterial} attach="material" />
      </mesh>

      <points
        ref={particleRef}
        geometry={particleGeometry}
        material={particleMaterial}
      />

      <mesh ref={rippleRef}>
        <torusGeometry args={[0.46, 0.032, 8, 24]} />
        <primitive object={rippleMaterial} attach="material" />
      </mesh>

      <mesh ref={flashRef}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <primitive object={flashMaterial} attach="material" />
      </mesh>
    </group>
  )
}


function Motorcycle({ bike, car }: { bike: Bike; car: Car }) {
  const meshRef = useRef<THREE.Group>(null)
  const visualRef = useRef<THREE.Group>(null)
  const currentXRef = useRef(0)
  const tiltRef = useRef(0)
  const bikeRef = useRef(bike)
  const wheelSpinRef = useRef(0)
  const shieldActive = useGameStore((s) => s.shieldActive)
  const vehicleMode = useGameStore((s) => s.vehicleMode)
  const { gl } = useThree()
  const vehicleQuality = useMemo(() => getVehicleGfxQuality(gl), [gl])

  useEffect(() => { bikeRef.current = bike }, [bike])

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing') return

    const currentBike = bikeRef.current
    const targetX = state.targetLane * LANE_WIDTH
    const lerpSpeed = 8 * currentBike.handling
    currentXRef.current += (targetX - currentXRef.current) * lerpSpeed * delta
    actions.setPlayerX(currentXRef.current)

    const tiltTarget = (targetX - currentXRef.current) * 0.12
    tiltRef.current += (tiltTarget - tiltRef.current) * 5 * delta

    // Wheel spin
    wheelSpinRef.current += state.speed * delta * 0.3

    if (meshRef.current) {
      meshRef.current.position.x = currentXRef.current
      meshRef.current.rotation.z = tiltRef.current
      meshRef.current.rotation.y = -tiltRef.current * 0.3
      // Slight bobbing at high speed
      meshRef.current.position.y = Math.sin(wheelSpinRef.current * 2) * 0.02 * (state.speed / 100)

      // [GFX] Visual-only secondary lean and suspension compression.
      if (visualRef.current) {
        const speedNorm = THREE.MathUtils.clamp(state.speed / 100, 0, 1)
        visualRef.current.rotation.z = tiltRef.current * 0.14
        visualRef.current.rotation.y = -tiltRef.current * 0.05
        visualRef.current.position.y =
          Math.sin(wheelSpinRef.current * 1.4) * 0.008 * speedNorm
        visualRef.current.scale.y = 1 - speedNorm * 0.018

        // [GFX] Wheel rotation is visual-only and driven from existing speed.
        visualRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh && object.name === 'player-wheel') {
            object.rotation.x = wheelSpinRef.current
          }
        })
      }
    }
  })

  const renderBikeModel = () => {
    switch (bike.id) {
      case 'blitz': return <BlitzBike bike={bike} />
      case 'apex': return <ApexBike bike={bike} />
      case 'chronos': return <ChronosBike bike={bike} />
      case 'stratos': return <StratosBike bike={bike} />
      case 'zenith': return <ZenithBike bike={bike} />
      default: return <BlitzBike bike={bike} />
    }
  }

  const renderCarModel = () => {
    switch (car.id) {
      case 'kanto-zip': return <KantoZipCar car={car} />
      case 'saber-swift': return <SaberSwiftCar car={car} />
      case 'goliath-titan': return <GoliathTitanCar car={car} />
      case 'kaiser-monarch': return <KaiserMonarchCar car={car} />
      case 'scuderia-fury': return <ScuderiaFuryCar car={car} />
      default: return <KantoZipCar car={car} />
    }
  }

  useEffect(() => {
    const root = meshRef.current
    if (!root) return
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [bike.id, car.id, vehicleMode])

  return (
    <group ref={meshRef} position={[0, 0, PLAYER_Z]}>
      <group ref={visualRef}>
        {vehicleMode === 'car' ? renderCarModel() : renderBikeModel()}
        <PlayerVehicleFinish bike={bike} car={car} quality={vehicleQuality} />
        <VehicleLightingAccents vehicleMode={vehicleMode} />
        <PlayerWheelEffects vehicleMode={vehicleMode} speed={0} />
        <PlayerContactShadow vehicleMode={vehicleMode} />
        <ShieldBubble vehicleMode={vehicleMode} active={shieldActive} />
      </group>
    </group>
  )
}

// ============== BLITZ BIKE (Modern Neo-Retro Cruiser) ==============
function BlitzBike({ bike }: { bike: Bike }) {
  return (
    <>
      {/* Main frame - slim and clean */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.4, 0.35, 1.9]} />
        <meshStandardMaterial color={bike.color} metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Engine block - compact */}
      <mesh position={[0, 0.32, 0.05]}>
        <boxGeometry args={[0.38, 0.22, 0.5]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.25} />
      </mesh>
      
      {/* Fuel tank - rounded modern shape */}
      <mesh position={[0, 0.72, -0.1]}>
        <boxGeometry args={[0.42, 0.28, 0.8]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.75} roughness={0.2} />
      </mesh>
      
      {/* Seat - slim */}
      <mesh position={[0, 0.75, 0.4]}>
        <boxGeometry args={[0.32, 0.08, 0.65]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>

      {/* Front fork - thin */}
      <mesh position={[0, 0.52, -0.82]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.06, 0.75, 0.06]} />
        <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Front wheel */}
      <mesh name="player-wheel" position={[0, 0.25, -0.92]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.07, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, -0.92]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.8} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh name="player-wheel" position={[0, 0.25, 0.82]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.09, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, 0.82]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.1, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.8} />
      </mesh>

      {/* Handlebar - moderate width */}
      <mesh position={[0, 0.92, -0.68]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.6, 0.04, 0.04]} />
        <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Mirrors */}
      <mesh position={[-0.32, 0.97, -0.7]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#999999" metalness={0.9} />
      </mesh>
      <mesh position={[0.32, 0.97, -0.7]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#999999" metalness={0.9} />
      </mesh>

      {/* Headlight - round modern */}
      <mesh position={[0, 0.62, -1.0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={3} />
      </mesh>

      {/* Tail light */}
      <mesh position={[0, 0.52, 1.0]}>
        <boxGeometry args={[0.22, 0.05, 0.03]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>

      {/* Exhaust - single pipe */}
      <mesh position={[0.28, 0.26, 0.45]} rotation={[0.08, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.85, 8]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Rider */}
      <group position={[0, 1.02, 0.12]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.38, 0.52, 0.28]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.58, -0.05]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color={bike.accentColor} metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.58, -0.15]}>
          <boxGeometry args={[0.2, 0.08, 0.05]} />
          <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.28, 0.05, -0.2]} rotation={[0.6, 0, 0.2]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.28, 0.05, -0.2]} rotation={[0.6, 0, -0.2]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.12, -0.35, 0.1]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0.12, -0.35, 0.1]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
    </>
  )
}

// ============== APEX BIKE (Classic Muscular Cruiser) ==============
function ApexBike({ bike }: { bike: Bike }) {
  return (
    <>
      {/* Main frame - bulkier */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.55, 0.42, 2.0]} />
        <meshStandardMaterial color={bike.color} metalness={0.7} roughness={0.28} />
      </mesh>
      
      {/* Engine block - larger, more prominent */}
      <mesh position={[0, 0.33, 0.08]}>
        <boxGeometry args={[0.5, 0.28, 0.6]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Engine fins */}
      <mesh position={[0.26, 0.33, 0.08]}>
        <boxGeometry args={[0.02, 0.25, 0.55]} />
        <meshStandardMaterial color="#333333" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[-0.26, 0.33, 0.08]}>
        <boxGeometry args={[0.02, 0.25, 0.55]} />
        <meshStandardMaterial color="#333333" metalness={0.85} roughness={0.25} />
      </mesh>
      
      {/* Fuel tank - classic teardrop shape */}
      <mesh position={[0, 0.74, -0.12]}>
        <boxGeometry args={[0.5, 0.32, 0.9]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.8} roughness={0.18} />
      </mesh>
      {/* Tank chrome strip */}
      <mesh position={[0, 0.74, -0.12]}>
        <boxGeometry args={[0.52, 0.03, 0.85]} />
        <meshStandardMaterial color="#cccccc" metalness={0.95} roughness={0.1} />
      </mesh>
      
      {/* Seat - wider, more cushioned */}
      <mesh position={[0, 0.76, 0.42]}>
        <boxGeometry args={[0.4, 0.12, 0.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>

      {/* Front fork - thicker */}
      <mesh position={[0, 0.54, -0.85]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[0.09, 0.8, 0.09]} />
        <meshStandardMaterial color="#777777" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Front wheel */}
      <mesh name="player-wheel" position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.09, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.08, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh name="player-wheel" position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.28, 0.11, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.21, 0.21, 0.14, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>

      {/* Handlebar - wider, cruiser style */}
      <mesh position={[0, 0.95, -0.72]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.7, 0.05, 0.05]} />
        <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Mirrors - larger */}
      <mesh position={[-0.38, 1.0, -0.74]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.9} />
      </mesh>
      <mesh position={[0.38, 1.0, -0.74]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.9} />
      </mesh>

      {/* Headlight - larger round */}
      <mesh position={[0, 0.65, -1.05]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={3} />
      </mesh>

      {/* Tail light */}
      <mesh position={[0, 0.55, 1.05]}>
        <boxGeometry args={[0.28, 0.07, 0.04]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>

      {/* Exhaust - dual pipes, chrome */}
      <mesh position={[0.32, 0.28, 0.48]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.9, 8]} />
        <meshStandardMaterial color="#cccccc" metalness={0.95} roughness={0.08} />
      </mesh>
      <mesh position={[-0.32, 0.28, 0.48]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.9, 8]} />
        <meshStandardMaterial color="#cccccc" metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Rider */}
      <group position={[0, 1.05, 0.15]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.42, 0.55, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.6, -0.05]}>
          <sphereGeometry args={[0.17, 8, 8]} />
          <meshStandardMaterial color={bike.accentColor} metalness={0.6} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.58, -0.15]}>
          <boxGeometry args={[0.2, 0.08, 0.05]} />
          <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[-0.28, 0.05, -0.2]} rotation={[0.6, 0, 0.2]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.28, 0.05, -0.2]} rotation={[0.6, 0, -0.2]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.12, -0.35, 0.1]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0.12, -0.35, 0.1]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.12]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
    </>
  )
}

// ============== CHRONOS BIKE (Sport Bike) ==============
function ChronosBike({ bike }: { bike: Bike }) {
  return (
    <>
      {/* Full fairing - aerodynamic body */}
      <mesh position={[0, 0.55, -0.2]}>
        <boxGeometry args={[0.5, 0.5, 1.8]} />
        <meshStandardMaterial color={bike.color} metalness={0.75} roughness={0.2} />
      </mesh>
      
      {/* Front fairing - aggressive angle */}
      <mesh position={[0, 0.65, -0.85]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.48, 0.45, 0.5]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.8} roughness={0.15} />
      </mesh>
      
      {/* Windscreen */}
      <mesh position={[0, 0.85, -0.75]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.35, 0.25, 0.03]} />
        <meshStandardMaterial color="#333333" metalness={0.3} roughness={0.4} transparent opacity={0.7} />
      </mesh>
      
      {/* Engine block - exposed */}
      <mesh position={[0, 0.32, 0.1]}>
        <boxGeometry args={[0.42, 0.24, 0.55]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Tail section - slim */}
      <mesh position={[0, 0.65, 0.6]}>
        <boxGeometry args={[0.35, 0.2, 0.6]} />
        <meshStandardMaterial color={bike.color} metalness={0.75} roughness={0.2} />
      </mesh>
      
      {/* Seat - low, sport */}
      <mesh position={[0, 0.72, 0.35]}>
        <boxGeometry args={[0.3, 0.08, 0.55]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>

      {/* Front fork - inverted, thick */}
      <mesh position={[0, 0.55, -0.88]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.1, 0.75, 0.1]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Front wheel */}
      <mesh name="player-wheel" position={[0, 0.25, -0.98]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.25, 0.08, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, -0.98]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel - wider */}
      <mesh name="player-wheel" position={[0, 0.25, 0.88]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.27, 0.12, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, 0.88]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.15, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.85} />
      </mesh>

      {/* Handlebar - clip-ons, low */}
      <mesh position={[0, 0.88, -0.7]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.55, 0.04, 0.04]} />
        <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Mirrors - integrated */}
      <mesh position={[-0.3, 0.92, -0.72]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#999999" metalness={0.9} />
      </mesh>
      <mesh position={[0.3, 0.92, -0.72]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#999999" metalness={0.9} />
      </mesh>

      {/* Headlight - aggressive twin */}
      <mesh position={[-0.12, 0.68, -1.08]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={3.5} />
      </mesh>
      <mesh position={[0.12, 0.68, -1.08]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={3.5} />
      </mesh>

      {/* Tail light - slim LED style */}
      <mesh position={[0, 0.58, 1.08]}>
        <boxGeometry args={[0.2, 0.04, 0.03]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2.5} />
      </mesh>

      {/* Exhaust - under-tail, single */}
      <mesh position={[0.25, 0.3, 0.6]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.7, 8]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Rider - tucked position */}
      <group position={[0, 0.98, 0.1]}>
        <mesh position={[0, 0.12, -0.05]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.38, 0.5, 0.28]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.52, -0.15]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color={bike.accentColor} metalness={0.7} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.5, -0.25]}>
          <boxGeometry args={[0.18, 0.07, 0.05]} />
          <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[-0.25, 0, -0.25]} rotation={[0.7, 0, 0.15]}>
          <boxGeometry args={[0.1, 0.38, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.25, 0, -0.25]} rotation={[0.7, 0, -0.15]}>
          <boxGeometry args={[0.1, 0.38, 0.1]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.1, -0.32, 0.05]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.11, 0.42, 0.11]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0.1, -0.32, 0.05]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.11, 0.42, 0.11]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
    </>
  )
}

// ============== STRATOS BIKE (High-Performance Sport) ==============
function StratosBike({ bike }: { bike: Bike }) {
  return (
    <>
      {/* Full fairing - sleek, aggressive */}
      <mesh position={[0, 0.52, -0.15]}>
        <boxGeometry args={[0.48, 0.48, 1.85]} />
        <meshStandardMaterial color={bike.color} metalness={0.8} roughness={0.18} />
      </mesh>
      
      {/* Front fairing - very aggressive angle */}
      <mesh position={[0, 0.62, -0.88]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.46, 0.42, 0.52]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.85} roughness={0.12} />
      </mesh>
      
      {/* Windscreen - sharper */}
      <mesh position={[0, 0.82, -0.78]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.32, 0.22, 0.025]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.3} transparent opacity={0.75} />
      </mesh>
      
      {/* Engine block */}
      <mesh position={[0, 0.3, 0.08]}>
        <boxGeometry args={[0.4, 0.22, 0.52]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Tail section - very slim */}
      <mesh position={[0, 0.6, 0.62]}>
        <boxGeometry args={[0.32, 0.18, 0.58]} />
        <meshStandardMaterial color={bike.color} metalness={0.8} roughness={0.18} />
      </mesh>
      
      {/* Seat - ultra low */}
      <mesh position={[0, 0.68, 0.32]}>
        <boxGeometry args={[0.28, 0.06, 0.52]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>

      {/* Front fork - inverted, thick */}
      <mesh position={[0, 0.52, -0.9]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[0.09, 0.72, 0.09]} />
        <meshStandardMaterial color="#999999" metalness={0.9} roughness={0.12} />
      </mesh>

      {/* Front wheel */}
      <mesh name="player-wheel" position={[0, 0.25, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.075, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.055, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh name="player-wheel" position={[0, 0.25, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.11, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.14, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>

      {/* Handlebar - very low clip-ons */}
      <mesh position={[0, 0.85, -0.72]} rotation={[0.38, 0, 0]}>
        <boxGeometry args={[0.52, 0.035, 0.035]} />
        <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Headlight - aggressive single LED */}
      <mesh position={[0, 0.65, -1.1]}>
        <boxGeometry args={[0.15, 0.06, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={4} />
      </mesh>

      {/* Tail light - LED strip */}
      <mesh position={[0, 0.55, 1.1]}>
        <boxGeometry args={[0.18, 0.035, 0.025]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
      </mesh>

      {/* Exhaust - side-mounted */}
      <mesh position={[0.28, 0.28, 0.55]} rotation={[0.12, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.048, 0.72, 8]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Racing stripe */}
      <mesh position={[0, 0.52, -0.15]}>
        <boxGeometry args={[0.08, 0.01, 1.8]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Rider - tucked position */}
      <group position={[0, 0.95, 0.08]}>
        <mesh position={[0, 0.1, -0.06]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.36, 0.48, 0.26]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.5, -0.16]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color={bike.accentColor} metalness={0.7} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.48, -0.26]}>
          <boxGeometry args={[0.17, 0.065, 0.045]} />
          <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[-0.24, -0.02, -0.26]} rotation={[0.75, 0, 0.15]}>
          <boxGeometry args={[0.095, 0.36, 0.095]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.24, -0.02, -0.26]} rotation={[0.75, 0, -0.15]}>
          <boxGeometry args={[0.095, 0.36, 0.095]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.09, -0.34, 0.04]} rotation={[0.45, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0.09, -0.34, 0.04]} rotation={[0.45, 0, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
    </>
  )
}

// ============== ZENITH BIKE (Ultimate Hyperbike) ==============
function ZenithBike({ bike }: { bike: Bike }) {
  return (
    <>
      {/* Full fairing - extreme, futuristic */}
      <mesh position={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.5, 0.52, 1.9]} />
        <meshStandardMaterial color={bike.color} metalness={0.85} roughness={0.15} />
      </mesh>
      
      {/* Front fairing - extreme angle */}
      <mesh position={[0, 0.6, -0.92]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.48, 0.45, 0.55]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Windscreen - very sharp */}
      <mesh position={[0, 0.8, -0.82]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.02]} />
        <meshStandardMaterial color="#111111" metalness={0.5} roughness={0.25} transparent opacity={0.8} />
      </mesh>
      
      {/* Engine block - larger */}
      <mesh position={[0, 0.28, 0.05]}>
        <boxGeometry args={[0.44, 0.25, 0.55]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.95} roughness={0.15} />
      </mesh>
      
      {/* Tail section - extreme */}
      <mesh position={[0, 0.58, 0.65]}>
        <boxGeometry args={[0.3, 0.16, 0.6]} />
        <meshStandardMaterial color={bike.color} metalness={0.85} roughness={0.15} />
      </mesh>
      
      {/* Seat - ultra low, minimal */}
      <mesh position={[0, 0.65, 0.3]}>
        <boxGeometry args={[0.26, 0.05, 0.5]} />
        <meshStandardMaterial color="#050505" roughness={0.95} />
      </mesh>

      {/* Front fork - inverted, very thick */}
      <mesh position={[0, 0.5, -0.95]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Front wheel */}
      <mesh name="player-wheel" position={[0, 0.25, -1.05]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.07, 8, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, -1.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 8]} />
        <meshStandardMaterial color="#777777" metalness={0.9} />
      </mesh>
      
      {/* Rear wheel - widest */}
      <mesh name="player-wheel" position={[0, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.27, 0.13, 8, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      <mesh name="player-wheel" position={[0, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.16, 8]} />
        <meshStandardMaterial color="#777777" metalness={0.9} />
      </mesh>

      {/* Handlebar - ultra low clip-ons */}
      <mesh position={[0, 0.82, -0.75]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.03]} />
        <meshStandardMaterial color="#222222" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Headlight - LED strip */}
      <mesh position={[0, 0.62, -1.15]}>
        <boxGeometry args={[0.2, 0.04, 0.03]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={5} />
      </mesh>

      {/* Tail light - LED strip */}
      <mesh position={[0, 0.52, 1.15]}>
        <boxGeometry args={[0.16, 0.03, 0.02]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3.5} />
      </mesh>

      {/* Exhaust - dual under tail */}
      <mesh position={[0.22, 0.26, 0.58]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.68, 8]} />
        <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.06} />
      </mesh>
      <mesh position={[-0.22, 0.26, 0.58]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.68, 8]} />
        <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.06} />
      </mesh>

      {/* Racing stripes - dual */}
      <mesh position={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.06, 0.008, 1.85]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.75} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.48, -0.1]}>
        <boxGeometry args={[0.04, 0.008, 1.8]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.7} roughness={0.2} opacity={0.6} transparent />
      </mesh>

      {/* Rider - extreme tucked position */}
      <group position={[0, 0.92, 0.05]}>
        <mesh position={[0, 0.08, -0.08]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.35, 0.46, 0.25]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.48, -0.18]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshStandardMaterial color={bike.accentColor} metalness={0.75} roughness={0.12} />
        </mesh>
        <mesh position={[0, 0.46, -0.28]}>
          <boxGeometry args={[0.16, 0.06, 0.04]} />
          <meshStandardMaterial color="#050505" metalness={0.95} roughness={0.08} />
        </mesh>
        <mesh position={[-0.22, -0.04, -0.28]} rotation={[0.8, 0, 0.15]}>
          <boxGeometry args={[0.09, 0.34, 0.09]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0.22, -0.04, -0.28]} rotation={[0.8, 0, -0.15]}>
          <boxGeometry args={[0.09, 0.34, 0.09]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[-0.08, -0.36, 0.02]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.095, 0.38, 0.095]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <mesh position={[0.08, -0.36, 0.02]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.095, 0.38, 0.095]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>
    </>
  )
}

// ============== CARS ==============
// Stylized, logo-free models inspired by the requested real-world proportions.

function CarBase({
  car,
  shape = 'sedan',
}: {
  car: Car
  shape?: 'hatch' | 'sedan' | 'suv' | 'gt' | 'exotic'
}) {
  const { gl } = useThree()
  const quality = getVehicleGfxQuality(gl)

  const dimensions = {
    hatch: [1.55, 1.0, 3.2],
    sedan: [1.65, 1.0, 4.2],
    suv: [1.9, 1.35, 4.6],
    gt: [1.85, 1.05, 4.7],
    exotic: [1.9, 0.9, 4.4],
  } as const

  // [GFX] Gameplay collision dimensions remain exactly the same.
  const [w, h, l] = dimensions[shape]
  const wheelZ = l * 0.34

  const bodyGeometry = useMemo(
    () => new RoundedBoxGeometry(w, h * 0.48, l, 0.055, 2),
    [w, h, l]
  )
  const upperBodyGeometry = useMemo(
    () => new RoundedBoxGeometry(w * 0.78, h * 0.42, l * 0.48, 0.045, 2),
    [w, h, l]
  )
  const glassGeometry = useMemo(
    () => new RoundedBoxGeometry(w * 0.64, h * 0.25, l * 0.42, 0.035, 2),
    [w, h, l]
  )
  const lowerTrimGeometry = useMemo(
    () => new RoundedBoxGeometry(w * 0.82, h * 0.13, 0.08, 0.02, 1),
    [w, h]
  )
  const wheelTireGeometry = useMemo(
    () => new THREE.TorusGeometry(0.28, 0.075, 8, 16),
    []
  )
  const wheelHubGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12),
    []
  )
  const wheelDiscGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.095, 0.095, 0.025, 10),
    []
  )

  const bodyMaterial = useMemo<THREE.Material>(() => {
    if (quality === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: car.color,
        metalness: 0.5,
        roughness: 0.23,
        clearcoat: 0.8,
        clearcoatRoughness: 0.14,
        envMapIntensity: 0.9,
      })
    }
    return new THREE.MeshMatcapMaterial({
      color: car.color,
      matcap: getVehicleMatcapTexture(),
    })
  }, [quality, car.color])

  const upperBodyMaterial = useMemo<THREE.Material>(() => {
    if (quality === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: car.accentColor,
        metalness: 0.66,
        roughness: 0.2,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.85,
      })
    }
    return new THREE.MeshMatcapMaterial({
      color: car.accentColor,
      matcap: getVehicleMatcapTexture(),
    })
  }, [quality, car.accentColor])

  const wheelMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#101010',
      roughness: 0.88,
      metalness: 0.04,
    }),
    []
  )
  const hubMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#9ca3af',
      metalness: 0.82,
      roughness: 0.18,
    }),
    []
  )
  const discMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#4e555a',
      metalness: 0.9,
      roughness: 0.16,
    }),
    []
  )

  useEffect(() => {
    return () => {
      bodyGeometry.dispose()
      upperBodyGeometry.dispose()
      glassGeometry.dispose()
      lowerTrimGeometry.dispose()
      wheelTireGeometry.dispose()
      wheelHubGeometry.dispose()
      wheelDiscGeometry.dispose()
      bodyMaterial.dispose()
      upperBodyMaterial.dispose()
      wheelMaterial.dispose()
      hubMaterial.dispose()
      discMaterial.dispose()
    }
  }, [
    bodyGeometry,
    upperBodyGeometry,
    glassGeometry,
    lowerTrimGeometry,
    wheelTireGeometry,
    wheelHubGeometry,
    wheelDiscGeometry,
    bodyMaterial,
    upperBodyMaterial,
    wheelMaterial,
    hubMaterial,
    discMaterial,
  ])

  return (
    <>
      {/* [GFX] Rounded primary body shell. Same footprint as the protected box. */}
      <mesh
        geometry={bodyGeometry}
        material={bodyMaterial}
        position={[0, h * 0.34, 0]}
        castShadow
        receiveShadow
      />

      {/* [GFX] Car-specific upper paint mass preserves each roster identity. */}
      <mesh
        geometry={upperBodyGeometry}
        material={upperBodyMaterial}
        position={[0, h * 0.66, -l * 0.04]}
        castShadow
      />

      {/* [GFX] Dark glass cockpit with a restrained reflective response. */}
      <mesh
        geometry={glassGeometry}
        position={[0, h * 0.68, -l * 0.06]}
        castShadow
      >
        {quality === 'high' ? (
          <meshPhysicalMaterial
            color="#17212b"
            metalness={0.55}
            roughness={0.16}
            clearcoat={0.4}
            clearcoatRoughness={0.16}
            transparent
            opacity={0.92}
          />
        ) : (
          <meshMatcapMaterial
            color="#17212b"
            matcap={getVehicleMatcapTexture()}
            transparent
            opacity={0.9}
          />
        )}
      </mesh>

      <mesh
        geometry={lowerTrimGeometry}
        position={[0, h * 0.29, -l * 0.48]}
        castShadow
      >
        <meshStandardMaterial
          color="#252525"
          metalness={0.62}
          roughness={0.22}
        />
      </mesh>

      {/* [GFX] Better wheel/tire presentation, including hub + brake-disc illusion.
          The existing player-wheel name keeps the rotation entirely visual-only. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-wheelZ, wheelZ].map((z) => (
            <group
              key={z}
              position={[side * w * 0.52, h * 0.24, z]}
            >
              <mesh
                name="player-wheel"
                geometry={wheelTireGeometry}
                rotation={[0, Math.PI / 2, 0]}
                castShadow
                receiveShadow
              >
                <primitive object={wheelMaterial} attach="material" />
              </mesh>
              <mesh
                name="player-wheel"
                geometry={wheelHubGeometry}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <primitive object={hubMaterial} attach="material" />
              </mesh>
              <mesh
                geometry={wheelDiscGeometry}
                rotation={[0, 0, Math.PI / 2]}
              >
                <primitive object={discMaterial} attach="material" />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* [GFX] Thin emissive light elements remain on the exact existing footprint. */}
      <mesh position={[-w * 0.3, h * 0.36, -l / 2 - 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.12, 0.05]} />
        <meshStandardMaterial
          color="#ffffdc"
          emissive="#fff4b8"
          emissiveIntensity={2.1}
        />
      </mesh>
      <mesh position={[w * 0.3, h * 0.36, -l / 2 - 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.12, 0.05]} />
        <meshStandardMaterial
          color="#ffffdc"
          emissive="#fff4b8"
          emissiveIntensity={2.1}
        />
      </mesh>
      <mesh position={[-w * 0.3, h * 0.36, l / 2 + 0.01]}>
        <boxGeometry args={[w * 0.18, h * 0.1, 0.05]} />
        <meshStandardMaterial
          color="#ef3340"
          emissive="#ef3340"
          emissiveIntensity={1.25}
        />
      </mesh>
      <mesh position={[w * 0.3, h * 0.36, l / 2 + 0.01]}>
        <boxGeometry args={[w * 0.18, h * 0.1, 0.05]} />
        <meshStandardMaterial
          color="#ef3340"
          emissive="#ef3340"
          emissiveIntensity={1.25}
        />
      </mesh>
    </>
  )
}
function KantoZipCar({ car }: { car: Car }) {
  return (
    <group scale={0.95}>
      <CarBase car={car} shape="hatch" />
      <mesh position={[0, 0.76, -0.42]}>
        <boxGeometry args={[1.22, 0.12, 0.7]} />
        <meshStandardMaterial color={car.accentColor} metalness={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.88, 0.58]}>
        <boxGeometry args={[1.18, 0.08, 0.45]} />
        <meshStandardMaterial color="#252525" roughness={0.85} />
      </mesh>
    </group>
  )
}

function SaberSwiftCar({ car }: { car: Car }) {
  return (
    <group>
      <CarBase car={car} shape="sedan" />
      <mesh position={[0, 0.82, 0.65]}>
        <boxGeometry args={[1.42, 0.12, 0.7]} />
        <meshStandardMaterial color={car.color} metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.55, -2.0]}>
        <boxGeometry args={[1.15, 0.1, 0.1]} />
        <meshStandardMaterial color={car.accentColor} metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  )
}

function GoliathTitanCar({ car }: { car: Car }) {
  return (
    <group scale={1.08}>
      <CarBase car={car} shape="suv" />
      <mesh position={[0, 0.98, 0.05]}>
        <boxGeometry args={[1.55, 0.3, 2.55]} />
        <meshStandardMaterial color={car.color} metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.99, -0.55]}>
        <boxGeometry args={[1.38, 0.22, 0.9]} />
        <meshStandardMaterial color="#18222a" metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.35, 2.15]}>
        <boxGeometry args={[1.55, 0.22, 0.18]} />
        <meshStandardMaterial color="#30353a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

function KaiserMonarchCar({ car }: { car: Car }) {
  return (
    <group>
      <CarBase car={car} shape="gt" />
      <mesh position={[0, 0.81, 0.42]}>
        <boxGeometry args={[1.48, 0.16, 1.0]} />
        <meshStandardMaterial color={car.color} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.88, -0.35]}>
        <boxGeometry args={[1.3, 0.12, 0.9]} />
        <meshStandardMaterial color="#111a23" metalness={0.55} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.3, -2.2]}>
        <boxGeometry args={[1.48, 0.16, 0.12]} />
        <meshStandardMaterial color="#c8ccd1" metalness={0.9} roughness={0.16} />
      </mesh>
    </group>
  )
}

function ScuderiaFuryCar({ car }: { car: Car }) {
  return (
    <group scale={1.02}>
      <CarBase car={car} shape="exotic" />
      <mesh position={[0, 0.7, -0.15]}>
        <boxGeometry args={[1.48, 0.16, 2.25]} />
        <meshStandardMaterial color={car.color} metalness={0.72} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.83, -0.55]}>
        <boxGeometry args={[1.25, 0.12, 1.05]} />
        <meshStandardMaterial color="#101820" metalness={0.65} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0.35, 2.08]}>
        <boxGeometry args={[1.4, 0.08, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.45, 2.25]}>
        <boxGeometry args={[1.15, 0.08, 0.1]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  )
}

// ============== TRAFFIC ==============
function TrafficSystem() {
  const vehiclesRef = useRef<TrafficVehicle[]>([])
  const nextIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const lastGameStateRef = useRef<string>('menu')
  const survivalTimeRef = useRef(0)
  const playtimeTrackerRef = useRef(0)

  const vehicleColors = useMemo(() => [
    '#e74c3c', '#3498db', '#27ae60', '#f39c12', '#8e44ad',
    '#1abc9c', '#e67e22', '#ecf0f1', '#2c3e50', '#d35400',
    '#c0392b', '#16a085', '#f1c40f', '#7f8c8d', '#2980b9',
  ], [])

  const getVehicleDimensions = useCallback((type: string): [number, number, number] => {
    switch (type) {
      case 'truck': return [1.8, 2.0, 5.0]
      case 'bus': return [2.0, 2.3, 6.5]
      case 'auto': return [1.0, 1.3, 1.6]
      case 'bike': return [0.95, 1.1, 2.0]
      case 'scooter': return [0.85, 1.15, 1.8]
      default: return [1.4, 1.1, 3.2]
    }
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    
    // Clear vehicles when game restarts
    if (state.gameState === 'playing' && lastGameStateRef.current !== 'playing') {
      vehiclesRef.current = []
      spawnTimerRef.current = 0
      survivalTimeRef.current = 0
      playtimeTrackerRef.current = 0
    }
    lastGameStateRef.current = state.gameState
    
    if (state.gameState !== 'playing') return

    const speed = state.speed
    const playerX = state.playerX
    const clampedDelta = Math.min(delta, 0.05) // Cap delta to prevent tunneling

    // Track survival time
    survivalTimeRef.current += clampedDelta

    // Track playtime (every second)
    playtimeTrackerRef.current += clampedDelta
    if (playtimeTrackerRef.current >= 1) {
      const secondsToAdd = Math.floor(playtimeTrackerRef.current)
      playtimeTrackerRef.current -= secondsToAdd
      actions.addPlaytime(secondsToAdd)
    }

    // Vehicle-specific spawn configuration
    const activeVehicleId = state.vehicleMode === 'car' ? state.selectedCar.id : state.selectedBike.id
    const spawnConfig = getSpawnConfig(activeVehicleId)

    // Calculate spawn distance based on bike type
    const spawnDistance = Math.max(30, spawnConfig.baseDistance - (survivalTimeRef.current / 20) * spawnConfig.reductionRate)

    // Spawn traffic
    spawnTimerRef.current -= clampedDelta
    if (spawnTimerRef.current <= 0) {
      const spawnRate = Math.max(0.35, 1.4 - speed * 0.004)
      spawnTimerRef.current = spawnRate + Math.random() * 0.3

      // Pick a lane, avoid spawning in all 3 lanes at once
      const lane = Math.floor(Math.random() * 3) - 1
      
      // Don't spawn if there's already a vehicle too close in that lane
      const tooClose = vehiclesRef.current.some(
        v => v.lane === lane && Math.abs(v.z - (-spawnDistance)) < 15
      )
      
      if (!tooClose) {
        // Cars never face another car as traffic. Cars get two-wheeled traffic plus public/commercial vehicles.
        const types: TrafficVehicle['type'][] = state.vehicleMode === 'car'
          ? ['bike', 'bike', 'bike', 'scooter', 'scooter', 'auto', 'bus', 'truck']
          : ['car', 'car', 'car', 'car', 'truck', 'auto', 'bus']
        const type = types[Math.floor(Math.random() * types.length)]
        const color = vehicleColors[Math.floor(Math.random() * vehicleColors.length)]
        const vehicleSpeed = 25 + Math.random() * 35

        vehiclesRef.current.push({
          id: nextIdRef.current++,
          lane,
          z: -spawnDistance - Math.random() * 30,
          speed: vehicleSpeed,
          type,
          color,
          passed: false,
        })
      }
    }

    // Update vehicles
    const vehicles = vehiclesRef.current

    for (let i = vehicles.length - 1; i >= 0; i--) {
      const v = vehicles[i]
      // Vehicles always approach player (minimum approach rate ensures visibility even at low speed)
      const approachRate = Math.max(15, speed - v.speed + 30)
      v.z += approachRate * clampedDelta * 0.5

      // Remove if past player
      if (v.z > 25) {
        vehicles.splice(i, 1)
        continue
      }

      // Near-miss detection
      const vehicleX = v.lane * LANE_WIDTH
      const lateralDist = Math.abs(playerX - vehicleX)
      const longitudinalDist = v.z - PLAYER_Z

      if (!v.passed && longitudinalDist > 0 && longitudinalDist < 4 && lateralDist < LANE_WIDTH * 0.85 && lateralDist > LANE_WIDTH * 0.25) {
        v.passed = true
        actions.addNearMiss()
      }

      // Collision detection
      const [vw, , vl] = getVehicleDimensions(v.type)
      const collisionX = lateralDist < (vw / 2 + 0.35)
      const collisionZ = v.z > PLAYER_Z - 1.8 && v.z < PLAYER_Z + 1.2

      if (collisionX && collisionZ && v.z > PLAYER_Z - 2) {
        // Check if shield is active
        if (state.shieldActive) {
          // [GFX] Cosmetic impact marker after collision has already been detected.
          emitShieldImpact(new THREE.Vector3(vehicleX, 0.85, v.z))
          actions.useShield()
          // Remove the vehicle that would have caused crash
          vehicles.splice(i, 1)
          continue
        }
        actions.setGameState('gameover')
        actions.setSpeed(0)
        return
      }
    }

    // Score: 180 points per second base rate (continuous), 2x or 4x if multiplier active
    const scoreRate = state.multiplierActive ? (state.multiplier4x ? 720 : 360) : 180
    actions.addScore(Math.floor(scoreRate * clampedDelta))
    actions.setDistance(state.distance + speed * clampedDelta * 0.08)
    
    // Gradually increase speed from 0 to maxSpeed (reaches max in ~15-20 seconds)
    const activeVehicle = state.vehicleMode === 'car' ? state.selectedCar : state.selectedBike
    const speedIncrease = activeVehicle.acceleration * 8 * clampedDelta
    const newSpeed = Math.min(activeVehicle.maxSpeed, state.speed + speedIncrease)
    actions.setSpeed(newSpeed)

    // Combo timer
    if (state.comboTimer > 0) {
      const newTimer = state.comboTimer - clampedDelta
      if (newTimer <= 0) {
        actions.resetCombo()
      }
    }
  })

  return (
    <group>
      <TrafficRenderer
        vehiclesRef={vehiclesRef}
        getDimensions={getVehicleDimensions}
      />
    </group>
  )
}

function TrafficRenderer({ vehiclesRef, getDimensions }: {
  vehiclesRef: React.MutableRefObject<TrafficVehicle[]>
  getDimensions: (type: string) => [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshCacheRef = useRef<Map<number, THREE.Group>>(new Map())

  useFrame(() => {
    if (!groupRef.current) return
    const vehicles = vehiclesRef.current
    
    const existingIds = new Set<number>()
    
    vehicles.forEach((v) => {
      existingIds.add(v.id)
      
      let mesh = meshCacheRef.current.get(v.id)
      if (!mesh) {
        mesh = createVehicleMesh(v.type, v.color, getDimensions)
        mesh.traverse((object) => {
          if (object instanceof THREE.Mesh && !(object.material instanceof THREE.SpriteMaterial)) {
            object.castShadow = true
            object.receiveShadow = true
          }
        })
        meshCacheRef.current.set(v.id, mesh)
        groupRef.current!.add(mesh)
      }
      
      mesh.position.set(v.lane * LANE_WIDTH, 0, v.z)
    })

    // Remove old meshes
    meshCacheRef.current.forEach((mesh, id) => {
      if (!existingIds.has(id)) {
        groupRef.current!.remove(mesh)
        meshCacheRef.current.delete(id)
      }
    })
  })

  return <group ref={groupRef} />
}

function createVehicleMesh(type: string, color: string, getDimensions: (type: string) => [number, number, number]): THREE.Group {
  const group = new THREE.Group()
  const [w, h, l] = getDimensions(type)

  // Body
  const bodyGeo = new RoundedBoxGeometry(w, h * 0.55, l, 0.045, 1)
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.36,
    envMapIntensity: 0.65,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = h * 0.35
  group.add(body)

  // Cabin/Roof
  if (type === 'car') {
    const roofGeo = new RoundedBoxGeometry(w * 0.82, h * 0.38, l * 0.45, 0.04, 1)
    const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.3, roughness: 0.4 })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = h * 0.65
    roof.position.z = -l * 0.05
    group.add(roof)
  } else if (type === 'auto') {
    // Auto-rickshaw style - open top with canopy
    const roofGeo = new RoundedBoxGeometry(w * 0.9, h * 0.15, l * 0.7, 0.025, 1)
    const roofMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = h * 0.7
    group.add(roof)
  } else if (type === 'bike') {
    const frameGeo = new THREE.BoxGeometry(w * 0.28, h * 0.22, l * 0.55)
    const frameMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.3 })
    const frame = new THREE.Mesh(frameGeo, frameMat)
    frame.position.y = h * 0.42
    group.add(frame)
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, h * 0.08, l * 0.24), new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 }))
    seat.position.set(0, h * 0.72, l * 0.12)
    group.add(seat)
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.07, h * 0.6, 0.07), new THREE.MeshStandardMaterial({ color: '#777777', metalness: 0.8 }))
    fork.position.set(0, h * 0.48, -l * 0.35)
    group.add(fork)
    const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8 }))
    handle.position.set(0, h * 0.82, -l * 0.34)
    group.add(handle)
  } else if (type === 'scooter') {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.14, l * 0.5), new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 }))
    deck.position.y = h * 0.38
    group.add(deck)
    const legShield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, h * 0.52, l * 0.25), new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 }))
    legShield.position.set(0, h * 0.62, -l * 0.08)
    group.add(legShield)
    const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8 }))
    handle.position.set(0, h * 0.9, -l * 0.28)
    group.add(handle)
  } else if (type === 'truck') {
    // Cabin
    const cabinGeo = new THREE.BoxGeometry(w * 0.88, h * 0.5, l * 0.22)
    const cabinMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3, roughness: 0.5 })
    const cabin = new THREE.Mesh(cabinGeo, cabinMat)
    cabin.position.y = h * 0.6
    cabin.position.z = -l * 0.32
    group.add(cabin)
    // Cargo
    const cargoGeo = new RoundedBoxGeometry(w * 0.95, h * 0.7, l * 0.6, 0.045, 1)
    const cargoMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 })
    const cargo = new THREE.Mesh(cargoGeo, cargoMat)
    cargo.position.y = h * 0.5
    cargo.position.z = l * 0.1
    group.add(cargo)
  } else if (type === 'bus') {
    // Bus body is taller
    const bodyGeo2 = new RoundedBoxGeometry(w * 0.95, h * 0.85, l * 0.95, 0.055, 1)
    const bodyMat2 = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 })
    const body2 = new THREE.Mesh(bodyGeo2, bodyMat2)
    body2.position.y = h * 0.5
    group.add(body2)
    // Windows
    const winGeo = new THREE.BoxGeometry(w * 0.96, h * 0.25, l * 0.85)
    const winMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.5, roughness: 0.2, transparent: true, opacity: 0.7 })
    const windows = new THREE.Mesh(winGeo, winMat)
    windows.position.y = h * 0.7
    group.add(windows)
  }

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8)
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 })
  
  const wheelZ = type === 'bus' || type === 'truck' ? l * 0.35 : type === 'bike' || type === 'scooter' ? l * 0.38 : l * 0.3
  const wheelPositions = (type === 'bike' || type === 'scooter')
    ? [[0, 0.22, -wheelZ], [0, 0.22, wheelZ]]
    : [
        [-w / 2 - 0.04, 0.22, -wheelZ],
        [w / 2 + 0.04, 0.22, -wheelZ],
        [-w / 2 - 0.04, 0.22, wheelZ],
        [w / 2 + 0.04, 0.22, wheelZ],
      ]

  if (type === 'truck' || type === 'bus') {
    // Extra rear wheels
    wheelPositions.push([-w / 2 - 0.04, 0.22, wheelZ * 0.6])
    wheelPositions.push([w / 2 + 0.04, 0.22, wheelZ * 0.6])
  }

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat)
    wheel.position.set(x, y, z)
    wheel.rotation.z = Math.PI / 2
    group.add(wheel)
  })

  // [GFX] Additive tail-light bloom without a dynamic light.
  const tailGlowMaterial = new THREE.SpriteMaterial({
    map: getGlowTexture('tail'),
    color: '#ff433d',
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const tailGlow = new THREE.Sprite(tailGlowMaterial)
  tailGlow.position.set(0, h * 0.38, l / 2 + 0.015)
  tailGlow.scale.set(0.44, 0.32, 1)
  group.add(tailGlow)

  // Tail lights
  const tailGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04)
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 0.8 })
  const tailL = new THREE.Mesh(tailGeo, tailMat)
  tailL.position.set(-w * 0.35, h * 0.35, l / 2)
  group.add(tailL)
  const tailR = new THREE.Mesh(tailGeo, tailMat)
  tailR.position.set(w * 0.35, h * 0.35, l / 2)
  group.add(tailR)

  // [GFX] Additive head-light bloom keeps approaching traffic readable.
  const headGlowMaterial = new THREE.SpriteMaterial({
    map: getGlowTexture('head'),
    color: '#fff8d6',
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const headGlow = new THREE.Sprite(headGlowMaterial)
  headGlow.position.set(0, h * 0.38, -l / 2 - 0.015)
  headGlow.scale.set(0.48, 0.34, 1)
  group.add(headGlow)

  // Headlights (front)
  const headGeo = new THREE.BoxGeometry(0.1, 0.06, 0.04)
  const headMat = new THREE.MeshStandardMaterial({ color: '#ffffcc', emissive: '#ffffcc', emissiveIntensity: 0.3 })
  const headL = new THREE.Mesh(headGeo, headMat)
  headL.position.set(-w * 0.3, h * 0.35, -l / 2)
  group.add(headL)
  const headR = new THREE.Mesh(headGeo, headMat)
  headR.position.set(w * 0.3, h * 0.35, -l / 2)
  group.add(headR)

  return group
}

// ============== COINS ==============
interface Coin {
  id: number
  lane: number
  x: number
  y: number
  z: number
  collected: boolean
  magnetized: boolean
}

type CoinVisualState = {
  x: number
  y: number
  z: number
  phase: number
}

type CoinCollectionBurst = {
  group: THREE.Group
  coinMesh: THREE.Mesh
  coinMaterial: THREE.MeshStandardMaterial
  points: THREE.Points
  pointGeometry: THREE.BufferGeometry
  pointMaterial: THREE.PointsMaterial
  positions: Float32Array
  positionAttribute: THREE.BufferAttribute
  velocities: THREE.Vector3[]
  origin: THREE.Vector3
  startedAt: number
  active: boolean
}

function createCoinCollectionBurst(
  coinGeometry: THREE.BufferGeometry,
): CoinCollectionBurst {
  const group = new THREE.Group()

  const coinMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd447',
    metalness: 0.86,
    roughness: 0.19,
    emissive: '#9a6500',
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0,
  })
  const coinMesh = new THREE.Mesh(coinGeometry, coinMaterial)
  coinMesh.rotation.x = -Math.PI / 2
  coinMesh.visible = false
  group.add(coinMesh)

  const particleCount = 10
  const positions = new Float32Array(particleCount * 3)
  const positionAttribute = new THREE.BufferAttribute(positions, 3)
  const pointGeometry = new THREE.BufferGeometry()
  pointGeometry.setAttribute('position', positionAttribute)
  const pointMaterial = new THREE.PointsMaterial({
    color: '#ffe08a',
    size: 0.075,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(pointGeometry, pointMaterial)
  points.visible = false
  group.add(points)

  return {
    group,
    coinMesh,
    coinMaterial,
    points,
    pointGeometry,
    pointMaterial,
    positions,
    positionAttribute,
    velocities: Array.from({ length: particleCount }, () => new THREE.Vector3()),
    origin: new THREE.Vector3(),
    startedAt: 0,
    active: false,
  }
}

function MagnetAura() {
  const groupRef = useRef<THREE.Group>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    if (!groupRef.current) return

    const active = state.magnetActive || state.magnet2xActive
    groupRef.current.visible = active
    if (!active) return

    // Critical gameplay constant: existing magnet acquisition radius is 11.
    const magnetRadius = 11
    const speedPulse = 1 + Math.sin(performance.now() * 0.005) * 0.04
    const pulse = reducedRef.current
      ? speedPulse
      : speedPulse + Math.sin(performance.now() * 0.008) * 0.035

    groupRef.current.position.set(state.playerX, 0.045, PLAYER_Z)
    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh
      mesh.scale.setScalar(pulse * (1 - index * 0.035))
      mesh.rotation.z += delta * (index % 2 === 0 ? 0.12 : -0.09)
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = (reducedRef.current ? 0.05 : 0.075) * (1 - index * 0.14)
    })
    // The visible ring diameter maps directly to the verified 11-unit radius.
    void magnetRadius
  })

  return (
    <group ref={groupRef} visible={false}>
      {[1, 0.86, 0.72].map((scale, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
          <torusGeometry args={[11, 0.045, 8, 48]} />
          <meshBasicMaterial
            color={index === 0 ? '#ffe08a' : '#fff2be'}
            transparent
            opacity={0.06}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function CoinSystem() {
  const coinsRef = useRef<Coin[]>([])
  const nextIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const groupRef = useRef<THREE.Group>(null)
  const lastGameStateRef = useRef<string>('menu')
  const visualCoinsRef = useRef<Map<number, CoinVisualState>>(new Map())
  const burstPoolRef = useRef<CoinCollectionBurst[]>([])
  const burstCursorRef = useRef(0)
  const collectionTriggeredRef = useRef<Set<number>>(new Set())
  const magnetTrailsRef = useRef<THREE.LineSegments>(null)
  const bodyMeshRef = useRef<THREE.InstancedMesh>(null)
  const faceMeshRef = useRef<THREE.InstancedMesh>(null)
  const glintMeshRef = useRef<THREE.InstancedMesh>(null)
  const magnetGlowMeshRef = useRef<THREE.InstancedMesh>(null)

  const magnetTrailPositions = useMemo(() => new Float32Array(64 * 2 * 3), [])
  const magnetGlowGeometry = useMemo(
    () => new THREE.SphereGeometry(0.34, 8, 6),
    []
  )

  const coinBodyGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, 0.3, 0, Math.PI * 2, false)
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 24,
    })
    geometry.center()
    return geometry
  }, [])

  const coinFaceGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.205, 0.205, 0.012, 16),
    []
  )
  const coinGlintGeometry = useMemo(
    () => new THREE.PlaneGeometry(0.075, 0.34),
    []
  )

  const coinBodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#d8a92f',
      metalness: 0.9,
      roughness: 0.2,
      emissive: '#7b5200',
      emissiveIntensity: 0.12,
    }),
    []
  )
  const coinFaceMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#ffe08a',
      metalness: 0.82,
      roughness: 0.16,
      emissive: '#8e6100',
      emissiveIntensity: 0.16,
    }),
    []
  )
  const coinGlintMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#fff6d2',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  const magnetGlowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#ffe08a',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  useEffect(() => {
    if (!groupRef.current) return

    const pool = Array.from({ length: 6 }, () => {
      const burst = createCoinCollectionBurst(coinBodyGeometry)
      groupRef.current!.add(burst.group)
      return burst
    })
    burstPoolRef.current = pool

    return () => {
      pool.forEach((burst) => {
        groupRef.current?.remove(burst.group)
        burst.coinMaterial.dispose()
        burst.pointGeometry.dispose()
        burst.pointMaterial.dispose()
      })
      burstPoolRef.current = []
      collectionTriggeredRef.current.clear()
      coinBodyGeometry.dispose()
      coinFaceGeometry.dispose()
      coinGlintGeometry.dispose()
      magnetGlowGeometry.dispose()
      coinBodyMaterial.dispose()
      coinFaceMaterial.dispose()
      coinGlintMaterial.dispose()
      magnetGlowMaterial.dispose()
    }
  }, [
    coinBodyGeometry,
    coinFaceGeometry,
    coinGlintGeometry,
    coinBodyMaterial,
    coinFaceMaterial,
    coinGlintMaterial,
    magnetGlowGeometry,
    magnetGlowMaterial,
  ])

  const activateCollectionBurst = useCallback((x: number, y: number, z: number, magnetBoost = false) => {
    const pool = burstPoolRef.current
    if (!pool.length) return

    const startIndex = burstCursorRef.current % pool.length
    let burst = pool[startIndex]
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[(startIndex + i) % pool.length]
      if (!candidate.active) {
        burst = candidate
        break
      }
    }
    burstCursorRef.current = (startIndex + 1) % pool.length

    const now = performance.now()
    burst.active = true
    burst.startedAt = now
    burst.origin.set(x, y, z)
    burst.group.position.copy(burst.origin)
    burst.coinMaterial.opacity = magnetBoost ? 1.0 : 0.95
    burst.points.visible = true
    burst.coinMesh.visible = true

    burst.velocities.forEach((velocity, i) => {
      const angle = (Math.PI * 2 * i) / burst.velocities.length + (now % 1000) * 0.001
      const radial = (magnetBoost ? 1.12 : 0.9) + (i % 3) * (magnetBoost ? 0.25 : 0.22)
      velocity.set(
        Math.cos(angle) * radial,
        (magnetBoost ? 1.32 : 1.1) + (i % 4) * (magnetBoost ? 0.25 : 0.22),
        Math.sin(angle) * radial
      )
      const base = i * 3
      burst.positions[base] = 0
      burst.positions[base + 1] = 0.08
      burst.positions[base + 2] = 0
    })
    burst.positionAttribute.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    const state = getState()

    if (state.gameState === 'playing' && lastGameStateRef.current !== 'playing') {
      coinsRef.current = []
      spawnTimerRef.current = 0
      visualCoinsRef.current.clear()
      collectionTriggeredRef.current.clear()
      burstPoolRef.current.forEach((burst) => {
        burst.active = false
        burst.group.visible = false
      })
    }
    lastGameStateRef.current = state.gameState

    if (state.gameState !== 'playing') return

    const clampedDelta = Math.min(delta, 0.05)

    // Spawn coins
    spawnTimerRef.current -= clampedDelta
    if (spawnTimerRef.current <= 0) {
      spawnTimerRef.current = 0.8 + Math.random() * 0.5

      const lane = Math.floor(Math.random() * 3) - 1

      coinsRef.current.push({
        id: nextIdRef.current++,
        lane,
        x: lane * LANE_WIDTH,
        y: 1.2,
        z: -80 - Math.random() * 20,
        collected: false,
        magnetized: false,
      })
    }

    // Update coins
    const coins = coinsRef.current
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i]

      // Stop the attraction immediately when the magnet power-up ends.
      if (!state.magnetActive && coin.magnetized) {
        coin.magnetized = false
      }

      // Normal forward movement until the magnet grabs the coin.
      if (!coin.magnetized) {
        coin.z += (state.speed + 20) * clampedDelta * 0.5
      }

      // Remove if past player and not currently being pulled.
      if (!coin.magnetized && coin.z > 20) {
        coins.splice(i, 1)
        continue
      }

      // Magnetic attraction: visually pull nearby coins toward the motorcycle.
      if (!coin.collected && state.magnetActive && !coin.magnetized) {
        const dx = state.playerX - coin.x
        const dz = PLAYER_Z - coin.z
        const magnetDistance = Math.sqrt(dx * dx + dz * dz)

        if (magnetDistance < 11) {
          coin.magnetized = true
        }
      }

      if (!coin.collected && coin.magnetized) {
        const dx = state.playerX - coin.x
        const dy = 1.05 - coin.y
        const dz = PLAYER_Z - coin.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // Ease the coin rapidly toward the motorcycle, creating the
        // visible "magnet pull" effect instead of instant collection.
        const pull = 1 - Math.exp(-13 * clampedDelta)
        coin.x += dx * pull
        coin.y += dy * pull
        coin.z += dz * pull

        if (distance < 0.65) {
          coin.collected = true
          const coinsToAdd = state.magnet2xActive ? 2 : 1
          actions.addCoins(coinsToAdd)
          actions.addScore(50)
        }
      } else if (!coin.collected) {
        // Normal collection behavior when no magnet is active.
        const coinX = coin.lane * LANE_WIDTH
        const lateralDist = Math.abs(state.playerX - coinX)
        const longitudinalDist = Math.abs(coin.z - PLAYER_Z)

        if (lateralDist < 1.0 && longitudinalDist < 1.5) {
          coin.collected = true
          const coinsToAdd = state.magnet2xActive ? 2 : 1
          actions.addCoins(coinsToAdd)
          actions.addScore(50)
        }
      }
    }

    if (
      !groupRef.current ||
      !bodyMeshRef.current ||
      !faceMeshRef.current ||
      !glintMeshRef.current ||
      !magnetGlowMeshRef.current
    ) return

    const now = performance.now()
    const liveIds = new Set<number>()
    const dummy = new THREE.Object3D()
    const maxInstances = bodyMeshRef.current.count
    let instanceIndex = 0

    coins.forEach((coin) => {
      const visual = visualCoinsRef.current.get(coin.id)

      if (coin.collected) {
        // [GFX] Gameplay credit has already happened above. Start the visual
        // burst once, using the last rendered position; never predict collection.
        if (!collectionTriggeredRef.current.has(coin.id)) {
          collectionTriggeredRef.current.add(coin.id)
          const magnetBoost = state.magnetActive || state.magnet2xActive
          if (visual) {
            activateCollectionBurst(visual.x, visual.y, visual.z, magnetBoost)
            visualCoinsRef.current.delete(coin.id)
          } else {
            activateCollectionBurst(coin.x, coin.y, coin.z, magnetBoost)
          }
        }
        return
      }

      if (instanceIndex >= maxInstances) return

      const phase = visual?.phase ?? coin.id * 1.61803398875
      visualCoinsRef.current.set(coin.id, {
        x: coin.x,
        y: coin.y,
        z: coin.z,
        phase,
      })
      liveIds.add(coin.id)

      const rotationY = now * 0.0028 + phase
      const scale = 1 + Math.sin(now * 0.005 + phase) * 0.018

      dummy.position.set(coin.x, coin.y, coin.z)
      dummy.rotation.set(0, rotationY, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      bodyMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix)

      // Slightly lifted embossed face.
      dummy.position.set(coin.x, coin.y + 0.012, coin.z)
      dummy.rotation.set(0, rotationY, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      faceMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix)

      // Occasional moving glint sweep. The matrix is zero-scaled unless the
      // coin's phase is currently inside the brief glint window.
      const glintPhase = (Math.sin(now * 0.0016 + phase * 1.7) + 1) * 0.5
      const glintStrength = glintPhase > 0.965
        ? (glintPhase - 0.965) / 0.035
        : 0
      const magnetBoost = coin.magnetized
        ? 0.55 + Math.sin(now * 0.01 + phase) * 0.08
        : 0
      dummy.position.set(coin.x, coin.y + 0.055, coin.z)
      dummy.rotation.set(-Math.PI / 2, rotationY, glintStrength * Math.PI * 0.35)
      dummy.scale.set(
        (glintStrength * 0.9) + magnetBoost,
        (glintStrength * 0.9) + magnetBoost * 0.55,
        1
      )
      dummy.updateMatrix()
      glintMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix)

      // [GFX] Soft coin aura grows only after the existing logic has marked
      // the coin magnetized. It is a presentation layer, not attraction logic.
      const magnetGlowStrength = coin.magnetized
        ? 0.9 + Math.sin(now * 0.009 + phase) * 0.16
        : 0
      dummy.position.set(coin.x, coin.y, coin.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(magnetGlowStrength)
      dummy.updateMatrix()
      magnetGlowMeshRef.current.setMatrixAt(instanceIndex, dummy.matrix)

      instanceIndex++
    })

    // [GFX] Style the existing logical magnet pull. No coordinates are changed.
    let trailIndex = 0
    coins.forEach((coin) => {
      if (!coin.collected && coin.magnetized && trailIndex < 64) {
        const visual = visualCoinsRef.current.get(coin.id)
        if (visual) {
          const tx = state.playerX
          const tz = PLAYER_Z
          const alpha = THREE.MathUtils.clamp(
            1 - Math.sqrt((coin.x - tx) ** 2 + (coin.z - tz) ** 2) / 11,
            0.15,
            1
          )
          const tailX = coin.x + (tx - coin.x) * 0.32
          const tailZ = coin.z + (tz - coin.z) * 0.32
          const base = trailIndex * 6
          magnetTrailPositions[base] = coin.x
          magnetTrailPositions[base + 1] = coin.y + 0.02
          magnetTrailPositions[base + 2] = coin.z
          magnetTrailPositions[base + 3] = tailX
          magnetTrailPositions[base + 4] = coin.y + 0.02
          magnetTrailPositions[base + 5] = tailZ
          trailIndex++
          void alpha
        }
      }
    })
    if (magnetTrailsRef.current) {
      const geometry = magnetTrailsRef.current.geometry as THREE.BufferGeometry
      const position = geometry.getAttribute('position') as THREE.BufferAttribute
      const drawCount = trailIndex * 2
      for (let i = trailIndex; i < 64; i++) {
        const base = i * 6
        magnetTrailPositions[base] = 0
        magnetTrailPositions[base + 1] = -100
        magnetTrailPositions[base + 2] = 0
        magnetTrailPositions[base + 3] = 0
        magnetTrailPositions[base + 4] = -100
        magnetTrailPositions[base + 5] = 0
      }
      position.array.set(magnetTrailPositions)
      position.needsUpdate = true
      geometry.setDrawRange(0, drawCount)
    }

    visualCoinsRef.current.forEach((_, id) => {
      if (!liveIds.has(id)) {
        visualCoinsRef.current.delete(id)
      }
    })

    // Hide unused instanced slots by scaling them to zero.
    for (let i = instanceIndex; i < maxInstances; i++) {
      dummy.position.set(0, -100, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      bodyMeshRef.current.setMatrixAt(i, dummy.matrix)
      faceMeshRef.current.setMatrixAt(i, dummy.matrix)
      glintMeshRef.current.setMatrixAt(i, dummy.matrix)
      magnetGlowMeshRef.current.setMatrixAt(i, dummy.matrix)
    }

    bodyMeshRef.current.instanceMatrix.needsUpdate = true
    faceMeshRef.current.instanceMatrix.needsUpdate = true
    glintMeshRef.current.instanceMatrix.needsUpdate = true
    magnetGlowMeshRef.current.instanceMatrix.needsUpdate = true
    const magnetGlowMaterialRef = magnetGlowMeshRef.current.material as THREE.MeshBasicMaterial
    magnetGlowMaterialRef.opacity =
      state.magnetActive || state.magnet2xActive ? 0.14 : 0.0

    // Animate pooled collection bursts independently of the collection event.
    burstPoolRef.current.forEach((burst) => {
      if (!burst.active) return

      const t = Math.min((now - burst.startedAt) / 260, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const fade = 1 - t

      burst.group.visible = true
      burst.coinMesh.position.set(0, ease * 0.72, 0)
      burst.coinMesh.scale.setScalar((1 + Math.sin(t * Math.PI) * 0.42) * (1 - t * 0.12))
      burst.coinMaterial.opacity = fade * 0.95
      burst.coinMesh.rotation.y += delta * 18

      for (let i = 0; i < burst.velocities.length; i++) {
        const velocity = burst.velocities[i]
        const base = i * 3
        const px = velocity.x * t
        const py = velocity.y * t - 3.2 * t * t
        const pz = velocity.z * t
        burst.positions[base] = px
        burst.positions[base + 1] = 0.08 + py
        burst.positions[base + 2] = pz
      }
      burst.positionAttribute.needsUpdate = true
      burst.pointMaterial.opacity = fade * 0.78

      if (t >= 1) {
        burst.active = false
        burst.group.visible = false
        burst.coinMesh.visible = false
        burst.points.visible = false
      }
    })
  })

  useEffect(() => {
    if (!groupRef.current) return

    const bodyMesh = new THREE.InstancedMesh(
      coinBodyGeometry,
      coinBodyMaterial,
      64
    )
    bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    bodyMesh.frustumCulled = false

    const faceMesh = new THREE.InstancedMesh(
      coinFaceGeometry,
      coinFaceMaterial,
      64
    )
    faceMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    faceMesh.frustumCulled = false

    const glintMesh = new THREE.InstancedMesh(
      coinGlintGeometry,
      coinGlintMaterial,
      64
    )
    glintMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    glintMesh.frustumCulled = false

    const magnetGlowMesh = new THREE.InstancedMesh(
      magnetGlowGeometry,
      magnetGlowMaterial,
      64
    )
    magnetGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    magnetGlowMesh.frustumCulled = false

    bodyMeshRef.current = bodyMesh
    faceMeshRef.current = faceMesh
    glintMeshRef.current = glintMesh
    magnetGlowMeshRef.current = magnetGlowMesh

    const trailGeometry = new THREE.BufferGeometry()
    trailGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(magnetTrailPositions, 3)
    )
    const trailMaterial = new THREE.LineBasicMaterial({
      color: '#ffe9a6',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const trailLines = new THREE.LineSegments(trailGeometry, trailMaterial)
    trailLines.frustumCulled = false
    magnetTrailsRef.current = trailLines

    groupRef.current.add(bodyMesh, faceMesh, glintMesh, magnetGlowMesh, trailLines)

    return () => {
      groupRef.current?.remove(bodyMesh, faceMesh, glintMesh, magnetGlowMesh, trailLines)
      trailGeometry.dispose()
      trailMaterial.dispose()
      bodyMeshRef.current = null
      faceMeshRef.current = null
      glintMeshRef.current = null
      magnetGlowMeshRef.current = null
      magnetTrailsRef.current = null
    }
  }, [
    coinBodyGeometry,
    coinFaceGeometry,
    coinGlintGeometry,
    coinBodyMaterial,
    coinFaceMaterial,
    coinGlintMaterial,
    magnetGlowGeometry,
    magnetGlowMaterial,
    magnetTrailPositions,
  ])

  return <group ref={groupRef} />
}

function createCoinMesh(): THREE.Group {
  const group = new THREE.Group()
  
  // Legacy visual helper retained for rollback safety; the live renderer above
  // now uses the shared instanced coin meshes and pooled collection bursts.
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16)
  const coinMat = new THREE.MeshStandardMaterial({
    color: '#ffd700',
    metalness: 0.8,
    roughness: 0.2,
    emissive: '#ffa500',
    emissiveIntensity: 0.3,
  })
  const coin = new THREE.Mesh(coinGeo, coinMat)
  coin.rotation.x = Math.PI / 2
  group.add(coin)

  const innerGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.09, 16)
  const innerMat = new THREE.MeshStandardMaterial({
    color: '#ffed4a',
    metalness: 0.9,
    roughness: 0.1,
  })
  const inner = new THREE.Mesh(innerGeo, innerMat)
  inner.rotation.x = Math.PI / 2
  group.add(inner)

  const glowGeo = new THREE.SphereGeometry(0.4, 8, 8)
  const glowMat = new THREE.MeshBasicMaterial({
    color: '#ffd700',
    transparent: true,
    opacity: 0.15,
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  group.add(glow)

  return group
}

// ============== POWER-UP SYSTEM ==============
function PowerUpSystem() {
  const powerUpsRef = useRef<PowerUp[]>([])
  const nextIdRef = useRef(0)
  const magnetTimerRef = useRef(10)
  const multiplierTimerRef = useRef(18)
  const shieldTimerRef = useRef(35)
  const meshCacheRef = useRef<Map<number, THREE.Group>>(new Map())
  const groupRef = useRef<THREE.Group>(null)
  const lastGameStateRef = useRef<string>('menu')

  useFrame((_, delta) => {
    const state = getState()
    
    // Clear power-ups when game restarts
    if (state.gameState === 'playing' && lastGameStateRef.current !== 'playing') {
      powerUpsRef.current = []
      magnetTimerRef.current = 10
      multiplierTimerRef.current = 18
      shieldTimerRef.current = 35
    }
    lastGameStateRef.current = state.gameState
    
    if (state.gameState !== 'playing') return

    const speed = state.speed
    const playerX = state.playerX
    const clampedDelta = Math.min(delta, 0.05)

    // Tick power-up timers
    actions.tickPowerUps(clampedDelta)

    // Spawn magnet every 10 seconds
    magnetTimerRef.current -= clampedDelta
    if (magnetTimerRef.current <= 0) {
      magnetTimerRef.current = 10
      const lane = Math.floor(Math.random() * 3) - 1
      powerUpsRef.current.push({
        id: nextIdRef.current++,
        lane,
        z: -60,
        type: 'magnet',
        collected: false,
      })
    }

    // Spawn multiplier every 18 seconds
    multiplierTimerRef.current -= clampedDelta
    if (multiplierTimerRef.current <= 0) {
      multiplierTimerRef.current = 18
      const lane = Math.floor(Math.random() * 3) - 1
      powerUpsRef.current.push({
        id: nextIdRef.current++,
        lane,
        z: -60,
        type: 'multiplier',
        collected: false,
      })
    }

    // Spawn shield every 35 seconds
    shieldTimerRef.current -= clampedDelta
    if (shieldTimerRef.current <= 0) {
      shieldTimerRef.current = 35
      const lane = Math.floor(Math.random() * 3) - 1
      powerUpsRef.current.push({
        id: nextIdRef.current++,
        lane,
        z: -60,
        type: 'shield',
        collected: false,
      })
    }

    // Update power-ups
    const powerUps = powerUpsRef.current
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const powerUp = powerUps[i]
      powerUp.z += (speed + 20) * clampedDelta * 0.5

      // Remove if past player
      if (powerUp.z > 20) {
        powerUps.splice(i, 1)
        continue
      }

      // Collection detection
      if (!powerUp.collected) {
        const powerUpX = powerUp.lane * LANE_WIDTH
        const lateralDist = Math.abs(playerX - powerUpX)
        const longitudinalDist = Math.abs(powerUp.z - PLAYER_Z)

        if (lateralDist < 1.0 && longitudinalDist < 1.5) {
          powerUp.collected = true
          
          // Activate power-up
          if (powerUp.type === 'magnet') {
            actions.activateMagnet()
          } else if (powerUp.type === 'multiplier') {
            actions.activateMultiplier()
          } else if (powerUp.type === 'shield') {
            actions.activateShield()
          }
        }
      }
    }

    // Update meshes
    if (!groupRef.current) return
    const existingIds = new Set<number>()
    
    powerUps.forEach((powerUp) => {
      if (powerUp.collected) return
      existingIds.add(powerUp.id)
      
      let mesh = meshCacheRef.current.get(powerUp.id)
      if (!mesh) {
        mesh = createPowerUpMesh(powerUp.type)
        meshCacheRef.current.set(powerUp.id, mesh)
        groupRef.current!.add(mesh)
      }
      
      mesh.position.set(powerUp.lane * LANE_WIDTH, 1.5, powerUp.z)
      mesh.rotation.y += clampedDelta * 2
    })

    // Remove collected/old meshes
    meshCacheRef.current.forEach((mesh, id) => {
      if (!existingIds.has(id)) {
        groupRef.current!.remove(mesh)
        meshCacheRef.current.delete(id)
      }
    })
  })

  return <group ref={groupRef} />
}

function createPowerUpMesh(type: 'magnet' | 'multiplier' | 'shield'): THREE.Group {
  const group = new THREE.Group()
  
  if (type === 'magnet') {
    // Blue horseshoe magnet - BIGGER
    const magnetGeo = new THREE.TorusGeometry(0.6, 0.18, 8, 16, Math.PI)
    const magnetMat = new THREE.MeshStandardMaterial({ 
      color: '#3b82f6', 
      metalness: 0.7, 
      roughness: 0.3,
      emissive: '#1e40af',
      emissiveIntensity: 0.8,
    })
    const magnet = new THREE.Mesh(magnetGeo, magnetMat)
    magnet.rotation.x = Math.PI / 2
    group.add(magnet)
    
    // Red tips - BIGGER
    const tipGeo = new THREE.BoxGeometry(0.22, 0.38, 0.22)
    const tipMat = new THREE.MeshStandardMaterial({ 
      color: '#ef4444', 
      metalness: 0.6, 
      roughness: 0.4,
      emissive: '#dc2626',
      emissiveIntensity: 0.6,
    })
    const tip1 = new THREE.Mesh(tipGeo, tipMat)
    tip1.position.set(-0.6, 0, 0)
    group.add(tip1)
    const tip2 = new THREE.Mesh(tipGeo, tipMat)
    tip2.position.set(0.6, 0, 0)
    group.add(tip2)
    
    // Glow - BIGGER
    const glowGeo = new THREE.SphereGeometry(0.8, 8, 8)
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#3b82f6', 
      transparent: true, 
      opacity: 0.3,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)
  }
  
  else if (type === 'multiplier') {
    // Gold "2x" symbol - BIGGER
    const ringGeo = new THREE.TorusGeometry(0.6, 0.12, 8, 16)
    const ringMat = new THREE.MeshStandardMaterial({ 
      color: '#fbbf24', 
      metalness: 0.9, 
      roughness: 0.1,
      emissive: '#f59e0b',
      emissiveIntensity: 0.9,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    group.add(ring)
    
    // Inner star - BIGGER
    const starGeo = new THREE.OctahedronGeometry(0.38, 0)
    const starMat = new THREE.MeshStandardMaterial({ 
      color: '#fcd34d', 
      metalness: 0.8, 
      roughness: 0.2,
      emissive: '#fbbf24',
      emissiveIntensity: 0.8,
    })
    const star = new THREE.Mesh(starGeo, starMat)
    group.add(star)
    
    // Glow - BIGGER
    const glowGeo = new THREE.SphereGeometry(0.8, 8, 8)
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#fbbf24', 
      transparent: true, 
      opacity: 0.35,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)
  }
  
  else if (type === 'shield') {
    // Green shield - BIGGER
    const shieldGeo = new THREE.SphereGeometry(0.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    const shieldMat = new THREE.MeshStandardMaterial({ 
      color: '#10b981', 
      metalness: 0.6, 
      roughness: 0.3,
      emissive: '#059669',
      emissiveIntensity: 0.8,
      side: THREE.DoubleSide,
    })
    const shield = new THREE.Mesh(shieldGeo, shieldMat)
    group.add(shield)
    
    // Shield base - BIGGER
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16)
    const baseMat = new THREE.MeshStandardMaterial({ 
      color: '#059669', 
      metalness: 0.7, 
      roughness: 0.3,
      emissive: '#047857',
      emissiveIntensity: 0.6,
    })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -0.075
    group.add(base)
    
    // Glow - BIGGER
    const glowGeo = new THREE.SphereGeometry(0.8, 8, 8)
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#10b981', 
      transparent: true, 
      opacity: 0.3,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)
  }
  
  return group
}

// [GFX] Speed-feel helpers. All inputs are read-only visual signals.
// Reduce Effects is opt-in via a safe hs_gfx_* key; no game persistence is touched.
function areSpeedEffectsReduced() {
  try {
    const value = window.localStorage.getItem('hs_gfx_reduce_effects')
    return value === '1' || value === 'true' || value === 'on'
  } catch {
    return false
  }
}

function SpeedEdgeStreaks() {
  const groupRef = useRef<THREE.Group>(null)
  const streaksRef = useRef<Array<{ mesh: THREE.Mesh; side: -1 | 1; y: number; z: number; base: number }>>([])
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing' || !groupRef.current) return

    const reduced = reducedRef.current
    const normalized = THREE.MathUtils.clamp(state.speed / 120, 0, 1)
    const intensity = reduced ? normalized * 0.42 : normalized

    groupRef.current.children.forEach((child, i) => {
      const streak = streaksRef.current[i]
      if (!streak) return
      streak.z += (state.speed + 35) * delta * 0.65
      if (streak.z > 18) {
        streak.z = -75 - Math.random() * 45
        streak.base = 0.5 + Math.random() * 0.9
      }

      streak.mesh.position.set(
        streak.side * (7.8 + streak.base * 2.5),
        streak.y,
        streak.z
      )
      streak.mesh.scale.set(
        1,
        0.7 + intensity * 3.8,
        1
      )

      const material = streak.mesh.material as THREE.MeshBasicMaterial
      material.opacity = intensity * (0.06 + streak.base * 0.06)
      streak.mesh.visible = intensity > 0.03
    })
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: 28 }, (_, i) => {
        const side: -1 | 1 = i % 2 === 0 ? -1 : 1
        return (
          <mesh
            key={i}
            position={[side * (8 + (i % 7) * 0.36), 0.7 + ((i * 13) % 45) / 10, -10 - i * 2.2]}
          >
            <boxGeometry args={[0.018, 0.55, 0.018]} />
            <meshBasicMaterial
              color="#d8e4e8"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function SpeedVignette() {
  const materialRef = useRef<THREE.SpriteMaterial>(null)
  const reducedRef = useRef(false)

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create speed vignette')
    const gradient = ctx.createRadialGradient(64, 64, 30, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.67, 'rgba(14,20,24,0.01)')
    gradient.addColorStop(0.84, 'rgba(14,20,24,0.12)')
    gradient.addColorStop(1, 'rgba(8,12,16,0.58)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.minFilter = THREE.LinearFilter
    map.magFilter = THREE.LinearFilter
    map.needsUpdate = true
    return map
  }, [])

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
    return () => texture.dispose()
  }, [texture])

  useFrame(() => {
    const state = getState()
    if (!materialRef.current) return
    const normalized = THREE.MathUtils.clamp(state.speed / 120, 0, 1)
    materialRef.current.opacity = (reducedRef.current ? 0.035 : 0.065) * normalized
    materialRef.current.visible = state.gameState === 'playing' && normalized > 0.08
  })

  return (
    <sprite
      position={[0, 0, -3]}
      scale={[8.2, 8.2, 1]}
      material={useMemo(
        () => new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        }),
        [texture]
      )}
    />
  )
}

function NearMissSpeedEffect() {
  const groupRef = useRef<THREE.Group>(null)
  const lastNearMissRef = useRef(0)
  const effectRef = useRef(0)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    if (!groupRef.current) return

    if (state.nearMisses > lastNearMissRef.current) {
      lastNearMissRef.current = state.nearMisses
      effectRef.current = reducedRef.current ? 0.3 : 0.55
    }

    effectRef.current = Math.max(0, effectRef.current - delta * 2.6)
    groupRef.current.visible = effectRef.current > 0.01

    groupRef.current.children.forEach((child, i) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = effectRef.current * (i % 2 === 0 ? 0.2 : 0.13)
      ;(child as THREE.Mesh).scale.y = 1 + effectRef.current * 4.5
    })
  })

  return (
    <group ref={groupRef} position={[0, 2.3, PLAYER_Z - 9]} visible={false}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.2, 0, 0]}>
          <boxGeometry args={[0.035, 1.2, 0.035]} />
          <meshBasicMaterial color="#dfe8eb" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.03, 1.4, 0.03]} />
        <meshBasicMaterial color="#fff4cf" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ============== CAMERA ==============
function GameCamera() {
  const { camera } = useThree()
  const smoothPosRef = useRef(new THREE.Vector3(0, 4, PLAYER_Z + 8))
  const shakeRef = useRef(0)
  const fovRef = useRef(70)
  const lastNearMissRef = useRef(0)
  const nearMissKickRef = useRef(0)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    const playerX = state.playerX

    if (state.nearMisses > lastNearMissRef.current) {
      lastNearMissRef.current = state.nearMisses
      nearMissKickRef.current = reducedRef.current ? 0.6 : 1
    }
    nearMissKickRef.current = Math.max(0, nearMissKickRef.current - delta * 5.0)

    const speedNormalized = THREE.MathUtils.clamp(
      (state.speed - 25) / Math.max(1, (state.vehicleMode === 'car' ? state.selectedCar.maxSpeed : state.selectedBike.maxSpeed) - 25),
      0,
      1
    )
    const speedFov = (reducedRef.current ? 2.5 : 5.5) * speedNormalized
    const targetFov = 70 + speedFov + nearMissKickRef.current * (reducedRef.current ? 1.2 : 2.2)
    fovRef.current = THREE.MathUtils.lerp(fovRef.current, targetFov, 1 - Math.exp(-5 * delta))
    camera.fov = fovRef.current
    camera.updateProjectionMatrix()
    
    // Chase camera that follows player slightly
    const targetPos = new THREE.Vector3(
      playerX,
      3.2 + state.speed * 0.004,
      PLAYER_Z + 6.5 + state.speed * 0.008
    )

    smoothPosRef.current.lerp(targetPos, 3 * delta)
    
    // Screen shake effect
    let shakeX = 0, shakeY = 0
    if (shakeRef.current > 0) {
      shakeRef.current -= delta * 5
      const intensity = Math.min(shakeRef.current * 0.025, 0.006)
      shakeX = (Math.random() - 0.5) * intensity
      shakeY = (Math.random() - 0.5) * intensity
    }
    
    camera.position.set(
      smoothPosRef.current.x + shakeX,
      smoothPosRef.current.y + shakeY,
      smoothPosRef.current.z
    )
    camera.lookAt(playerX * 0.25, 0.8, PLAYER_Z - 25)
  })

  return null
}

// [GFX] Reusable roadside scenery. Repeats are instanced and intentionally
// placed outside the road corridor, while the parent inherits Highway recycling.
function RoadsideVisualInstances({ segmentOffsets }: { segmentOffsets: number[] }) {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    const root = groupRef.current
    if (!root) return

    const seed = (n: number) => {
      const value = Math.sin(n * 91.713 + 17.21) * 43758.5453
      return value - Math.floor(value)
    }

    type TreeInstance = {
      x: number
      z: number
      scale: number
      rotation: number
      variant: number
      tint: THREE.Color
    }

    const trees: TreeInstance[] = []
    const guardrailRails: Array<{ x: number; z: number }> = []
    const guardrailPosts: Array<{ x: number; z: number }> = []
    const lamps: Array<{ x: number; z: number; scale: number }> = []
    const signs: Array<{ x: number; z: number; scale: number }> = []
    const props: Array<{ x: number; z: number; rotation: number; scale: number }> = []

    segmentOffsets.forEach((segmentZ, i) => {
      // Zone weighting changes density/tint gradually along the route.
      const zone = 0.5 + 0.5 * Math.sin((segmentZ + 100) / 150)
      const near = i < 8
      const treeChance = near ? 0.82 : (zone > 0.55 ? 0.42 : 0.28)

      if (seed(i * 5 + 1) < treeChance) {
        trees.push({
          x: -(ROAD_WIDTH / 2 + 4.2 + seed(i * 5 + 2) * 2.4),
          z: segmentZ + (seed(i * 5 + 3) - 0.5) * 9,
          scale: 0.78 + seed(i * 5 + 4) * (0.45 + zone * 0.18),
          rotation: (seed(i * 5 + 5) - 0.5) * 0.2,
          variant: i % 3,
          tint: new THREE.Color(zone > 0.58 ? '#3f7d43' : '#356f43'),
        })
      }

      if (seed(i * 11 + 4) < treeChance * 0.88) {
        trees.push({
          x: ROAD_WIDTH / 2 + 4.2 + seed(i * 11 + 5) * 2.6,
          z: segmentZ + (seed(i * 11 + 6) - 0.5) * 9,
          scale: 0.75 + seed(i * 11 + 7) * (0.5 + zone * 0.16),
          rotation: (seed(i * 11 + 8) - 0.5) * 0.2,
          variant: (i + 1) % 3,
          tint: new THREE.Color(zone > 0.58 ? '#447f46' : '#386f45'),
        })
      }

      // Safety barriers occupy only the shoulder/outside corridor.
      if (i % 2 === 1 || i % 5 === 0) {
        const side = i % 4 === 1 ? -1 : 1
        const x = side * (ROAD_WIDTH / 2 + 1.8)
        const z = segmentZ + (side === -1 ? -4 : 4)
        guardrailRails.push({ x, z })
        guardrailPosts.push({ x, z: z - 1.8 })
        guardrailPosts.push({ x, z: z + 1.8 })
      }

      // Sparse lamps.
      if (i % 5 === 0) {
        const side = i % 10 === 0 ? -1 : 1
        lamps.push({
          x: side * (ROAD_WIDTH / 2 + 3.0),
          z: segmentZ + (side === -1 ? -5 : 5),
          scale: 0.9 + seed(i * 17 + 1) * 0.14,
        })
      }

      // Fictional signage/billboards only.
      if (i % 6 === 0) {
        const side = i % 12 === 0 ? -1 : 1
        signs.push({
          x: side * (ROAD_WIDTH / 2 + 4.2),
          z: segmentZ + 1.5,
          scale: 0.88 + seed(i * 13 + 2) * 0.2,
        })
      }

      // Small utility props.
      if (i % 3 === 0 && (near || zone > 0.44)) {
        const side = i % 2 === 0 ? -1 : 1
        props.push({
          x: side * (ROAD_WIDTH / 2 + 2.5),
          z: segmentZ + 4,
          rotation: (seed(i * 23 + 3) - 0.5) * 0.08,
          scale: 0.82 + seed(i * 23 + 4) * 0.2,
        })
      }
    })

    const dummy = new THREE.Object3D()

    // Shared tree geometry: three visibly different, low-poly variants.
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.22, 2.7, 6)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: '#3d2d24',
      roughness: 0.95,
      vertexColors: true,
    })
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
    trunkMesh.castShadow = true

    const canopyGeos = [
      new THREE.SphereGeometry(1.25, 8, 6),
      new THREE.ConeGeometry(1.35, 2.6, 8),
      new THREE.SphereGeometry(1.05, 7, 5),
    ]
    const canopyMats = [
      new THREE.MeshStandardMaterial({ color: '#3f7d43', roughness: 0.9, vertexColors: true }),
      new THREE.MeshStandardMaterial({ color: '#447e49', roughness: 0.9, vertexColors: true }),
      new THREE.MeshStandardMaterial({ color: '#356f43', roughness: 0.9, vertexColors: true }),
    ]
    const variantCounts = [0, 0, 0]
    trees.forEach((tree) => { variantCounts[tree.variant]++ })

    const canopyMeshes = canopyGeos.map((geo, idx) =>
      new THREE.InstancedMesh(geo, canopyMats[idx], variantCounts[idx])
    )

    const variantCounters = [0, 0, 0]
    trees.forEach((tree, index) => {
      dummy.position.set(tree.x, 1.35 * tree.scale, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.setScalar(tree.scale)
      dummy.updateMatrix()
      trunkMesh.setMatrixAt(index, dummy.matrix)
      trunkMesh.setColorAt(index, tree.tint.clone().lerp(new THREE.Color('#2f4a35'), 0.35))

      const canopyIndex = variantCounters[tree.variant]++
      const canopyY = tree.variant === 1 ? 3.25 * tree.scale : 3.0 * tree.scale
      const canopyMesh = canopyMeshes[tree.variant]
      dummy.position.set(tree.x, canopyY, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.setScalar(tree.scale)
      dummy.updateMatrix()
      canopyMesh.setMatrixAt(canopyIndex, dummy.matrix)
      canopyMesh.setColorAt(canopyIndex, tree.tint)
    })

    trunkMesh.instanceMatrix.needsUpdate = true
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true
    canopyMeshes.forEach((mesh) => {
      mesh.frustumCulled = false
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    trunkMesh.frustumCulled = false

    const railGeo = new THREE.BoxGeometry(0.12, 0.58, 4.4)
    const railMat = new THREE.MeshStandardMaterial({ color: '#aeb1b2', metalness: 0.58, roughness: 0.36 })
    const railMesh = new THREE.InstancedMesh(railGeo, railMat, guardrailRails.length)
    railMesh.castShadow = true
    railMesh.receiveShadow = true
    const postGeo = new THREE.BoxGeometry(0.18, 0.56, 0.18)
    const postMat = new THREE.MeshStandardMaterial({ color: '#656b6f', metalness: 0.45, roughness: 0.5 })
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, guardrailPosts.length)
    postMesh.castShadow = true
    postMesh.receiveShadow = true

    guardrailRails.forEach((item, idx) => {
      dummy.position.set(item.x, 0.52, item.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      railMesh.setMatrixAt(idx, dummy.matrix)
    })
    guardrailPosts.forEach((item, idx) => {
      dummy.position.set(item.x, 0.28, item.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      postMesh.setMatrixAt(idx, dummy.matrix)
    })
    railMesh.instanceMatrix.needsUpdate = true
    postMesh.instanceMatrix.needsUpdate = true
    railMesh.frustumCulled = false
    postMesh.frustumCulled = false

    const poleGeo = new THREE.CylinderGeometry(0.045, 0.07, 6.2, 6)
    const poleMat = new THREE.MeshStandardMaterial({ color: '#62686c', metalness: 0.7, roughness: 0.28 })
    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length)
    poleMesh.castShadow = true
    const lampGeo = new THREE.SphereGeometry(0.12, 7, 6)
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fff6d5',
      emissive: '#ffe8a6',
      emissiveIntensity: 0.7,
      roughness: 0.32,
    })
    const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length)

    lamps.forEach((item, idx) => {
      dummy.position.set(item.x, 3.1 * item.scale, item.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      poleMesh.setMatrixAt(idx, dummy.matrix)

      dummy.position.set(
        item.x + (item.x > 0 ? -0.35 : 0.35) * item.scale,
        6.05 * item.scale,
        item.z
      )
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      lampMesh.setMatrixAt(idx, dummy.matrix)
    })
    poleMesh.instanceMatrix.needsUpdate = true
    lampMesh.instanceMatrix.needsUpdate = true
    poleMesh.frustumCulled = false
    lampMesh.frustumCulled = false

    const makeBillboardTexture = (headline: string, subline: string, fill: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 112
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Unable to create billboard texture')
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 25px Arial'
      ctx.fillText(headline, 16, 42)
      ctx.font = '700 14px Arial'
      ctx.fillStyle = '#d9e1e5'
      ctx.fillText(subline, 16, 70)
      ctx.fillStyle = '#f7c84a'
      ctx.fillRect(16, 86, 92, 5)

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.needsUpdate = true
      return texture
    }

    const boardTextures = [
      makeBillboardTexture('HIGHWAY SPEEDSTER', 'RIDE SMART. GO FAR.', '#24313a'),
      makeBillboardTexture('DRIVE SMART', 'ENJOY THE OPEN ROAD.', '#3d5847'),
    ]

    const boardGeo = new THREE.PlaneGeometry(2.9, 1.27)
    const boardMeshes = boardTextures.map((texture) => {
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.56,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
      return new THREE.InstancedMesh(
        boardGeo,
        material,
        Math.max(1, Math.ceil(signs.length / 2))
      )
    })

    const boardPostGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.9, 6)
    const boardPostMat = new THREE.MeshStandardMaterial({
      color: '#5e6469',
      metalness: 0.62,
      roughness: 0.34,
    })
    const boardPosts = new THREE.InstancedMesh(boardPostGeo, boardPostMat, signs.length)

    signs.forEach((item, idx) => {
      dummy.position.set(item.x, 2.55 * item.scale, item.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      boardMeshes[idx % 2].setMatrixAt(Math.floor(idx / 2), dummy.matrix)

      dummy.position.set(item.x, 1.35 * item.scale, item.z)
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      boardPosts.setMatrixAt(idx, dummy.matrix)
    })
    boardMeshes.forEach((mesh) => {
      mesh.frustumCulled = false
      mesh.instanceMatrix.needsUpdate = true
    })
    boardPosts.frustumCulled = false
    boardPosts.instanceMatrix.needsUpdate = true

    const propGeo = new THREE.BoxGeometry(0.7, 1.1, 0.52)
    const propMat = new THREE.MeshStandardMaterial({
      color: '#6d726e',
      metalness: 0.28,
      roughness: 0.72,
    })
    const propMesh = new THREE.InstancedMesh(propGeo, propMat, props.length)
    propMesh.castShadow = true
    propMesh.receiveShadow = true
    props.forEach((item, idx) => {
      dummy.position.set(item.x, 0.56 * item.scale, item.z)
      dummy.rotation.set(0, item.rotation, 0)
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      propMesh.setMatrixAt(idx, dummy.matrix)
    })
    propMesh.frustumCulled = false
    propMesh.instanceMatrix.needsUpdate = true

    root.add(
      trunkMesh,
      ...canopyMeshes,
      railMesh,
      postMesh,
      poleMesh,
      lampMesh,
      ...boardMeshes,
      boardPosts,
      propMesh
    )

    return () => {
      root.remove(
        trunkMesh,
        ...canopyMeshes,
        railMesh,
        postMesh,
        poleMesh,
        lampMesh,
        ...boardMeshes,
        boardPosts,
        propMesh
      )

      trunkGeo.dispose()
      trunkMat.dispose()
      canopyGeos.forEach((geo) => geo.dispose())
      canopyMats.forEach((mat) => mat.dispose())

      railGeo.dispose()
      railMat.dispose()
      postGeo.dispose()
      postMat.dispose()

      poleGeo.dispose()
      poleMat.dispose()
      lampGeo.dispose()
      lampMat.dispose()

      boardGeo.dispose()
      boardTextures.forEach((texture) => texture.dispose())
      boardMeshes.forEach((mesh) => (mesh.material as THREE.Material).dispose())
      boardPostGeo.dispose()
      boardPostMat.dispose()

      propGeo.dispose()
      propMat.dispose()
    }
  }, [segmentOffsets])

  return <group ref={groupRef} />
}

// ============== ENVIRONMENT ==============
// Reusable low-poly environment pieces keep the scene populated while
// avoiding large numbers of unique models or external texture downloads.
function RoadsideBarrier({ side, z }: { side: 1 | -1; z: number }) {
  const x = side * (ROAD_WIDTH / 2 + 1.65)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[0.16, 0.7, 3.8]} />
        <meshStandardMaterial color="#777b7f" metalness={0.55} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <boxGeometry args={[0.12, 0.12, 3.9]} />
        <meshStandardMaterial color="#c7c9ca" metalness={0.68} roughness={0.28} />
      </mesh>
      {[-1, 1].map((post) => (
        <mesh key={post} position={[0, 0.28, post * 1.72]}>
          <boxGeometry args={[0.2, 0.55, 0.18]} />
          <meshStandardMaterial color="#5f6366" metalness={0.48} roughness={0.45} />
        </mesh>
      ))}
    </group>
  )
}

function RoadsideSign({ side, z, variant }: { side: 1 | -1; z: number; variant: number }) {
  const x = side * (ROAD_WIDTH / 2 + 2.9)
  const signScale = 0.92 + (variant % 3) * 0.06
  return (
    <group position={[x, 0, z]} scale={signScale}>
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.035, 0.055, 2.7, 7]} />
        <meshStandardMaterial color="#5e6469" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[1.0, 0.62, 0.08]} />
        <meshStandardMaterial
          color={variant % 2 === 0 ? '#2f5870' : '#556b55'}
          metalness={0.18}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0, 2.45, -0.045]}>
        <boxGeometry args={[0.78, 0.035, 0.02]} />
        <meshBasicMaterial color="#e8ecef" transparent opacity={0.72} />
      </mesh>
    </group>
  )
}

function RoadsideUtilityCabinet({ side, z }: { side: 1 | -1; z: number }) {
  const x = side * (ROAD_WIDTH / 2 + 2.45)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.65, 1.05, 0.5]} />
        <meshStandardMaterial color="#6b716d" metalness={0.32} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.78, side * -0.28]}>
        <boxGeometry args={[0.42, 0.18, 0.025]} />
        <meshStandardMaterial color="#8f9798" metalness={0.18} roughness={0.52} />
      </mesh>
    </group>
  )
}

function DistantBuilding({ position, variant }: {
  position: [number, number, number]
  variant: number
}) {
  const width = 8 + (variant % 3) * 2
  const height = 7 + (variant % 4) * 2
  const depth = 5 + (variant % 2) * 2
  const bodyColor = variant % 2 === 0 ? '#71818a' : '#7f887f'

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} metalness={0.06} />
      </mesh>
      {[-1, 0, 1].map((row) =>
        [-1, 1].map((col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              col * (width * 0.22),
              height * 0.28 + (row + 1) * height * 0.19,
              -depth / 2 - 0.01,
            ]}
          >
            <boxGeometry args={[width * 0.16, height * 0.09, 0.025]} />
            <meshStandardMaterial
              color="#a9b6bb"
              emissive="#8ea3ac"
              emissiveIntensity={0.08}
              roughness={0.45}
              metalness={0.1}
            />
          </mesh>
        ))
      )}
      <mesh position={[0, height + 0.5, 0]}>
        <boxGeometry args={[width * 0.58, 0.35, depth * 0.68]} />
        <meshStandardMaterial color="#59656a" roughness={0.74} metalness={0.08} />
      </mesh>
    </group>
  )
}

function DistantTower({ position, variant }: {
  position: [number, number, number]
  variant: number
}) {
  const height = 18 + (variant % 3) * 5
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[4.5, height, 4.5]} />
        <meshStandardMaterial color="#67747c" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, height + 0.9, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 1.8, 7]} />
        <meshStandardMaterial color="#78858c" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  )
}

function TerrainMound({ position, scale }: {
  position: [number, number, number]
  scale: [number, number, number]
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshStandardMaterial color="#537052" roughness={1} />
    </mesh>
  )
}

function Environment() {
  const roadsideBuildings = useMemo(
    () => [
      { position: [-30, 0, -95] as [number, number, number], variant: 0 },
      { position: [31, 0, -118] as [number, number, number], variant: 1 },
      { position: [-39, 0, -148] as [number, number, number], variant: 2 },
      { position: [40, 0, -168] as [number, number, number], variant: 3 },
      { position: [-47, 0, -210] as [number, number, number], variant: 4 },
      { position: [48, 0, -232] as [number, number, number], variant: 5 },
    ],
    []
  )

  const towers = useMemo(
    () => [
      { position: [-72, 0, -245] as [number, number, number], variant: 0 },
      { position: [74, 0, -285] as [number, number, number], variant: 1 },
      { position: [-88, 0, -330] as [number, number, number], variant: 2 },
    ],
    []
  )

  const mounds = useMemo(
    () => [
      { position: [-32, 1.8, -92] as [number, number, number], scale: [10, 2.2, 15] as [number, number, number] },
      { position: [35, 1.5, -125] as [number, number, number], scale: [14, 1.8, 18] as [number, number, number] },
      { position: [-47, 2.2, -175] as [number, number, number], scale: [18, 2.5, 22] as [number, number, number] },
      { position: [52, 2.5, -225] as [number, number, number], scale: [22, 2.8, 28] as [number, number, number] },
    ],
    []
  )

  return (
    <>
      {/* Sky dome */}
      <mesh>
        <sphereGeometry args={[450, 16, 16]} />
        <meshBasicMaterial color="#6bb3d9" side={THREE.BackSide} />
      </mesh>

      {/* Sun glow */}
      <mesh position={[40, 70, -250]}>
        <sphereGeometry args={[20, 12, 12]} />
        <meshBasicMaterial color="#fff8dc" />
      </mesh>
      <mesh position={[40, 70, -250]}>
        <sphereGeometry args={[35, 12, 12]} />
        <meshBasicMaterial color="#fff8dc" transparent opacity={0.15} />
      </mesh>

      {/* Broad terrain base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -150]} receiveShadow>
        <planeGeometry args={[300, 800]} />
        <meshStandardMaterial color="#5a8a4a" roughness={1} />
      </mesh>

      {/* Layered terrain close to and beyond the road */}
      {mounds.map((mound, i) => (
        <TerrainMound
          key={i}
          position={mound.position}
          scale={mound.scale}
        />
      ))}

      {/* Existing distant hills, retained as the far silhouette */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -150 + i * 28 + (Math.sin(i * 2.5) * 10)
        const height = 12 + Math.sin(i * 1.7) * 8
        return (
          <mesh key={`hill-${i}`} position={[x, height * 0.4, -300]}>
            <coneGeometry args={[height * 0.8, height, 4]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#4a6741' : '#5a7a51'} roughness={1} />
          </mesh>
        )
      })}

      {/* Mid/far structures establish a believable settlement horizon */}
      {roadsideBuildings.map((building, i) => (
        <DistantBuilding key={`building-${i}`} {...building} />
      ))}
      {towers.map((tower, i) => (
        <DistantTower key={`tower-${i}`} {...tower} />
      ))}

      {/* [GFX] One-key lighting rig with hemisphere fill and tight player shadow map. */}
      <LightingRig />

      {/* Layered atmospheric depth: near detail stays crisp while distant
          structures merge naturally into the horizon. */}
      <fog attach="fog" args={['#a9c1cf', 34, 165]} />
    </>
  )
}

// ============== SPEED LINES ==============
function SpeedLines() {
  const linesRef = useRef<THREE.Group>(null)
  const linesDataRef = useRef<Array<{ x: number; y: number; z: number; speed: number; edge: number }>>([])
  const reducedRef = useRef(false)

  useEffect(() => {
    const data = []
    for (let i = 0; i < 42; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const edge = Math.random()
      data.push({
        x: side * (3.9 + edge * 4.8),
        y: Math.random() * 5 + 1,
        z: -Math.random() * 90,
        speed: 35 + Math.random() * 45,
        edge,
      })
    }
    linesDataRef.current = data
    reducedRef.current = areSpeedEffectsReduced()
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing' || !linesRef.current) return

    const normalized = THREE.MathUtils.clamp(
      (state.speed - 25) /
      Math.max(
        1,
        (state.vehicleMode === 'car' ? state.selectedCar.maxSpeed : state.selectedBike.maxSpeed) - 25
      ),
      0,
      1
    )
    const intensity = reducedRef.current ? normalized * 0.42 : normalized

    linesRef.current.children.forEach((child, i) => {
      const line = linesDataRef.current[i]
      if (!line) return

      line.z += (state.speed + line.speed) * delta * 0.5
      if (line.z > 15) {
        line.z = -85 - Math.random() * 40
        const side = line.x < 0 ? -1 : 1
        line.x = side * (3.9 + Math.random() * 4.8)
      }

      const mesh = child as THREE.Mesh
      mesh.position.set(line.x, line.y, line.z)
      mesh.scale.set(
        1,
        (0.55 + line.edge * 0.35) * (1 + intensity * 3.6),
        1
      )
      mesh.visible = intensity > 0.08

      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = intensity * (0.045 + line.edge * 0.05)
    })
  })

  return (
    <group ref={linesRef}>
      {Array.from({ length: 42 }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.015, 0.4, 0.015]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}


// ============== MAIN SCENE ==============
export function GameScene() {
  const selectedBike = useGameStore((s) => s.selectedBike)
  const selectedCar = useGameStore((s) => s.selectedCar)

  return (
    <Canvas
      camera={{ position: [0, 4, PLAYER_Z + 8], fov: 70, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
    >
      <Environment />
      <Highway />
      <Motorcycle bike={selectedBike} car={selectedCar} />
      <TrafficSystem />
      <CoinSystem />
      <PowerUpSystem />
      <SpeedLines />
      <SpeedEdgeStreaks />
      <SpeedVignette />
      <NearMissSpeedEffect />
      <GameCamera />
    </Canvas>
  )
}
