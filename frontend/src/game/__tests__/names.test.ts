import { describe, expect, it } from 'vitest'
import { nameError } from '../store'

describe('round 2, 4.10: names', () => {
  it('a bad word with spaces, dots or Latin letters is still caught', () => {
    for (const n of ['х у й', 'х.у.й', 'xyй', 'XУЙ', 'сyка', 'с у к а', 'blyad', 'бл9дь'.replace('9', 'я')]) expect(nameError(n), n).toBe('Выбери другое имя')
  })
  it('ordinary names pass', () => {
    for (const n of ['Марат', 'Ann', 'Кот с крыши', 'Игорь-2']) expect(nameError(n), n).toBeNull()
  })
  it('a name already taken in the city is refused, in any case or spelling', () => {
    expect(nameError('марат', ['Марат'])).toBe('Это имя уже занято')
    expect(nameError('Mapат', ['Марат'])).toBe('Это имя уже занято')
    expect(nameError('Марат', ['Марина'])).toBeNull()
  })
})
