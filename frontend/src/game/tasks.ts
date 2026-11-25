import type { DistrictId } from '../data/types'
import { createRng, hashString } from '../lib/random'
import type { DailyTaskId } from './catalog'

/*
 * The bank of daily tasks. Every task is one of five kinds (wires, delivery, survey, patrol,
 * reviews), each with its own text, place and difficulty. A resident sees five at a time;
 * a finished task disappears and the next one from their personal queue takes its place.
 * Each day starts further down the queue, so the same task does not come back for weeks.
 */

export interface SurveyQuestion {
  id: string
  q: string
  options: string[]
  /** What the answer changes, shown under the question (see stage 3.2). */
  effect?: string
}

export interface TaskVariant {
  id: string
  kind: DailyTaskId
  title: string
  text: string
  reward: number
  /** Wires: how many pairs. */
  pairs?: number
  /** Patrol: how many buildings, and in which district (any if not set). */
  count?: number
  district?: DistrictId
  /** Survey: the question. */
  question?: SurveyQuestion
  /** Delivery: what is carried (for the text and the hint). */
  item?: string
}

/** Tasks shown at once. */
export const TASKS_SHOWN = 5
/** Tasks that pay per real day in a shared city (in one-player test mode there is no limit). */
export const TASKS_PER_DAY = 5

const DISTRICT_NAME: Record<DistrictId, string> = { residential: 'Микрорайоне', downtown: 'Центре', industrial: 'Промзоне' }

/* Wires ------------------------------------------------------------------- */

const WIRE_PLACES: [string, string][] = [
  ['на ТЭЦ', 'Без этого станция работает с перебоями.'],
  ['в школе', 'В классах мигает свет, дети не видят доску.'],
  ['в поликлинике', 'Аппарат УЗИ выключается посреди приёма.'],
  ['в библиотеке', 'Читальный зал сидит в полутьме.'],
  ['на почте', 'Сортировочная лента стоит.'],
  ['в универмаге', 'Кассы то включаются, то гаснут.'],
  ['на складе', 'Холодильники с продуктами греются.'],
  ['в мастерской', 'Станки не запускаются.'],
  ['на светофоре у кольца', 'Светофор моргает жёлтым, водители путаются.'],
  ['в фонарях бульвара', 'Половина бульвара осталась без света.'],
  ['в подъезде пятиэтажки', 'Жильцы поднимаются по лестнице с фонариками.'],
  ['на водокачке', 'Насос качает воду рывками.'],
]

/* Deliveries ---------------------------------------------------------------- */

const DELIVERY_ITEMS: [string, string][] = [
  ['посылку', 'Обычная посылка с почты.'],
  ['лекарства', 'Соседке срочно нужны таблетки из аптеки.'],
  ['письмо', 'Письмо без обратного адреса. Интересно, от кого.'],
  ['свежий хлеб', 'Хлеб из гастронома, ещё тёплый.'],
  ['цветы', 'Букет к юбилею. Не помни лепестки.'],
  ['газеты', 'Утренний выпуск «Вестника Афтерлайта».'],
  ['ключи', 'Кто-то забыл ключи в автобусе.'],
  ['торт', 'Торт на день рождения. Неси аккуратно.'],
  ['детали для станка', 'Тяжёлая коробка с болтами и шестерёнками.'],
  ['книги из библиотеки', 'Читатель заказал книги на дом.'],
  ['пиццу', 'Пицца остывает, поторопись.'],
  ['пакет с продуктами', 'Пожилой сосед попросил помочь с покупками.'],
  ['чертежи', 'Чертежи нового квартала для прораба.'],
  ['кошку', 'Кошка сбежала из дома. Верни её хозяевам.'],
  ['подарок', 'Подарок с бантом. Что внутри, не говорят.'],
  ['кофе в термосе', 'Ночная смена просит кофе.'],
  ['лампочки', 'Коробка лампочек для подъезда.'],
  ['приглашения', 'Приглашения на праздник двора.'],
  ['забытый зонтик', 'Зонтик оставили в кафе.'],
  ['рассаду', 'Рассада помидоров для огорода.'],
]

/* Surveys ----------------------------------------------------------------- */

export const SURVEY_BANK: SurveyQuestion[] = [
  { id: 'need', q: 'Что городу нужнее всего прямо сейчас?', options: ['Больница', 'Парк', 'Новая электростанция'], effect: 'Победивший проект сутки получает +10% к каждому взносу.' },
  { id: 'park', q: 'Что добавить в парк?', options: ['Сцену для концертов', 'Каток', 'Сад скульптур'], effect: 'Победитель появится в парке, когда парк построят.' },
  { id: 'market', q: 'Где открыть следующий рынок?', options: ['Микрорайон', 'Центр', 'У Промзоны'] },
  { id: 'square', q: 'Как назвать площадь у кольца?', options: ['Площадь Света', 'Кольцевая', 'Площадь Основателей'] },
  { id: 'bus', q: 'Как часто должен ходить автобус?', options: ['Каждые 5 минут', 'Каждые 10 минут', 'Хватит и 20'] },
  { id: 'lamps', q: 'Каким сделать ночное освещение улиц?', options: ['Тёплым жёлтым', 'Холодным белым', 'Разноцветным'] },
  { id: 'holiday', q: 'Какой праздник города устроить первым?', options: ['День города', 'Фестиваль огней', 'Ярмарку'] },
  { id: 'trees', q: 'Какие деревья сажать вдоль бульвара?', options: ['Липы', 'Каштаны', 'Клёны'] },
  { id: 'cafe', q: 'Какого заведения в городе не хватает?', options: ['Пекарни', 'Кинотеатра', 'Спортзала'] },
  { id: 'school', q: 'Какой кружок открыть в школе?', options: ['Робототехника', 'Театр', 'Футбол'] },
  { id: 'bike', q: 'Нужны ли городу велодорожки?', options: ['Да, везде', 'Только в парке', 'Не нужны'] },
  { id: 'night', q: 'Должно ли кафе «Полночь» работать и днём?', options: ['Нет, это его тайна', 'Да, по выходным', 'Да, всегда'] },
  { id: 'mascot', q: 'Кто станет символом города?', options: ['Кот с крыши ТЭЦ', 'Фонарщик', 'Искорка'] },
  { id: 'colour', q: 'В какой цвет покрасить автобусы?', options: ['Оранжевый', 'Синий', 'Зелёный'] },
  { id: 'warehouse', q: 'Что сделать со Складом №7?', options: ['Музей', 'Оставить тайной', 'Снести'] },
  { id: 'river', q: 'Где поставить фонтан?', options: ['У ТЦ', 'В Микрорайоне', 'У школы'] },
  { id: 'sport', q: 'Какую площадку построить во дворах?', options: ['Футбольную', 'Баскетбольную', 'Детскую'] },
  { id: 'news', q: 'Где читать новости города?', options: ['Газета', 'Доска объявлений', 'Радио'] },
  { id: 'market2', q: 'Что продавать на ярмарке?', options: ['Овощи с огородов', 'Поделки жителей', 'Всё подряд'] },
  { id: 'music', q: 'Какая музыка должна играть на площади?', options: ['Живой оркестр', 'Радио', 'Тишина'] },
  { id: 'snow', q: 'Что первым чистить зимой?', options: ['Тротуары', 'Дороги', 'Дворы'] },
  { id: 'museum', q: 'О чём сделать первый музей?', options: ['История ТЭЦ', 'Жители города', 'Тайны города'] },
  { id: 'shop', q: 'Какой магазин нужен Микрорайону?', options: ['Продукты', 'Хозтовары', 'Аптека'] },
  { id: 'work', q: 'Что важнее для новых жителей?', options: ['Работа', 'Жильё', 'Развлечения'] },
  { id: 'clock', q: 'Нужны ли часы на башне ТЦ?', options: ['Да', 'Нет', 'Лучше табло с погодой'] },
  { id: 'dog', q: 'Где сделать площадку для собак?', options: ['В парке', 'У кольцевой', 'Нигде'] },
  { id: 'garden', q: 'Что вырастить в общем огороде?', options: ['Помидоры', 'Цветы', 'Яблони'] },
  { id: 'night2', q: 'Что сделать с улицами ночью?', options: ['Больше фонарей', 'Ночной автобус', 'Пусть спят'] },
  { id: 'stadium', q: 'Где построить стадион, когда город вырастет?', options: ['На окраине', 'У Промзоны', 'Рядом с центром'] },
  { id: 'anthem', q: 'Нужен ли городу гимн?', options: ['Да, торжественный', 'Да, весёлый', 'Нет'] },
  { id: 'cinema', q: 'Какое кино показывать летом под открытым небом?', options: ['Комедии', 'Фантастику', 'Старое советское'] },
  { id: 'trash', q: 'Как собирать мусор?', options: ['Раздельно', 'Как сейчас', 'Чаще вывозить'] },
  { id: 'roof', q: 'Что сделать на крышах пятиэтажек?', options: ['Сады', 'Солнечные панели', 'Ничего'] },
  { id: 'statue', q: 'Кому поставить первый памятник?', options: ['Основателю', 'Строителям ТЭЦ', 'Неизвестному жителю'] },
  { id: 'library', q: 'Какие книги нужны библиотеке?', options: ['Детские', 'Учебники', 'Детективы'] },
  { id: 'taxi', q: 'Нужно ли городу такси?', options: ['Да', 'Хватит автобусов', 'Лучше велопрокат'] },
  { id: 'fair', q: 'Когда устраивать ярмарку?', options: ['Каждые выходные', 'Раз в месяц', 'По праздникам'] },
  { id: 'wall', q: 'Что нарисовать на стене у школы?', options: ['Карту города', 'Космос', 'Портреты жителей'] },
  { id: 'pool', q: 'Нужен ли городу бассейн?', options: ['Да, крытый', 'Да, летний', 'Пока рано'] },
  { id: 'plant', q: 'Чем заменить старую ТЭЦ в будущем?', options: ['Солнцем', 'Ветром', 'Новой ТЭЦ'] },
]

/* Patrols and reviews ------------------------------------------------------ */

const PATROL_TEXTS: [string, string][] = [
  ['Обход района', 'Найди на карте и нажми на {n} разных зданий {where}.'],
  ['Проверка подъездов', 'Управдом просит заглянуть в {n} зданий {where} и проверить двери.'],
  ['Перепись жильцов', 'Обойди {n} зданий {where} и отметь, кто где живёт.'],
  ['Счётчики воды', 'Сними показания счётчиков в {n} зданиях {where}.'],
]

const REVIEW_TEXTS: [string, string][] = [
  ['Оцени заведение', 'Поставь оценку заведению другого жителя. Если таких нет, сходи в кафе «Полночь».'],
  ['Тайный покупатель', 'Зайди в заведение другого жителя и честно оцени его. Нет заведений — загляни в «Полночь».'],
  ['Отзыв для газеты', 'Газете нужен отзыв о любом заведении города. Нет заведений жителей — сходи в «Полночь».'],
  ['Проверка качества', 'Санитарная служба просит оценить заведение. Нет других — сходи в «Полночь».'],
  ['Совет новичку', 'Новый житель спрашивает, куда сходить. Оцени заведение или сходи в «Полночь».'],
]

/* The pool ------------------------------------------------------------------ */

function buildPool(): TaskVariant[] {
  const out: TaskVariant[] = []
  WIRE_PLACES.forEach(([place, why], i) => {
    for (const pairs of [3, 4, 5]) {
      out.push({ id: `w${i}-${pairs}`, kind: 'wires', title: `Почини проводку ${place}`, text: `${why} Соедини ${pairs} пары проводов.`, reward: 120 + pairs * 20, pairs })
    }
  })
  DELIVERY_ITEMS.forEach(([item, why], i) => {
    out.push({ id: `d${i}`, kind: 'delivery', title: `Отнеси ${item}`, text: `${why} Найди дом с меткой на карте и нажми на него.`, reward: 220, item })
    out.push({ id: `d${i}x`, kind: 'delivery', title: `Срочно: ${item}`, text: `${why} Адрес на другом конце города. Найди дом с меткой и нажми на него.`, reward: 260, item })
  })
  SURVEY_BANK.forEach((q) => out.push({ id: `s-${q.id}`, kind: 'survey', title: 'Опрос горожан', text: q.q, reward: 90, question: q }))
  const where: (DistrictId | undefined)[] = [undefined, 'residential', 'downtown', 'industrial']
  PATROL_TEXTS.forEach(([title, text], i) =>
    where.forEach((d) =>
      [3, 5].forEach((n) =>
        out.push({
          id: `p${i}-${d ?? 'any'}-${n}`,
          kind: 'patrol',
          title,
          text: text.replace('{n}', String(n)).replace('{where}', d ? `в ${DISTRICT_NAME[d]}` : 'в любом районе'),
          reward: 90 + n * 18 + (d ? 15 : 0),
          count: n,
          district: d,
        }),
      ),
    ),
  )
  REVIEW_TEXTS.forEach(([title, text], i) => {
    for (let k = 0; k < 3; k++) out.push({ id: `r${i}-${k}`, kind: 'reviews', title, text, reward: 110 + k * 10 })
  })
  return out
}

export const TASK_POOL: TaskVariant[] = buildPool()
export const TASK_BY_ID: Record<string, TaskVariant> = Object.fromEntries(TASK_POOL.map((t) => [t.id, t]))

const queueCache = new Map<string, string[]>()
/** A resident's own order of the whole bank (the same on every device). */
export function taskQueue(uid: string): string[] {
  const hit = queueCache.get(uid)
  if (hit) return hit
  const rng = createRng(hashString(`tasks:${uid}`))
  const ids = TASK_POOL.map((t) => t.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  queueCache.set(uid, ids)
  return ids
}

/** Where a resident's queue starts on a day, from where it stood on the last day they did tasks. */
export interface TaskCursor {
  /** Queue position at the start of `day`. */
  base: number
  day: number
}

/** The queue position at the start of `day`: each day moves on past what the previous day showed. */
export function cursorFor(cur: TaskCursor | null, day: number, doneOn: (day: number) => number): number {
  if (!cur) return day * TASKS_SHOWN
  if (day <= cur.day) return cur.base
  return cur.base + TASKS_SHOWN + doneOn(cur.day) + TASKS_SHOWN * (day - cur.day - 1)
}

/** The tasks a resident sees now: the first ones of today's part of the queue not done yet. */
export function offeredTasks(uid: string, base: number, doneToday: string[], limit: number | null): TaskVariant[] {
  if (limit !== null && doneToday.length >= limit) return []
  const q = taskQueue(uid)
  const out: TaskVariant[] = []
  for (let k = 0; out.length < TASKS_SHOWN && k < q.length; k++) {
    const id = q[(base + k) % q.length]
    if (!doneToday.includes(id)) out.push(TASK_BY_ID[id])
  }
  return out
}

/** Where today's delivery of one task goes (the same on every device). */
export function deliveryFor(uid: string, day: number, taskId: string, candidates: string[]): string {
  return candidates[hashString(`${day}:${uid}:${taskId}`) % candidates.length]
}
