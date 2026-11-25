import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Sign, useFacadeMats, type Props } from './CivicShapes'

/*
 * Residents' businesses. Each type has its own building, and upgrades are
 * drawn in a way that suits the type (a garage gets a waiting area, not cafe
 * umbrellas). Everything fits inside data.size; +z faces the street.
 */

interface Lay {
  W: number
  D: number
  /** Building footprint: centre x/z, width, depth. */
  bx: number
  bz: number
  bw: number
  bd: number
  /** z of the front wall. */
  fz: number
  /** Depth of the forecourt between the front wall and the plot edge. */
  apron: number
  /** Width of the free strip on the left (parking, waiting area). */
  side: number
}

function layout(W: number, D: number): Lay {
  const apron = THREE.MathUtils.clamp(D * 0.28, 1.4, 3)
  const side = W >= 9 ? Math.min(3.6, W * 0.3) : 0
  const bw = W - side
  const bd = D - apron
  const bx = side / 2
  const bz = -apron / 2
  return { W, D, bx, bz, bw, bd, fz: bz + bd / 2, apron, side }
}

function contrast(color: string) {
  const hsl = { h: 0, s: 0, l: 0 }
  new THREE.Color(color).getHSL(hsl)
  return hsl.l > 0.6 ? { bg: '#1f1f22', fg: '#f4efe6' } : { bg: '#f4efe6', fg: '#1f1f22' }
}

function Glass({ size, at, night }: { size: [number, number, number]; at: [number, number, number]; night: boolean }) {
  return <Box size={size} at={at} color={night ? '#f3d9a4' : '#8fb3c9'} rough={0.08} metal={0.5} cast={false} emissive="#ffd59a" ei={night ? 0.9 : 0} />
}

/** A shop window split into panes by thin frames. */
function Storefront({ x, z, w, h, y0 = 0.25, panes, frame, night }: { x: number; z: number; w: number; h: number; y0?: number; panes: number; frame: string; night: boolean }) {
  const pw = w / panes
  return (
    <group position={[x, 0, z]}>
      <Glass size={[w, h, 0.06]} at={[0, y0 + h / 2, 0]} night={night} />
      {Array.from({ length: panes + 1 }, (_, i) => (
        <Box key={i} size={[0.1, h + 0.1, 0.12]} at={[-w / 2 + i * pw, y0 + h / 2, 0.02]} color={frame} cast={false} />
      ))}
      <Box size={[w + 0.1, 0.1, 0.12]} at={[0, y0 + h, 0.02]} color={frame} cast={false} />
      <Box size={[w + 0.1, 0.1, 0.12]} at={[0, y0, 0.02]} color={frame} cast={false} />
    </group>
  )
}

export function Car({ at, rot = 0, color }: { at: [number, number, number]; rot?: number; color: string }) {
  return (
    <group position={at} rotation={[0, rot, 0]}>
      <Box size={[1.7, 0.55, 3.9]} at={[0, 0.55, 0]} color={color} rough={0.35} metal={0.4} />
      <Box size={[1.5, 0.5, 2]} at={[0, 1.06, -0.25]} color="#2a3540" rough={0.1} metal={0.5} />
      {[-1.2, 1.2].map((z) =>
        [-0.82, 0.82].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.33, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.33, 0.33, 0.24, 12]} />
            <meshStandardMaterial color="#1b1c1e" roughness={0.9} />
          </mesh>
        )),
      )}
      <Box size={[0.4, 0.14, 0.05]} at={[-0.55, 0.62, 1.96]} color="#fff6d8" cast={false} emissive="#fff1c4" ei={0.4} />
      <Box size={[0.4, 0.14, 0.05]} at={[0.55, 0.62, 1.96]} color="#fff6d8" cast={false} emissive="#fff1c4" ei={0.4} />
    </group>
  )
}

function Tyres({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.16 + i * 0.27, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.36, 0.14, 8, 18]} />
          <meshStandardMaterial color="#1d1e20" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/* Building types -------------------------------------------------------- */

function Coffee({ data, L, night }: { data: Props['data']; L: Lay; night: boolean }) {
  const h = 3.9
  const c = contrast(data.color)
  const stripes = Math.max(4, Math.round(L.bw / 0.8))
  return (
    <group>
      <Box size={[L.bw, h, L.bd]} at={[L.bx, h / 2, L.bz]} color={data.color} rough={0.85} />
      <Box size={[L.bw + 0.2, 0.4, L.bd + 0.2]} at={[L.bx, h + 0.2, L.bz]} color="#f1ece2" />
      <Storefront x={L.bx - 0.5} z={L.fz + 0.04} w={L.bw - 2.6} h={2.3} panes={3} frame="#2b2b2b" night={night} />
      <Box size={[1.1, 2.3, 0.08]} at={[L.bx + L.bw / 2 - 1.2, 1.15, L.fz + 0.05]} color="#3b2a1e" />
      {/* striped awning */}
      {Array.from({ length: stripes }, (_, i) => (
        <mesh key={i} position={[L.bx - L.bw / 2 + (i + 0.5) * (L.bw / stripes), 2.85, L.fz + 0.65]} rotation={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[L.bw / stripes, 0.06, 1.35]} />
          <meshStandardMaterial color={i % 2 ? '#f4efe6' : data.color} roughness={0.8} />
        </mesh>
      ))}
      <Sign text={data.name} at={[L.bx, 3.5, L.fz + 0.08]} w={Math.min(L.bw - 0.6, 6)} h={0.7} bg={c.bg} fg={c.fg} night={night} />
      {/* chalkboard menu by the door */}
      <group position={[L.bx + L.bw / 2 - 2.2, 0, L.fz + 0.8]} rotation={[0, 0.3, 0]}>
        <Box size={[0.6, 0.9, 0.06]} at={[0, 0.55, 0]} color="#2c3a30" />
        <Box size={[0.66, 0.06, 0.1]} at={[0, 1.02, 0]} color="#8a6a48" cast={false} />
      </group>
      <Box size={[1.2, 0.6, 0.9]} at={[L.bx - L.bw / 4, h + 0.7, L.bz - 0.5]} color="#c9cdd1" metal={0.4} />
    </group>
  )
}

function Diner({ data, L, night }: { data: Props['data']; L: Lay; night: boolean }) {
  const h = 3.5
  const c = contrast(data.color)
  const signW = Math.min(L.bw * 0.85, 7)
  return (
    <group>
      <Box size={[L.bw, h, L.bd]} at={[L.bx, h / 2, L.bz]} color="#f2ede3" rough={0.7} />
      <Box size={[L.bw + 0.06, 0.55, L.bd + 0.06]} at={[L.bx, 0.6, L.bz]} color={data.color} rough={0.6} />
      <Box size={[L.bw + 0.08, 0.1, L.bd + 0.08]} at={[L.bx, 2.55, L.bz]} color="#c7ccd1" metal={0.8} rough={0.25} />
      <Box size={[L.bw + 0.3, 0.3, L.bd + 0.3]} at={[L.bx, h + 0.15, L.bz]} color={data.color} />
      <Storefront x={L.bx - 0.6} z={L.fz + 0.04} w={L.bw - 2.4} h={1.3} y0={1.0} panes={Math.max(3, Math.round(L.bw / 1.6))} frame="#c7ccd1" night={night} />
      <Box size={[1, 2.2, 0.08]} at={[L.bx + L.bw / 2 - 1, 1.1, L.fz + 0.05]} color="#c7ccd1" metal={0.6} rough={0.3} />
      {/* tall roof sign on two legs */}
      {[-signW / 2 + 0.4, signW / 2 - 0.4].map((x) => (
        <Box key={x} size={[0.14, 1.3, 0.14]} at={[L.bx + x, h + 0.9, L.bz]} color="#3a3f45" metal={0.5} />
      ))}
      <Sign text={data.name} at={[L.bx, h + 2.05, L.bz]} w={signW} h={1.2} bg={c.bg} fg={c.fg} night={night} />
    </group>
  )
}

function Restaurant({ data, L, night, shadows }: { data: Props['data']; L: Lay; night: boolean; shadows: boolean }) {
  const h = 6.6
  const m = useFacadeMats(data.id + data.color, data.color, 'shopfront', L.bw, L.bd, h, night, 0.8)
  const c = contrast(data.color)
  return (
    <group>
      <mesh position={[L.bx, h / 2, L.bz]} material={m.all} castShadow={shadows} receiveShadow>
        <boxGeometry args={[L.bw, h, L.bd]} />
      </mesh>
      <Box size={[L.bw + 0.4, 0.4, L.bd + 0.4]} at={[L.bx, h + 0.2, L.bz]} color="#4a4d52" />
      <Box size={[L.bw + 0.2, 0.18, 0.3]} at={[L.bx, 3.3, L.fz + 0.12]} color="#d9cfbd" />
      {/* entrance canopy with lanterns */}
      <Box size={[2.6, 0.14, 1.6]} at={[L.bx, 2.75, L.fz + 0.8]} color="#1f1f22" />
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[L.bx + x, 0, L.fz + 1.45]}>
          <Box size={[0.08, 2.7, 0.08]} at={[0, 1.35, 0]} color="#1f1f22" metal={0.6} />
          <Box size={[0.24, 0.34, 0.24]} at={[0, 2.35, 0]} color="#fff0c8" cast={false} emissive="#ffcf7a" ei={night ? 2.5 : 0.2} />
        </group>
      ))}
      <Box size={[1.4, 2.4, 0.08]} at={[L.bx, 1.2, L.fz + 0.05]} color="#3a2418" />
      <Sign text={data.name} at={[L.bx, 4.2, L.fz + 0.1]} w={Math.min(L.bw - 0.8, 6.5)} h={1} bg={c.bg} fg={c.fg} night={night} />
      {/* flower boxes under the upper windows */}
      {[-L.bw / 3, 0, L.bw / 3].map((x) => (
        <group key={x} position={[L.bx + x, 4.95, L.fz + 0.2]}>
          <Box size={[1.2, 0.22, 0.3]} at={[0, 0, 0]} color="#5a3c28" cast={false} />
          <Box size={[1.1, 0.2, 0.26]} at={[0, 0.18, 0]} color="#c2423a" cast={false} />
        </group>
      ))}
    </group>
  )
}

function Store({ data, L, night }: { data: Props['data']; L: Lay; night: boolean }) {
  const h = 4.5
  const c = contrast(data.color)
  return (
    <group>
      <Box size={[L.bw, h, L.bd]} at={[L.bx, h / 2, L.bz]} color="#e4e6e8" rough={0.6} />
      {/* coloured fascia across the whole front */}
      <Box size={[L.bw + 0.2, 1.1, 0.4]} at={[L.bx, h - 0.45, L.fz + 0.15]} color={data.color} />
      <Sign text={data.name} at={[L.bx, h - 0.45, L.fz + 0.38]} w={Math.min(L.bw - 1, 7.5)} h={0.8} bg={c.bg} fg={c.fg} night={night} />
      <Storefront x={L.bx} z={L.fz + 0.04} w={L.bw - 0.8} h={2.9} y0={0.1} panes={Math.max(4, Math.round(L.bw / 1.5))} frame="#9aa1a8" night={night} />
      {/* sliding doors */}
      <Box size={[1.8, 2.5, 0.06]} at={[L.bx, 1.35, L.fz + 0.1]} color="#cfe0ea" rough={0.05} metal={0.6} cast={false} />
      <Box size={[0.06, 2.5, 0.1]} at={[L.bx, 1.35, L.fz + 0.12]} color="#9aa1a8" cast={false} />
      {/* shopping carts */}
      <group position={[L.bx - L.bw / 2 + 1.2, 0, L.fz + 0.8]}>
        {[0, 0.35, 0.7].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Box size={[0.5, 0.45, 0.8]} at={[0, 0.65, 0]} color="#b7bcc1" metal={0.7} rough={0.3} cast={false} />
            <Box size={[0.5, 0.05, 0.05]} at={[0, 1.0, -0.42]} color={data.color} cast={false} />
          </group>
        ))}
      </group>
      <Box size={[1.4, 0.5, 1]} at={[L.bx + L.bw / 4, h + 0.25, L.bz]} color="#c9cdd1" metal={0.4} />
    </group>
  )
}

function Garage({ data, L, night }: { data: Props['data']; L: Lay; night: boolean }) {
  const h = 5
  const c = contrast(data.color)
  const office = Math.min(2.6, L.bw * 0.28)
  const bays = L.bw - office >= 7 ? 2 : 1
  const bayW = (L.bw - office) / bays
  const doorW = bayW - 0.8
  const x0 = L.bx - L.bw / 2
  return (
    <group>
      <Box size={[L.bw, h, L.bd]} at={[L.bx, h / 2, L.bz]} color="#d5d8db" rough={0.7} />
      <Box size={[L.bw + 0.06, 0.9, L.bd + 0.06]} at={[L.bx, h - 0.45, L.bz]} color={data.color} />
      <Sign text={data.name} at={[L.bx - office / 2, h - 0.45, L.fz + 0.1]} w={Math.min(L.bw - office - 0.6, 7)} h={0.75} bg={c.bg} fg={c.fg} night={night} />
      {Array.from({ length: bays }, (_, i) => {
        const x = x0 + bayW * (i + 0.5)
        const open = i === 0
        return (
          <group key={i} position={[x, 0, L.fz]}>
            {/* yellow-black bollards */}
            {[-doorW / 2 - 0.2, doorW / 2 + 0.2].map((bx) => (
              <Box key={bx} size={[0.22, 0.9, 0.22]} at={[bx, 0.45, 0.25]} color="#e9b824" cast={false} />
            ))}
            {open ? (
              <>
                {/* open bay: dark workshop inside, a lift, the header with a lamp */}
                <Box size={[doorW, 3.3, 0.04]} at={[0, 1.65, 0.03]} color="#1d2126" cast={false} emissive="#ffe7b5" ei={night ? 0.2 : 0} />
                <Box size={[0.14, 1.8, 0.14]} at={[-doorW / 2 + 0.25, 0.9, 0.12]} color="#c43b2f" cast={false} />
                <Box size={[0.14, 1.8, 0.14]} at={[doorW / 2 - 0.25, 0.9, 0.12]} color="#c43b2f" cast={false} />
                <Box size={[doorW + 0.2, 0.3, 0.2]} at={[0, 3.45, 0.1]} color="#9ba2a9" metal={0.6} />
                {/* a car waiting for repair in front of the bay */}
                <Car at={[0, 0, L.apron * 0.55]} rot={Math.PI / 2} color={['#3d5a99', '#b9bec4', '#7a1f1f'][data.id.length % 3]} />
              </>
            ) : (
              <>
                <Box size={[doorW, 3.4, 0.1]} at={[0, 1.7, 0.04]} color="#c3c8cd" metal={0.5} rough={0.4} />
                {Array.from({ length: 9 }, (_, k) => (
                  <Box key={k} size={[doorW, 0.05, 0.13]} at={[0, 0.3 + k * 0.36, 0.06]} color="#9ba2a9" cast={false} />
                ))}
              </>
            )}
          </group>
        )
      })}
      {/* office with a window and door */}
      <group position={[L.bx + L.bw / 2 - office / 2, 0, L.fz]}>
        <Glass size={[office - 0.6, 1.2, 0.06]} at={[0, 2.4, 0.04]} night={night} />
        <Box size={[0.95, 2.2, 0.08]} at={[0, 1.1, 0.05]} color="#3a4652" />
      </group>
      {L.side > 0 && (
        <>
          <Tyres at={[-L.W / 2 + 0.6, 0, L.fz + 0.7]} />
          <Tyres at={[-L.W / 2 + 1.35, 0, L.fz + 0.7]} />
        </>
      )}
    </group>
  )
}

/* Upgrades ---------------------------------------------------------------- */

function Terrace({ L, type, night }: { L: Lay; type: string; night: boolean }) {
  const z = L.fz + L.apron / 2 + 0.1
  if (type === 'service') {
    // Waiting area: benches, a vending machine and a coffee machine.
    const x = L.bx + L.bw / 2 - 1.4
    return (
      <group position={[x, 0, z - 0.2]}>
        <Box size={[2.4, 0.12, 1.6]} at={[0, 0.06, 0]} color="#b9b2a4" cast={false} />
        <Box size={[0.08, 2.4, 0.08]} at={[-1.1, 1.2, -0.7]} color="#3a3f45" />
        <Box size={[0.08, 2.4, 0.08]} at={[1.1, 1.2, -0.7]} color="#3a3f45" />
        <Box size={[2.6, 0.08, 1.7]} at={[0, 2.45, -0.1]} color="#e8e4da" />
        <Box size={[1.8, 0.1, 0.45]} at={[0, 0.45, 0.2]} color="#7a5a3c" />
        <Box size={[1.8, 0.5, 0.08]} at={[0, 0.75, 0]} color="#7a5a3c" />
        <Box size={[0.7, 1.7, 0.6]} at={[-0.8, 0.9, -0.45]} color="#c43b2f" emissive="#ffffff" ei={night ? 0.15 : 0} />
      </group>
    )
  }
  if (type === 'store') {
    // Fruit and flower stalls out front.
    return (
      <group position={[L.bx + L.bw / 4, 0, z]}>
        {[-0.8, 0.8].map((x, i) => (
          <group key={x} position={[x, 0, 0]}>
            <Box size={[1.3, 0.7, 0.8]} at={[0, 0.35, 0]} color="#8a6a48" />
            {[-0.35, 0, 0.35].map((dx, k) => (
              <Box key={dx} size={[0.36, 0.14, 0.7]} at={[dx, 0.77, 0]} color={i ? ['#e24b3b', '#f2c53d', '#7fb04a'][k] : ['#e889b5', '#f6f1e6', '#f2a03d'][k]} cast={false} />
            ))}
          </group>
        ))}
      </group>
    )
  }
  const n = Math.max(1, Math.min(3, Math.floor((L.bw - 1) / 2.4)))
  const umbrellas = ['#c0392b', '#f1e3c6', '#2f6f6a']
  return (
    <group position={[L.bx, 0, z]}>
      <Box size={[L.bw - 0.4, 0.1, L.apron - 0.3]} at={[0, 0.05, 0]} color="#a07a52" cast={false} />
      {Array.from({ length: n }, (_, i) => {
        const x = (i - (n - 1) / 2) * 2.4
        return (
          <group key={i} position={[x, 0.1, 0]}>
            <Box size={[0.05, 2.1, 0.05]} at={[0, 1.05, 0]} color="#ddd" cast={false} />
            <mesh position={[0, 2.15, 0]} castShadow>
              <coneGeometry args={[0.95, 0.45, 8]} />
              <meshStandardMaterial color={umbrellas[i % 3]} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 0.05, 16]} />
              <meshStandardMaterial color="#f5f1e8" />
            </mesh>
            {[-0.6, 0.6].map((dx) => (
              <Box key={dx} size={[0.32, 0.45, 0.32]} at={[dx, 0.22, 0]} color="#3b3b3b" cast={false} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Greenery({ L }: { L: Lay }) {
  const corners = [L.bx - L.bw / 2 + 0.45, L.bx + L.bw / 2 - 0.45]
  return (
    <group>
      {corners.map((x) => (
        <group key={x} position={[x, 0, L.fz + 0.45]}>
          <Box size={[0.8, 0.5, 0.6]} at={[0, 0.25, 0]} color="#8a8f93" />
          {[-0.2, 0.2].map((dx) => (
            <mesh key={dx} position={[dx, 0.72, 0]}>
              <icosahedronGeometry args={[0.34, 1]} />
              <meshStandardMaterial color="#4f8a3c" flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {[-L.W / 2 + 0.7, L.W / 2 - 0.7].map((x) => (
        <group key={x} position={[x, 0, -L.D / 2 + 0.7]}>
          <Box size={[0.16, 1.6, 0.16]} at={[0, 0.8, 0]} color="#6b4a2f" />
          <mesh position={[0, 2.1, 0]} castShadow>
            <icosahedronGeometry args={[0.9, 1]} />
            <meshStandardMaterial color="#5e9a46" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Parking({ L, color }: { L: Lay; color: string }) {
  if (L.side < 2.4) {
    return (
      <group position={[L.bx - L.bw / 2 - 0.3, 0, L.fz + 0.5]}>
        <Box size={[0.08, 1.6, 0.08]} at={[0, 0.8, 0]} color="#3a3f45" />
        <Sign text="P" at={[0, 1.7, 0]} w={0.55} h={0.55} bg="#2b5aa8" fg="#ffffff" night={false} />
      </group>
    )
  }
  const x = -L.W / 2 + L.side / 2
  return (
    <group position={[x, 0, 0]}>
      <Box size={[L.side - 0.3, 0.04, L.D - 0.4]} at={[0, 0.03, 0]} color="#5a5e63" cast={false} />
      {[-L.D / 2 + 0.3, 0, L.D / 2 - 0.3].map((z) => (
        <Box key={z} size={[L.side - 0.6, 0.02, 0.08]} at={[0, 0.06, z]} color="#f4f1e8" cast={false} />
      ))}
      {L.D > 4.4 && <Car at={[0, 0, -L.D / 4]} color={color === '#2e2e2e' ? '#b9bec4' : '#2e2e2e'} />}
      <group position={[-L.side / 2 + 0.25, 0, L.D / 2 - 0.4]}>
        <Box size={[0.08, 1.6, 0.08]} at={[0, 0.8, 0]} color="#3a3f45" />
        <Sign text="P" at={[0, 1.7, 0]} w={0.55} h={0.55} bg="#2b5aa8" fg="#ffffff" night={false} />
      </group>
    </group>
  )
}

function DriveThru({ L, type, night }: { L: Lay; type: string; night: boolean }) {
  const x = L.bx + L.bw / 2
  return (
    <group position={[x, 0, L.bz]}>
      <Box size={[0.5, 1.0, 1.2]} at={[0.25, 1.5, 0]} color="#3d4852" />
      <Glass size={[0.06, 0.8, 1]} at={[0.52, 1.5, 0]} night={night} />
      <Sign text={type === 'service' ? 'ПРИЁМКА' : 'ВЫДАЧА'} at={[0.56, 2.3, 0]} w={1.2} h={0.4} bg="#1f1f22" fg="#ffd36a" night={night} rotY={Math.PI / 2} />
    </group>
  )
}

/* Entry point --------------------------------------------------------------- */

export function BusinessShape({ data, night, shadows }: Props) {
  const meta = data.meta?.type === 'business' ? data.meta : null
  const type = meta?.businessType ?? 'coffee'
  const upgrades = meta?.upgrades ?? []
  const L = useMemo(() => layout(data.size[0], data.size[1]), [data.size])
  return (
    <group>
      {/* forecourt paving */}
      <Box size={[L.W, 0.06, L.D]} at={[0, 0.03, 0]} color={type === 'service' ? '#8d9093' : '#cfc6b6'} cast={false} />
      {type === 'coffee' && <Coffee data={data} L={L} night={night} />}
      {type === 'diner' && <Diner data={data} L={L} night={night} />}
      {type === 'restaurant' && <Restaurant data={data} L={L} night={night} shadows={shadows} />}
      {type === 'store' && <Store data={data} L={L} night={night} />}
      {type === 'service' && <Garage data={data} L={L} night={night} />}
      {meta?.ownerName && (
        <Sign text={`владелец: ${meta.ownerName}`} at={[L.bx - L.bw / 2 + 1.3, 1.7, L.fz + 0.1]} w={2.2} h={0.36} bg="#f4efe6" fg="#3a3a3a" night={night} />
      )}
      {upgrades.includes('terrace') && <Terrace L={L} type={type} night={night} />}
      {upgrades.includes('greenery') && <Greenery L={L} />}
      {upgrades.includes('parking') && <Parking L={L} color={data.color} />}
      {upgrades.includes('drivethru') && <DriveThru L={L} type={type} night={night} />}
    </group>
  )
}
