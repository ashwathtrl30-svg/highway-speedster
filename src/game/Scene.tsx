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
const TRAFFIC_SPAWN_DISTANCE = 65
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
              <RoadsideTree position={[-ROAD_WIDTH / 2 - 4 - (i * 0.37) % 3, 0, (i * 0.73) % 10 - 5]} />
              <RoadsideTree position={[ROAD_WIDTH / 2 + 4 + (i * 0.41) % 3, 0, (i * 0.67) % 10 - 5]} />
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
  const scale = useMemo(() => 0.8 + (position[0] * 0.13 + position[2] * 0.17) % 0.6, [position])
  return (
    <group position={position} scale={scale}>
      {/* Trunk - tapered cylinder */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 3, 6]} />
        <meshStandardMaterial color="#3e2723" roughness={0.9} />
      </mesh>
      
      {/* Main foliage cluster - bottom layer */}
      <mesh position={[0, 3.2, 0]}>
        <sphereGeometry args={[1.3, 8, 6]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      
      {/* Middle foliage */}
      <mesh position={[0.5, 3.8, 0.3]}>
        <sphereGeometry args={[1.0, 7, 5]} />
        <meshStandardMaterial color="#388e3c" roughness={0.8} />
      </mesh>
      <mesh position={[-0.4, 3.6, -0.3]}>
        <sphereGeometry args={[0.9, 7, 5]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.8} />
      </mesh>
      
      {/* Top foliage */}
      <mesh position={[0.2, 4.5, 0.1]}>
        <sphereGeometry args={[0.8, 6, 5]} />
        <meshStandardMaterial color="#43a047" roughness={0.8} />
      </mesh>
      <mesh position={[-0.3, 4.3, 0.2]}>
        <sphereGeometry args={[0.7, 6, 5]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      
      {/* Small detail clusters */}
      <mesh position={[0.7, 3.3, -0.2]}>
        <sphereGeometry args={[0.5, 5, 4]} />
        <meshStandardMaterial color="#388e3c" roughness={0.8} />
      </mesh>
      <mesh position={[-0.6, 4.0, 0.4]}>
        <sphereGeometry args={[0.4, 5, 4]} />
        <meshStandardMaterial color="#43a047" roughness={0.8} />
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
      {/* Main bush body */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.55, 6, 5]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
      </mesh>
      
      {/* Bush detail clusters */}
      <mesh position={[0.3, 0.3, 0.2]}>
        <sphereGeometry args={[0.4, 5, 4]} />
        <meshStandardMaterial color="#388e3c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.25, 0.28, -0.15]}>
        <sphereGeometry args={[0.35, 5, 4]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 0.45, 0.1]}>
        <sphereGeometry args={[0.3, 5, 4]} />
        <meshStandardMaterial color="#43a047" roughness={0.9} />
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

  // Render different bike models based on bike type
  const renderBikeModel = () => {
    switch (bike.id) {
      case 'blitz':
        return <BlitzBike bike={bike} />
      case 'apex':
        return <ApexBike bike={bike} />
      case 'chronos':
        return <ChronosBike bike={bike} />
      case 'stratos':
        return <StratosBike bike={bike} />
      case 'zenith':
        return <ZenithBike bike={bike} />
      default:
        return <BlitzBike bike={bike} />
    }
  }

  return (
    <group ref={meshRef} position={[0, 0, PLAYER_Z]}>
      {renderBikeModel()}
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
      <mesh position={[0, 0.25, -0.92]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.07, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, -0.92]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.8} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh position={[0, 0.25, 0.82]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.09, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.82]} rotation={[0, 0, Math.PI / 2]}>
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
      <pointLight position={[0, 0.62, -1.4]} intensity={0.5} distance={15} color="#ffffee" />

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
      <mesh position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.09, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.08, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.28, 0.11, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.85]} rotation={[0, 0, Math.PI / 2]}>
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
      <pointLight position={[0, 0.65, -1.5]} intensity={0.6} distance={15} color="#ffffee" />

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
      <mesh position={[0, 0.25, -0.98]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.25, 0.08, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, -0.98]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 8]} />
        <meshStandardMaterial color="#555555" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel - wider */}
      <mesh position={[0, 0.25, 0.88]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.27, 0.12, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.88]} rotation={[0, 0, Math.PI / 2]}>
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
      <pointLight position={[0, 0.68, -1.5]} intensity={0.7} distance={15} color="#ffffee" />

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
      <mesh position={[0, 0.25, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.075, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.055, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.85} />
      </mesh>
      
      {/* Rear wheel */}
      <mesh position={[0, 0.25, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.26, 0.11, 8, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.14, 8]} />
        <meshStandardMaterial color="#666666" metalness={0
