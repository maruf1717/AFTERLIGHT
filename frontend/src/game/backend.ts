import { DEFAULT_CONFIG, type GameConfig } from './catalog'
import { emptyPlayer, isLegacy, normalizePlayer, openingFromLegacy, type Grant, type LegacyPlayerDoc, type Opening, type PlayerDoc, type Review } from './types'

/**
 * Where the shared game lives.
 * - "shared": the artifact's database. Everyone who can open the page sees one city.
 * - "local": this browser only (dev server, or when the database is not available).
 */

export interface Snapshot {
  config: GameConfig | null
  /** Opening balances written by the owner (old saves, restarts). */
  opening: Opening | null
  /** Records as stored: format 2, or format 1 from before the ledger. */
  players: Record<string, PlayerDoc | LegacyPlayerDoc>
  grants: Grant[]
  reviews: Review[]
}

export interface Profile {
  name: string
  avatarUrl?: string
  color?: string
}

export interface Backend {
  mode: 'shared' | 'local'
  uid: string
  isOwner: boolean
  canWrite: boolean
  start(onChange: (s: Snapshot) => void, onError: (msg: string) => void): void
  savePlayer(uid: string, doc: PlayerDoc): Promise<void>
  /** Read my record straight from the store; create it only if it truly does not exist. */
  ensurePlayer(uid: string, fresh: PlayerDoc): Promise<PlayerDoc | LegacyPlayerDoc>
  /** Owner only. */
  saveOpening(o: Opening): Promise<void>
  /** Current time according to the server, or null when the server can't tell. */
  serverTime(): Promise<number | null>
  addGrant(g: Grant): Promise<void>
  setReview(r: Review): Promise<void>
  saveConfig(cfg: GameConfig): Promise<void>
  profiles(ids: string[]): Promise<Record<string, Profile>>
}

/* ------------------------------------------------------------------ */
/* Local (this browser)                                                */
/* ------------------------------------------------------------------ */

const LS_KEY = 'afterlight:game:v1'

/**
 * Format 1 → 2: the numbers of old records move into opening balances (with the grants and
 * creative rewards already earned), and the records become empty action logs.
 */
export function migrateSnapshot(snap: Snapshot, now: number): Snapshot {
  const legacy = Object.entries(snap.players).filter(([, d]) => isLegacy(d)) as [string, LegacyPlayerDoc][]
  if (!legacy.length) return snap
  const opening: Opening = { at: now, players: { ...(snap.opening?.players ?? {}) } }
  if (snap.opening) opening.at = snap.opening.at
  const players = { ...snap.players }
  for (const [uid, doc] of legacy) {
    const extra =
      snap.grants.filter((g) => g.to === uid && g.at < opening.at).reduce((s, g) => s + g.amount, 0) +
      snap.reviews.filter((r) => r.to === uid && r.status === 'approved' && r.at < opening.at).reduce((s, r) => s + r.reward, 0)
    opening.players[uid] = openingFromLegacy(doc, extra)
    players[uid] = normalizePlayer(doc, now)
  }
  return { ...snap, opening, players }
}

function loadLocal(): Snapshot {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot
      // Settings added in newer versions get their defaults.
      const fixed: Snapshot = { ...snap, opening: snap.opening ?? null, config: { ...DEFAULT_CONFIG, startedAt: Date.now(), ...snap.config } }
      return migrateSnapshot(fixed, Date.now())
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return { config: { ...DEFAULT_CONFIG, startedAt: Date.now() }, opening: null, players: {}, grants: [], reviews: [] }
}

export function localBackend(): Backend {
  let snap = loadLocal()
  let cb: (s: Snapshot) => void = () => {}
  const persist = () => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(snap))
    } catch {
      /* quota or private mode: keep playing in memory */
    }
    cb({ ...snap })
  }
  return {
    mode: 'local',
    uid: 'local-player',
    isOwner: true,
    canWrite: true,
    start(onChange) {
      cb = onChange
      if (!snap.players['local-player']) snap.players['local-player'] = emptyPlayer(Date.now())
      persist()
    },
    async savePlayer(uid, doc) {
      snap = { ...snap, players: { ...snap.players, [uid]: doc } }
      persist()
    },
    async ensurePlayer(uid, fresh) {
      if (!snap.players[uid]) {
        snap = { ...snap, players: { ...snap.players, [uid]: fresh } }
        persist()
      }
      return snap.players[uid]
    },
    async addGrant(g) {
      snap = { ...snap, grants: [...snap.grants, g] }
      persist()
    },
    async setReview(r) {
      snap = { ...snap, reviews: [...snap.reviews.filter((x) => x.id !== r.id), r] }
      persist()
    },
    async saveConfig(cfg) {
      snap = { ...snap, config: cfg }
      persist()
    },
    async saveOpening(o) {
      snap = { ...snap, opening: o }
      persist()
    },
    async serverTime() {
      return null
    },
    async profiles(ids) {
      return Object.fromEntries(ids.map((id) => [id, { name: id === 'local-player' ? 'Вы' : 'Житель' }]))
    },
  }
}

/* ------------------------------------------------------------------ */
/* Shared (artifact database)                                          */
/* ------------------------------------------------------------------ */

/* Minimal typings for the viewer's runtime; see the artifact capability contract. */
interface DocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
  metadata: { fromCache: boolean }
}
interface QuerySnap {
  docs: DocSnap[]
  metadata: { fromCache: boolean }
}
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>
  acquire?(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>
  get(): Promise<DocSnap>
  onSnapshot(n: (s: DocSnap) => void, e?: (err: { code: string; message: string }) => void): () => void
}
interface ColRef {
  doc(id?: string): DocRef
  onSnapshot(n: (s: QuerySnap) => void, e?: (err: { code: string; message: string }) => void): () => void
}
interface DB {
  doc(path: string): DocRef
  collection(path: string): ColRef
}
interface UserApi {
  id(): Promise<string | null>
  isOwner(): Promise<boolean>
  can(name: string): Promise<boolean | null>
  profiles(ids: string[]): Promise<Record<string, { name: string; avatarUrl: string; color: string }>>
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])
}

export async function connect(): Promise<Backend> {
  const claude = window.claude
  if (!claude?.use) return localBackend()
  const [db, user] = (await Promise.all([
    withTimeout(claude.use('db'), 10_000, null),
    withTimeout(claude.use('user'), 10_000, null),
  ])) as [DB | null, UserApi | null]
  if (!db || !user) return localBackend()
  const uid = await user.id()
  if (!uid) return localBackend()
  const isOwner = await user.isOwner()
  const can = await user.can('data.write')

  // One write at a time per document: chain them.
  let chain: Promise<unknown> = Promise.resolve()
  const queue = <T,>(fn: () => Promise<T>) => {
    const next = chain.then(fn, fn)
    chain = next.catch(() => {})
    return next
  }

  return {
    mode: 'shared',
    uid,
    isOwner,
    canWrite: can !== false,
    start(onChange, onError) {
      const snap: Snapshot = { config: null, opening: null, players: {}, grants: [], reviews: [] }
      let configKnown = false
      const emit = () => onChange({ ...snap, players: { ...snap.players } })
      const fail = (e: { message: string }) => onError(e.message)

      db.doc('game/config').onSnapshot((s) => {
        snap.config = s.exists ? ({ ...DEFAULT_CONFIG, ...(s.data() as Partial<GameConfig>) } as GameConfig) : null
        if (!s.exists && !s.metadata.fromCache && !configKnown && isOwner) {
          configKnown = true
          // The owner's first visit founds the city.
          // A shared city is played by many people: the solo test rules are off.
          void db.doc('game/config').set({ ...DEFAULT_CONFIG, soloMode: false, startedAt: Date.now() } as unknown as Record<string, unknown>)
        }
        emit()
      }, fail)
      db.doc('game/opening').onSnapshot((s) => {
        snap.opening = s.exists ? (s.data() as unknown as Opening) : null
        emit()
      }, fail)
      db.collection('players').onSnapshot((s) => {
        snap.players = Object.fromEntries(s.docs.filter((d) => d.exists).map((d) => [d.id, d.data() as unknown as PlayerDoc | LegacyPlayerDoc]))
        emit()
      }, fail)
      db.collection('grants').onSnapshot((s) => {
        snap.grants = s.docs.map((d) => d.data() as unknown as Grant)
        emit()
      }, fail)
      db.collection('reviews').onSnapshot((s) => {
        snap.reviews = s.docs.map((d) => d.data() as unknown as Review)
        emit()
      }, fail)
    },
    savePlayer: (id, doc) => queue(() => db.doc(`players/${id}`).set(doc as unknown as Record<string, unknown>)),
    ensurePlayer: (id, fresh) =>
      queue(async () => {
        const s = await db.doc(`players/${id}`).get()
        if (s.exists) return s.data() as unknown as PlayerDoc | LegacyPlayerDoc
        await db.doc(`players/${id}`).set(fresh as unknown as Record<string, unknown>)
        return fresh
      }),
    addGrant: (g) => queue(() => db.doc(`grants/${g.id}`).set(g as unknown as Record<string, unknown>)),
    setReview: (r) => queue(() => db.doc(`reviews/${r.id}`).set(r as unknown as Record<string, unknown>)),
    saveConfig: (cfg) => queue(() => db.doc('game/config').set(cfg as unknown as Record<string, unknown>)),
    saveOpening: (o) => queue(() => db.doc('game/opening').set(o as unknown as Record<string, unknown>)),
    async serverTime() {
      // A short lease on a document of my own: the server answers with its expiry time.
      try {
        const ref = db.doc(`players/${uid}/clock/now`)
        if (!ref.acquire) return null
        const ttl = 2000
        const sent = Date.now()
        const r = await ref.acquire({ holder: uid, ttlMs: ttl })
        if (!r.expiresAt) return null
        const back = Date.now()
        return Date.parse(r.expiresAt) - ttl + (back - sent) / 2
      } catch {
        return null
      }
    },
    async profiles(ids) {
      const ps = await user.profiles(ids)
      return Object.fromEntries(Object.entries(ps).map(([id, p]) => [id, { name: p.name, avatarUrl: p.avatarUrl, color: p.color }]))
    },
  }
}
