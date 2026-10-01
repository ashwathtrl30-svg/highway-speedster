import type { Bike, Car, BikeSkin } from './store'

const VEHICLE_FACING_RIGHT_STYLE = {
  display: 'block',
} as const

function BikeMenuRider({ compact = false }: { compact?: boolean }) {
  const shoulderY = compact ? 24 : 23
  const hipY = compact ? 35 : 34
  const scale = compact ? 0.92 : 1
  return (
    <g transform={`translate(0 0) scale(${scale})`}>
      {/* Simple stickman rider: light-blue T-shirt + black pants. */}
      <circle cx="49" cy="16.5" r="4.1" fill="#20252a" stroke="#0d0f11" strokeWidth="1" />
      <path d={`M45.4 ${shoulderY + 1} Q49 ${shoulderY - 1} 52.6 ${shoulderY + 1} L55 ${hipY} Q49 ${hipY + 2} 43 ${hipY} Z`} fill="#8ec5e8" stroke="#5d8eaf" strokeWidth="0.7"/>
      
      {/* Arms — forward and down to the bars. */}
      <path d={`M45.6 ${shoulderY + 1} L41.2 26 L36.2 22.2`} fill="none" stroke="#8ec5e8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={`M52.4 ${shoulderY + 1} L48.1 26.4 L42.4 22.8`} fill="none" stroke="#8ec5e8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.92"/>
      <circle cx="36.2" cy="22.2" r="1.25" fill="#111315"/>
      <circle cx="42.4" cy="22.8" r="1.25" fill="#111315"/>
      
      {/* Bent legs — seated naturally on the saddle/foot controls. */}
      <path d={`M45 ${hipY} L49 39 L42.5 43.5`} fill="none" stroke="#17191c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={`M53 ${hipY} L56 39 L50.5 43.5`} fill="none" stroke="#17191c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="42.5" cy="43.5" r="1.2" fill="#101214"/>
      <circle cx="50.5" cy="43.5" r="1.2" fill="#101214"/>
      
      {/* Small helmet visor for a recognizable rider silhouette. */}
      <path d="M46.1 15.8 L51.8 15.8" stroke="#5f6971" strokeWidth="1" strokeLinecap="round"/>
    </g>
  )
}

export function BikeIcon({ bike, skin }: { bike: Bike; skin?: BikeSkin }) {
  if (bike.id === 'blitz') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="25" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="75" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <path d="M 25 45 L 40 30 L 60 30 L 75 45" fill="none" stroke={bike.color} strokeWidth="3"/>
        <ellipse cx="50" cy="32" rx="15" ry="8" fill={bike.color}/>
        <ellipse cx="50" cy="32" rx="12" ry="6" fill={bike.accentColor}/>
        <ellipse cx="55" cy="28" rx="8" ry="4" fill="#1a1a1a"/>
        <line x1="35" y1="25" x2="45" y2="20" stroke="#666" strokeWidth="2"/>
        <circle cx="45" cy="20" r="2" fill="#888"/>
        <circle cx="38" cy="28" r="3" fill="#ffffcc" opacity="0.8"/>
        <BikeMenuRider />
      </g></svg>
    )
  }
  
  if (bike.id === 'apex') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="22" cy="45" r="11" fill="#333" stroke="#555" strokeWidth="2"/>
        <circle cx="78" cy="45" r="11" fill="#333" stroke="#555" strokeWidth="2"/>
        <path d="M 22 45 L 38 28 L 62 28 L 78 45" fill="none" stroke={bike.color} strokeWidth="4"/>
        <rect x="42" y="32" width="16" height="10" fill="#2a2a2a" rx="2"/>
        <rect x="44" y="34" width="12" height="6" fill="#444"/>
        <ellipse cx="50" cy="30" rx="18" ry="10" fill={bike.color}/>
        <ellipse cx="50" cy="30" rx="15" ry="8" fill={bike.accentColor}/>
        <rect x="35" y="29" width="30" height="2" fill="#ccc" opacity="0.6"/>
        <ellipse cx="58" cy="26" rx="10" ry="5" fill="#1a1a1a"/>
        <line x1="32" y1="22" x2="48" y2="18" stroke="#777" strokeWidth="2.5"/>
        <circle cx="48" cy="18" r="2.5" fill="#999"/>
        <circle cx="35" cy="26" r="4" fill="#ffffcc" opacity="0.8"/>
        <line x1="60" y1="38" x2="70" y2="42" stroke="#bbb" strokeWidth="2"/>
        <line x1="58" y1="40" x2="68" y2="44" stroke="#bbb" strokeWidth="2"/>
        <BikeMenuRider />
      </g></svg>
    )
  }
  
  if (bike.id === 'chronos') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="25" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="75" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <path d="M 30 40 L 35 25 L 50 20 L 65 25 L 70 40 Z" fill={bike.color}/>
        <path d="M 35 38 L 38 27 L 50 23 L 62 27 L 65 38 Z" fill={bike.accentColor}/>
        <path d="M 40 25 L 45 18 L 55 18 L 60 25" fill="#333" opacity="0.5"/>
        <ellipse cx="58" cy="32" rx="8" ry="3" fill="#1a1a1a"/>
        <path d="M 65 30 L 72 35 L 70 40" fill={bike.color}/>
        <line x1="38" y1="22" x2="45" y2="20" stroke="#666" strokeWidth="1.5"/>
        <circle cx="37" cy="28" r="2.5" fill="#ffffcc" opacity="0.9"/>
        <circle cx="42" cy="26" r="2.5" fill="#ffffcc" opacity="0.9"/>
        <line x1="62" y1="38" x2="68" y2="42" stroke="#aaa" strokeWidth="1.5"/>
        <BikeMenuRider />
      </g></svg>
    )
  }
  
  if (bike.id === 'stratos' && skin === 'candy-flat-blazed-green') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <defs>
          <linearGradient id="hsStratosGreenBlackBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#32373b" />
            <stop offset="35%" stopColor="#171a1d" />
            <stop offset="72%" stopColor="#0b0e11" />
            <stop offset="100%" stopColor="#262b30" />
          </linearGradient>
          <linearGradient id="hsStratosGreenFrame" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8bf4aa" />
            <stop offset="38%" stopColor="#35cf69" />
            <stop offset="75%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#0d6b35" />
          </linearGradient>
          <linearGradient id="hsStratosGreenTrim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16381f" />
            <stop offset="48%" stopColor="#58e57d" />
            <stop offset="100%" stopColor="#12331c" />
          </linearGradient>
        </defs>

        <circle cx="23" cy="45" r="10" fill="#15171a" stroke="#50585d" strokeWidth="1.8"/>
        <circle cx="77" cy="45" r="10" fill="#15171a" stroke="#50585d" strokeWidth="1.8"/>
        {/* Clearly visible racing cockpit: clip-on bar, grips and mirrors. */}
        <path d="M37 22 L33 15 L41 14" fill="none" stroke="#9aa1a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M29 14 L42 14" stroke="#25292d" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M28 13 L25 12" stroke="#0d1012" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M43 13 L46 12" stroke="#0d1012" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M29 14 L27 10" stroke="#858b90" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M43 13 L45 9" stroke="#858b90" strokeWidth="1.2" strokeLinecap="round"/>
        <ellipse cx="26.5" cy="9.5" rx="2.7" ry="1.5" fill="#171a1d" stroke="#6f777d" strokeWidth="0.7"/>
        <ellipse cx="45.5" cy="8.5" rx="2.7" ry="1.5" fill="#171a1d" stroke="#6f777d" strokeWidth="0.7"/>
        <path d="M31 15 L29 16" stroke="#c2c7ca" strokeWidth="1" strokeLinecap="round"/>
        <path d="M40 15 L42 16" stroke="#c2c7ca" strokeWidth="1" strokeLinecap="round"/>


        {/* Candy Flat Blazed Green trellis/frame treatment. */}
        <path
          d="M23 45 C28 39 33 31 40 29 C47 27 59 29 65 33 C70 36 73 40 77 45"
          fill="none"
          stroke="url(#hsStratosGreenFrame)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M31 39 L44 31 L61 32 L71 39" fill="none" stroke="#26b95a" strokeWidth="1.7" opacity=".9"/>

        {/* Mirror-coated matte spark black bodywork. */}
        <path
          d="M23 44 L29 25 L40 18 L57 17 L68 23 L74 33 L77 43 C66 45 42 45 23 44Z"
          fill="url(#hsStratosGreenBlackBody)"
        />
        <path
          d="M34 27 C38 21 45 18 52 18 C59 18 65 21 69 26 L62 31 C54 28 44 28 34 31Z"
          fill="#22282d"
        />
        <path
          d="M40 22 L48 17 L59 18 L65 23 L58 25 L46 24Z"
          fill="#090b0e"
        />

        {/* H2-style green graphic accents and pinstriping. */}
        <path d="M30 33 L43 28 L46 31 L33 36Z" fill="#45dc73"/>
        <path d="M42 28 L57 25 L61 28 L48 31Z" fill="#70ef95"/>
        <path d="M57 25 L67 28 L69 31 L61 29Z" fill="#25bc59"/>
        <path d="M59 31 L70 33 L73 36 L63 35Z" fill="url(#hsStratosGreenTrim)"/>
        <path d="M35 38 L55 33 L61 36 L40 40Z" fill="#1f8f47" opacity=".9"/>

        {/* Metallic highlights and carbon details. */}
        <path d="M31 28 L48 22 L51 24 L34 31Z" fill="#b9c2c7" opacity=".62"/>
        <path d="M43 39 L65 34 L69 36 L49 41Z" fill="#dce4e7" opacity=".18"/>
        <path d="M64 37 L74 40 L72 42 L63 39Z" stroke="#6be68c" strokeWidth="1.8" fill="none"/>

        {/* Headlight / cockpit and exhaust. */}
        <path d="M33 26 L39 23 L39 28 L34 30Z" fill="#fff8cf" opacity=".98"/>
        <path d="M66 35 L78 36 L82 39 L71 39Z" fill="#2bc462"/>
        <circle cx="80" cy="38" r="1.5" fill="#101316"/>

        {/* Small glossy paint reflections. */}
        <path d="M29 25 C39 19 50 16 61 18" fill="none" stroke="#f4f7f8" strokeWidth="1.1" opacity=".24"/>
        <path d="M31 36 C39 34 46 32 54 31" fill="none" stroke="#9ff8b7" strokeWidth="1" opacity=".45"/>
        <BikeMenuRider />
      </g></svg>
    )
  }

  if (bike.id === 'stratos') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="23" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        <circle cx="77" cy="45" r="10" fill="#333" stroke="#555" strokeWidth="1.5"/>
        {/* Clearly visible racing cockpit: clip-on bar, grips and mirrors. */}
        <path d="M37 22 L33 15 L41 14" fill="none" stroke="#9aa1a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M29 14 L42 14" stroke="#25292d" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M28 13 L25 12" stroke="#0d1012" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M43 13 L46 12" stroke="#0d1012" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M29 14 L27 10" stroke="#858b90" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M43 13 L45 9" stroke="#858b90" strokeWidth="1.2" strokeLinecap="round"/>
        <ellipse cx="26.5" cy="9.5" rx="2.7" ry="1.5" fill="#171a1d" stroke="#6f777d" strokeWidth="0.7"/>
        <ellipse cx="45.5" cy="8.5" rx="2.7" ry="1.5" fill="#171a1d" stroke="#6f777d" strokeWidth="0.7"/>
        <path d="M31 15 L29 16" stroke="#c2c7ca" strokeWidth="1" strokeLinecap="round"/>
        <path d="M40 15 L42 16" stroke="#c2c7ca" strokeWidth="1" strokeLinecap="round"/>

        <path d="M 25 42 L 30 22 L 48 16 L 68 22 L 75 42 Z" fill={bike.color}/>
        <path d="M 32 40 L 35 25 L 48 20 L 63 25 L 68 40 Z" fill={bike.accentColor}/>
        <path d="M 36 22 L 42 14 L 54 14 L 58 22" fill="#222" opacity="0.6"/>
        <ellipse cx="60" cy="30" rx="9" ry="2.5" fill="#1a1a1a"/>
        <path d="M 68 28 L 78 32 L 75 40" fill={bike.color}/>
        <line x1="35" y1="20" x2="44" y2="17" stroke="#555" strokeWidth="1.5"/>
        <path d="M 33 26 L 38 24 L 38 28 Z" fill="#ffffcc" opacity="0.9"/>
        <line x1="65" y1="36" x2="73" y2="40" stroke="#999" strokeWidth="2"/>
        <line x1="40" y1="30" x2="60" y2="30" stroke={bike.accentColor} strokeWidth="1.5" opacity="0.7"/>
        <BikeMenuRider />
      </g></svg>
    )
  }
  
  if (bike.id === 'zenith' && skin === 'tricolore-livery') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <defs>
          <linearGradient id="hsZenithTriWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="52%" stopColor="#f0f1ee" />
            <stop offset="100%" stopColor="#cfd3d0" />
          </linearGradient>
          <linearGradient id="hsZenithTriRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef3849" />
            <stop offset="55%" stopColor="#c91629" />
            <stop offset="100%" stopColor="#8e0f1c" />
          </linearGradient>
          <linearGradient id="hsZenithTriGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#37b86c" />
            <stop offset="55%" stopColor="#148348" />
            <stop offset="100%" stopColor="#0b5831" />
          </linearGradient>
        </defs>

        <circle cx="22" cy="45" r="10" fill="#17191c" stroke="#596168" strokeWidth="1.6"/>
        <circle cx="78" cy="45" r="10" fill="#17191c" stroke="#596168" strokeWidth="1.6"/>
        {/* Hyperbike racing cockpit: substantial top clamp, clip-ons, grips and mirrors. */}
        <path d="M40 18 L37 12 L45 11" fill="none" stroke="#bcc2c6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M32 11 L46 11" stroke="#1b1e22" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M31 10 L28 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M47 10 L50 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M33 11 L30 6.5" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <path d="M46 10.5 L49 6" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <ellipse cx="29.5" cy="6.2" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <ellipse cx="49.5" cy="5.7" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <circle cx="40" cy="11" r="2.1" fill="#777d82" opacity=".95"/>
        <path d="M34 12 L32 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>
        <path d="M45 12 L47 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>


        {/* White Panigale-style fairing base. */}
        <path
          d="M22 43 L28 18 L46 12 L70 18 L78 43 C65 46 39 46 22 43Z"
          fill="url(#hsZenithTriWhite)"
        />

        {/* Aggressive asymmetric Italian tricolore treatment. */}
        <path d="M29 19 L45 13 L46 27 L34 34 L27 40Z" fill="url(#hsZenithTriGreen)"/>
        <path d="M46 13 L59 15 L60 29 L50 32 L46 27Z" fill="#f5f6f3"/>
        <path d="M59 15 L70 19 L76 32 L67 38 L60 29Z" fill="url(#hsZenithTriRed)"/>

        {/* Lower black/checkered racing section. */}
        <path d="M27 39 L38 34 L52 33 L66 38 L75 40 L77 43 C63 46 38 46 25 43Z" fill="#121519"/>
        {[0,1,2,3,4,5].map((n) => (
          <g key={n}>
            <rect x={31 + n * 7} y="38" width="4" height="3" fill={n % 2 === 0 ? "#f4f4f1" : "#101317"} opacity=".9"/>
            <rect x={34.5 + n * 7} y="41" width="4" height="3" fill={n % 2 === 0 ? "#101317" : "#f4f4f1"} opacity=".9"/>
          </g>
        ))}

        {/* Black cockpit / carbon aero surfaces. */}
        <path d="M34 18 L40 11 L53 10 L59 17 L55 22 L42 22Z" fill="#0a0d11"/>
        <path d="M58 19 L70 18 L77 29 L73 33 L64 28Z" fill="#111419"/>
        <path d="M71 31 L82 34 L86 38 L73 38Z" fill="#0b0e11"/>

        {/* Racing slash, headlight and metallic details. */}
        <path d="M31 29 L46 24 L50 27 L35 33Z" fill="#ffffff" opacity=".9"/>
        <path d="M31 26 L37 23 L37 28 L32 30Z" fill="#fff7cf"/>
        <path d="M67 38 L78 40 L74 42 L64 40Z" fill="#d2d6d7"/>
        <path d="M67 35 L78 37" stroke="#e1e5e6" strokeWidth="1.4" opacity=".55"/>
        <circle cx="73" cy="30" r="1.3" fill="#ffffff" opacity=".9"/>
        <BikeMenuRider />
      </g></svg>
    )
  }

  if (bike.id === 'zenith' && skin === 'winter-test') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <defs>
          <linearGradient id="hsZenithWinterBlack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2a2e32" />
            <stop offset="42%" stopColor="#14171a" />
            <stop offset="100%" stopColor="#080a0d" />
          </linearGradient>
          <linearGradient id="hsZenithWinterTank" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d7dadd" />
            <stop offset="50%" stopColor="#9ba1a5" />
            <stop offset="100%" stopColor="#e4e6e7" />
          </linearGradient>
        </defs>

        <circle cx="22" cy="45" r="10" fill="#111316" stroke="#4b5359" strokeWidth="1.6"/>
        <circle cx="78" cy="45" r="10" fill="#111316" stroke="#4b5359" strokeWidth="1.6"/>
        {/* Hyperbike racing cockpit: substantial top clamp, clip-ons, grips and mirrors. */}
        <path d="M40 18 L37 12 L45 11" fill="none" stroke="#bcc2c6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M32 11 L46 11" stroke="#1b1e22" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M31 10 L28 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M47 10 L50 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M33 11 L30 6.5" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <path d="M46 10.5 L49 6" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <ellipse cx="29.5" cy="6.2" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <ellipse cx="49.5" cy="5.7" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <circle cx="40" cy="11" r="2.1" fill="#777d82" opacity=".95"/>
        <path d="M34 12 L32 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>
        <path d="M45 12 L47 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>


        {/* Matte-black Winter Test fairings. */}
        <path
          d="M22 43 L28 18 L46 12 L70 18 L78 43 C64 46 39 46 22 43Z"
          fill="url(#hsZenithWinterBlack)"
        />

        {/* Exposed brushed-aluminium tank. */}
        <path d="M34 16 L46 12 L60 15 L63 24 L53 28 L41 24Z" fill="url(#hsZenithWinterTank)"/>
        <path d="M39 15 L48 13 L58 16" fill="none" stroke="#f2f3f4" strokeWidth="1.1" opacity=".7"/>

        {/* Bright Ducati-red race accents. */}
        <path d="M29 25 L42 20 L45 23 L32 29Z" fill="#e21b2e"/>
        <path d="M55 25 L68 21 L72 25 L59 29Z" fill="#c91528"/>
        <path d="M30 35 L47 31 L53 34 L34 39Z" fill="#ed1b31"/>
        <path d="M58 34 L73 36 L76 39 L61 38Z" fill="#e21b2e"/>
        <path d="M44 41 L64 38 L69 40 L50 44Z" fill="#b50f20"/>

        {/* Carbon-style wings and dark lower fairing. */}
        <path d="M32 20 L25 25 L30 28 L38 24Z" fill="#090b0e"/>
        <path d="M61 20 L72 22 L79 28 L70 30Z" fill="#0a0c10"/>
        <path d="M27 39 L38 35 L52 35 L67 39 L76 41 L77 43 C63 46 39 46 24 43Z" fill="#0a0d10"/>

        {/* Brushed-metal exhaust / lower hardware. */}
        <path d="M61 38 L74 39 L82 42 L69 43Z" fill="#b5b9bb"/>
        <path d="M67 40 L79 41" stroke="#eceff0" strokeWidth="1" opacity=".65"/>
        <path d="M30 28 L42 23" stroke="#f1f3f4" strokeWidth="1" opacity=".35"/>

        {/* Headlight, Italian-flag wing mark and race details. */}
        <path d="M31 23 L37 20 L37 25 L32 27Z" fill="#fff9d0"/>
        <path d="M69 27 L74 28 L76 30 L70 30Z" fill="#159447"/>
        <path d="M73 27 L77 29 L79 31 L74 30Z" fill="#e21b2e"/>
        <rect x="62" y="34" width="7" height="1.4" rx=".7" fill="#f3f4f4" opacity=".7"/>
        <BikeMenuRider />
      </g></svg>
    )
  }

  if (bike.id === 'zenith') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="22" cy="45" r="10" fill="#222" stroke="#444" strokeWidth="1.5"/>
        <circle cx="78" cy="45" r="10" fill="#222" stroke="#444" strokeWidth="1.5"/>
        {/* Hyperbike racing cockpit: substantial top clamp, clip-ons, grips and mirrors. */}
        <path d="M40 18 L37 12 L45 11" fill="none" stroke="#bcc2c6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M32 11 L46 11" stroke="#1b1e22" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M31 10 L28 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M47 10 L50 9" stroke="#07090b" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M33 11 L30 6.5" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <path d="M46 10.5 L49 6" stroke="#9aa0a5" strokeWidth="1.25" strokeLinecap="round"/>
        <ellipse cx="29.5" cy="6.2" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <ellipse cx="49.5" cy="5.7" rx="3" ry="1.6" fill="#0b0d10" stroke="#777e84" strokeWidth="0.75"/>
        <circle cx="40" cy="11" r="2.1" fill="#777d82" opacity=".95"/>
        <path d="M34 12 L32 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>
        <path d="M45 12 L47 13" stroke="#d7dbde" strokeWidth="1" strokeLinecap="round"/>

        <line x1="22" y1="38" x2="22" y2="52" stroke="#555" strokeWidth="0.5"/>
        <line x1="15" y1="45" x2="29" y2="45" stroke="#555" strokeWidth="0.5"/>
        <line x1="78" y1="38" x2="78" y2="52" stroke="#555" strokeWidth="0.5"/>
        <line x1="71" y1="45" x2="85" y2="45" stroke="#555" strokeWidth="0.5"/>
        <path d="M 22 43 L 28 18 L 46 12 L 70 18 L 78 43 Z" fill={bike.color}/>
        <path d="M 30 41 L 33 22 L 46 16 L 64 22 L 70 41 Z" fill={bike.accentColor}/>
        <path d="M 34 18 L 40 10 L 52 10 L 56 18" fill="#111" opacity="0.7"/>
        <ellipse cx="62" cy="28" rx="10" ry="2" fill="#0a0a0a"/>
        <path d="M 70 25 L 82 28 L 78 40" fill={bike.color}/>
        <line x1="33" y1="16" x2="42" y2="13" stroke="#444" strokeWidth="1.5"/>
        <rect x="30" y="22" width="8" height="2" rx="1" fill="#ffffcc" opacity="0.9"/>
        <line x1="68" y1="34" x2="76" y2="38" stroke="#888" strokeWidth="1.5"/>
        <line x1="66" y1="36" x2="74" y2="40" stroke="#888" strokeWidth="1.5"/>
        <line x1="38" y1="28" x2="62" y2="28" stroke={bike.accentColor} strokeWidth="1" opacity="0.8"/>
        <line x1="40" y1="32" x2="60" y2="32" stroke={bike.accentColor} strokeWidth="1" opacity="0.5"/>
        <BikeMenuRider />
      </g></svg>
    )
  }
  
  return <span className="text-2xl sm:text-3xl">🏍️</span>
}

export function CarIcon({ car }: { car: Car }) {
  const common = { fill: car.color, accent: car.accentColor }

  if (car.id === 'kanto-zip') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="23" cy="46" r="9" fill="#222" stroke="#777" strokeWidth="2"/>
        <circle cx="77" cy="46" r="9" fill="#222" stroke="#777" strokeWidth="2"/>
        <path d="M13 43 L18 33 L28 31 L38 22 L56 21 L66 25 L73 33 L84 38 L87 43Z" fill={common.fill}/>
        <path d="M29 30 L39 22 L55 22 L64 30Z" fill={common.accent}/>
        <path d="M40 23 L53 23 L60 29 L43 29Z" fill="#172330"/>
        <path d="M15 40 L28 40 L28 43 L15 43Z" fill="#303030"/>
        <rect x="18" y="35" width="10" height="3" rx="1.5" fill="#f4f4f4"/>
        <rect x="72" y="37" width="9" height="3" rx="1.5" fill="#d9343a"/>
        <path d="M69 29 L78 34 L81 37 L68 37Z" fill={common.accent} opacity="0.45"/>
      </g></svg>
    )
  }

  if (car.id === 'saber-swift') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="19" cy="47" r="9" fill="#1d1d1d" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="47" r="9" fill="#1d1d1d" stroke="#777" strokeWidth="2"/>
        <path d="M9 43 L16 35 L29 32 L39 25 L61 25 L72 30 L79 34 L90 38 L92 43Z" fill={common.fill}/>
        <path d="M30 32 L40 25 L60 25 L71 31Z" fill={common.accent}/>
        <path d="M41 26 L58 26 L66 31 L45 31Z" fill="#1e2b3a"/>
        <path d="M15 38 L29 35 L73 35 L86 39 L84 42 L16 42Z" fill={common.accent} opacity="0.28"/>
        <rect x="13" y="40" width="13" height="2.5" rx="1" fill="#f5f5f5"/>
        <rect x="76" y="39" width="10" height="3" rx="1" fill="#c7363d"/>
        <rect x="38" y="38" width="30" height="2" rx="1" fill="#dfe6ee" opacity="0.75"/>
        <path d="M70 31 L74 28 L78 31" stroke="#9ba8b4" strokeWidth="1.3" fill="none"/>
      </g></svg>
    )
  }

  if (car.id === 'goliath-titan') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="19" cy="47" r="10.5" fill="#202020" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="47" r="10.5" fill="#202020" stroke="#777" strokeWidth="2"/>
        <path d="M10 44 L14 28 L24 24 L24 16 L68 16 L77 22 L82 27 L88 30 L91 44Z" fill={common.fill}/>
        <rect x="28" y="19" width="39" height="14" rx="2" fill="#22313b"/>
        <path d="M17 29 L27 27 L27 38 L16 39Z" fill={common.accent} opacity="0.62"/>
        <rect x="24" y="37" width="50" height="5" rx="2" fill="#3b4147"/>
        <rect x="75" y="35" width="10" height="4" rx="1.5" fill="#cf3434"/>
        <circle cx="82" cy="29" r="3.2" fill="#333" stroke="#8b8b8b" strokeWidth="1"/>
        <path d="M30 15 L37 11 L63 11 L69 15" fill="none" stroke={common.accent} strokeWidth="2"/>
        <path d="M14 42 L14 34 M86 42 L86 34" stroke="#6e7377" strokeWidth="2"/>
      </g></svg>
    )
  }

  if (car.id === 'kaiser-monarch') {
    return (
      <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
        <circle cx="19" cy="46" r="9" fill="#191919" stroke="#777" strokeWidth="2"/>
        <circle cx="81" cy="46" r="9" fill="#191919" stroke="#777" strokeWidth="2"/>
        <path d="M8 43 L17 33 L29 30 L45 20 L62 18 L74 23 L82 30 L92 36 L94 43Z" fill={common.fill}/>
        <path d="M32 30 L46 21 L61 19 L72 24 L77 30Z" fill="#16202c"/>
        <path d="M18 35 L31 32 L76 31 L85 35 L82 39 L17 39Z" fill={common.accent} opacity="0.27"/>
        <path d="M75 34 L88 35 L91 38 L76 38Z" fill="#101820"/>
        <rect x="15" y="39" width="13" height="2.5" rx="1" fill="#f2eab7"/>
        <rect x="74" y="39" width="13" height="3" rx="1" fill="#d92f3b"/>
        <rect x="36" y="38" width="29" height="2" rx="1" fill="#c9cdd2"/>
        <path d="M68 25 L80 24 L84 27" stroke={common.accent} strokeWidth="2" fill="none"/>
      </g></svg>
    )
  }

  // Scuderia Fury — very low wedge supercar with a long nose, wide stance and rear wing.
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full" style={VEHICLE_FACING_RIGHT_STYLE}><g transform="translate(100 0) scale(-1 1)">
      <circle cx="18" cy="46" r="8" fill="#111" stroke="#777" strokeWidth="2"/>
      <circle cx="82" cy="46" r="8" fill="#111" stroke="#777" strokeWidth="2"/>
      <path d="M5 43 L15 36 L28 33 L41 23 L58 18 L70 22 L81 30 L91 35 L95 43Z" fill={common.fill}/>
      <path d="M35 31 L44 24 L58 19 L69 24 L77 30Z" fill="#101820"/>
      <path d="M13 36 L29 33 L75 32 L88 36 L84 39 L11 39Z" fill={common.accent} opacity="0.24"/>
      <path d="M70 34 L87 34 L92 38 L72 38Z" fill="#0c0f12"/>
      <path d="M72 26 L85 28 L90 31" stroke="#252a31" strokeWidth="2.5" fill="none"/>
      <rect x="12" y="39" width="18" height="2.5" rx="1" fill="#f7eeb4"/>
      <rect x="70" y="39" width="18" height="2.5" rx="1" fill="#e12d3b"/>
      <path d="M59 21 L87 21 L89 24 L61 24Z" fill="#111"/>
      <path d="M8 42 L14 39 M92 42 L86 39" stroke={common.accent} strokeWidth="2"/>
    </g></svg>
  )
}
