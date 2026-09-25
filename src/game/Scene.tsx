import { useRef, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getState, actions, useGameStore, type Bike } from './store'

// Constants
const LANE_WIDTH = 3.5
const ROAD_WIDTH = 14
const SEGMENT_LENGTH = 20
const NUM_SEGMENTS = 30
const VISIBLE_DISTANCE = 400
const TRAFFIC_SPAWN_DISTANCE = 90
const PLAYER_Z = 5

// Traffic vehicle types
interface TrafficVehicle {
  id: number
  lane: number
  z: number
  speed: number
  type: 'car' | 'truck' | 'auto' | 'bus'
  color: string
  passed: boolean
}

// ============== HIGHWAY ==============
function Highway() {
  const segmentsRef = useRef<THREE.Group>(null)
  const offsetRef = useRef(0)

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing') return
    
    const speed = state.speed
    offsetRef.current += speed * delta * 0.5
    
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
      {segments.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          {/* Road surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[ROAD_WIDTH, SEGMENT_LENGTH]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
          </mesh>
          
          {/* Road edge lines (solid white) */}
          {[-ROAD_WIDTH / 2 + 0.3, ROAD_WIDTH / 2 - 0.3].map((x, li) => (
            <mesh key={`edge-${li}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
              <planeGeometry args={[0.18, SEGMENT_LENGTH]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          
          {/* Lane divider dashes */}
          {[-LANE_WIDTH, 0, LANE_WIDTH].map((x, li) => (
            <group key={`dash-${li}`}>
              {Array.from({ length: 5 }, (_, di) => (
                <mesh
                  key={di}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[x, 0.01, -SEGMENT_LENGTH / 2 + di * (SEGMENT_LENGTH / 5) + SEGMENT_LENGTH / 10]}
                >
                  <planeGeometry args={[0.12, SEGMENT_LENGTH / 7]} />
                  <meshStandardMaterial color="#ffcc00" />
                </mesh>
              ))}
            </group>
          ))}

          {/* Road shoulders (gravel) */}
          {[-ROAD_WIDTH / 2 - 1, ROAD_WIDTH / 2 + 1].map((x, si) => (
            <mesh key={`shoulder-${si}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.005, 0]}>
              <planeGeometry args={[2, SEGMENT_LENGTH]} />
              <meshStandardMaterial color="#5c4a3a" roughness={1} />
            </mesh>
          ))}

          {/* Roadside elements */}
          {i % 3 === 0 && (
            <>
              <RoadsideTree position={[-ROAD_WIDTH / 2 - 4 - Math.random() * 3, 0, Math.random() * 10 - 5]} />
              <RoadsideTree position={[ROAD_WIDTH / 2 + 4 + Math.random() * 3, 0, Math.random() * 10 - 5]} />
            </>
          )}
          {i % 4 === 0 && (
            <>
              <RoadsidePole position={[-ROAD_WIDTH / 2 - 1.8, 0, 0]} />
              <RoadsidePole position={[ROAD_WIDTH / 2 + 1.8, 0, 0]} />
            </>
          )}
          {i % 7 === 0 && (
            <>
              <RoadsideBush position={[-ROAD_WIDTH / 2 - 2.5, 0, 5]} />
              <RoadsideBush position={[ROAD_WIDTH / 2 + 2.5, 0, -3]} />
            </>
          )}
        </group>
      ))}
    </group>
  )
}

function RoadsideTree({ position }: { position: [number, number, number] }) {
  const scale = 0.8 + Math.random() * 0.6
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 3.6, 5]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[1.4, 6, 5]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      <mesh position={[0.4, 4.5, 0.3]}>
        <sphereGeometry args={[0.9, 5, 4]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      <mesh position={[-0.3, 3.5, -0.2]}>
        <sphereGeometry args={[0.7, 5, 4]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
    </group>
  )
}

function RoadsidePole({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 6, 6]} />
        <meshStandardMaterial color="#616161" metalness={0.5} />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fff176" emissiveIntensity={0.5} />
      </mesh>
      {/* Arm */}
      <mesh position={[position[0] > 0 ? -0.4 : 0.4, 5.8, 0]} rotation={[0, 0, position[0] > 0 ? 0.5 : -0.5]}>
        <boxGeometry args={[0.8, 0.04, 0.04]} />
        <meshStandardMaterial color="#616161" metalness={0.5} />
      </mesh>
    </group>
  )
}

function RoadsideBush({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.6, 5, 4]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      <mesh position={[0.3, 0.3, 0.2]}>
        <sphereGeometry args={[0.4, 4, 3]} />
        <meshStandardMaterial color="#558b2f" />
      </mesh>
    </group>
  )
}

// ============== MOTORCYCLE ==============
function Motorcycle({ bike }: { bike: Bike }) {
  const meshRef = useRef<THREE.Group>(null)
  const currentXRef = useRef(0)
  const tiltRef = useRef(0)
  const bikeRef = useRef(bike)
  const wheelSpinRef = useRef(0)

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
    }
  })

  return (
    <group ref={meshRef} position={[0, 0, PLAYER_Z]}>
      {/* Main body/frame */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.5, 0.4, 2.0]} />
        <meshStandardMaterial color={bike.color} metalness={0.7} roughness={0.25} />
      </mesh>
      
      {/* Engine block */}
      <mesh position={[0, 0.35, 0.1]}>
        <boxGeometry args={[0.45, 0.25, 0.6]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Fuel tank */}
      <mesh position={[0, 0.75, -0.15]}>
        <boxGeometry args={[0.45, 0.3, 0.85]} />
        <meshStandardMaterial color={bike.accentColor} metalness={0.8} roughness={0.15} />
      </mesh>
      
      {/* Seat */}
      <mesh position={[0, 0.78, 0.45]}>
        <boxGeometry args={[0.35, 0.1, 0.7]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>

      {/* Front fork */}
      <mesh position={[0, 0.55, -0.85]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Front wheel */}
      <mesh position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.25, 0.08, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 8]} />
        <meshStandardMaterial color="#444444" metalness={0.8} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.28, 0.1, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.12, 8]} />
        <meshStandardMaterial color="#444444" metalness={0.8} />
      </mesh>

      {/* Handlebar */}
      <mesh position={[0, 0.95, -0.7]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.65, 0.05, 0.05]} />
        <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Mirrors */}
      <mesh position={[-0.35, 1.0, -0.72]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.9} />
      </mesh>
      <mesh position={[0.35, 1.0, -0.72]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#888888" metalness={0.9} />
      </mesh>

      {/* Headlight */}
      <mesh position={[0, 0.65, -1.05]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffee" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0, 0.65, -1.5]} intensity={0.5} distance={15} color="#ffffee" />

      {/* Tail light */}
      <mesh position={[0, 0.55, 1.05]}>
        <boxGeometry args={[0.25, 0.06, 0.04]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
      </mesh>

      {/* Exhaust pipes */}
      <mesh position={[0.3, 0.28, 0.5]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh position={[-0.3, 0.28, 0.5]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.9, 8]} />
        <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Rider */}
      <group position={[0, 1.05, 0.15]}>
        {/* Torso */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.4, 0.55, 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        {/* Helmet */}
        <mesh position={[0, 0.6, -0.05]}>
          <sphereGeometry args={[0.17, 8, 8]} />
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
    </group>
  )
}

// ============== TRAFFIC ==============
function TrafficSystem() {
  const vehiclesRef = useRef<TrafficVehicle[]>([])
  const nextIdRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const lastGameStateRef = useRef<string>('menu')

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
      default: return [1.4, 1.1, 3.2]
    }
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    
    // Clear vehicles when game restarts
    if (state.gameState === 'playing' && lastGameStateRef.current !== 'playing') {
      vehiclesRef.current = []
      spawnTimerRef.current = 0
    }
    lastGameStateRef.current = state.gameState
    
    if (state.gameState !== 'playing') return

    const speed = state.speed
    const playerX = state.playerX
    const clampedDelta = Math.min(delta, 0.05) // Cap delta to prevent tunneling

    // Spawn traffic
    spawnTimerRef.current -= clampedDelta
    if (spawnTimerRef.current <= 0) {
      const spawnRate = Math.max(0.35, 1.4 - speed * 0.004)
      spawnTimerRef.current = spawnRate + Math.random() * 0.3

      // Pick a lane, avoid spawning in all 3 lanes at once
      const lane = Math.floor(Math.random() * 3) - 1
      
      // Don't spawn if there's already a vehicle too close in that lane
      const tooClose = vehiclesRef.current.some(
        v => v.lane === lane && Math.abs(v.z - (-TRAFFIC_SPAWN_DISTANCE)) < 15
      )
      
      if (!tooClose) {
        const types: Array<'car' | 'truck' | 'auto' | 'bus'> = ['car', 'car', 'car', 'car', 'truck', 'auto', 'bus']
        const type = types[Math.floor(Math.random() * types.length)]
        const color = vehicleColors[Math.floor(Math.random() * vehicleColors.length)]
        const vehicleSpeed = 25 + Math.random() * 35

        vehiclesRef.current.push({
          id: nextIdRef.current++,
          lane,
          z: -TRAFFIC_SPAWN_DISTANCE - Math.random() * 30,
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
        actions.setGameState('gameover')
        actions.setSpeed(0)
        return
      }
    }

    // Score: 180 points per second base rate (continuous)
    actions.addScore(Math.floor(180 * clampedDelta))
    actions.setDistance(state.distance + speed * clampedDelta * 0.08)
    
    // Gradually increase speed from 0 to maxSpeed (reaches max in ~15-20 seconds)
    const speedIncrease = state.selectedBike.acceleration * 8 * clampedDelta
    const newSpeed = Math.min(state.selectedBike.maxSpeed, state.speed + speedIncrease)
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
  
  const wheelZ = type === 'bus' || type === 'truck' ? l * 0.35 : l * 0.3
  const wheelPositions = [
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

// ============== CAMERA ==============
function GameCamera() {
  const { camera } = useThree()
  const smoothPosRef = useRef(new THREE.Vector3(0, 4, PLAYER_Z + 8))
  const shakeRef = useRef(0)

  useFrame((_, delta) => {
    const state = getState()
    const playerX = state.playerX
    
    // Chase camera that follows player slightly
    const targetPos = new THREE.Vector3(
      playerX * 0.4,
      3.2 + state.speed * 0.004,
      PLAYER_Z + 6.5 + state.speed * 0.008
    )

    smoothPosRef.current.lerp(targetPos, 3 * delta)
    
    // Screen shake effect
    let shakeX = 0, shakeY = 0
    if (shakeRef.current > 0) {
      shakeRef.current -= delta * 5
      const intensity = shakeRef.current * 0.1
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

// ============== ENVIRONMENT ==============
function Environment() {
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

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -150]}>
        <planeGeometry args={[300, 800]} />
        <meshStandardMaterial color="#5a8a4a" roughness={1} />
      </mesh>

      {/* Distant hills */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -150 + i * 28 + (Math.sin(i * 2.5) * 10)
        const height = 12 + Math.sin(i * 1.7) * 8
        return (
          <mesh key={i} position={[x, height * 0.4, -300]}>
            <coneGeometry args={[height * 0.8, height, 4]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#4a6741' : '#5a7a51'} />
          </mesh>
        )
      })}

      {/* Lighting */}
      <ambientLight intensity={0.55} color="#e8e0d0" />
      <directionalLight
        position={[30, 40, -20]}
        intensity={1.3}
        color="#fff5e0"
      />
      <directionalLight
        position={[-15, 25, 15]}
        intensity={0.25}
        color="#b3d9ff"
      />
      {/* Fill light from below for better visibility */}
      <hemisphereLight
        color="#87ceeb"
        groundColor="#4a7c3f"
        intensity={0.4}
      />
      
      {/* Fog - hides distant vehicles */}
      <fog attach="fog" args={['#a8c8d8', 30, 110]} />
    </>
  )
}

// ============== SPEED LINES ==============
function SpeedLines() {
  const linesRef = useRef<THREE.Group>(null)
  const linesDataRef = useRef<Array<{ x: number; y: number; z: number; speed: number }>>([])

  useEffect(() => {
    const data = []
    for (let i = 0; i < 50; i++) {
      data.push({
        x: (Math.random() - 0.5) * 16,
        y: Math.random() * 6 + 1,
        z: -Math.random() * 80,
        speed: 40 + Math.random() * 40,
      })
    }
    linesDataRef.current = data
  }, [])

  useFrame((_, delta) => {
    const state = getState()
    if (state.gameState !== 'playing' || !linesRef.current) return

    const speedFactor = state.speed / 100
    linesRef.current.children.forEach((child, i) => {
      const line = linesDataRef.current[i]
      if (!line) return
      line.z += (state.speed + line.speed) * delta * 0.5
      if (line.z > 15) {
        line.z = -80 - Math.random() * 40
        line.x = (Math.random() - 0.5) * 16
        line.y = Math.random() * 6 + 1
      }
      child.position.set(line.x, line.y, line.z)
      child.scale.y = speedFactor * 3
      ;(child as THREE.Mesh).visible = speedFactor > 0.4
    })
  })

  return (
    <group ref={linesRef}>
      {Array.from({ length: 50 }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.015, 0.4, 0.015]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
      ))}
    </group>
  )
}

// ============== MAIN SCENE ==============
export function GameScene() {
  const selectedBike = useGameStore((s) => s.selectedBike)

  return (
    <Canvas
      camera={{ position: [0, 4, PLAYER_Z + 8], fov: 65, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <Environment />
      <Highway />
      <Motorcycle bike={selectedBike} />
      <TrafficSystem />
      <SpeedLines />
      <GameCamera />
    </Canvas>
  )
}
