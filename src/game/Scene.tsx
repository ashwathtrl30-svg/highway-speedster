import { useRef, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getState, actions, useGameStore, type Bike, type Car } from './store'
import { sweptSegmentOverlapsRange } from './collision'

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

      const value = Math.max(36, Math.min(98, Math.round(64 + periodic - tireWear + patches)))
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
        const roadTint = new THREE.Color('#3a4144').lerp(
          new THREE.Color('#424b47'),
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
        intensity={0.96}
      />
      <ambientLight intensity={0.25} color="#f0e9dc" />
      <directionalLight
        ref={keyRef}
        position={[18, 28, PLAYER_Z + 18]}
        color="#ffd9ad"
        intensity={1.82}
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
const shellVS = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const shellFS = `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.2);
  float wave = 0.5 + 0.5 * sin(vWorldPosition.y * 7.0 + atan(vWorldPosition.z, vWorldPosition.x) * 3.0 - uTime * 3.2);
  float alpha = uOpacity * (0.055 + fresnel * 0.42 + wave * 0.045);
  vec3 color = uColor * (0.72 + fresnel * 1.45 + wave * 0.18);
  gl_FragColor = vec4(color, alpha);
}
`

const innerVS = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const innerFS = `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 3.0);
  float shimmer = 0.5 + 0.5 * sin(vWorldPosition.x * 5.0 - vWorldPosition.z * 4.0 + uTime * 2.4);
  float alpha = uOpacity * (0.018 + rim * 0.18 + shimmer * 0.018);
  gl_FragColor = vec4(uColor * (0.8 + rim * 1.2), alpha);
}
`

function ShieldBubble({ vehicleMode }: { vehicleMode: 'bike' | 'car' }) {
  const bubbleRef = useRef<THREE.Group>(null)
  const radius = vehicleMode === 'car' ? 1.48 : 0.96

  useFrame((_, delta) => {
    if (!bubbleRef.current) return
    bubbleRef.current.rotation.y += delta * 0.2
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.02
    bubbleRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={bubbleRef} position={[0, 0.95, 0]}>
      <mesh>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshStandardMaterial
          color="#168cff"
          emissive="#0077ff"
          emissiveIntensity={0.65}
          transparent
          opacity={0.12}
          depthWrite={false}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      <mesh scale={1.015}>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshBasicMaterial
          color="#39a7ff"
          transparent
          opacity={0.2}
          wireframe
          depthWrite={false}
        />
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

    wheelSpinRef.current += state.speed * delta * 0.3

    if (meshRef.current) {
      meshRef.current.position.x = currentXRef.current
      meshRef.current.rotation.z = tiltRef.current
      meshRef.current.rotation.y = -tiltRef.current * 0.3
      meshRef.current.position.y = Math.sin(wheelSpinRef.current * 2) * 0.02 * (state.speed / 100)

      if (visualRef.current) {
        const speedNorm = THREE.MathUtils.clamp(state.speed / 100, 0, 1)
        visualRef.current.rotation.z = tiltRef.current * 0.14
        visualRef.current.rotation.y = -tiltRef.current * 0.05
        visualRef.current.position.y =
          Math.sin(wheelSpinRef.current * 1.4) * 0.008 * speedNorm
        visualRef.current.scale.y = 1 - speedNorm * 0.018

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
        <VehicleLightingAccents vehicleMode={vehicleMode} />
        {shieldActive && <ShieldBubble vehicleMode={vehicleMode} />}
      </group>
    </group>
  )
}

// ============== FUTURISTIC RIDER ==============
function RiderSegment({
  start,
  end,
  radius,
  color,
  metalness = 0.35,
  roughness = 0.5,
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
  metalness?: number
  roughness?: number
}) {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  const direction = new THREE.Vector3().subVectors(b, a)
  const length = direction.length()
  const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  )

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.92, radius, length, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

function FuturisticRider({
  position,
  scale = 0.70,
  elbowX = 0.19,
  elbowY = 0.28,
  handX = 0.20,
  handY = -0.04,
  handZ = -0.82,
  shoulderY = 0.55,
  hipY = 0.13,
  kneeY = -0.10,
  ankleY = -0.31,
  ankleZ = 0.06,
  torsoRotationX = -0.30,
}: {
  position: [number, number, number]
  scale?: number
  elbowX?: number
  elbowY?: number
  handX?: number
  handY?: number
  handZ?: number
  shoulderY?: number
  hipY?: number
  kneeY?: number
  ankleY?: number
  ankleZ?: number
  torsoRotationX?: number
}) {
  const suit = '#20252a'
  const suitEdge = '#0f1317'
  const red = '#e33a32'
  const redDeep = '#a91f1b'
  const white = '#e8edf0'
  const visor = '#071017'

  return (
    <group position={position} scale={scale}>
      {/* Same supplied visual language: black/red/white suit, full dark helmet,
          compact forward tuck and pronounced bent legs. */}
      <mesh position={[0, 0.36, -0.05]} rotation={[torsoRotationX, 0, 0]}>
        <boxGeometry args={[0.38, 0.50, 0.30]} />
        <meshStandardMaterial color={suit} metalness={0.38} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.52, -0.15]} rotation={[torsoRotationX, 0, 0]}>
        <boxGeometry args={[0.24, 0.14, 0.035]} />
        <meshStandardMaterial color={red} metalness={0.45} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.42, -0.20]} rotation={[torsoRotationX, 0, 0]}>
        <boxGeometry args={[0.27, 0.055, 0.028]} />
        <meshStandardMaterial color={white} metalness={0.25} roughness={0.48} />
      </mesh>

      {/* Helmet shell, red perimeter and dark visor. */}
      <mesh position={[0, 0.82, -0.25]} scale={[1.0, 1.07, 1.10]}>
        <sphereGeometry args={[0.19, 14, 10]} />
        <meshStandardMaterial color="#252b31" metalness={0.62} roughness={0.20} />
      </mesh>
      <mesh
        position={[0, 0.82, -0.25]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1.0, 0.88, 1.0]}
      >
        <torusGeometry args={[0.155, 0.026, 8, 16]} />
        <meshStandardMaterial color={red} metalness={0.55} roughness={0.20} />
      </mesh>
      <mesh position={[0, 0.79, -0.43]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[0.20, 0.105, 0.04]} />
        <meshStandardMaterial color={visor} metalness={0.82} roughness={0.10} />
      </mesh>

      {/* Arms: shoulder armor, dropped elbows and hands at the bars. */}
      <mesh position={[-0.17, shoulderY, -0.08]} scale={[1.10, 0.85, 0.95]}>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial color={red} metalness={0.42} roughness={0.30} />
      </mesh>
      <mesh position={[0.17, shoulderY, -0.08]} scale={[1.10, 0.85, 0.95]}>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial color={red} metalness={0.42} roughness={0.30} />
      </mesh>
      <RiderSegment start={[-0.16, shoulderY - 0.02, -0.07]} end={[-elbowX, elbowY, -0.34]} radius={0.075} color={suit} />
      <RiderSegment start={[-elbowX, elbowY, -0.34]} end={[-handX, handY, handZ]} radius={0.065} color={suit} />
      <RiderSegment start={[0.16, shoulderY - 0.02, -0.07]} end={[elbowX, elbowY, -0.34]} radius={0.075} color={suit} />
      <RiderSegment start={[elbowX, elbowY, -0.34]} end={[handX, handY, handZ]} radius={0.065} color={suit} />

      {/* White/red suit accents and gloves. */}
      <mesh position={[-elbowX, 0.38, -0.22]} rotation={[0.1, 0, -0.04]}>
        <boxGeometry args={[0.18, 0.052, 0.035]} />
        <meshStandardMaterial color={white} metalness={0.22} roughness={0.45} />
      </mesh>
      <mesh position={[elbowX, 0.38, -0.22]} rotation={[0.1, 0, 0.04]}>
        <boxGeometry args={[0.18, 0.052, 0.035]} />
        <meshStandardMaterial color={white} metalness={0.22} roughness={0.45} />
      </mesh>
      <mesh position={[-handX, handY, handZ - 0.01]}>
        <sphereGeometry args={[0.072, 9, 7]} />
        <meshStandardMaterial color={suitEdge} metalness={0.18} roughness={0.70} />
      </mesh>
      <mesh position={[handX, handY, handZ - 0.01]}>
        <sphereGeometry args={[0.072, 9, 7]} />
        <meshStandardMaterial color={suitEdge} metalness={0.18} roughness={0.70} />
      </mesh>

      {/* Legs deliberately form hip -> forward knee -> rear ankle: ">" from side view. */}
      <RiderSegment start={[-0.14, hipY, 0.08]} end={[-0.15, kneeY, -0.34]} radius={0.092} color={suit} metalness={0.32} roughness={0.46} />
      <RiderSegment start={[-0.15, kneeY, -0.34]} end={[-0.15, ankleY, ankleZ]} radius={0.078} color={suit} metalness={0.30} roughness={0.48} />
      <RiderSegment start={[0.14, hipY, 0.08]} end={[0.15, kneeY, -0.34]} radius={0.092} color={suit} metalness={0.32} roughness={0.46} />
      <RiderSegment start={[0.15, kneeY, -0.34]} end={[0.15, ankleY, ankleZ]} radius={0.078} color={suit} metalness={0.30} roughness={0.48} />

      {/* Knee armor, bright shin bands and boots. */}
      <mesh position={[-0.15, kneeY, -0.34]} scale={[1.0, 1.0, 1.12]}>
        <sphereGeometry args={[0.095, 10, 8]} />
        <meshStandardMaterial color={redDeep} metalness={0.45} roughness={0.30} />
      </mesh>
      <mesh position={[0.15, kneeY, -0.34]} scale={[1.0, 1.0, 1.12]}>
        <sphereGeometry args={[0.095, 10, 8]} />
        <meshStandardMaterial color={redDeep} metalness={0.45} roughness={0.30} />
      </mesh>
      <mesh position={[-0.15, -0.23, -0.16]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.13, 0.045, 0.035]} />
        <meshStandardMaterial color={white} metalness={0.24} roughness={0.45} />
      </mesh>
      <mesh position={[0.15, -0.23, -0.16]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.13, 0.045, 0.035]} />
        <meshStandardMaterial color={white} metalness={0.24} roughness={0.45} />
      </mesh>
      <mesh position={[-0.15, ankleY - 0.06, ankleZ]}>
        <boxGeometry args={[0.14, 0.16, 0.28]} />
        <meshStandardMaterial color={suitEdge} metalness={0.30} roughness={0.54} />
      </mesh>
      <mesh position={[0.15, ankleY - 0.06, ankleZ]}>
        <boxGeometry args={[0.14, 0.16, 0.28]} />
        <meshStandardMaterial color={suitEdge} metalness={0.30} roughness={0.54} />
      </mesh>
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

      {/* Supplied futuristic rider reference, scaled down to fit this bike. */}
      <FuturisticRider position={[0, 1.02, 0.12]} scale={0.70} />
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

      {/* Supplied futuristic rider reference, scaled down to fit this bike. */}
      <FuturisticRider position={[0, 1.05, 0.15]} scale={0.70} />
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

      {/* Handlebar - clearly visible split clip-ons */}
      <mesh position={[0, 0.90, -0.69]}>
        <boxGeometry args={[0.18, 0.055, 0.12]} />
        <meshStandardMaterial color="#666a6d" metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh position={[-0.20, 0.90, -0.70]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.22, 8]} />
        <meshStandardMaterial color="#3d4145" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[0.20, 0.90, -0.70]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.22, 8]} />
        <meshStandardMaterial color="#3d4145" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[-0.33, 0.90, -0.71]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
        <meshStandardMaterial color="#111315" roughness={0.92} />
      </mesh>
      <mesh position={[0.33, 0.90, -0.71]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.16, 8]} />
        <meshStandardMaterial color="#111315" roughness={0.92} />
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

      {/* Supplied futuristic rider reference, scaled down to fit this bike. */}
      <FuturisticRider position={[0, 0.98, 0.1]} scale={0.70} />
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

      {/* Racing cockpit - visible split clip-ons, steering stem and controls */}
      <mesh position={[0, 0.91, -0.58]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[0.2, 0.055, 0.12]} />
        <meshStandardMaterial color="#55585b" metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.96, -0.53]}>
        <cylinderGeometry args={[0.035, 0.045, 0.16, 10]} />
        <meshStandardMaterial color="#777b80" metalness={0.96} roughness={0.1} />
      </mesh>
      <mesh position={[-0.22, 0.94, -0.56]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.28, 10]} />
        <meshStandardMaterial color="#3e4144" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[0.22, 0.94, -0.56]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.28, 10]} />
        <meshStandardMaterial color="#3e4144" metalness={0.92} roughness={0.16} />
      </mesh>
      <mesh position={[-0.38, 0.95, -0.54]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.043, 0.043, 0.16, 10]} />
        <meshStandardMaterial color="#101113" roughness={0.92} />
      </mesh>
      <mesh position={[0.38, 0.95, -0.54]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.043, 0.043, 0.16, 10]} />
        <meshStandardMaterial color="#101113" roughness={0.92} />
      </mesh>
      {/* Brake/clutch control levers */}
      <mesh position={[-0.31, 0.93, -0.55]} rotation={[0.18, 0, -0.18]}>
        <boxGeometry args={[0.035, 0.018, 0.17]} />
        <meshStandardMaterial color="#aeb3b7" metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh position={[0.31, 0.93, -0.55]} rotation={[0.18, 0, 0.18]}>
        <boxGeometry args={[0.035, 0.018, 0.17]} />
        <meshStandardMaterial color="#aeb3b7" metalness={0.95} roughness={0.12} />
      </mesh>
      {/* Cockpit mirrors */}
      <mesh position={[-0.32, 1.02, -0.57]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color="#202326" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.32, 1.02, -0.57]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshStandardMaterial color="#202326" metalness={0.85} roughness={0.2} />
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

      {/* Supplied futuristic rider reference, scaled down to fit this bike. */}
      <FuturisticRider
        position={[0, 0.98, 0.10]}
        scale={0.90}
        elbowX={0.20}
        elbowY={0.13}
        handX={0.39}
        handY={-0.03}
        handZ={-0.55}
        shoulderY={0.42}
        hipY={0.10}
        kneeY={-0.02}
        ankleY={-0.16}
        ankleZ={0.26}
        torsoRotationX={-0.40}
      />
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

      {/* Hyperbike cockpit - forged top clamp with split clip-ons and racing controls */}
      <mesh position={[0, 0.9, -0.62]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.13]} />
        <meshStandardMaterial color="#777b80" metalness={0.98} roughness={0.08} />
      </mesh>
      <mesh position={[0, 0.98, -0.57]}>
        <cylinderGeometry args={[0.04, 0.05, 0.18, 10]} />
        <meshStandardMaterial color="#9a9fa3" metalness={0.98} roughness={0.08} />
      </mesh>
      <mesh position={[-0.24, 0.94, -0.6]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.3, 10]} />
        <meshStandardMaterial color="#2a2d30" metalness={0.96} roughness={0.1} />
      </mesh>
      <mesh position={[0.24, 0.94, -0.6]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.3, 10]} />
        <meshStandardMaterial color="#2a2d30" metalness={0.96} roughness={0.1} />
      </mesh>
      <mesh position={[-0.4, 0.96, -0.58]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.17, 10]} />
        <meshStandardMaterial color="#090a0b" roughness={0.94} />
      </mesh>
      <mesh position={[0.4, 0.96, -0.58]} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.17, 10]} />
        <meshStandardMaterial color="#090a0b" roughness={0.94} />
      </mesh>
      {/* Brembo-style lever silhouettes without logos */}
      <mesh position={[-0.33, 0.94, -0.59]} rotation={[0.2, 0, -0.2]}>
        <boxGeometry args={[0.036, 0.02, 0.19]} />
        <meshStandardMaterial color="#c4c8cb" metalness={0.98} roughness={0.09} />
      </mesh>
      <mesh position={[0.33, 0.94, -0.59]} rotation={[0.2, 0, 0.2]}>
        <boxGeometry args={[0.036, 0.02, 0.19]} />
        <meshStandardMaterial color="#c4c8cb" metalness={0.98} roughness={0.09} />
      </mesh>
      {/* Low-profile aerodynamic mirrors */}
      <mesh position={[-0.34, 1.04, -0.61]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#111214" metalness={0.92} roughness={0.12} />
      </mesh>
      <mesh position={[0.34, 1.04, -0.61]}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshStandardMaterial color="#111214" metalness={0.92} roughness={0.12} />
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

      {/* Supplied futuristic rider reference, scaled down to fit this bike. */}
      <FuturisticRider
        position={[0, 0.99, 0.06]}
        scale={0.92}
        elbowX={0.20}
        elbowY={0.13}
        handX={0.39}
        handY={-0.03}
        handZ={-0.59}
        shoulderY={0.42}
        hipY={0.10}
        kneeY={-0.02}
        ankleY={-0.16}
        ankleZ={0.27}
        torsoRotationX={-0.40}
      />
    </>
  )
}

// ============== CARS ==============
// Stylized, logo-free models inspired by the requested real-world proportions.

function CarBase({ car, shape = 'sedan' }: { car: Car; shape?: 'hatch' | 'sedan' | 'suv' | 'gt' | 'exotic' }) {
  const dimensions = {
    hatch: [1.55, 1.0, 3.2],
    sedan: [1.65, 1.0, 4.2],
    suv: [1.9, 1.35, 4.6],
    gt: [1.85, 1.05, 4.7],
    exotic: [1.9, 0.9, 4.4],
  } as const
  const [w, h, l] = dimensions[shape]
  const wheelZ = l * 0.34

  return (
    <>
      <mesh position={[0, h * 0.34, 0]}>
        <boxGeometry args={[w, h * 0.48, l]} />
        <meshStandardMaterial color={car.color} metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[0, h * 0.66, -l * 0.04]}>
        <boxGeometry args={[w * 0.78, h * 0.42, l * 0.48]} />
        <meshStandardMaterial color={car.accentColor} metalness={0.35} roughness={0.3} />
      </mesh>
      <mesh position={[0, h * 0.68, -l * 0.06]}>
        <boxGeometry args={[w * 0.64, h * 0.25, l * 0.42]} />
        <meshStandardMaterial color="#17212b" metalness={0.55} roughness={0.18} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, h * 0.29, -l * 0.48]}>
        <boxGeometry args={[w * 0.82, h * 0.13, 0.08]} />
        <meshStandardMaterial color="#252525" metalness={0.5} roughness={0.25} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-wheelZ, wheelZ].map((z) => (
            <group key={z} position={[side * w * 0.52, h * 0.24, z]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.27, 0.27, 0.22, 16]} />
                <meshStandardMaterial color="#101010" roughness={0.82} metalness={0.05} />
              </mesh>
              <mesh position={[side > 0 ? 0.115 : -0.115, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.13, 0.13, 0.025, 16]} />
                <meshStandardMaterial color="#9ca3af" metalness={0.75} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[-w * 0.3, h * 0.36, -l / 2 - 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.12, 0.05]} />
        <meshStandardMaterial color="#ffffdc" emissive="#fff6b0" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[w * 0.3, h * 0.36, -l / 2 - 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.12, 0.05]} />
        <meshStandardMaterial color="#ffffdc" emissive="#fff6b0" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-w * 0.3, h * 0.36, l / 2 + 0.01]}>
        <boxGeometry args={[w * 0.18, h * 0.1, 0.05]} />
        <meshStandardMaterial color="#ef3340" emissive="#ef3340" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[w * 0.3, h * 0.36, l / 2 + 0.01]}>
        <boxGeometry args={[w * 0.18, h * 0.1, 0.05]} />
        <meshStandardMaterial color="#ef3340" emissive="#ef3340" emissiveIntensity={0.7} />
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
  const previousPlayerXRef = useRef(0)

  const vehicleColors = useMemo(() => [
    '#e74c3c', '#3498db', '#27ae60', '#f39c12', '#8e44ad',
    '#1abc9c', '#e67e22', '#ecf0f1', '#f5f5f5', '#d35400',
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
      previousPlayerXRef.current = state.playerX
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
      const previousZ = v.z
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
      const [vw] = getVehicleDimensions(v.type)
      const collisionHalfWidth = vw / 2 + 0.35
      const collisionX = sweptSegmentOverlapsRange(
        previousPlayerXRef.current,
        playerX,
        vehicleX - collisionHalfWidth,
        vehicleX + collisionHalfWidth,
      )
      const collisionZ = sweptSegmentOverlapsRange(
        previousZ,
        v.z,
        PLAYER_Z - 1.8,
        PLAYER_Z + 1.2,
      )

      if (collisionX && collisionZ) {
        // Check if shield is active
        if (state.shieldActive) {
          // [GFX] Cosmetic-only collision feedback; gameplay remains unchanged.
          emitShieldImpact(new THREE.Vector3(vehicleX, 0.85, v.z))
          emitCollisionImpact(new THREE.Vector3(vehicleX, 0.72, v.z), true)
          actions.useShield()
          // Remove the vehicle that would have caused crash
          vehicles.splice(i, 1)
          continue
        }
        emitCollisionImpact(new THREE.Vector3(vehicleX, 0.72, v.z), false)
        actions.setGameState('gameover')
        actions.setSpeed(0)
        return
      }
    }

    previousPlayerXRef.current = playerX

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

function getPlayerVisualLength(state: ReturnType<typeof getState>): number {
  if (state.vehicleMode === 'car') {
    switch (state.selectedCar.id) {
      case 'kanto-zip': return 3.2 * 0.95
      case 'goliath-titan': return 4.6 * 1.08
      case 'saber-swift': return 4.2
      case 'kaiser-monarch': return 4.7
      case 'scuderia-fury': return 4.4
      default: return 4.2
    }
  }
  // The five selectable bikes occupy essentially the same longitudinal
  // envelope in the gameplay scene; use a single reference length.
  return 2.1
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
    const state = getState()

    // Traffic uses the same fixed car-reference envelope in every run.
    // This keeps vans/cars/buses visually consistent when the player is on a bike.
    // The player's bike geometry and scale are untouched.
    const trafficReferenceLength = 4.2

    const existingIds = new Set<number>()

    vehicles.forEach((v) => {
      existingIds.add(v.id)

      let mesh = meshCacheRef.current.get(v.id)
      if (!mesh) {
        mesh = createVehicleMesh(v.type, v.color, getDimensions)

        // Visual-only normalization: traffic keeps the same relative sizing
        // used when driving a car, never the shorter bike reference length.
        const trafficLength = Math.max(getDimensions(v.type)[2], 0.01)
        mesh.scale.setScalar(trafficReferenceLength / trafficLength)

        meshCacheRef.current.set(v.id, mesh)
        groupRef.current!.add(mesh)
      }

      const trafficLength = Math.max(getDimensions(v.type)[2], 0.01)
      const normalizedScale = trafficReferenceLength / trafficLength
      if (Math.abs(mesh.scale.x - normalizedScale) > 0.001) {
        mesh.scale.setScalar(normalizedScale)
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
  const bodyGeo = new THREE.BoxGeometry(w, h * 0.55, l)
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = h * 0.35
  group.add(body)

  // Cabin/Roof
  if (type === 'car') {
    const roofGeo = new THREE.BoxGeometry(w * 0.82, h * 0.38, l * 0.45)
    const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.3, roughness: 0.4 })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = h * 0.65
    roof.position.z = -l * 0.05
    group.add(roof)
  } else if (type === 'auto') {
    // Auto-rickshaw style - open top with canopy
    const roofGeo = new THREE.BoxGeometry(w * 0.9, h * 0.15, l * 0.7)
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
    const cargoGeo = new THREE.BoxGeometry(w * 0.95, h * 0.7, l * 0.6)
    const cargoMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 })
    const cargo = new THREE.Mesh(cargoGeo, cargoMat)
    cargo.position.y = h * 0.5
    cargo.position.z = l * 0.1
    group.add(cargo)
  } else if (type === 'bus') {
    // Bus body is taller
    const bodyGeo2 = new THREE.BoxGeometry(w * 0.95, h * 0.85, l * 0.95)
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

  // Tail lights
  const tailGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04)
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 0.8 })
  const tailL = new THREE.Mesh(tailGeo, tailMat)
  tailL.position.set(-w * 0.35, h * 0.35, l / 2)
  group.add(tailL)
  const tailR = new THREE.Mesh(tailGeo, tailMat)
  tailR.position.set(w * 0.35, h * 0.35, l / 2)
  group.add(tailR)

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

type VfxQualityTier = 'low' | 'medium' | 'high'
type SharedVfxKind = 1 | 2 | 3 | 4 | 5 | 6
const VFX_KIND_DUST = 1
const VFX_KIND_ROAD = 2
const VFX_KIND_COIN = 3
const VFX_KIND_MAGNET = 4
const VFX_KIND_SHIELD = 5
const VFX_KIND_IMPACT = 6

function getVfxBudget(gl: THREE.WebGLRenderer): { tier: VfxQualityTier; maxParticles: number } {
  try {
    const stored = window.localStorage.getItem('hs_gfx_quality')
    if (stored === 'low') return { tier: 'low', maxParticles: 40 }
    if (stored === 'medium') return { tier: 'medium', maxParticles: 120 }
    if (stored === 'high') return { tier: 'high', maxParticles: 250 }
  } catch {}
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const highCapability = gl.capabilities.maxTextureSize >= 2048 && gl.capabilities.getMaxAnisotropy() >= 4 && dpr <= 2
  return highCapability ? { tier: 'high', maxParticles: 250 } : { tier: 'medium', maxParticles: 120 }
}

type SharedVfxEmitter = {
  maxParticles: number
  positions: Float32Array
  velocities: Float32Array
  colors: Float32Array
  baseColors: Float32Array
  life: Float32Array
  maxLife: Float32Array
  priority: Uint8Array
  kind: Uint8Array
  aliveCount: number
}
let sharedVfxEmitter: SharedVfxEmitter | null = null

function emitSharedVfx(kind: SharedVfxKind, x: number, y: number, z: number, count: number, priority: number, power = 1) {
  const fx = sharedVfxEmitter
  if (!fx) return
  for (let i = 0; i < count; i++) {
    let slot = -1
    for (let j = 0; j < fx.maxParticles; j++) {
      if (fx.life[j] <= 0) { slot = j; break }
    }
    if (slot < 0) {
      let weakestPriority = priority + 1
      for (let j = 0; j < fx.maxParticles; j++) {
        if (fx.life[j] > 0 && fx.priority[j] < weakestPriority) {
          weakestPriority = fx.priority[j]
          slot = j
        }
      }
      if (slot < 0 || priority <= weakestPriority) break
    } else {
      fx.aliveCount++
    }

    const base = slot * 3
    const angle = Math.random() * Math.PI * 2
    const spread = (0.45 + Math.random() * 0.9) * power
    let vx = 0, vy = 0, vz = 0
    let particleLife = 0.32 + Math.random() * 0.28
    let red = 1, green = 1, blue = 1

    if (kind === VFX_KIND_DUST) {
      vx = (Math.random() - 0.5) * 0.45
      vy = 0.12 + Math.random() * 0.32
      vz = 18 + Math.random() * 14
      particleLife = 0.5 + Math.random() * 0.45
      red = 0.56; green = 0.46; blue = 0.34
    } else if (kind === VFX_KIND_ROAD) {
      vx = (Math.random() - 0.5) * 0.5
      vy = 0.2 + Math.random() * 0.45
      vz = 28 + Math.random() * 20
      particleLife = 0.32 + Math.random() * 0.24
      red = 0.74; green = 0.82; blue = 0.86
    } else if (kind === VFX_KIND_COIN) {
      vx = Math.cos(angle) * spread
      vy = 1.15 + Math.random() * 1.35
      vz = Math.sin(angle) * spread
      particleLife = 0.28 + Math.random() * 0.18
      red = 1; green = 0.78 + Math.random() * 0.18; blue = 0.28
    } else if (kind === VFX_KIND_MAGNET) {
      const radius = 0.5 + Math.random() * 1.05
      fx.positions[base] = x + Math.cos(angle) * radius
      fx.positions[base + 1] = y + (Math.random() - 0.5) * 0.65
      fx.positions[base + 2] = z + Math.sin(angle) * radius
      vx = -Math.sin(angle) * (0.55 + Math.random() * 0.45)
      vy = (Math.random() - 0.5) * 0.4
      vz = Math.cos(angle) * (0.55 + Math.random() * 0.45)
      particleLife = 0.3 + Math.random() * 0.26
      red = 0.30; green = 0.82; blue = 1
    } else if (kind === VFX_KIND_SHIELD) {
      const radius = 0.72 + Math.random() * 0.52
      fx.positions[base] = x + Math.cos(angle) * radius
      fx.positions[base + 1] = y + 0.18 + Math.random() * 1.2
      fx.positions[base + 2] = z + Math.sin(angle) * radius
      vx = Math.cos(angle) * 0.28
      vy = 0.35 + Math.random() * 0.55
      vz = Math.sin(angle) * 0.28
      particleLife = 0.34 + Math.random() * 0.24
      red = 0.34; green = 0.88; blue = 1
    } else {
      vx = Math.cos(angle) * spread * 1.45
      vy = 0.8 + Math.random() * 1.3
      vz = Math.sin(angle) * spread * 1.45
      particleLife = 0.22 + Math.random() * 0.2
      red = 1; green = 0.48 + Math.random() * 0.28; blue = 0.22
    }

    if (kind === VFX_KIND_DUST || kind === VFX_KIND_ROAD || kind === VFX_KIND_COIN || kind === VFX_KIND_IMPACT) {
      fx.positions[base] = x
      fx.positions[base + 1] = y
      fx.positions[base + 2] = z
    }
    fx.velocities[base] = vx
    fx.velocities[base + 1] = vy
    fx.velocities[base + 2] = vz
    fx.life[slot] = particleLife
    fx.maxLife[slot] = particleLife
    fx.priority[slot] = priority
    fx.kind[slot] = kind
    fx.baseColors[base] = red
    fx.baseColors[base + 1] = green
    fx.baseColors[base + 2] = blue
    fx.colors[base] = red
    fx.colors[base + 1] = green
    fx.colors[base + 2] = blue
  }
}

function SharedParticleVFX() {
  const { gl } = useThree()
  const pointsRef = useRef<THREE.Points>(null)
  const hiddenRef = useRef(false)
  const reducedRef = useRef(false)
  const ambientTimerRef = useRef(0)
  const roadTimerRef = useRef(0)
  const magnetTimerRef = useRef(0)
  const lastCollisionIdRef = useRef(0)
  const lastShieldImpactIdRef = useRef(0)
  const lastShieldActiveRef = useRef(false)

  const budget = useMemo(() => getVfxBudget(gl), [gl])
  const maxParticles = budget.maxParticles
  const positions = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles])
  const velocities = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles])
  const colors = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles])
  const baseColors = useMemo(() => new Float32Array(maxParticles * 3), [maxParticles])
  const life = useMemo(() => new Float32Array(maxParticles), [maxParticles])
  const maxLife = useMemo(() => new Float32Array(maxParticles), [maxParticles])
  const priority = useMemo(() => new Uint8Array(maxParticles), [maxParticles])
  const kind = useMemo(() => new Uint8Array(maxParticles), [maxParticles])

  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    next.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    next.setDrawRange(0, maxParticles)
    return next
  }, [colors, maxParticles, positions])

  const material = useMemo(() => new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.095,
    transparent: true,
    opacity: 0.92,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  useEffect(() => {
    reducedRef.current =
      areSpeedEffectsReduced() ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    const onVisibility = () => { hiddenRef.current = document.hidden }
    hiddenRef.current = document.hidden
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const fx: SharedVfxEmitter = {
      maxParticles, positions, velocities, colors, baseColors, life, maxLife, priority, kind, aliveCount: 0,
    }

    for (let i = 0; i < maxParticles; i++) {
      const base = i * 3
      positions[base] = 0
      positions[base + 1] = -1000
      positions[base + 2] = 0
      colors[base] = 0
      colors[base + 1] = 0
      colors[base + 2] = 0
      baseColors[base] = 0
      baseColors[base + 1] = 0
      baseColors[base + 2] = 0
    }

    sharedVfxEmitter = fx
    return () => {
      if (sharedVfxEmitter === fx) sharedVfxEmitter = null
      geometry.dispose()
      material.dispose()
    }
  }, [baseColors, colors, geometry, kind, life, maxLife, material, maxParticles, positions, priority, velocities])

  useFrame((_, delta) => {
    if (!pointsRef.current || hiddenRef.current || document.hidden) return
    const fx = sharedVfxEmitter
    if (!fx) return

    const state = getState()
    const dt = Math.min(delta, 0.05)

    if (collisionImpactVisual && collisionImpactVisual.id !== lastCollisionIdRef.current) {
      lastCollisionIdRef.current = collisionImpactVisual.id
      emitSharedVfx(
        VFX_KIND_IMPACT,
        collisionImpactVisual.position.x,
        collisionImpactVisual.position.y,
        collisionImpactVisual.position.z,
        budget.tier === 'low' ? 5 : budget.tier === 'medium' ? 8 : 12,
        6,
        collisionImpactVisual.absorbed ? 0.72 : 1,
      )
    }

    if (shieldImpactVisual && shieldImpactVisual.id !== lastShieldImpactIdRef.current) {
      lastShieldImpactIdRef.current = shieldImpactVisual.id
      emitSharedVfx(
        VFX_KIND_SHIELD,
        shieldImpactVisual.position.x,
        shieldImpactVisual.position.y,
        shieldImpactVisual.position.z,
        budget.tier === 'low' ? 5 : budget.tier === 'medium' ? 8 : 12,
        5,
      )
    }

    if (state.shieldActive !== lastShieldActiveRef.current) {
      lastShieldActiveRef.current = state.shieldActive
      if (state.shieldActive) {
        emitSharedVfx(
          VFX_KIND_SHIELD,
          state.playerX,
          0.8,
          PLAYER_Z,
          budget.tier === 'low' ? 8 : budget.tier === 'medium' ? 12 : 18,
          5,
        )
      }
    }

    if (state.gameState === 'playing') {
      const speedNorm = THREE.MathUtils.clamp(state.speed / 120, 0, 1)

      ambientTimerRef.current -= dt
      if (ambientTimerRef.current <= 0) {
        ambientTimerRef.current = budget.tier === 'low' ? 0.24 : budget.tier === 'medium' ? 0.15 : 0.11
        emitSharedVfx(VFX_KIND_DUST, state.playerX + (Math.random() - 0.5) * 5, 0.05, -45, 1, 1)
      }

      roadTimerRef.current -= dt
      if (roadTimerRef.current <= 0 && speedNorm > 0.28) {
        roadTimerRef.current = budget.tier === 'low' ? 0.14 : budget.tier === 'medium' ? 0.085 : 0.06
        emitSharedVfx(
          VFX_KIND_ROAD,
          state.playerX + (Math.random() - 0.5) * 7,
          0.08,
          -34,
          budget.tier === 'low' ? 1 : 2,
          2,
        )
      }

      magnetTimerRef.current -= dt
      if ((state.magnetActive || state.magnet2xActive) && magnetTimerRef.current <= 0) {
        magnetTimerRef.current = budget.tier === 'low' ? 0.16 : budget.tier === 'medium' ? 0.10 : 0.07
        emitSharedVfx(VFX_KIND_MAGNET, state.playerX, 0.95, PLAYER_Z, budget.tier === 'low' ? 1 : 2, 4)
      }
    }

    const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute

    for (let i = 0; i < maxParticles; i++) {
      const currentLife = fx.life[i]
      if (currentLife <= 0) continue

      const base = i * 3
      const particleKind = fx.kind[i]

      fx.positions[base] += fx.velocities[base] * dt
      fx.positions[base + 1] += fx.velocities[base + 1] * dt
      fx.positions[base + 2] += fx.velocities[base + 2] * dt

      if (particleKind === VFX_KIND_DUST) fx.velocities[base + 1] -= 0.15 * dt
      else if (particleKind === VFX_KIND_ROAD) fx.velocities[base + 1] -= 0.08 * dt
      else if (particleKind === VFX_KIND_COIN) fx.velocities[base + 1] -= 3.2 * dt
      else if (particleKind === VFX_KIND_SHIELD) fx.velocities[base + 1] -= 0.65 * dt
      else if (particleKind === VFX_KIND_IMPACT) fx.velocities[base + 1] -= 4.8 * dt
      else if (particleKind === VFX_KIND_MAGNET) {
        fx.velocities[base] *= 0.992
        fx.velocities[base + 2] *= 0.992
      }

      fx.life[i] = Math.max(0, currentLife - dt)
      if (fx.life[i] <= 0) {
        fx.aliveCount = Math.max(0, fx.aliveCount - 1)
        fx.positions[base + 1] = -1000
        fx.colors[base] = 0
        fx.colors[base + 1] = 0
        fx.colors[base + 2] = 0
      } else {
        const fade = fx.life[i] / Math.max(0.001, fx.maxLife[i])
        const intensity = fade * (reducedRef.current ? 0.58 : 1)
        fx.colors[base] = fx.baseColors[base] * intensity
        fx.colors[base + 1] = fx.baseColors[base + 1] * intensity
        fx.colors[base + 2] = fx.baseColors[base + 2] * intensity
      }
    }

    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
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
  const collectionTriggeredRef = useRef<Set<number>>(new Set())
  const magnetTrailsRef = useRef<THREE.LineSegments | null>(null)
  const bodyMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const faceMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const glintMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const magnetGlowMeshRef = useRef<THREE.InstancedMesh | null>(null)

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
      color: '#f6b82f',
      metalness: 0.92,
      roughness: 0.11,
      emissive: '#f59e0b',
      emissiveIntensity: 0.96,
    }),
    []
  )
  const coinFaceMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#fbd35a',
      metalness: 0.88,
      roughness: 0.10,
      emissive: '#fbbf24',
      emissiveIntensity: 0.92,
    }),
    []
  )
  const coinGlintMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  const magnetGlowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#fff1a8',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    []
  )

  useEffect(() => {
    return () => {
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

  useFrame((_, delta) => {
    const state = getState()

    if (state.gameState === 'playing' && lastGameStateRef.current !== 'playing') {
      coinsRef.current = []
      spawnTimerRef.current = 0
      visualCoinsRef.current.clear()
      collectionTriggeredRef.current.clear()
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
    const maxInstances = bodyMeshRef.current!.count
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
            emitSharedVfx(VFX_KIND_COIN, visual.x, visual.y, visual.z, magnetBoost ? 9 : 7, 4, magnetBoost ? 1.2 : 1)
            visualCoinsRef.current.delete(coin.id)
          } else {
            emitSharedVfx(VFX_KIND_COIN, coin.x, coin.y, coin.z, 7, 4, 1)
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
      bodyMeshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

      // Slightly lifted embossed face.
      dummy.position.set(coin.x, coin.y + 0.012, coin.z)
      dummy.rotation.set(0, rotationY, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      faceMeshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

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
      glintMeshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

      // [GFX] Soft coin aura grows only after the existing logic has marked
      // the coin magnetized. It is a presentation layer, not attraction logic.
      const magnetGlowStrength = coin.magnetized
        ? 0.9 + Math.sin(now * 0.009 + phase) * 0.16
        : 0
      dummy.position.set(coin.x, coin.y, coin.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(magnetGlowStrength)
      dummy.updateMatrix()
      magnetGlowMeshRef.current!.setMatrixAt(instanceIndex, dummy.matrix)

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
      bodyMeshRef.current!.setMatrixAt(i, dummy.matrix)
      faceMeshRef.current!.setMatrixAt(i, dummy.matrix)
      glintMeshRef.current!.setMatrixAt(i, dummy.matrix)
      magnetGlowMeshRef.current!.setMatrixAt(i, dummy.matrix)
    }

    bodyMeshRef.current!.instanceMatrix.needsUpdate = true
    faceMeshRef.current!.instanceMatrix.needsUpdate = true
    glintMeshRef.current!.instanceMatrix.needsUpdate = true
    magnetGlowMeshRef.current!.instanceMatrix.needsUpdate = true
    const magnetGlowMaterialRef = magnetGlowMeshRef.current!.material as THREE.MeshBasicMaterial
    magnetGlowMaterialRef.opacity =
      state.magnetActive || state.magnet2xActive ? 0.18 : 0.0

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
      color: '#4ea1ff',
      metalness: 0.72,
      roughness: 0.24,
      emissive: '#2563d8',
      emissiveIntensity: 0.95,
    })
    const magnet = new THREE.Mesh(magnetGeo, magnetMat)
    magnet.rotation.x = Math.PI / 2
    group.add(magnet)
    
    // Red tips - BIGGER
    const tipGeo = new THREE.BoxGeometry(0.22, 0.38, 0.22)
    const tipMat = new THREE.MeshStandardMaterial({ 
      color: '#ff5550',
      metalness: 0.62,
      roughness: 0.34,
      emissive: '#e62f2a',
      emissiveIntensity: 0.72,
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
      color: '#6db7ff',
      transparent: true,
      opacity: 0.36,
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
      emissiveIntensity: 1.10,
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
      emissiveIntensity: 1.05,
    })
    const star = new THREE.Mesh(starGeo, starMat)
    group.add(star)
    
    // Glow - BIGGER
    const glowGeo = new THREE.SphereGeometry(0.8, 8, 8)
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#fbbf24', 
      transparent: true, 
      opacity: 0.46,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)
  }
  
  else if (type === 'shield') {
    // Green shield - BIGGER
    const shieldGeo = new THREE.SphereGeometry(0.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    const shieldMat = new THREE.MeshStandardMaterial({ 
      color: '#28d99c',
      metalness: 0.62,
      roughness: 0.25,
      emissive: '#08a875',
      emissiveIntensity: 0.95,
      side: THREE.DoubleSide,
    })
    const shield = new THREE.Mesh(shieldGeo, shieldMat)
    group.add(shield)
    
    // Shield base - BIGGER
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16)
    const baseMat = new THREE.MeshStandardMaterial({ 
      color: '#16b982',
      metalness: 0.72,
      roughness: 0.26,
      emissive: '#078f68',
      emissiveIntensity: 0.72,
    })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = -0.075
    group.add(base)
    
    // Glow - BIGGER
    const glowGeo = new THREE.SphereGeometry(0.8, 8, 8)
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#59f0b8',
      transparent: true,
      opacity: 0.36,
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

// [GFX] Collision feedback is event-driven and purely cosmetic.
// Gameplay emits this marker only after collision has already been detected.
type CollisionImpactVisual = {
  id: number
  position: THREE.Vector3
  absorbed: boolean
}

let collisionImpactVisual: CollisionImpactVisual | null = null

function emitCollisionImpact(
  position: THREE.Vector3,
  absorbed = false
) {
  collisionImpactVisual = {
    id: (collisionImpactVisual?.id ?? 0) + 1,
    position: position.clone(),
    absorbed,
  }
}

type CollisionBurst = {
  group: THREE.Group
  smoke: THREE.Sprite
  flash: THREE.Sprite
}
let collisionBurstTexture: THREE.CanvasTexture | null = null
function getCollisionBurstTexture() {
  if (collisionBurstTexture) return collisionBurstTexture
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create collision burst texture')
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  gradient.addColorStop(0, 'rgba(255,250,228,0.95)')
  gradient.addColorStop(0.2, 'rgba(255,210,126,0.76)')
  gradient.addColorStop(0.48, 'rgba(255,122,70,0.3)')
  gradient.addColorStop(0.78, 'rgba(125,87,68,0.12)')
  gradient.addColorStop(1, 'rgba(60,45,38,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  collisionBurstTexture = new THREE.CanvasTexture(canvas)
  collisionBurstTexture.colorSpace = THREE.SRGBColorSpace
  collisionBurstTexture.minFilter = THREE.LinearFilter
  collisionBurstTexture.magFilter = THREE.LinearFilter
  collisionBurstTexture.needsUpdate = true
  return collisionBurstTexture
}
function createCollisionBurst(): CollisionBurst {
  const group = new THREE.Group()
  const makeSprite = () => new THREE.Sprite(new THREE.SpriteMaterial({
    map: getCollisionBurstTexture(),
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  }))
  const smoke = makeSprite()
  const flash = makeSprite()
  group.add(smoke, flash)
  return { group, smoke, flash }
}
function CollisionFeedback() {
  const groupRef = useRef<THREE.Group>(null)
  const poolRef = useRef<CollisionBurst[]>([])
  const cursorRef = useRef(0)
  const lastEventIdRef = useRef(0)
  const lastFlashAtRef = useRef(0)
  const reducedRef = useRef(false)
  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()
    if (!groupRef.current) return
    const pool = Array.from({ length: 4 }, () => {
      const burst = createCollisionBurst()
      burst.group.visible = false
      groupRef.current!.add(burst.group)
      return burst
    })
    poolRef.current = pool
    return () => {
      pool.forEach((burst) => {
        groupRef.current?.remove(burst.group)
        ;(burst.smoke.material as THREE.SpriteMaterial).dispose()
        ;(burst.flash.material as THREE.SpriteMaterial).dispose()
      })
      poolRef.current = []
    }
  }, [])
  useFrame((_, delta) => {
    const now = performance.now()
    const event = collisionImpactVisual
    if (event && event.id !== lastEventIdRef.current) {
      lastEventIdRef.current = event.id
      if (poolRef.current.length) {
        const burst = poolRef.current[cursorRef.current % poolRef.current.length]
        cursorRef.current = (cursorRef.current + 1) % poolRef.current.length
        const reduced = reducedRef.current
        burst.group.visible = true
        burst.group.position.copy(event.position)
        const smokeMaterial = burst.smoke.material as THREE.SpriteMaterial
        const flashMaterial = burst.flash.material as THREE.SpriteMaterial
        smokeMaterial.opacity = reduced ? (event.absorbed ? 0.04 : 0.07) : (event.absorbed ? 0.07 : 0.12)
        flashMaterial.opacity = now - lastFlashAtRef.current >= 333
          ? (reduced ? 0.04 : (event.absorbed ? 0.06 : 0.11))
          : 0
        if (flashMaterial.opacity > 0) lastFlashAtRef.current = now
        burst.smoke.scale.setScalar(event.absorbed ? 0.7 : 0.9)
        burst.flash.scale.setScalar(event.absorbed ? 0.45 : 0.62)
        burst.smoke.userData.startedAt = now
      }
    }
    poolRef.current.forEach((burst) => {
      const startedAt = Number(burst.smoke.userData.startedAt ?? 0)
      if (!startedAt || !burst.group.visible) return
      const t = Math.min((now - startedAt) / 420, 1)
      const fade = 1 - t
      const smokeMaterial = burst.smoke.material as THREE.SpriteMaterial
      const flashMaterial = burst.flash.material as THREE.SpriteMaterial
      smokeMaterial.opacity = Math.max(0, smokeMaterial.opacity - delta * 0.3)
      flashMaterial.opacity = Math.max(0, flashMaterial.opacity - delta * 1.9)
      burst.smoke.scale.multiplyScalar(1 + delta * 1.6)
      burst.flash.scale.multiplyScalar(1 + delta * 3.0)
      if (t >= 1) {
        burst.group.visible = false
        smokeMaterial.opacity = 0
        flashMaterial.opacity = 0
        burst.smoke.userData.startedAt = 0
      } else {
        smokeMaterial.opacity *= fade + 0.02
      }
    })
  })
  return <group ref={groupRef} />
}

function CollisionScreenEffect() {
  const { camera } = useThree()
  const spriteRef = useRef<THREE.Sprite>(null)
  const materialRef = useRef<THREE.SpriteMaterial>(null)
  const lastEventIdRef = useRef(0)
  const lastTintAtRef = useRef(0)
  const effectRef = useRef(0)
  const reducedRef = useRef(false)

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create collision screen effect')

    const gradient = ctx.createRadialGradient(64, 64, 18, 64, 64, 72)
    gradient.addColorStop(0, 'rgba(115,20,20,0)')
    gradient.addColorStop(0.63, 'rgba(155,25,25,0.02)')
    gradient.addColorStop(0.82, 'rgba(185,35,35,0.12)')
    gradient.addColorStop(1, 'rgba(185,35,35,0.3)')
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

  useFrame((_, delta) => {
    const event = collisionImpactVisual
    if (event && event.id !== lastEventIdRef.current) {
      lastEventIdRef.current = event.id

      // [GFX] Screen flashes are rate-limited to <=3 starts per second.
      if (performance.now() - lastTintAtRef.current >= 333) {
        lastTintAtRef.current = performance.now()
        effectRef.current = reducedRef.current
          ? (event.absorbed ? 0.18 : 0.24)
          : (event.absorbed ? 0.28 : 0.42)
      }
    }

    effectRef.current = Math.max(0, effectRef.current - delta * 2.6)

    if (spriteRef.current) {
      spriteRef.current.position.copy(camera.position)
      spriteRef.current.quaternion.copy(camera.quaternion)
      spriteRef.current.position.z -= 0.9
      spriteRef.current.visible = effectRef.current > 0.01
    }
    if (materialRef.current) {
      materialRef.current.opacity = effectRef.current
    }
  })

  return (
    <sprite
      ref={spriteRef}
      scale={[8.2, 8.2, 1]}
      material={useMemo(
        () => new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
        }),
        [texture]
      )}
    />
  )
}

// ============== CAMERA ==============
function GameCamera() {
  const { camera } = useThree()
  const basePosRef = useRef(new THREE.Vector3(0, 3.2, PLAYER_Z + 6.5))
  const renderPosRef = useRef(new THREE.Vector3(0, 3.2, PLAYER_Z + 6.5))
  const targetRef = useRef(new THREE.Vector3(0, 0.8, PLAYER_Z - 25))
  const shakeRef = useRef(0)
  const nearMissKickRef = useRef(0)
  const fovRef = useRef(70)
  const lastNearMissRef = useRef(0)
  const lastCollisionIdRef = useRef(0)
  const reducedRef = useRef(false)
  const hiddenRef = useRef(false)

  useEffect(() => {
    reducedRef.current = areSpeedEffectsReduced()

    const onVisibility = () => {
      hiddenRef.current = document.hidden
    }

    hiddenRef.current = document.hidden
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useFrame((_, delta) => {
    if (hiddenRef.current || document.hidden) return

    const state = getState()
    const dt = Math.min(delta, 0.05)
    const perspectiveCamera = camera as THREE.PerspectiveCamera

    if (
      collisionImpactVisual &&
      collisionImpactVisual.id !== lastCollisionIdRef.current
    ) {
      lastCollisionIdRef.current = collisionImpactVisual.id
      // Render-only camera kick. Gameplay position, collision checks and
      // steering/input variables are never modified.
      shakeRef.current = reducedRef.current
        ? 0.42
        : collisionImpactVisual.absorbed
          ? 0.58
          : 0.82
    }

    if (state.nearMisses > lastNearMissRef.current) {
      lastNearMissRef.current = state.nearMisses
      nearMissKickRef.current = reducedRef.current ? 0.5 : 0.82
    }
    nearMissKickRef.current = Math.max(0, nearMissKickRef.current - dt * 4.5)

    // Small speed-based FOV expansion only. The camera position and obstacle
    // layout remain unchanged, preserving lane positions and visibility fairness.
    const selectedMaxSpeed =
      state.vehicleMode === 'car'
        ? state.selectedCar.maxSpeed
        : state.selectedBike.maxSpeed
    const speedNormalized = THREE.MathUtils.clamp(
      (state.speed - 25) / Math.max(1, selectedMaxSpeed - 25),
      0,
      1
    )
    const maxFovDelta = reducedRef.current ? 2.2 : 4.5
    const targetFov =
      70 +
      speedNormalized * maxFovDelta +
      nearMissKickRef.current * (reducedRef.current ? 1.0 : 1.6)

    fovRef.current = THREE.MathUtils.damp(
      fovRef.current,
      targetFov,
      5.5,
      dt
    )
    perspectiveCamera.fov = fovRef.current
    perspectiveCamera.updateProjectionMatrix()

    // Restore yesterday's horizontal chase-camera feel: the camera smoothly
    // follows the player's lane movement while gameplay/input coordinates stay unchanged.
    const targetRenderX = state.playerX
    const targetRenderY = 3.2 + THREE.MathUtils.clamp(state.speed * 0.0008, 0, 0.07)
    renderPosRef.current.x = THREE.MathUtils.damp(renderPosRef.current.x, targetRenderX, 6.0, dt)
    renderPosRef.current.y = THREE.MathUtils.damp(renderPosRef.current.y, targetRenderY, 6.5, dt)
    renderPosRef.current.z = basePosRef.current.z

    let shakeX = 0
    let shakeY = 0

    if (shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt * 4.8)
      const maxAmplitude = reducedRef.current ? 0.009 : 0.022
      const amplitude = Math.min(shakeRef.current * 0.02, maxAmplitude)
      shakeX = (Math.random() - 0.5) * amplitude
      shakeY = (Math.random() - 0.5) * amplitude
    }

    renderPosRef.current.x += shakeX
    renderPosRef.current.y += shakeY
    renderPosRef.current.z = basePosRef.current.z

    camera.position.set(
      renderPosRef.current.x,
      renderPosRef.current.y,
      renderPosRef.current.z
    )

    // The look target follows a small fraction of the player's lateral movement,
    // matching yesterday's camera framing while leaving gameplay coordinates untouched.
    targetRef.current.x = state.playerX * 0.25
    camera.lookAt(targetRef.current)
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
          tint: new THREE.Color('#ffffff'),
        })
      }

      if (seed(i * 11 + 4) < treeChance * 0.88) {
        trees.push({
          x: ROAD_WIDTH / 2 + 4.2 + seed(i * 11 + 5) * 2.6,
          z: segmentZ + (seed(i * 11 + 6) - 0.5) * 9,
          scale: 0.75 + seed(i * 11 + 7) * (0.5 + zone * 0.16),
          rotation: (seed(i * 11 + 8) - 0.5) * 0.2,
          variant: (i + 1) % 3,
          tint: new THREE.Color('#ffffff'),
        })
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
      color: '#7a4a2a',
      roughness: 0.9,
      emissive: '#24160d',
      emissiveIntensity: 0.08,
    })
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
    trunkMesh.castShadow = true

    const canopyGeos = [
      new THREE.SphereGeometry(1.25, 8, 6),
      new THREE.ConeGeometry(1.35, 2.6, 8),
      new THREE.SphereGeometry(1.05, 7, 5),
    ]
    // Lush foliage: darker and more saturated than the muted roadside grass (#53664a).
    const canopyMats = [
      new THREE.MeshStandardMaterial({
        color: '#1f6b2b',
        roughness: 0.88,
        emissive: '#08260e',
        emissiveIntensity: 0.02,
      }),
      new THREE.MeshStandardMaterial({
        color: '#1f6b2b',
        roughness: 0.88,
        emissive: '#08260e',
        emissiveIntensity: 0.02,
      }),
      new THREE.MeshStandardMaterial({
        color: '#1f6b2b',
        roughness: 0.88,
        emissive: '#08260e',
        emissiveIntensity: 0.02,
      }),
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
      // Trunks remain natural brown; per-instance green foliage tint never affects them.

      const canopyIndex = variantCounters[tree.variant]++
      const canopyY = tree.variant === 1 ? 3.25 * tree.scale : 3.0 * tree.scale
      const canopyMesh = canopyMeshes[tree.variant]
      dummy.position.set(tree.x, canopyY, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.setScalar(tree.scale)
      dummy.updateMatrix()
      canopyMesh.setMatrixAt(canopyIndex, dummy.matrix)
      // Fixed material color keeps all foliage consistently lush green.
    })

    trunkMesh.instanceMatrix.needsUpdate = true
    if (trunkMesh.instanceColor) trunkMesh.instanceColor.needsUpdate = true
    canopyMeshes.forEach((mesh) => {
      mesh.frustumCulled = false
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    trunkMesh.frustumCulled = false

    const poleGeo = new THREE.CylinderGeometry(0.045, 0.07, 6.2, 6)
    const poleMat = new THREE.MeshStandardMaterial({ color: '#62686c', metalness: 0.7, roughness: 0.28 })
    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length)
    poleMesh.castShadow = true
    const lampGeo = new THREE.SphereGeometry(0.12, 7, 6)
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fff6d5',
      emissive: '#ffe8a6',
      emissiveIntensity: 0.90,
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
  const bodyColor = variant % 2 === 0 ? '#7e9098' : '#8d958c'

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
        <meshStandardMaterial color="#77878e" roughness={0.82} metalness={0.08} />
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
      <meshStandardMaterial color="#63835a" roughness={1} />
    </mesh>
  )
}

function AtmosphereSky() {
  const { camera } = useThree()

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#70b5dc') },
      horizonColor: { value: new THREE.Color('#e0eef4') },
      lowerHorizonColor: { value: new THREE.Color('#d3dfe3') },
      sunColor: { value: new THREE.Color('#fff7df') },
      sunDirection: { value: new THREE.Vector3(0.12, 0.72, -0.68).normalize() },
    }),
    []
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          varying vec3 vLocalPosition;
          void main() {
            vLocalPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 lowerHorizonColor;
          uniform vec3 sunColor;
          uniform vec3 sunDirection;
          varying vec3 vLocalPosition;

          void main() {
            vec3 direction = normalize(vLocalPosition);
            float height = clamp(direction.y, -0.18, 0.9);
            float upper = smoothstep(0.02, 0.72, height);
            vec3 sky = mix(horizonColor, topColor, upper);

            float lower = smoothstep(-0.18, 0.04, height);
            sky = mix(lowerHorizonColor, sky, lower);

            float sunAmount = pow(max(dot(direction, normalize(sunDirection)), 0.0), 18.0);
            float glowAmount = pow(max(dot(direction, normalize(sunDirection)), 0.0), 4.0) * 0.12;

            vec3 color = sky + sunColor * (sunAmount * 0.17 + glowAmount);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [uniforms]
  )

  useFrame(() => {
    // Keep the dome centered on the camera so the sky is infinitely distant.
    material.uniforms.sunDirection.value.set(0.12, 0.72, -0.68).normalize()
    material.needsUpdate = false
  })

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  return (
    <mesh position={[camera.position.x, 0, camera.position.z]} renderOrder={-10}>
      <sphereGeometry args={[450, 24, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

let atmosphereCloudTexture: THREE.CanvasTexture | null = null

function getAtmosphereCloudTexture() {
  if (atmosphereCloudTexture) return atmosphereCloudTexture

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create atmosphere cloud texture')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const glow = ctx.createRadialGradient(128, 48, 8, 128, 48, 122)
  glow.addColorStop(0, 'rgba(255,255,255,0.78)')
  glow.addColorStop(0.42, 'rgba(255,255,255,0.34)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  atmosphereCloudTexture = new THREE.CanvasTexture(canvas)
  atmosphereCloudTexture.colorSpace = THREE.SRGBColorSpace
  atmosphereCloudTexture.minFilter = THREE.LinearFilter
  atmosphereCloudTexture.magFilter = THREE.LinearFilter
  atmosphereCloudTexture.needsUpdate = true
  return atmosphereCloudTexture
}

function AtmosphereClouds() {
  const texture = useMemo(() => getAtmosphereCloudTexture(), [])

  const clouds = useMemo(
    () => [
      { position: [-105, 44, -175] as [number, number, number], scale: [38, 10, 1] as [number, number, number], opacity: 0.15 },
      { position: [82, 50, -215] as [number, number, number], scale: [44, 11, 1] as [number, number, number], opacity: 0.13 },
      { position: [-22, 57, -305] as [number, number, number], scale: [54, 13, 1] as [number, number, number], opacity: 0.11 },
      { position: [125, 40, -335] as [number, number, number], scale: [34, 9, 1] as [number, number, number], opacity: 0.10 },
    ],
    []
  )

  useEffect(() => {
    return () => {
      if (atmosphereCloudTexture === texture) {
        atmosphereCloudTexture = null
        texture.dispose()
      }
    }
  }, [texture])

  return (
    <group renderOrder={-5}>
      {clouds.map((cloud, i) => (
        <sprite key={i} position={cloud.position} scale={cloud.scale}>
          <spriteMaterial
            map={texture}
            transparent
            opacity={cloud.opacity}
            depthWrite={false}
            depthTest={false}
          />
        </sprite>
      ))}
    </group>
  )
}

function DistantDepthLayers() {
  const layers = useMemo(
    () => [
      { z: -245, x: -66, y: 6, scale: [72, 18, 32] as [number, number, number], color: '#718b91' },
      { z: -305, x: 68, y: 8, scale: [92, 23, 40] as [number, number, number], color: '#7d969b' },
      { z: -370, x: -18, y: 10, scale: [124, 28, 52] as [number, number, number], color: '#8da4a9' },
    ],
    []
  )

  return (
    <group>
      {layers.map((layer, i) => (
        <mesh key={i} position={[layer.x, layer.y, layer.z]} scale={layer.scale}>
          <sphereGeometry args={[1, 12, 6]} />
          <meshStandardMaterial
            color={layer.color}
            roughness={1}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
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
      <AtmosphereSky />
      <AtmosphereClouds />

      {/* Sun: bright enough to define the sky without washing out road/vehicle contrast. */}
      <mesh position={[40, 70, -250]}>
        <sphereGeometry args={[17, 16, 16]} />
        <meshBasicMaterial color="#fff7df" />
      </mesh>
      <mesh position={[40, 70, -250]}>
        <sphereGeometry args={[33, 16, 16]} />
        <meshBasicMaterial color="#fff7df" transparent opacity={0.14} depthWrite={false} />
      </mesh>

      <DistantDepthLayers />

      {/* Broad terrain base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -150]} receiveShadow>
        <planeGeometry args={[300, 800]} />
        <meshStandardMaterial color="#679353" roughness={1} />
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
            <meshStandardMaterial color={i % 2 === 0 ? '#58784d' : '#67885c'} roughness={1} />
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
      <fog attach="fog" args={['#c7d8df', 62, 220]} />
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
  const gameState = useGameStore((s) => s.gameState)

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
        toneMappingExposure: 1.12,
      }}
      shadows={{ type: THREE.PCFSoftShadowMap }}
    >
      <Environment />
      <Highway />
      {gameState !== 'menu' && <Motorcycle bike={selectedBike} car={selectedCar} />}
      <TrafficSystem />
      <CoinSystem />
      <SharedParticleVFX />
      <PowerUpSystem />
      <SpeedLines />
      <SpeedEdgeStreaks />
      <CollisionFeedback />
      <CollisionScreenEffect />
      <GameCamera />
    </Canvas>
  )
}
