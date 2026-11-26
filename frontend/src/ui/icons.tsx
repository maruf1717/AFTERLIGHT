import type { Category, Model, RoadKind } from '../game/catalog'

/** Small flat pictures for the build menu (no emoji). */

const CAT_COLOR: Record<Category, string> = {
  roads: '#5a5f66',
  homes: '#d9772b',
  work: '#2f63c9',
  services: '#2f8f7a',
  utility: '#c9a227',
  fun: '#4f9a3a',
}
export const categoryColor = (c: Category) => CAT_COLOR[c]

const MODEL_PATH: Partial<Record<Model, string>> = {
  house: 'M5 13l7-6 7 6v7H5z M10 20v-4h4v4',
  cottage: 'M4 13l8-7 8 7v7H4z M8 15h3v3H8z M14 15h3v3h-3z',
  lowrise: 'M4 8h16v12H4z M7 11h2v2H7z M11 11h2v2h-2z M15 11h2v2h-2z M7 15h2v2H7z M15 15h2v2h-2z',
  apartment: 'M6 3h12v17H6z M8 6h2v2H8z M14 6h2v2h-2z M8 10h2v2H8z M14 10h2v2h-2z M8 14h2v2H8z M14 14h2v2h-2z',
  tower: 'M8 2h8v18H8z M10 5h4 M10 8h4 M10 11h4 M10 14h4 M12 0v2',
  shop: 'M4 9h16v11H4z M3 9l2-4h14l2 4 M8 14h8v6H8z',
  cafe: 'M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z M16 11h2a2 2 0 0 1 0 4h-2 M8 4v3 M11 4v3',
  office: 'M4 4h16v16H4z M4 9h16 M4 14h16 M10 4v16',
  bizTower: 'M7 2h10v18H7z M7 7h10 M7 12h10 M12 2v18',
  mall: 'M2 9h20v11H2z M6 5h12l4 4H2z M9 14h6v6H9z',
  garage: 'M3 10l9-5 9 5v10H3z M7 13h10v7H7z M7 16h10',
  parking: 'M6 4h12v16H6z M10 16V8h3a2.5 2.5 0 0 1 0 5h-3',
  factory: 'M3 20V10l5 3V10l5 3V10l5 3V4h3v16z',
  kindergarten: 'M4 20V10l8-6 8 6v10z M9 14a3 3 0 0 1 6 0',
  school: 'M3 9l9-5 9 5-9 5z M7 11v5c3 2 7 2 10 0v-5',
  clinic: 'M4 6h16v14H4z M12 9v8 M8 13h8',
  hospital: 'M3 6h18v14H3z M12 9v8 M8 13h8 M9 3h6v3H9z',
  police: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z M12 9l1 2h2l-1.5 1.5.5 2-2-1-2 1 .5-2L9 11h2z',
  fire: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 1 2 2 3 4 3 0-3-1-5 0-7z',
  coal: 'M3 20V11h6V6h3v5h3V4h3v16z M5 14h2 M13 14h2',
  solar: 'M3 17l3-9h12l3 9z M9 8l-1 9 M15 8l1 9 M4.5 12.5h15',
  wind: 'M12 12v9 M12 12L6 6 M12 12l8-1 M12 12l-2 8',
  waterTower: 'M7 4h10v6H7z M9 10l-2 10 M15 10l2 10 M8 15h8',
  pump: 'M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z',
  gazebo: 'M3 10l9-6 9 6z M6 10v9 M18 10v9 M12 10v9 M4 19h16',
  playground: 'M4 20l6-12 M10 8h8 M18 8v12 M6 16l12 0',
  fountain: 'M4 16h16v3H4z M12 16V8 M12 8c-3 0-4 3-4 5 M12 8c3 0 4 3 4 5',
  park: 'M8 20v-5 M8 15a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M17 20v-4 M17 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  stadium: 'M2 12c0-4 4-6 10-6s10 2 10 6-4 6-10 6-10-2-10-6z M6 12c0-2 3-3 6-3s6 1 6 3-3 3-6 3-6-1-6-3z',
}

export function ModelIcon({ model, category, size = 44 }: { model: Model; category: Category; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: `${CAT_COLOR[category]}22` }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke={CAT_COLOR[category]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={MODEL_PATH[model] ?? 'M4 4h16v16H4z'} />
      </svg>
    </span>
  )
}

const ROAD_COLOR: Record<RoadKind, string> = { dirt: '#a58a63', street: '#5a5f66', avenue: '#3f4a52', ring: '#5a5f66' }
export function RoadIcon({ kind, size = 44 }: { kind: RoadKind; size?: number }) {
  const c = ROAD_COLOR[kind]
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-[#eceef1]" style={{ width: size, height: size }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" aria-hidden>
        {kind === 'ring' ? (
          <>
            <rect x="9" y="0" width="6" height="24" fill={c} />
            <rect x="0" y="9" width="24" height="6" fill={c} />
            <circle cx="12" cy="12" r="7" fill={c} />
            <circle cx="12" cy="12" r="3" fill="#6fa452" />
          </>
        ) : (
          <>
            <rect x={kind === 'avenue' ? 5 : 7} y="0" width={kind === 'avenue' ? 14 : 10} height="24" fill={c} />
            {kind === 'street' && <path d="M12 2v4 M12 10v4 M12 18v4" stroke="#fff" strokeWidth="1.2" />}
            {kind === 'avenue' && <rect x="11" y="0" width="2" height="24" fill="#6fa452" />}
          </>
        )}
      </svg>
    </span>
  )
}

const P = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
export const RotateIcon = () => (
  <svg {...P}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
  </svg>
)
export const SellIcon = () => (
  <svg {...P}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
)
export const CloseIcon = () => (
  <svg {...P}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const PeopleIcon = () => (
  <svg {...P}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11a3 3 0 1 0 0-6M21 20c0-2.6-1.6-4.8-4-5.7" />
  </svg>
)
export const SmileIcon = () => (
  <svg {...P}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
  </svg>
)
export const BoltIcon = () => (
  <svg {...P}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </svg>
)
export const DropIcon = () => (
  <svg {...P}>
    <path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z" />
  </svg>
)
export const CoinIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="10" fill="#f2b632" stroke="#c98a12" strokeWidth="2" />
    <path d="M12 7v10M9 9.5h4.5a1.8 1.8 0 0 1 0 3.5H10a1.8 1.8 0 0 0 0 3.5h4.5" stroke="#8a5a00" strokeWidth="1.6" fill="none" />
  </svg>
)
export const ListIcon = () => (
  <svg {...P}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)
export const MoonIcon = () => (
  <svg {...P}>
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
  </svg>
)
