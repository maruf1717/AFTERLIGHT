import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const MoonIcon = (p: P) => (
  <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
)
export const SunIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5V21H3z" /><path d="M9 21v-6h6v6" /></svg>
)
export const ListIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
export const CloseIcon = (p: P) => (
  <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const ChevronLeft = (p: P) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
)
export const ChevronRight = (p: P) => (
  <svg {...base} {...p}><path d="m9 18 6-6-6-6" /></svg>
)
export const TargetIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></svg>
)
export const SearchIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const GaugeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 14l4-4" /><path d="M3.3 19a10 10 0 1 1 17.4 0" /></svg>
)
export const LockIcon = (p: P) => (
  <svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
)
export const HelpIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" /></svg>
)
export const SparkIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>
)
export const PeopleIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>
)
export const BriefcaseIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>
)
export const BuildingIcon = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></svg>
)
export const RulerIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 20 20 4M7 17l2 2M10 14l2 2M13 11l2 2M16 8l2 2" /></svg>
)
export const StairsIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 20h5v-5h5v-5h5V5h3" /></svg>
)
export const CalendarIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const ZoomIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></svg>
)
export const HandIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10M11 9.5V4a1.5 1.5 0 0 1 3 0v6M14 9a1.5 1.5 0 0 1 3 0v3M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4.3 14a1.6 1.6 0 0 1 2.6-1.8L8 13.5" /></svg>
)
export const MapIcon = (p: P) => (
  <svg {...base} {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
)
export const CursorIcon = (p: P) => (
  <svg {...base} {...p}><path d="m4 3 7 18 2.5-7.5L21 11z" /></svg>
)
