import { useMemo } from 'react'
import { create } from 'zustand'
import { BUILDINGS, MIDNIGHT_ID } from '../data/city'
import { RESERVED_LOTS } from '../data/lots'
import type { Building, BuildingKind, DistrictId } from '../data/types'
import {
  BUSINESS_TYPE_BY_ID,
  configError,
  DAILY_TASKS,
  DEFAULT_CONFIG,
  PATROL_COUNT,
  PROJECT_BY_ID,
  PROJECTS,
  UPGRADE_BY_ID,
  WARN_AT,
  type BusinessType,
  type CivicVisual,
  type DailyTaskId,
  type GameConfig,
  type UpgradeId,
} from './catalog'
import { connect, type Backend, type Profile, type Snapshot } from './backend'
import { deliveryTarget, replay, surveyIndex, taskDayOf, type Account, type BizState, type CityState } from './sim'
import {
  emptyPlayer,
  isLegacy,
  normalizePlayer,
  openingFromLegacy,
  type Action,
  type Donation,
  type Grant,
  type LegacyPlayerDoc,
  type Opening,
  type PlayerDoc,
  type Review,
  type Submission,
} from './types'

export interface Toast {
  id: number
  text: string
  tone: 'good' | 'bad' | 'info'
}

/** What the screens need to know about me, worked out from the ledger. */
export interface MeView {
  balance: number
  rep: number
  daily: { date: string; day: number; done: DailyTaskId[]; target: string; surveyIdx: number; visited: string[] }
  donations: Donation[]
  business: BizState | null
  /** My latest stars per business owner. */
  ratings: Record<string, number>
  submissions: Submission[]
  /** My survey answer per task day. */
  survey: Record<string, number>
  creativePaid: string[]
}

type AnyAction = Action extends infer A ? (A extends Action ? Omit<A, 't'> : never) : never

interface GameState {
  status: 'connecting' | 'ready' | 'waiting-owner'
  mode: 'shared' | 'local'
  uid: string
  isOwner: boolean
  canWrite: boolean
  error: string | null
  config: GameConfig
  opening: Opening | null
  players: Record<string, PlayerDoc>
  /** Records still in the old format (converted by the owner's next visit). */
  legacy: Record<string, LegacyPlayerDoc>
  grants: Grant[]
  reviews: Review[]
  city: CityState | null
  accounts: Record<string, Account>
  /** Every object drawn on the map right now: built static buildings + game objects. */
  objects: Building[]
  objectById: Record<string, Building>
  names: Record<string, Profile>
  toasts: Toast[]
  panel: Panel | null
  /** Desktop side menu. Folds away while the camera shows the result of an action. */
  sidebarOpen: boolean
  /** Short-lived fireworks over buildings that just opened. */
  celebrations: { id: string; at: number }[]
  /** Server time minus this device's clock (ms). */
  clockOffset: number

  init(): Promise<void>
  tick(): void
  now(): number
  setPanel(p: Panel | null): void
  setSidebar(open: boolean): void
  /** Close the menus and fly the camera to an object (optionally with fireworks). */
  showOnMap(id: string, celebrate?: boolean): void
  toast(text: string, tone?: Toast['tone']): void
  me(): MeView
  balance(uid?: string): number

  /** Record one action of mine; it is checked against the rules first. */
  act(a: AnyAction): Promise<boolean>
  completeDaily(id: DailyTaskId, extra?: { x?: string | number; ids?: string[] }): Promise<boolean>
  answerSurvey(option: number): Promise<void>
  donate(projectId: string, amount: number): Promise<boolean>
  openBusiness(b: { type: BusinessType; name: string; color: string; price: 1 | 2 | 3; lot: string }): Promise<boolean>
  updateBusiness(patch: { name?: string; color?: string; price?: 1 | 2 | 3 }): Promise<void>
  buyUpgrade(id: UpgradeId): Promise<boolean>
  collect(): Promise<void>
  rate(owner: string, stars: number): Promise<void>
  submitCreative(taskId: string, kind: 'text' | 'drawing', content: string): Promise<boolean>
  onBuildingOpened(id: string, source: 'map' | 'pager' | 'directory'): void

  adminGrant(to: string, amount: number, note: string): Promise<void>
  adminReview(sub: Submission, owner: string, rating: number | null, featured: boolean): Promise<void>
  adminSaveConfig(patch: Partial<GameConfig>): Promise<void>
  adminRestart(): Promise<void>
}

export type Panel = 'city' | 'tasks' | 'projects' | 'business' | 'rating' | 'admin' | 'buildings'

let backend: Backend | null = null
let meRequested = false
let meLoaded = false
let migrating = false
/** Filled in by the camera store (avoids a circular import). */
export const useCityRef: { current: { getState(): { flyTo(id: string): void } } | null } = { current: null }
let toastId = 0
const fmtNum = (n: number) => n.toLocaleString('ru-RU')

const KIND_BY_VISUAL: Record<CivicVisual, BuildingKind> = {
  park: 'park',
  clinic: 'clinic',
  hospital: 'hospital',
  'water-tower': 'watertower',
  police: 'police',
  fire: 'fire',
  school: 'school',
  library: 'library',
  solar: 'solar',
  pump: 'pump',
  spire: 'tower',
  'plant-repair': 'plant',
}

const HEIGHT_BY_VISUAL: Partial<Record<CivicVisual, number>> = {
  park: 0.3,
  clinic: 9,
  hospital: 21,
  'water-tower': 19,
  police: 8,
  fire: 9,
  school: 11,
  library: 13,
  solar: 1.6,
  pump: 7,
  spire: 92,
}

/** Buildings opened on the map today for the patrol task (kept on this device). */
const patrolKey = (uid: string, day: number) => `afterlight:patrol:${uid}:${day}`
function readPatrol(uid: string, day: number): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(patrolKey(uid, day)) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writePatrol(uid: string, day: number, ids: string[]) {
  try {
    window.localStorage.setItem(patrolKey(uid, day), JSON.stringify(ids))
  } catch {
    /* private mode: the list lives until the page closes */
  }
}
const patrolMemory = new Map<string, string[]>()

/** Turn the simulation + residents' accounts into the objects the map draws. */
function buildObjects(city: CityState, cfg: GameConfig): Building[] {
  // Status comes from the city itself: the plant works with interruptions in a power crisis.
  const powerShort = city.needs.power.ratio < WARN_AT
  const out: Building[] = BUILDINGS.filter((b) => city.built.has(b.id)).map((b) =>
    b.kind === 'plant' ? { ...b, status: powerShort ? 'limited' : 'open' } : b,
  )
  const stage = city.openStage
  const byLot = new Map(city.businesses.map((b) => [b.biz.lot, b]))
  for (const lot of RESERVED_LOTS) {
    const P = lot.parcel
    const base = {
      districtId: lot.district as DistrictId,
      position: [P.c.x, P.c.z] as [number, number],
      rotation: P.rot,
      parcel: P.id,
      founded: new Date(cfg.startedAt).getFullYear(),
      landmark: false,
      tags: [] as string[],
      accent: '#ffd59a',
    }
    if (lot.use === 'civic') {
      const p = PROJECTS.find((q) => q.lot === lot.key)
      if (!p) continue
      const st = city.projects[p.id]
      if (P.stage > stage && !st.funded) continue
      if (st.completedAt) {
        const h = HEIGHT_BY_VISUAL[p.visual] ?? 10
        out.push({
          ...base,
          id: `civic:${p.id}`,
          kind: KIND_BY_VISUAL[p.visual],
          shape: p.visual === 'park' ? 'park' : 'civic',
          name: p.name,
          description: p.description,
          size: p.visual === 'park' ? [Math.min(P.w - 1, 16), Math.min(P.d - 1, 14)] : [8.4, 8.4],
          height: h,
          floors: p.visual === 'park' || p.visual === 'solar' ? 0 : Math.max(1, Math.round(h / 3.6)),
          occupancy: 0,
          capacity: 0,
          status: 'open',
          color: p.visual === 'spire' ? '#9fb3c6' : '#e6e2da',
          landmark: true,
          tags: ['построено жителями'],
          meta: { type: 'civic', projectId: p.id, visual: p.visual },
        })
      } else if (st.funded > 0) {
        out.push({
          ...base,
          id: `build:${p.id}`,
          kind: 'construction',
          shape: 'construction',
          name: `Стройка: ${p.name}`,
          description: `Жители собирают деньги. Когда сумма наберётся, здесь откроется ${p.name.toLowerCase()}.`,
          size: [Math.min(P.w - 1, 12), Math.min(P.d - 1, 12)],
          height: 14,
          floors: 0,
          occupancy: 0,
          capacity: 0,
          status: 'closed',
          color: '#c9c3b6',
          meta: { type: 'construction', projectId: p.id, progress: Math.min(1, st.funded / p.cost) },
        })
      } else {
        out.push({
          ...base,
          id: `lot:${lot.key}`,
          kind: 'lot',
          shape: 'lot',
          name: `Участок под ${p.name.toLowerCase()}`,
          description: 'Земля ждёт. Как только жители начнут собирать деньги, здесь появится стройка.',
          size: [P.w - 1, P.d - 1],
          height: 0.2,
          floors: 0,
          occupancy: 0,
          capacity: 0,
          status: 'closed',
          color: '#9c8a70',
          meta: { type: 'lot', lotKey: lot.key, use: 'civic', projectId: p.id },
        })
      }
    } else {
      const owned = byLot.get(lot.key)
      if (!owned && P.stage > stage) continue
      if (owned) {
        const { owner, biz } = owned
        out.push({
          ...base,
          id: `biz:${owner}`,
          kind: 'business',
          shape: 'business',
          name: biz.name,
          description: `${BUSINESS_TYPE_BY_ID[biz.type].label}, которую открыл житель города.`,
          size: [Math.min(13, P.w - 1.2), Math.min(10, P.d - 1.2)],
          height: 6.5,
          floors: 2,
          occupancy: 0,
          capacity: 0,
          status: 'open',
          color: biz.color,
          accent: '#ffd59a',
          tags: [BUSINESS_TYPE_BY_ID[biz.type].label.toLowerCase()],
          meta: { type: 'business', owner, businessType: biz.type, upgrades: biz.upgrades, price: biz.price },
        })
      } else {
        out.push({
          ...base,
          id: `lot:${lot.key}`,
          kind: 'lot',
          shape: 'lot',
          name: 'Свободный участок для бизнеса',
          description: 'Здесь любой житель может открыть своё заведение.',
          size: [P.w - 1, P.d - 1],
          height: 0.2,
          floors: 0,
          occupancy: 0,
          capacity: 0,
          status: 'open',
          color: '#9c8a70',
          meta: { type: 'lot', lotKey: lot.key, use: 'business' },
        })
      }
    }
  }
  return out
}

/** Why an action was refused, in words a resident understands. */
const REASONS: Record<string, string> = {
  'не хватает Искр': 'Не хватает Искр.',
  'уже выполнено сегодня': 'Это задание уже выполнено сегодня.',
  'дневной лимит взносов': 'Сегодня ты уже вложил максимум. Завтра можно снова.',
  'участок занят': 'Этот участок уже занят. Выбери другой.',
  'нет названия': 'Впиши название заведения (от 2 до 32 букв).',
  'мало репутации': 'Нужно больше репутации. Выполняй задания и помогай городу.',
  'проект ещё закрыт': 'Проект пока закрыт: в городе мало жителей.',
  'проект уже построен': 'Этот проект уже построен.',
  'бизнес уже есть': 'У тебя уже есть заведение.',
  'оценка уже стоит сегодня': 'Сегодня ты уже оценил это заведение. Изменить оценку можно завтра.',
  'не тот адрес': 'Посылка не для этого здания.',
  'обход не завершён': 'Открой на карте ещё здания.',
  'время идёт назад': 'Часы на устройстве отстают. Обнови страницу.',
}

export const useGame = create<GameState>((set, get) => {
  /** Replay everything: city + accounts. */
  const compute = (players = get().players, extra?: { uid: string; action: Action }) => {
    const st = get()
    const docs = extra ? { ...players, [extra.uid]: { ...players[extra.uid], actions: [...players[extra.uid].actions, extra.action] } } : players
    return replay({ config: st.config, opening: st.opening, players: docs, grants: st.grants, reviews: st.reviews }, st.now())
  }

  const save = async (next: PlayerDoc) => {
    const st = get()
    set({ players: { ...st.players, [st.uid]: next } })
    get().tick()
    try {
      await backend!.savePlayer(st.uid, next)
      return true
    } catch (e) {
      st.toast('Не получилось сохранить. Проверь интернет и попробуй ещё раз.', 'bad')
      console.error(e)
      return false
    }
  }

  const ready = () => {
    const st = get()
    if (!backend || !st.canWrite) {
      st.toast('Ты сейчас только смотришь: попроси у владельца доступ на изменение.', 'bad')
      return false
    }
    if (!meLoaded || !st.players[st.uid]) {
      st.toast('Загружаем твои данные, попробуй через пару секунд.', 'info')
      return false
    }
    if (st.legacy[st.uid]) {
      st.toast('Твои данные переносятся в новую версию. Это случится, когда основатель откроет город.', 'info')
      return false
    }
    return true
  }

  /** Bring old records over once: the owner writes everyone's opening balances. */
  const migrate = async (s: Snapshot) => {
    const st = get()
    if (!backend || migrating) return
    const legacy = Object.entries(s.players).filter(([, d]) => isLegacy(d)) as [string, LegacyPlayerDoc][]
    const known = s.opening?.players ?? {}
    // The owner converts records nobody has converted yet.
    if (st.isOwner && legacy.some(([uid]) => !known[uid])) {
      migrating = true
      const at = s.opening?.at ?? st.now()
      const players = { ...known }
      for (const [uid, doc] of legacy) {
        if (players[uid]) continue
        const extra =
          s.grants.filter((g) => g.to === uid && g.at < at).reduce((x, g) => x + g.amount, 0) +
          s.reviews.filter((r) => r.to === uid && r.status === 'approved' && r.at < at).reduce((x, r) => x + r.reward, 0)
        players[uid] = openingFromLegacy(doc, extra)
      }
      try {
        await backend.saveOpening({ at, players })
      } finally {
        migrating = false
      }
      return
    }
    // My own old record becomes an empty action log once the owner has saved its numbers.
    const mine = s.players[st.uid]
    if (mine && isLegacy(mine) && known[st.uid] && st.canWrite) {
      migrating = true
      try {
        await backend.savePlayer(st.uid, normalizePlayer(mine, st.now()))
      } finally {
        migrating = false
      }
    }
  }

  const syncClock = async () => {
    if (!backend) return
    const server = await backend.serverTime()
    if (server !== null) set({ clockOffset: server - Date.now() })
  }

  return {
    status: 'connecting',
    mode: 'local',
    uid: '',
    isOwner: false,
    canWrite: false,
    error: null,
    config: { ...DEFAULT_CONFIG, startedAt: Date.now() },
    opening: null,
    players: {},
    legacy: {},
    grants: [],
    reviews: [],
    city: null,
    accounts: {},
    objects: [],
    objectById: {},
    names: {},
    toasts: [],
    panel: null,
    sidebarOpen: true,
    celebrations: [],
    clockOffset: 0,

    now: () => Date.now() + get().clockOffset,

    async init() {
      backend = await connect()
      set({ mode: backend.mode, uid: backend.uid, isOwner: backend.isOwner, canWrite: backend.canWrite })
      await syncClock()
      setInterval(() => void syncClock(), 10 * 60_000)
      backend.start(
        (s: Snapshot) => {
          const now = get().now()
          const players: Record<string, PlayerDoc> = {}
          const legacy: Record<string, LegacyPlayerDoc> = {}
          for (const [uid, d] of Object.entries(s.players)) {
            if (isLegacy(d)) legacy[uid] = d
            players[uid] = normalizePlayer(d, now)
          }
          const base = { players, legacy, opening: s.opening, grants: s.grants, reviews: s.reviews }
          if (!s.config) {
            set({ status: 'waiting-owner', ...base })
            return
          }
          set({ status: 'ready', config: s.config, ...base })
          get().tick()
          void migrate(s)
          // Load (or, on a true first visit, create) my record exactly once, straight from the store.
          const st = get()
          if (st.canWrite && backend && !meRequested) {
            meRequested = true
            void backend
              .ensurePlayer(st.uid, emptyPlayer(st.now()))
              .then((doc) => {
                meLoaded = true
                if (!get().players[st.uid]) set({ players: { ...get().players, [st.uid]: normalizePlayer(doc, get().now()) } })
                get().tick()
              })
              .catch(() => set({ canWrite: false }))
          }
          if (s.players[st.uid]) meLoaded = true
          const ids = Object.keys(s.players)
          if (ids.length && backend) void backend.profiles(ids).then((names) => set({ names: { ...get().names, ...names } }))
        },
        (msg) => set({ error: msg }),
      )
      setInterval(() => get().tick(), 4000)
    },

    tick() {
      const { config, status } = get()
      if (status !== 'ready') return
      const prev = get().city
      const world = compute()
      const city = world.city
      const objects = buildObjects(city, config)
      set({ city, accounts: world.accounts, objects, objectById: Object.fromEntries(objects.map((o) => [o.id, o])) })
      if (prev) {
        for (const p of PROJECTS) {
          if (!prev.projects[p.id]?.completedAt && city.projects[p.id]?.completedAt) {
            get().toast(`Открыто: ${p.name}! Город стал лучше.`, 'good')
            const id = p.lot ? `civic:${p.id}` : objects.find((o) => o.kind === 'plant')?.id
            if (id) get().showOnMap(id, true)
          }
        }
      }
    },

    setPanel: (p) => set(p ? { panel: p, sidebarOpen: true } : { panel: null }),
    setSidebar: (open) => set({ sidebarOpen: open }),
    showOnMap(id, celebrate = false) {
      set({ panel: null, sidebarOpen: false })
      // Wait a frame so freshly created objects exist before the camera looks for them.
      setTimeout(() => {
        useCityRef.current?.getState().flyTo(id)
        if (celebrate) set({ celebrations: [...get().celebrations.filter((c) => Date.now() - c.at < 8000), { id, at: Date.now() }] })
      }, 60)
    },

    toast(text, tone = 'info') {
      const id = ++toastId
      set({ toasts: [...get().toasts, { id, text, tone }].slice(-3) })
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200)
    },

    me() {
      const st = get()
      const day = taskDayOf(st.now())
      const acc = st.accounts[st.uid]
      const key = `${st.uid}:${day}`
      const visited = patrolMemory.get(key) ?? readPatrol(st.uid, day)
      patrolMemory.set(key, visited)
      return {
        balance: Math.round(acc?.balance ?? 0),
        rep: acc?.rep ?? 0,
        daily: {
          date: String(day),
          day,
          done: acc?.tasks[day] ?? [],
          target: deliveryTarget(st.uid, day, st.config),
          surveyIdx: surveyIndex(day),
          visited,
        },
        donations: acc?.donations ?? [],
        business: acc?.business ?? null,
        ratings: Object.fromEntries(Object.entries(acc?.ratings ?? {}).map(([o, r]) => [o, r.s])),
        submissions: st.players[st.uid]?.submissions ?? [],
        survey: Object.fromEntries(Object.entries(acc?.survey ?? {}).map(([d, v]) => [d, v])),
        creativePaid: acc?.creativePaid ?? [],
      }
    },

    balance(uid) {
      const st = get()
      return Math.round(st.accounts[uid ?? st.uid]?.balance ?? 0)
    },

    async act(partial) {
      if (!ready()) return false
      const st = get()
      const mine = st.players[st.uid]
      // Never stamp an action earlier than my previous one.
      const last = mine.actions.length ? mine.actions[mine.actions.length - 1].t : 0
      const action = { ...partial, t: Math.max(st.now(), last + 1) } as Action
      // Check it exactly as every other device will.
      const world = compute(st.players, { uid: st.uid, action })
      const refused = world.accounts[st.uid]?.rejected.find((r) => r.t === action.t && r.k === action.k)
      if (refused) {
        st.toast(REASONS[refused.why] ?? `Не получилось: ${refused.why}.`, 'bad')
        return false
      }
      return save({ ...mine, actions: [...mine.actions, action] })
    },

    async completeDaily(id, extra = {}) {
      const ok = await get().act({ k: 'task', id, ...extra })
      if (ok) get().toast(`Задание выполнено: +${DAILY_TASKS.find((t) => t.id === id)!.reward} Искр`, 'good')
      return ok
    },

    async answerSurvey(option) {
      const ok = await get().completeDaily('survey', { x: option })
      if (ok) get().toast('Спасибо! Твой голос учтён.', 'info')
    },

    async donate(projectId, amount) {
      const st = get()
      const def = PROJECT_BY_ID[projectId]
      const ps = st.city?.projects[projectId]
      if (!def || !ps || ps.completedAt) return false
      if (!ps.available) {
        st.toast(`Проект откроется, когда в городе будет ${def.minPopulation} жителей.`, 'bad')
        return false
      }
      if (!Number.isInteger(amount) || amount <= 0) return false
      const amt = Math.min(amount, def.cost - ps.funded)
      const ok = await get().act({ k: 'donate', p: projectId, a: amt })
      // The panel stays open; the camera flies only when the building is finished (see tick).
      if (ok) get().toast(`Ты вложил ${fmtNum(amt)} Искр в «${def.name}»`, 'good')
      return ok
    },

    async openBusiness(b) {
      if (b.name.trim().length < 2) {
        get().toast('Впиши название заведения.', 'bad')
        return false
      }
      const ok = await get().act({ k: 'open', lot: b.lot, type: b.type, name: b.name.trim(), color: b.color, price: b.price })
      if (ok) {
        get().toast(`«${b.name.trim()}» открыт! Первые гости уже идут.`, 'good')
        get().showOnMap(`biz:${get().uid}`, true)
      }
      return ok
    },

    async updateBusiness(patch) {
      const biz = get().me().business
      if (!biz) return
      await get().act({ k: 'bizset', lot: biz.lot, ...patch })
    },

    async buyUpgrade(id) {
      const biz = get().me().business
      if (!biz) return false
      const up = UPGRADE_BY_ID[id]
      const ok = await get().act({ k: 'upgrade', lot: biz.lot, u: id })
      if (ok) {
        get().toast(`${up.label}: готово`, 'good')
        get().showOnMap(`biz:${get().uid}`, true)
      }
      return ok
    },

    async collect() {
      const biz = get().me().business
      if (!biz) return
      const amount = Math.floor(biz.pending)
      const ok = await get().act({ k: 'collect', lot: biz.lot })
      if (ok) get().toast(amount > 0 ? `Выручка собрана: +${amount} Искр` : 'Пока нечего собирать', amount > 0 ? 'good' : 'info')
    },

    async rate(owner, stars) {
      const ok = await get().act({ k: 'rate', o: owner, s: stars })
      if (!ok) return
      get().toast('Оценка сохранена', 'good')
      const me = get().me()
      if (!me.daily.done.includes('reviews')) await get().completeDaily('reviews', { x: owner })
    },

    async submitCreative(taskId, kind, content) {
      if (!ready()) return false
      const st = get()
      const me = st.me()
      if (me.creativePaid.includes(taskId)) {
        st.toast('Это задание ты уже выполнил.', 'info')
        return false
      }
      const pending = me.submissions.filter((s) => !st.reviews.some((r) => r.id === s.id))
      if (pending.length >= 5) {
        st.toast('У тебя уже 5 работ на проверке. Дождись оценки.', 'bad')
        return false
      }
      if (pending.some((s) => s.taskId === taskId)) {
        st.toast('Работа по этому заданию уже на проверке.', 'bad')
        return false
      }
      const now = st.now()
      const sub: Submission = { id: `${st.uid.slice(-6)}-${now.toString(36)}`, taskId, kind, at: now, ...(kind === 'text' ? { text: content.slice(0, 2000) } : { image: content }) }
      const mine = st.players[st.uid]
      const ok = await save({ ...mine, submissions: [...mine.submissions.slice(-20), sub] })
      if (ok) get().toast('Работа отправлена на проверку', 'good')
      return ok
    },

    onBuildingOpened(id, source) {
      const st = get()
      // Only a building found and tapped on the map counts for the delivery and the patrol.
      if (source !== 'map' || st.status !== 'ready' || !st.canWrite || !st.players[st.uid]) return
      const me = st.me()
      if (me.daily.target === id && !me.daily.done.includes('delivery')) {
        void get().completeDaily('delivery', { x: id })
        return
      }
      // Nobody else runs a business yet: a visit to the night cafe counts as the review task.
      if (id === MIDNIGHT_ID && !me.daily.done.includes('reviews') && !st.city?.businesses.some((x) => x.owner !== st.uid)) {
        void get().completeDaily('reviews', { x: 'cafe' })
      }
      if (me.daily.done.includes('patrol') || id.includes(':') || !st.city?.built.has(id)) return
      if (me.daily.visited.includes(id)) return
      const visited = [...me.daily.visited, id]
      patrolMemory.set(`${st.uid}:${me.daily.day}`, visited)
      writePatrol(st.uid, me.daily.day, visited)
      set({ players: { ...st.players } })
      if (visited.length >= PATROL_COUNT) void get().completeDaily('patrol', { ids: visited.slice(-PATROL_COUNT) })
      else st.toast(`Обход района: ${visited.length} из ${PATROL_COUNT}`, 'info')
    },

    async adminGrant(to, amount, note) {
      const st = get()
      if (!backend || !st.isOwner || !amount || !Number.isInteger(amount)) return
      if (amount < 0 && -amount > st.balance(to)) {
        st.toast(`У игрока только ${st.balance(to)} Искр.`, 'bad')
        return
      }
      const g: Grant = { id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, to, amount, note, at: st.now() }
      set({ grants: [...st.grants, g] })
      get().tick()
      await backend.addGrant(g)
      get().toast(amount > 0 ? `Начислено ${amount} Искр` : `Списано ${-amount} Искр`, 'good')
    },

    async adminReview(sub, owner, rating, featured) {
      if (!backend || !get().isOwner) return
      const r: Review = {
        id: sub.id,
        to: owner,
        taskId: sub.taskId,
        status: rating ? 'approved' : 'rejected',
        rating: rating ?? 0,
        reward: rating ? rating * get().config.creativePerStar : 0,
        featured,
        at: get().now(),
      }
      set({ reviews: [...get().reviews.filter((x) => x.id !== r.id), r] })
      get().tick()
      await backend.setReview(r)
      get().toast(rating ? `Оценка ${rating}: житель получит ${r.reward} Искр` : 'Работа отклонена', 'good')
    },

    async adminSaveConfig(patch) {
      const st = get()
      if (!backend || !st.isOwner) return
      for (const [k, v] of Object.entries(patch)) {
        const err = configError(k as keyof GameConfig, v as number)
        if (err) {
          st.toast(`Не сохранено: ${err.toLowerCase()}.`, 'bad')
          return
        }
      }
      // A new day length applies from now on: the days already lived keep theirs.
      if (patch.dayMinutes !== undefined && patch.dayMinutes !== st.config.dayMinutes && patch.startedAt === undefined) {
        const prev = st.config.dayPeriods?.length ? st.config.dayPeriods : [{ from: st.config.startedAt, minutes: st.config.dayMinutes }]
        patch = { ...patch, dayPeriods: [...prev, { from: st.now(), minutes: patch.dayMinutes }] }
      }
      const cfg = { ...st.config, ...patch }
      set({ config: cfg })
      get().tick()
      await backend.saveConfig(cfg)
      get().toast('Настройки сохранены', 'good')
    },

    async adminRestart() {
      const st = get()
      if (!backend || !st.isOwner) return
      // Everyone gets back what they put into this city: donations, businesses, upgrades.
      const at = st.now()
      const players: Opening['players'] = {}
      for (const [uid, a] of Object.entries(st.accounts)) {
        players[uid] = { balance: Math.round(a.balance + a.invested), rep: a.rep, donations: [], business: null, activity: [] }
      }
      await backend.saveOpening({ at, players })
      set({ opening: { at, players } })
      await get().adminSaveConfig({ startedAt: at, dayPeriods: [] })
    },
  }
})

/** Total a resident donated in this city. */
export function donatedBy(acc: Account | undefined) {
  return (acc?.donations ?? []).reduce((s, d) => s + d.amt, 0)
}

/** My state worked out from the ledger. Stable between renders unless it really changed. */
export function useMe(): MeView {
  const acc = useGame((s) => s.accounts[s.uid])
  const p = useGame((s) => s.players[s.uid])
  const cfg = useGame((s) => s.config)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when my account, record or the rules change
  return useMemo(() => useGame.getState().me(), [acc, p, cfg])
}

/** My spendable balance. */
export function useBalance(): number {
  return useGame((s) => s.balance())
}

/** Where today's parcel goes, until it is delivered (null afterwards). */
export function useDeliveryTarget(): string | null {
  return useGame((s) => {
    if (s.status !== 'ready' || !s.uid) return null
    const day = taskDayOf(s.now())
    if (s.accounts[s.uid]?.tasks[day]?.includes('delivery')) return null
    return deliveryTarget(s.uid, day, s.config)
  })
}
