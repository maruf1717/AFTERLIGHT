import { create } from 'zustand'
import { BUILDING_BY_ID, ROAD_BY_ID, TICK_MS, type RoadKind } from './catalog'
import { advance, build, evaluate, newCity, road, sell, type CityData, type Refusal, type Rot, type Stats } from './city'
import { makeComplaint, type Complaint } from './complaints'
import { cityNameError, connectStore, type CityCard, type Store } from './save'

export type Tool = { kind: 'road'; road: RoadKind } | { kind: 'build'; id: string } | { kind: 'sell' } | null

export interface Toast {
  id: number
  text: string
  tone: 'good' | 'bad' | 'info'
}

interface GameState {
  status: 'loading' | 'start' | 'play'
  mode: 'shared' | 'local'
  city: CityData | null
  stats: Stats | null
  /** Looking at someone else's city (read-only), or null for my own. */
  visiting: { uid: string; city: CityData; stats: Stats } | null
  tool: Tool
  rot: Rot
  /** The building whose card is open. */
  selected: number | null
  complaints: Complaint[]
  toasts: Toast[]
  rolledBack: boolean
  cities: CityCard[]

  init(): Promise<void>
  createCity(name: string): Promise<string | null>
  setTool(t: Tool): void
  rotate(): void
  /** Tap on a cell with the current tool. */
  apply(x: number, z: number): void
  /** A road drawn along these cells (one stroke). */
  roadLine(cells: [number, number][]): void
  select(uid: number | null): void
  sellSelected(): void
  toast(text: string, tone?: Toast['tone']): void
  dismissComplaint(id: number): void
  closeRollback(): void
  loadCities(): Promise<void>
  visit(uid: string | null): Promise<void>
}

let store: Store | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastId = 0
let complaintSeq = 0
let lastComplaint = 0

export const useGame = create<GameState>((set, get) => {
  const persist = (soon = true) => {
    if (!store) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(
      () => {
        const c = get().city
        if (c && store) void store.save(c).catch(() => get().toast('Не получилось сохранить. Проверь интернет.', 'bad'))
      },
      soon ? 1200 : 0,
    )
  }
  const commit = (c: CityData) => {
    set({ city: c, stats: evaluate(c) })
    persist()
  }
  const refuse = (why: Refusal) => get().toast(why, 'bad')

  const tick = () => {
    const st = get()
    if (st.status !== 'play' || !st.city) return
    const now = Date.now()
    const r = advance(st.city, now)
    set({ city: r.city, stats: r.stats })
    if (r.rolledBack) {
      set({ rolledBack: true, tool: null, selected: null })
      persist(false)
      return
    }
    // Every so often a resident says what is wrong.
    if (now - lastComplaint > 14_000) {
      const c = makeComplaint(
        r.stats.perHome.map((h) => ({ home: h.uid, missing: h.missing })),
        ++complaintSeq + Math.floor(now / 1000),
      )
      if (c) {
        lastComplaint = now
        set({ complaints: [...get().complaints.slice(-2), c] })
        setTimeout(() => get().dismissComplaint(c.id), 9000)
      }
    }
  }

  return {
    status: 'loading',
    mode: 'local',
    city: null,
    stats: null,
    visiting: null,
    tool: null,
    rot: 0,
    selected: null,
    complaints: [],
    toasts: [],
    rolledBack: false,
    cities: [],

    async init() {
      store = await connectStore()
      set({ mode: store.mode })
      // Local play (outside Claude): let automated checks drive the game.
      if (store.mode === 'local' && typeof window !== 'undefined') (window as unknown as { __game: typeof useGame }).__game = useGame
      const mine = await store.load().catch(() => null)
      if (!mine) {
        set({ status: 'start' })
        void get().loadCities()
        return
      }
      // Money earned while away (capped), residents moved in or out.
      const r = advance(mine, Date.now(), true)
      set({ status: 'play', city: r.city, stats: r.stats })
      const away = r.city.money - mine.money
      if (away >= 1) get().toast(`Пока тебя не было, город заработал ${Math.floor(away).toLocaleString('ru-RU')}`, 'good')
      persist(false)
      setInterval(tick, TICK_MS)
      setInterval(() => persist(false), 30_000)
    },

    async createCity(raw) {
      await get().loadCities()
      const name = raw.trim().replace(/\s+/g, ' ')
      const err = cityNameError(name, get().cities.map((c) => c.name))
      if (err) return err
      const c = newCity(name, Date.now())
      set({ status: 'play', city: c, stats: evaluate(c) })
      persist(false)
      setInterval(tick, TICK_MS)
      setInterval(() => persist(false), 30_000)
      return null
    },

    setTool(t) {
      set({ tool: t, selected: null })
    },
    rotate() {
      set({ rot: ((get().rot + 1) % 4) as Rot })
    },

    apply(x, z) {
      const st = get()
      if (!st.city || st.visiting) return
      const t = st.tool
      if (!t) return
      if (t.kind === 'road') {
        const r = road(st.city, t.road, x, z)
        if (typeof r === 'string') refuse(r)
        else commit(r)
      } else if (t.kind === 'build') {
        const r = build(st.city, t.id, x, z, st.rot)
        if (typeof r === 'string') refuse(r)
        else commit(r)
      } else if (t.kind === 'sell') {
        const r = sell(st.city, x, z)
        if (typeof r === 'string') refuse(r)
        else {
          commit(r.city)
          get().toast(`Продано: ${r.what}, +${r.got.toLocaleString('ru-RU')}`, 'info')
        }
      }
    },

    roadLine(cells) {
      const st = get()
      if (!st.city || st.visiting || st.tool?.kind !== 'road') return
      let c = st.city
      let laid = 0
      let short = false
      for (const [x, z] of cells) {
        const r = road(c, st.tool.road, x, z)
        if (typeof r === 'string') {
          if (r === 'Нет денег') short = true
          continue
        }
        c = r
        laid++
      }
      if (laid) commit(c)
      if (short) get().toast(`Не хватило денег на всю дорогу (${ROAD_BY_ID[st.tool.road].name.toLowerCase()})`, 'bad')
    },

    select(uid) {
      set({ selected: uid })
    },

    sellSelected() {
      const st = get()
      const p = st.city?.items.find((i) => i.uid === st.selected)
      if (!st.city || !p) return
      const r = sell(st.city, p.x, p.z)
      if (typeof r === 'string') return refuse(r)
      commit(r.city)
      set({ selected: null })
      get().toast(`Продано: ${BUILDING_BY_ID[p.id].name}, +${r.got.toLocaleString('ru-RU')}`, 'info')
    },

    toast(text, tone = 'info') {
      const id = ++toastId
      set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] })
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3500)
    },

    dismissComplaint(id) {
      set({ complaints: get().complaints.filter((c) => c.id !== id) })
    },
    closeRollback() {
      set({ rolledBack: false })
    },

    async loadCities() {
      if (!store) return
      const list = await store.cities().catch(() => [])
      set({ cities: list.sort((a, b) => b.pop - a.pop) })
    },

    async visit(uid) {
      if (!uid || !store) {
        set({ visiting: null })
        return
      }
      const c = await store.open(uid)
      if (!c) return get().toast('Город не найден', 'bad')
      const r = advance(c, Date.now(), true)
      set({ visiting: { uid, city: r.city, stats: r.stats }, tool: null, selected: null })
    },
  }
})

/** The city on screen: mine, or the one I am visiting. */
export function useShownCity() {
  return useGame((s) => s.visiting?.city ?? s.city)
}
export function useShownStats() {
  return useGame((s) => s.visiting?.stats ?? s.stats)
}
