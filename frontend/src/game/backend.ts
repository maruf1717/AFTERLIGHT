import { DEFAULT_CONFIG, type GameConfig } from './catalog'
import { emptyPlayer, type Grant, type PlayerDoc, type Review } from './types'

/**
 * Where the shared game lives.
 * - "shared": the artifact's database. Everyone who can open the page sees one city.
 * - "local": this browser only (dev server, or when the database is not available).
 */

export interface Snapshot {
  config: GameConfig | null
  players: Record<string, PlayerDoc>
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
  ensurePlayer(uid: string, fresh: PlayerDoc): Promise<PlayerDoc>
  addGrant(g: Grant): Promise<void>
  setReview(r: Review): Promise<void>
  saveConfig(cfg: GameConfig): Promise<void>
  profiles(ids: string[]): Promise<Record<string, Profile>>
}

/* ------------------------------------------------------------------ */
/* Local (this browser)                                                */
/* ------------------------------------------------------------------ */

const LS_KEY = 'afterlight:game:v1'

function loadLocal(): Snapshot {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as Snapshot
  } catch {
    /* storage unavailable: start fresh */
  }
  return { config: { ...DEFAULT_CONFIG, startedAt: Date.now() }, players: {}, grants: [], reviews: [] }
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
      const snap: Snapshot = { config: null, players: {}, grants: [], reviews: [] }
      let configKnown = false
      const emit = () => onChange({ ...snap, players: { ...snap.players } })
      const fail = (e: { message: string }) => onError(e.message)

      db.doc('game/config').onSnapshot((s) => {
        snap.config = s.exists ? ({ ...DEFAULT_CONFIG, ...(s.data() as Partial<GameConfig>) } as GameConfig) : null
        if (!s.exists && !s.metadata.fromCache && !configKnown && isOwner) {
          configKnown = true
          // The owner's first visit founds the city.
          void db.doc('game/config').set({ ...DEFAULT_CONFIG, startedAt: Date.now() } as unknown as Record<string, unknown>)
        }
        emit()
      }, fail)
      db.collection('players').onSnapshot((s) => {
        snap.players = Object.fromEntries(s.docs.filter((d) => d.exists).map((d) => [d.id, { ...emptyPlayer(0), ...(d.data() as Partial<PlayerDoc>) }]))
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
        if (s.exists) return { ...emptyPlayer(0), ...(s.data() as Partial<PlayerDoc>) }
        await db.doc(`players/${id}`).set(fresh as unknown as Record<string, unknown>)
        return fresh
      }),
    addGrant: (g) => queue(() => db.doc(`grants/${g.id}`).set(g as unknown as Record<string, unknown>)),
    setReview: (r) => queue(() => db.doc(`reviews/${r.id}`).set(r as unknown as Record<string, unknown>)),
    saveConfig: (cfg) => queue(() => db.doc('game/config').set(cfg as unknown as Record<string, unknown>)),
    async profiles(ids) {
      const ps = await user.profiles(ids)
      return Object.fromEntries(Object.entries(ps).map(([id, p]) => [id, { name: p.name, avatarUrl: p.avatarUrl, color: p.color }]))
    },
  }
}
