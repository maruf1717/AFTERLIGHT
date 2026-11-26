import { createRng, hashString } from '../lib/random'
import type { Problem } from './city'

/*
 * Residents complain about what is missing near their homes. A complaint is a short message
 * from a random resident; the screen shows one every so often while something is wrong.
 */

const FIRST = ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина', 'Егор', 'Жанна', 'Илья', 'Ксения', 'Лев', 'Мария', 'Никита', 'Ольга', 'Пётр', 'Рита', 'Семён', 'Таня', 'Фёдор', 'Юля', 'Ярослав', 'Алия', 'Тимур', 'Дильноза', 'Рустам']
const LAST = ['Соколов', 'Иванов', 'Ким', 'Петров', 'Смирнов', 'Лебедев', 'Каримов', 'Орлов', 'Волков', 'Зайцев', 'Фёдоров', 'Ахмедов']

const TEXTS: Record<Problem, string[]> = {
  power: ['Опять нет света! Холодильник потёк.', 'Свет мигает весь вечер. Постройте электростанцию!', 'Сижу при свечке. Нам не хватает электричества.'],
  water: ['Из крана ничего не течёт.', 'Не могу помыть посуду: нет воды!', 'Городу нужна вода. Хотя бы водонапорную башню!'],
  jobs: ['Уже месяц ищу работу. Где офисы и заводы?', 'Работы нет, а за квартиру платить надо.', 'Откройте магазин или завод, людям негде работать.'],
  smoke: ['От завода дым прямо в окна.', 'Дышать нечем: рядом дымит труба.', 'Зачем строить завод возле домов?'],
  road: ['К нашему дому даже дороги нет.', 'Мы бы переехали, но к дому не проехать.'],
  shops: ['За хлебом приходится идти через весь город.', 'Рядом ни одного магазина!'],
  fun: ['Вечером совсем некуда пойти.', 'Хочется в парк или хотя бы в беседку.', 'Скучно! Нет ни кафе, ни парка.'],
  kids: ['Малыша не с кем оставить: нет детского сада.', 'Нужен детский сад поближе.'],
  school: ['Детям далеко до школы.', 'Постройте школу, дети сидят дома.'],
  health: ['Заболел, а до врача не добраться.', 'Нам нужна поликлиника рядом.'],
  police: ['Вчера у соседа угнали велосипед. Где полиция?', 'Вечером страшно ходить по улицам.'],
  fire: ['Если начнётся пожар, кто приедет?', 'Рядом нет пожарной части.'],
  parking: ['Машину негде оставить!', 'Ставлю машину на газон: парковок нет.'],
  cars: ['Машина сломалась, а автосервиса нет.', 'Где починить колесо в этом городе?'],
}

export interface Complaint {
  id: number
  who: string
  text: string
  problem: Problem
  /** The home this resident lives in (to show it on the map). */
  home: number
}

/** A complaint about one of the problems homes have right now (or null when all is fine). */
export function makeComplaint(problems: { home: number; missing: Problem[] }[], seed: number): Complaint | null {
  const list = problems.filter((p) => p.missing.length)
  if (!list.length) return null
  const rng = createRng(hashString(`complaint:${seed}`))
  const h = rng.pick(list)
  const problem = rng.pick(h.missing)
  return { id: seed, who: `${rng.pick(FIRST)} ${rng.pick(LAST)[0]}.`, text: rng.pick(TEXTS[problem]), problem, home: h.home }
}

export const PROBLEM_LABEL: Record<Problem, string> = {
  power: 'Нет света',
  water: 'Нет воды',
  jobs: 'Нет работы',
  smoke: 'Дым от завода',
  road: 'Нет дороги',
  shops: 'Нет магазина',
  fun: 'Негде отдохнуть',
  kids: 'Нет детского сада',
  school: 'Нет школы',
  health: 'Нет врача',
  police: 'Нет полиции',
  fire: 'Нет пожарных',
  parking: 'Нет парковки',
  cars: 'Нет автосервиса',
}
