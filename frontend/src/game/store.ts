import { useMemo } from 'react'
import { create } from 'zustand'
import { BUILDINGS, DISTRICT_BY_ID, lotCenter } from '../data/city'
import { RESERVED_LOTS } from '../data/lots'
import type { Building, BuildingKind, DistrictId } from '../data/types'
import { hashString } from '../lib/random'
import {
  BUSINESS_TYPE_BY_ID,
  DAILY_TASKS,
  DEFAULT_CONFIG,
  PROJECT_BY_ID,
  PROJECTS,
  SURVEY_QUESTIONS,
  UPGRADE_BY_ID,
  type BusinessType,
  type CivicVisual,
  type DailyTaskId,
  type GameConfig,
  type UpgradeId,
} from './catalog'
import { connect, type Backend, type Profile, type Snapshot } from './backend'
import { pendingIncome, simulate, type CityState } from './sim'
import { emptyPlayer, type Business, type Grant, type PlayerDoc, type Review, type Submission } from './types'

export interface Toast {
  id: number
  text: string
  tone: 'good' | 'bad' | 'info'
}

interface GameState {
  status: 'connecting' | 'ready' | 'waiting-owner'
  mode: 'shared' | 'local'
  uid: string
  isOwner: boolean
  canWrite: boolean
  error: string | null
  config: GameConfig
  players: Record<string, PlayerDoc>
  grants: Grant[]
  reviews: Review[]
  city: CityState | null
  /** Every object drawn on the map right now: built static buildings + game objects. */
  objects: Building[]
  objectById: Record<string, Building>
  names: Record<string, Profile>
  toasts: Toast[]
  panel: Panel | null

  init(): Promise<void>
  tick(): void
  setPanel(p: Panel | null): void
  toast(text: string, tone?: Toast['tone']): void
  me(): PlayerDoc
  balance(uid?: string): number

  completeDaily(id: DailyTaskId): Promise<void>
  answerSurvey(option: number): Promise<void>
  donate(projectId: string, amount: number): Promise<boolean>
  openBusiness(b: { type: BusinessType; name: string; color: string; price: 1 | 2 | 3; lot: string }): Promise<boolean>
  updateBusiness(patch: Partial<Pick<Business, 'name' | 'color' | 'price'>>): Promise<void>
  buyUpgrade(id: UpgradeId): Promise<boolean>
  collect(): Promise<void>
  rate(owner: string, stars: number): Promise<void>
  submitCreative(taskId: string, kind: 'text' | 'drawing', content: string): Promise<boolean>
  onBuildingOpened(id: string): void

  adminGrant(to: string, amount: number, note: string): Promise<void>
  adminReview(sub: Submission, owner: string, rating: number | null, featured: boolean): Promise<void>
  adminSaveConfig(patch: Partial<GameConfig>): Promise<void>
  adminRestart(): Promise<void>
}

export type Panel = 'city' | 'tasks' | 'projects' | 'business' | 'rating' | 'admin' | 'buildings'

let backend: Backend | null = null
let toastId = 0

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

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

/** Turn the simulation + residents' records into the objects the map draws. */
function buildObjects(city: CityState, players: Record<string, PlayerDoc>, cfg: GameConfig): Building[] {
  const out: Building[] = BUILDINGS.filter((b) => city.built.has(b.id))
  for (const lot of RESERVED_LOTS) {
    const d = DISTRICT_BY_ID[lot.district]
    const [x, z] = lotCenter(d, lot.col, lot.row)
    const base = {
      districtId: lot.district as DistrictId,
      position: [x, z] as [number, number],
      founded: new Date(cfg.startedAt).getFullYear(),
      landmark: false,
      tags: [] as string[],
      accent: '#ffd59a',
    }
    if (lot.use === 'civic') {
      const p = PROJECTS.find((q) => q.lot === lot.key)
      if (!p) continue
      const st = city.projects[p.id]
      if (st.completedAt) {
        const h = HEIGHT_BY_VISUAL[p.visual] ?? 10
        out.push({
          ...base,
          id: `civic:${p.id}`,
          kind: KIND_BY_VISUAL[p.visual],
          shape: p.visual === 'park' ? 'park' : 'civic',
          name: p.name,
          description: p.description,
          size: p.visual === 'park' ? [9, 9] : [8.4, 8.4],
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
          size: [8.6, 8.6],
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
          size: [9, 9],
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
      const owner = Object.entries(players).find(([, pl]) => pl.business?.lot === lot.key && pl.business.openedAt >= cfg.startedAt)
      if (owner) {
        const [uid, pl] = owner
        const biz = pl.business!
        out.push({
          ...base,
          id: `biz:${uid}`,
          kind: 'business',
          shape: 'business',
          name: biz.name,
          description: `${BUSINESS_TYPE_BY_ID[biz.type].label}, которую открыл житель города.`,
          size: [7.6, 7],
          height: 6.5,
          floors: 2,
          occupancy: 0,
          capacity: 0,
          status: 'open',
          color: biz.color,
          accent: '#ffd59a',
          tags: [BUSINESS_TYPE_BY_ID[biz.type].label.toLowerCase()],
          meta: { type: 'business', owner: uid, businessType: biz.type, upgrades: biz.upgrades, price: biz.price },
        })
      } else {
        out.push({
          ...base,
          id: `lot:${lot.key}`,
          kind: 'lot',
          shape: 'lot',
          name: 'Свободный участок для бизнеса',
          description: 'Здесь любой житель может открыть своё заведение.',
          size: [9, 9],
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

function sameDay(cfg: GameConfig, t: number, now: number) {
  return new Date(t).toDateString() === new Date(now).toDateString() && t >= cfg.startedAt
}

export const useGame = create<GameState>((set, get) => {
  /** Apply a change to my own record and save it. */
  const mutateMe = async (fn: (p: PlayerDoc) => PlayerDoc | null) => {
    const st = get()
    if (!backend || !st.canWrite) {
      st.toast('Ты сейчас только смотришь: попроси у владельца доступ на изменение.', 'bad')
      return false
    }
    const next = fn(structuredClone(st.me()))
    if (!next) return false
    next.activity = next.activity.slice(-300)
    set({ players: { ...st.players, [st.uid]: next } })
    get().tick()
    try {
      await backend.savePlayer(st.uid, next)
      return true
    } catch (e) {
      st.toast('Не получилось сохранить. Проверь интернет и попробуй ещё раз.', 'bad')
      console.error(e)
      return false
    }
  }

  const ensureDaily = (p: PlayerDoc): PlayerDoc => {
    const date = todayKey()
    if (p.daily?.date === date) return p
    const candidates = get().objects.filter((b) => !b.meta && b.kind !== 'unknown')
    const target = candidates.length ? candidates[hashString(date + get().uid) % candidates.length].id : undefined
    return { ...p, daily: { date, done: [], target, surveyIdx: hashString(date) % SURVEY_QUESTIONS.length, visited: [] } }
  }

  const reward = (p: PlayerDoc, id: DailyTaskId, now: number): PlayerDoc => {
    const def = DAILY_TASKS.find((t) => t.id === id)!
    return { ...p, balance: p.balance + def.reward, rep: p.rep + 1, activity: [...p.activity, now], daily: { ...p.daily, done: [...p.daily.done, id] } }
  }

  return {
    status: 'connecting',
    mode: 'local',
    uid: '',
    isOwner: false,
    canWrite: false,
    error: null,
    config: { ...DEFAULT_CONFIG, startedAt: Date.now() },
    players: {},
    grants: [],
    reviews: [],
    city: null,
    objects: [],
    objectById: {},
    names: {},
    toasts: [],
    panel: null,

    async init() {
      backend = await connect()
      set({ mode: backend.mode, uid: backend.uid, isOwner: backend.isOwner, canWrite: backend.canWrite })
      backend.start(
        (s: Snapshot) => {
          if (!s.config) {
            set({ status: 'waiting-owner', players: s.players, grants: s.grants, reviews: s.reviews })
            return
          }
          set({ status: 'ready', config: s.config, players: s.players, grants: s.grants, reviews: s.reviews })
          get().tick()
          // First visit: create my record.
          const st = get()
          if (st.canWrite && !s.players[st.uid] && backend) {
            const fresh = emptyPlayer(Date.now())
            set({ players: { ...st.players, [st.uid]: fresh } })
            void backend.savePlayer(st.uid, fresh).catch(() => set({ canWrite: false }))
          }
          const ids = Object.keys(s.players)
          if (ids.length && backend) void backend.profiles(ids).then((names) => set({ names: { ...get().names, ...names } }))
        },
        (msg) => set({ error: msg }),
      )
      setInterval(() => get().tick(), 4000)
    },

    tick() {
      const { config, players, status } = get()
      if (status !== 'ready') return
      const city = simulate(config, players, Date.now())
      const objects = buildObjects(city, players, config)
      set({ city, objects, objectById: Object.fromEntries(objects.map((o) => [o.id, o])) })
    },

    setPanel: (p) => set({ panel: p }),

    toast(text, tone = 'info') {
      const id = ++toastId
      set({ toasts: [...get().toasts, { id, text, tone }].slice(-3) })
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200)
    },

    me() {
      const st = get()
      return ensureDaily(st.players[st.uid] ?? emptyPlayer(Date.now()))
    },

    balance(uid) {
      const st = get()
      const id = uid ?? st.uid
      const p = st.players[id]
      if (!p) return 0
      const grants = st.grants.filter((g) => g.to === id).reduce((s, g) => s + g.amount, 0)
      const creative = st.reviews.filter((r) => r.to === id && r.status === 'approved').reduce((s, r) => s + r.reward, 0)
      return Math.round(p.balance + grants + creative)
    },

    async completeDaily(id) {
      const now = Date.now()
      const ok = await mutateMe((p) => (p.daily.done.includes(id) ? null : reward(p, id, now)))
      if (ok) get().toast(`Задание выполнено: +${DAILY_TASKS.find((t) => t.id === id)!.reward} Искр`, 'good')
    },

    async answerSurvey(option) {
      const now = Date.now()
      const ok = await mutateMe((p) => {
        if (p.daily.done.includes('survey')) return null
        const next = reward(p, 'survey', now)
        next.survey = { ...next.survey, [p.daily.date]: option }
        return next
      })
      if (ok) get().toast('Спасибо! Твой голос учтён.', 'good')
    },

    async donate(projectId, amount) {
      const st = get()
      const def = PROJECT_BY_ID[projectId]
      const ps = st.city?.projects[projectId]
      if (!def || !ps) return false
      if (ps.completedAt) return false
      if (!ps.available) {
        st.toast(`Проект откроется, когда в городе будет ${def.minPopulation} жителей.`, 'bad')
        return false
      }
      if (amount <= 0) return false
      if (st.balance() < amount) {
        st.toast('Не хватает Искр. Выполни задания, чтобы заработать.', 'bad')
        return false
      }
      const now = Date.now()
      const me = st.me()
      const today = me.donations.filter((d) => sameDay(st.config, d.t, now)).reduce((s, d) => s + d.amt, 0)
      if (today + amount > st.config.dailyDonationLimit) {
        st.toast(`За день можно вложить не больше ${st.config.dailyDonationLimit} Искр. Осталось ${Math.max(0, st.config.dailyDonationLimit - today)}.`, 'bad')
        return false
      }
      const left = def.cost - ps.funded
      const amt = Math.min(amount, Math.max(left, 1))
      const ok = await mutateMe((p) => ({
        ...p,
        balance: p.balance - amt,
        rep: p.rep + (amt >= 500 ? 1 : 0),
        activity: [...p.activity, now],
        donations: [...p.donations, { p: projectId, amt, t: now }],
      }))
      if (ok) get().toast(`Ты вложил ${amt} Искр в «${def.name}»`, 'good')
      return ok
    },

    async openBusiness(b) {
      const st = get()
      const def = BUSINESS_TYPE_BY_ID[b.type]
      if (st.me().business && st.me().business!.openedAt >= st.config.startedAt) return false
      if (st.me().rep < st.config.businessRep) {
        st.toast(`Нужна репутация ${st.config.businessRep}. Выполняй задания и помогай городу.`, 'bad')
        return false
      }
      if (st.balance() < def.openCost) {
        st.toast(`Открытие стоит ${def.openCost} Искр.`, 'bad')
        return false
      }
      const taken = Object.entries(st.players).some(([uid, p]) => uid !== st.uid && p.business?.lot === b.lot && p.business.openedAt >= st.config.startedAt)
      if (taken) {
        st.toast('Этот участок уже занят. Выбери другой.', 'bad')
        return false
      }
      const now = Date.now()
      const ok = await mutateMe((p) => ({
        ...p,
        balance: p.balance - def.openCost,
        activity: [...p.activity, now],
        business: { ...b, name: b.name.trim().slice(0, 32) || def.label, openedAt: now, lastCollect: now, upgrades: [], totalEarned: 0 },
      }))
      if (ok) get().toast(`«${b.name}» открыт! Первые гости уже идут.`, 'good')
      return ok
    },

    async updateBusiness(patch) {
      await mutateMe((p) => (p.business ? { ...p, business: { ...p.business, ...patch, name: (patch.name ?? p.business.name).slice(0, 32) } } : null))
    },

    async buyUpgrade(id) {
      const st = get()
      const up = UPGRADE_BY_ID[id]
      if (st.balance() < up.cost) {
        st.toast(`Улучшение стоит ${up.cost} Искр.`, 'bad')
        return false
      }
      const ok = await mutateMe((p) =>
        p.business && !p.business.upgrades.includes(id) ? { ...p, balance: p.balance - up.cost, business: { ...p.business, upgrades: [...p.business.upgrades, id] } } : null,
      )
      if (ok) get().toast(`${up.label}: готово`, 'good')
      return ok
    },

    async collect() {
      const st = get()
      const me = st.me()
      if (!me.business || !st.city) return
      const amount = pendingIncome(st.uid, me.business, st.city, st.players, st.config)
      const now = Date.now()
      const ok = await mutateMe((p) =>
        p.business ? { ...p, balance: p.balance + amount, activity: [...p.activity, now], business: { ...p.business, lastCollect: now, totalEarned: p.business.totalEarned + amount } } : null,
      )
      if (ok) get().toast(amount > 0 ? `Выручка собрана: +${amount} Искр` : 'Пока нечего собирать', amount > 0 ? 'good' : 'info')
    },

    async rate(owner, stars) {
      const now = Date.now()
      const ok = await mutateMe((p) => {
        let next: PlayerDoc = { ...p, ratings: { ...p.ratings, [owner]: stars } }
        if (!p.daily.done.includes('reviews')) next = reward(next, 'reviews', now)
        return next
      })
      if (ok) get().toast('Оценка сохранена', 'good')
    },

    async submitCreative(taskId, kind, content) {
      const st = get()
      const me = st.me()
      const pending = me.submissions.filter((s) => !st.reviews.some((r) => r.id === s.id))
      if (pending.length >= 5) {
        st.toast('У тебя уже 5 работ на проверке. Дождись оценки.', 'bad')
        return false
      }
      if (pending.some((s) => s.taskId === taskId)) {
        st.toast('Работа по этому заданию уже на проверке.', 'bad')
        return false
      }
      const now = Date.now()
      const sub: Submission = { id: `${st.uid.slice(-6)}-${now.toString(36)}`, taskId, kind, at: now, ...(kind === 'text' ? { text: content.slice(0, 2000) } : { image: content }) }
      const ok = await mutateMe((p) => ({ ...p, activity: [...p.activity, now], submissions: [...p.submissions.slice(-20), sub] }))
      if (ok) get().toast('Работа отправлена на проверку', 'good')
      return ok
    },

    onBuildingOpened(id) {
      const st = get()
      if (st.status !== 'ready' || !st.canWrite || !st.players[st.uid]) return
      const me = st.me()
      if (me.daily.target === id && !me.daily.done.includes('delivery')) {
        void get().completeDaily('delivery')
        return
      }
      if (me.daily.done.includes('patrol') || id.includes(':')) return
      const visited = new Set(me.daily.visited ?? [])
      if (visited.has(id)) return
      visited.add(id)
      const now = Date.now()
      void mutateMe((p) => {
        let next: PlayerDoc = { ...p, daily: { ...p.daily, visited: [...visited] } }
        if (visited.size >= 5) next = reward(next, 'patrol', now)
        return next
      }).then((ok) => ok && visited.size >= 5 && get().toast('Обход района завершён: +50 Искр', 'good'))
    },

    async adminGrant(to, amount, note) {
      if (!backend || !get().isOwner || !amount) return
      const g: Grant = { id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, to, amount, note, at: Date.now() }
      set({ grants: [...get().grants, g] })
      await backend.addGrant(g)
      get().toast(`Начислено ${amount} Искр`, 'good')
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
        at: Date.now(),
      }
      set({ reviews: [...get().reviews.filter((x) => x.id !== r.id), r] })
      await backend.setReview(r)
      get().toast(rating ? `Оценка ${rating}: житель получит ${r.reward} Искр` : 'Работа отклонена', 'good')
    },

    async adminSaveConfig(patch) {
      if (!backend || !get().isOwner) return
      const cfg = { ...get().config, ...patch }
      set({ config: cfg })
      get().tick()
      await backend.saveConfig(cfg)
      get().toast('Настройки сохранены', 'good')
    },

    async adminRestart() {
      await get().adminSaveConfig({ startedAt: Date.now() })
    },
  }
})

/** Total a resident donated since the city was founded. */
export function donatedBy(p: PlayerDoc, cfg: GameConfig) {
  return p.donations.filter((d) => d.t >= cfg.startedAt).reduce((s, d) => s + d.amt, 0)
}

/** My record with today's tasks normalised. Stable between renders unless it really changed. */
export function useMe(): PlayerDoc {
  const p = useGame((s) => s.players[s.uid])
  const objects = useGame((s) => s.objects)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => useGame.getState().me(), [p, objects])
}

/** My spendable balance (own record + grants + creative rewards). */
export function useBalance(): number {
  return useGame((s) => s.balance())
}
