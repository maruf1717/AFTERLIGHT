import type { CityData } from './city'

/*
 * Where cities are kept.
 * - shared: the artifact's database. Each signed-in player has one city (their own document),
 *   opened automatically on any device under the same account; everyone can see the list.
 * - local: this browser only (dev server, or when the database is not available).
 */

export interface CityCard {
  uid: string
  name: string
  pop: number
  best: number
  items: number
}

export interface Store {
  mode: 'shared' | 'local'
  uid: string
  /** My city, or null when I have none yet. */
  load(): Promise<CityData | null>
  save(c: CityData): Promise<void>
  /** All cities (for unique names and the list of cities). */
  cities(): Promise<CityCard[]>
  /** Someone else's city, to look at. */
  open(uid: string): Promise<CityData | null>
}

const isCity = (d: unknown): d is CityData => !!d && typeof d === 'object' && (d as { v?: number }).v === 3 && typeof (d as CityData).name === 'string'
const card = (uid: string, c: CityData): CityCard => ({ uid, name: c.name, pop: c.pop, best: c.best, items: c.items.length })

/* Local ---------------------------------------------------------------------- */

const LS = 'afterlight:city:v3'

function localStore(): Store {
  const read = () => {
    try {
      const raw = localStorage.getItem(LS)
      const d = raw ? JSON.parse(raw) : null
      return isCity(d) ? d : null
    } catch {
      return null
    }
  }
  return {
    mode: 'local',
    uid: 'me',
    load: async () => read(),
    save: async (c) => {
      try {
        localStorage.setItem(LS, JSON.stringify(c))
      } catch {
        /* storage unavailable: the city lives until the page closes */
      }
    },
    cities: async () => {
      const c = read()
      return c ? [card('me', c)] : []
    },
    open: async () => read(),
  }
}

/* Shared --------------------------------------------------------------------- */

interface DocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface DB {
  doc(path: string): { get(): Promise<DocSnap>; set(d: Record<string, unknown>): Promise<void> }
  collection(path: string): { get(): Promise<{ docs: DocSnap[] }> }
}
interface UserApi {
  id(): Promise<string | null>
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> }
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])

export async function connectStore(): Promise<Store> {
  const claude = typeof window !== 'undefined' ? window.claude : undefined
  if (!claude?.use) return localStore()
  const [db, user] = (await Promise.all([withTimeout(claude.use('db'), 10_000, null), withTimeout(claude.use('user'), 10_000, null)])) as [DB | null, UserApi | null]
  if (!db || !user) return localStore()
  const uid = await user.id()
  if (!uid) return localStore()
  // One write at a time.
  let chain: Promise<unknown> = Promise.resolve()
  return {
    mode: 'shared',
    uid,
    async load() {
      const s = await db.doc(`players/${uid}`).get()
      const d = s.exists ? s.data() : null
      return isCity(d) ? d : null
    },
    save(c) {
      const next = chain.then(() => db.doc(`players/${uid}`).set(c as unknown as Record<string, unknown>))
      chain = next.catch(() => {})
      return next
    },
    async cities() {
      const q = await db.collection('players').get()
      return q.docs.flatMap((d) => {
        const c = d.data()
        return isCity(c) ? [card(d.id, c)] : []
      })
    },
    async open(other) {
      const s = await db.doc(`players/${other}`).get()
      const d = s.exists ? s.data() : null
      return isCity(d) ? d : null
    },
  }
}

/** A city name: 2–24 letters, digits, spaces or dashes, unique among the cities (any case). */
export function cityNameError(raw: string, taken: string[]): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 2) return 'Хотя бы 2 буквы'
  if (name.length > 24) return 'Не длиннее 24 букв'
  if (!/^[\p{L}\p{N} \-']+$/u.test(name)) return 'Только буквы, цифры, пробел и дефис'
  const k = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '')
  if (taken.some((t) => k(t) === k(name))) return 'Город с таким названием уже есть'
  return null
}
