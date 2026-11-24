import type { ReactNode } from 'react'
import type { BuildingKind, DistrictId } from '../data/types'

/**
 * Hand-drawn flat illustrations for every building kind and district.
 * Each one is a small scene on a 48×48 tile, so it reads as a picture, not a bullet.
 */

interface TileProps {
  size?: number
  bg: [string, string]
  children: ReactNode
  rounded?: number
}

function Tile({ size = 40, bg, children, rounded = 12 }: TileProps) {
  const id = `g${bg[0].slice(1)}${bg[1].slice(1)}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={rounded} fill={`url(#${id})`} />
      {children}
      <rect x="0.5" y="0.5" width="47" height="47" rx={rounded - 0.5} fill="none" stroke="rgba(0,0,0,0.08)" />
    </svg>
  )
}

const Ground = ({ c = '#7fae5c' }: { c?: string }) => <rect x="0" y="38" width="48" height="10" fill={c} />
const win = (x: number, y: number, w = 3, h = 3, c = '#dfe9f2') => <rect x={x} y={y} width={w} height={h} rx="0.6" fill={c} />

const SKY: [string, string] = ['#cfe3f3', '#eaf3fa']

const ART: Record<BuildingKind, (size?: number) => ReactNode> = {
  tower: (s) => (
    <Tile size={s} bg={SKY}>
      <Ground c="#b9b4aa" />
      <rect x="11" y="16" width="9" height="23" fill="#8ea6bd" />
      <rect x="20" y="6" width="13" height="33" fill="#5f7f9e" />
      <rect x="20" y="6" width="5" height="33" fill="#7896b3" />
      <rect x="25.5" y="2" width="1" height="5" fill="#556" />
      <circle cx="26" cy="2.5" r="1.1" fill="#d9483b" />
      {[10, 15, 20, 25, 30].map((y) => (
        <g key={y}>{win(21.5, y, 2.5, 3)}{win(27, y, 4, 3, '#b8cde0')}</g>
      ))}
      {[19, 24, 29].map((y) => <g key={y}>{win(13, y, 2, 2.5)}{win(16.5, y, 2, 2.5)}</g>)}
      <rect x="34" y="24" width="7" height="15" fill="#a9b9c8" />
    </Tile>
  ),
  office: (s) => (
    <Tile size={s} bg={SKY}>
      <Ground c="#b9b4aa" />
      <rect x="9" y="13" width="30" height="26" fill="#7f97ae" />
      <rect x="9" y="11" width="30" height="3" fill="#5c6f81" />
      {[16, 22, 28].map((y) => (
        <rect key={y} x="11" y={y} width="26" height="4" fill="#c6d8e8" />
      ))}
      {[17, 23, 29].map((x) => (
        <rect key={x} x={x} y="15" width="1" height="18" fill="#7f97ae" />
      ))}
      <rect x="21" y="34" width="6" height="5" fill="#3d4b58" />
    </Tile>
  ),
  hotel: (s) => (
    <Tile size={s} bg={SKY}>
      <Ground c="#b9b4aa" />
      <rect x="12" y="9" width="24" height="30" fill="#c9b79c" />
      <rect x="10" y="7" width="28" height="3" fill="#8b6f52" />
      {[13, 19, 25].map((y) => (
        <g key={y}>{win(15, y, 4, 4, '#9fb6c9')}{win(22, y, 4, 4, '#9fb6c9')}{win(29, y, 4, 4, '#9fb6c9')}</g>
      ))}
      <rect x="17" y="32" width="14" height="2" fill="#a83b30" />
      <rect x="21" y="34" width="6" height="5" fill="#4b3326" />
      <text x="24" y="31" fontSize="4.5" textAnchor="middle" fill="#7a2c24" fontWeight="700" fontFamily="sans-serif">★★★</text>
    </Tile>
  ),
  shop: (s) => (
    <Tile size={s} bg={['#fde9cf', '#fff6ea']}>
      <Ground c="#c8c2b6" />
      <rect x="8" y="18" width="32" height="21" fill="#efe3cf" />
      <path d="M6 17h36l-2 6H8z" fill="#c0463a" />
      {[8, 14, 20, 26, 32].map((x) => (
        <path key={x} d={`M${x + 0.5} 17h3l-.5 6h-3z`} fill="#f4efe6" />
      ))}
      <rect x="11" y="26" width="11" height="9" fill="#9fc0d6" />
      <rect x="26" y="26" width="8" height="13" fill="#5a3f2c" />
      <rect x="12" y="31" width="3" height="4" fill="#e0a33b" />
      <rect x="16" y="29" width="3" height="6" fill="#6aa24f" />
    </Tile>
  ),
  cafe: (s) => (
    <Tile size={s} bg={['#f3e4d6', '#fbf3ea']}>
      <Ground c="#c8c2b6" />
      <path d="M14 19h18v9a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z" fill="#ffffff" />
      <path d="M14 19h18v9a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z" fill="none" stroke="#6b4a3a" strokeWidth="1.6" />
      <path d="M32 22h3a4 4 0 0 1 0 8h-3" fill="none" stroke="#6b4a3a" strokeWidth="1.6" />
      <ellipse cx="23" cy="20.5" rx="8" ry="1.6" fill="#6b4a2f" />
      <path d="M19 15c0-2 2-2 2-4M24 15c0-2 2-2 2-4" stroke="#b59a85" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="23" cy="37" rx="13" ry="1.6" fill="#a08b78" />
    </Tile>
  ),
  library: (s) => (
    <Tile size={s} bg={['#e6e0f0', '#f4f1f8']}>
      <Ground c="#c8c2b6" />
      <path d="M6 16 24 7l18 9z" fill="#8a7a64" />
      <rect x="8" y="16" width="32" height="3" fill="#cdbfa6" />
      {[11, 17, 23, 29, 35].map((x) => (
        <rect key={x} x={x} y="19" width="2.5" height="15" fill="#efe7d8" />
      ))}
      <rect x="8" y="34" width="32" height="5" fill="#cdbfa6" />
      <rect x="20" y="25" width="2" height="9" fill="#3f6fa8" />
      <rect x="23" y="24" width="2" height="10" fill="#b6463a" />
      <rect x="26" y="26" width="2" height="8" fill="#3f8f5a" />
    </Tile>
  ),
  house: (s) => (
    <Tile size={s} bg={SKY}>
      <Ground />
      <rect x="12" y="22" width="24" height="17" fill="#efe3cf" />
      <path d="M9 23 24 11l15 12z" fill="#9b3d2e" />
      <rect x="30" y="12" width="3" height="7" fill="#8c5a45" />
      <rect x="15" y="26" width="6" height="6" fill="#9fb6c9" />
      <rect x="15" y="28.6" width="6" height="0.8" fill="#efe3cf" />
      <rect x="25" y="29" width="6" height="10" fill="#6b4a3a" />
      <circle cx="40" cy="34" r="4" fill="#5e9a46" />
      <rect x="39.4" y="36" width="1.2" height="3" fill="#6b4a2f" />
    </Tile>
  ),
  apartment: (s) => (
    <Tile size={s} bg={SKY}>
      <Ground />
      <rect x="10" y="10" width="28" height="29" fill="#e2c6a2" />
      <rect x="9" y="9" width="30" height="2" fill="#8b7258" />
      {[14, 21, 28].map((y) => (
        <g key={y}>
          {win(13, y, 4, 4, '#9fb6c9')}
          {win(22, y, 4, 4, y === 21 ? '#ffd59a' : '#9fb6c9')}
          {win(31, y, 4, 4, '#9fb6c9')}
          <rect x="12" y={y + 4} width="6" height="1" fill="#f4efe6" />
          <rect x="30" y={y + 4} width="6" height="1" fill="#f4efe6" />
        </g>
      ))}
      <rect x="21" y="34" width="6" height="5" fill="#5a4636" />
    </Tile>
  ),
  park: (s) => (
    <Tile size={s} bg={['#d8eec9', '#eef7e6']}>
      <rect x="0" y="30" width="48" height="18" fill="#7fae5c" />
      <path d="M0 40c10-4 20 4 30 0s14-2 18 0v8H0z" fill="#d9cdb4" />
      <circle cx="14" cy="21" r="8" fill="#4f8a3c" />
      <circle cx="19" cy="17" r="6" fill="#6aa24f" />
      <rect x="15" y="26" width="2" height="8" fill="#6b4a2f" />
      <circle cx="35" cy="24" r="6" fill="#5e9a46" />
      <rect x="34" y="28" width="2" height="6" fill="#6b4a2f" />
      <rect x="25" y="33" width="7" height="1.5" fill="#8a6a48" />
      <rect x="25.5" y="34.5" width="1" height="2" fill="#5a4636" />
      <rect x="30.5" y="34.5" width="1" height="2" fill="#5a4636" />
    </Tile>
  ),
  school: (s) => (
    <Tile size={s} bg={['#fbe8c8', '#fdf4e4']}>
      <Ground />
      <rect x="8" y="20" width="32" height="19" fill="#d9a27a" />
      <path d="M6 21 24 12l18 9z" fill="#8a4b34" />
      <rect x="22" y="6" width="1" height="7" fill="#555" />
      <path d="M23 6h6l-1.5 2 1.5 2h-6z" fill="#2f63c9" />
      {[11, 17, 28, 34].map((x) => win(x, 25, 4, 5, '#9fb6c9'))}
      <rect x="21" y="29" width="6" height="10" fill="#5a3f2c" />
      <circle cx="24" cy="24" r="2.2" fill="#f4efe6" stroke="#5a3f2c" strokeWidth="0.7" />
    </Tile>
  ),
  factory: (s) => (
    <Tile size={s} bg={['#e9dfd2', '#f5efe7']}>
      <Ground c="#b9b2a6" />
      <ellipse cx="13" cy="7" rx="5" ry="3" fill="#d6d6d6" />
      <ellipse cx="18" cy="4.5" rx="4" ry="2.4" fill="#e6e6e6" />
      <rect x="10" y="10" width="5" height="18" fill="#a2483a" />
      <rect x="10" y="12" width="5" height="2" fill="#f2f2f2" />
      <path d="M6 39V24l9 5v-5l9 5v-5l9 5v-5l9 5v10z" fill="#8f8478" />
      <rect x="9" y="31" width="30" height="3" fill="#a9bccb" />
      <rect x="28" y="34" width="6" height="5" fill="#5d5650" />
    </Tile>
  ),
  warehouse: (s) => (
    <Tile size={s} bg={['#e9dfd2', '#f5efe7']}>
      <Ground c="#b9b2a6" />
      <path d="M5 22 24 13l19 9v17H5z" fill="#9a8f84" />
      {[9, 13, 17, 21, 25, 29, 33, 37].map((x) => (
        <rect key={x} x={x} y="22" width="0.8" height="17" fill="#857b70" />
      ))}
      <rect x="15" y="27" width="18" height="12" fill="#cfc5b3" />
      {[29, 32, 35].map((y) => (
        <rect key={y} x="15" y={y} width="18" height="0.8" fill="#a89c8c" />
      ))}
      <rect x="36" y="33" width="6" height="6" fill="#c7761f" />
      <rect x="36" y="35.6" width="6" height="0.8" fill="#8a5212" />
    </Tile>
  ),
  plant: (s) => (
    <Tile size={s} bg={['#e3e9ee', '#f2f5f8']}>
      <Ground c="#b9b2a6" />
      <ellipse cx="16" cy="9" rx="7" ry="4" fill="#ececec" />
      <ellipse cx="22" cy="6" rx="5" ry="3" fill="#f6f6f6" />
      <path d="M9 39c2-8 2-16 0-24h13c-2 8-2 16 0 24z" fill="#cfccc6" />
      <path d="M9 15h13" stroke="#b5b1aa" strokeWidth="1.2" />
      <rect x="26" y="26" width="16" height="13" fill="#9a8f84" />
      <rect x="26" y="24" width="16" height="2.5" fill="#d18a2c" />
      <path d="M33 29l-2.5 4h2.5l-1.5 4 4-5.5h-2.5l1.5-2.5z" fill="#f6d35b" />
    </Tile>
  ),
  unknown: (s) => (
    <Tile size={s} bg={['#d9d4cf', '#ebe7e3']}>
      <Ground c="#a89f94" />
      <rect x="11" y="15" width="26" height="24" fill="#6e5f55" />
      <path d="M9 16 24 9l15 7z" fill="#4f4540" />
      {[19, 28].map((y) => (
        <g key={y}>
          {win(14, y, 6, 5, '#3a332f')}
          {win(28, y, 6, 5, '#3a332f')}
        </g>
      ))}
      <rect x="12" y="21" width="10" height="1.6" fill="#a8875f" transform="rotate(-12 17 21)" />
      <rect x="26" y="30" width="10" height="1.6" fill="#a8875f" transform="rotate(10 31 30)" />
      <circle cx="35" cy="12" r="7" fill="#e0a33b" />
      <text x="35" y="15.6" fontSize="10" textAnchor="middle" fill="#fff" fontWeight="800" fontFamily="sans-serif">?</text>
    </Tile>
  ),
}

export function KindArt({ kind, size = 40 }: { kind: BuildingKind; size?: number }) {
  return <>{ART[kind](size)}</>
}

const DISTRICT_KIND: Record<DistrictId, BuildingKind> = {
  downtown: 'tower',
  residential: 'house',
  industrial: 'factory',
}

export function DistrictArt({ id, size = 40 }: { id: DistrictId; size?: number }) {
  return <>{ART[DISTRICT_KIND[id]](size)}</>
}
