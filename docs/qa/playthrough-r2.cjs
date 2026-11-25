// Round 2 play-through: a new resident on a 390×844 phone, with the test clock.
// Run: (cd frontend && npx vite preview --port 4317) & node docs/qa/playthrough-r2.cjs
const { chromium } = require('playwright')
const OUT = __dirname + '/r2/'
const log = []
let page = null
const step = async (name, f) => {
  try {
    const r = await f()
    log.push(`ok   ${name}${r ? ' — ' + r : ''}`)
  } catch (e) {
    if (page) await page.screenshot({ path: OUT + 'fail-' + name.slice(0, 2).replace(/\W/g, '') + '.png' }).catch(() => {})
    log.push(`FAIL ${name} — ${String(e.message).split('\n')[0].slice(0, 160)}`)
  }
}
;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  page = p
  p.setDefaultTimeout(10000)
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)))
  const shot = (n) => p.screenshot({ path: OUT + n + '.png' })
  const nav = (t) => p.locator('nav[aria-label="Разделы"] button', { hasText: t }).first().click({ timeout: 8000 })
  const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(400) }
  const more = async (label) => { await nav('Ещё'); await p.getByRole('button', { name: label }).first().click({ timeout: 8000 }); await p.waitForTimeout(700) }
  const body = () => p.locator('body').innerText()

  await p.goto('http://localhost:4317/')
  await p.waitForTimeout(9000)

  await step('1. Приветствие с «Строй сам»', async () => {
    await shot('01-welcome')
    const t = await body()
    if (!t.includes('Строй сам')) throw new Error('нет блока «Строй сам»')
    await p.getByRole('button', { name: 'Начать' }).first().click()
    await p.waitForTimeout(800)
  })
  await step('1. Имя игрока', async () => {
    const input = p.locator('input').first()
    if (await p.getByText('Как тебя зовут').count()) {
      await input.fill('Тестер')
      await p.keyboard.press('Enter')
      await p.waitForTimeout(800)
      return 'введено «Тестер»'
    }
    return 'окно имени не показано'
  })
  await step('1. Обучение (4 шага) на экране', async () => {
    await shot('02-tutorial')
    const t = await body()
    if (!/Шаг 1 из 4/.test(t)) throw new Error('нет плашки обучения')
  })

  await step('2. Задания: 5 штук, выполненное сменяется', async () => {
    await nav('Задания')
    await p.waitForTimeout(800)
    await shot('03-tasks')
    const before = (await body()).match(/(Опрос горожан|Почини проводку[^\n]*|Отнеси[^\n]*|Срочно[^\n]*|Обход района|Проверка подъездов|Перепись жильцов|Счётчики воды|Оцени заведение|Тайный покупатель|Отзыв для газеты|Проверка качества|Совет новичку)/g) || []
    // The wiring: tap each wire on the left, then the terminal with the same number.
    const card = p.locator('div.flex.gap-3.rounded-2xl', { hasText: 'Почини проводку' }).first()
    await card.getByRole('button', { name: 'Начать' }).click()
    await p.waitForTimeout(1200)
    const groups = p.locator('[role=dialog] svg g')
    const n = (await groups.count()) / 2
    for (let i = 0; i < n; i++) {
      await groups.nth(i).click()
      for (let r = 0; r < n; r++) {
        const label = await groups.nth(n + r).locator('text').textContent()
        if (Number(label) === i + 1) {
          await groups.nth(n + r).click()
          break
        }
      }
      await p.waitForTimeout(250)
    }
    await p.waitForTimeout(600)
    await shot('04-wires-done')
    await p.waitForTimeout(1800)
    await esc()
    if (!(await p.getByText('сегодня выполнено').count())) await nav('Задания')
    await p.waitForTimeout(800)
    await shot('05-tasks-after')
    const after = (await body()).match(/сегодня выполнено (\d+)|осталось на сегодня (\d+)/)
    return `до: ${before.slice(0, 5).join(' / ')}; после: ${after ? after[0] : '?'}`
  })
  await esc()

  await step('Деньги для теста: начисление 100 000 в админке', async () => {
    await more(/Админ-панель/)
    await p.locator('input[placeholder="± сумма"]').first().fill('100000')
    await p.getByRole('button', { name: 'Начислить' }).first().click()
    await p.waitForTimeout(1200)
    await esc()
  })

  await step('3. Склад №7: 6 ящиков, 3 попытки', async () => {
    for (let k = 0; k < 3; k++) {
      await p.getByRole('button', { name: 'Промзона' }).first().click()
      await p.waitForTimeout(600)
      await more(/Все здания района/)
      await p.locator('#building-search').fill('Склад №7')
      await p.waitForTimeout(500)
      await p.locator('ul button', { hasText: 'Склад №7' }).first().click()
      await p.waitForTimeout(1200)
      if (await p.getByRole('button', { name: 'Войти' }).count()) {
        await p.getByRole('button', { name: 'Войти' }).click()
        await p.waitForTimeout(700)
        for (let i = 0; i < 3; i++) {
          const box = p.locator('[role=dialog] button:not([disabled])', { hasText: /Ящик/ }).first()
          if (!(await box.count())) break
          await box.click()
          await p.waitForTimeout(500)
        }
        await shot('06-warehouse')
        const t = await body()
        await esc()
        await esc()
        return t.includes('Нашёл') ? 'посылка найдена' : 'не нашёл, утешительные 50'
      }
      await esc()
      // Closed today: one day forward with the test clock.
      await nav('Стройка')
      await p.getByRole('button', { name: '+1 день' }).click()
      await p.waitForTimeout(2500)
      await esc()
    }
    throw new Error('склад так и не открылся')
  })

  await step('4. Участок в Микрорайоне, малоэтажка, +2 часа: аренда от заселения', async () => {
    await nav('Стройка')
    await p.waitForTimeout(700)
    await p.getByText('Жилой микрорайон — лучше всего для домов').locator('xpath=..').locator('button').first().click({ timeout: 8000 })
    await p.waitForTimeout(1500)
    await p.locator('div.rounded-2xl', { hasText: /^Малоэтажка/ }).getByRole('button').first().click({ timeout: 8000, force: true })
    await p.waitForTimeout(2500)
    await shot('07a-crane')
    // The game shows the new site on the map; back to the build tab.
    await nav('Стройка')
    await p.waitForTimeout(1000)
    const rush = p.getByRole('button', { name: /Ускорить за/ }).first()
    if (await rush.count()) await rush.click({ force: true })
    await p.waitForTimeout(2000)
    await shot('07b-built')
    if (!(await p.getByRole('button', { name: '+1 час' }).count())) await nav('Стройка')
    await p.waitForTimeout(800)
    await p.getByRole('button', { name: '+1 час' }).click({ force: true })
    await p.waitForTimeout(2000)
    await p.getByRole('button', { name: '+1 час' }).click({ force: true })
    await p.waitForTimeout(2500)
    await shot('07-lowrise-rent')
    const m = (await body()).match(/Аренда \+(\d+) в час \(до (\d+)/)
    return m ? `аренда +${m[1]} в час из ${m[2]} при полном заселении` : 'строка аренды не найдена'
  })
  await esc()

  await step('5. Два заведения: у второго 80%', async () => {
    await nav('Бизнес')
    await p.waitForTimeout(800)
    const open = async (name) => {
      await p.locator('#biz-name').fill(name)
      await p.getByRole('button', { name: /^Открыть/ }).last().click({ force: true })
      await p.waitForTimeout(1800)
    }
    await open('Утро')
    if (await p.getByRole('tab', { name: '+ Ещё заведение' }).count()) {
      await p.getByRole('tab', { name: '+ Ещё заведение' }).click()
      await p.waitForTimeout(600)
      await open('Вечер')
    }
    await shot('08-second-business')
    const t = await body()
    return t.includes('в кассу идёт 80%') ? 'видно «в кассу идёт 80%»' : 'строки про 80% нет (возможно, прибыль ≤ 0)'
  })
  await esc()

  await step('6. +7 дней: город растёт сам', async () => {
    const pop0 = Number(((await body()).match(/Жители\s*\n?\s*([\d\s ]+)/) || [])[1]?.replace(/\D/g, '') || 0)
    await nav('Стройка')
    await p.getByRole('button', { name: '+7 дней' }).click()
    await p.waitForTimeout(6000)
    await esc()
    const pop1 = Number(((await body()).match(/Жители\s*\n?\s*([\d\s ]+)/) || [])[1]?.replace(/\D/g, '') || 0)
    await shot('09-after-week')
    return `жителей ${pop0} → ${pop1}`
  })

  await step('Перед перезапуском: «застроить всё»', async () => {
    await nav('Стройка')
    await p.getByRole('button', { name: /Скупить все свободные/ }).click()
    await p.waitForTimeout(6000)
    await esc()
    const pop = ((await body()).match(/Жители\s*\n?\s*([\d\s ]+)/) || [])[1]
    for (const d of ['Промзона', 'Центр', 'Микрорайон']) {
      await p.getByRole('button', { name: d }).first().click()
      await p.waitForTimeout(3000)
      await shot('10-built-' + d)
    }
    return `жителей ${pop}`
  })

  await step('8. Перезапуск: достижения остались, касса вернулась, история с разбивкой', async () => {
    await more(/Профиль и настройки/)
    const achBefore = ((await body()).match(/★/g) || []).length
    await esc()
    await more(/Админ-панель/)
    await p.getByRole('button', { name: 'Перезапустить город' }).click()
    await p.getByRole('button', { name: 'Да, начать заново' }).click()
    await p.waitForTimeout(3000)
    const toast = (await body()).includes('Город начат заново, вложения возвращены')
    await esc()
    await more(/Профиль и настройки/)
    await p.waitForTimeout(800)
    const t = await body()
    const achAfter = (t.match(/★/g) || []).length
    await p.getByText('История счёта').scrollIntoViewIfNeeded()
    await shot('11-after-restart')
    await esc()
    return `уведомление: ${toast ? 'да' : 'нет'}; звёзд достижений ${achBefore} → ${achAfter}; строка возврата: ${t.includes('Возврат после перезапуска города') ? 'да' : 'нет'}`
  })

  await step('9. Телефон боком', async () => {
    await p.setViewportSize({ width: 844, height: 390 })
    await p.waitForTimeout(2500)
    await shot('12-landscape')
    const h = await p.locator('nav[aria-label="Районы"]').boundingBox()
    return `высота переключателя районов ${Math.round(h?.height ?? 0)} px`
  })

  log.push('', 'Ошибки страницы: ' + (errs.length ? errs.slice(0, 5).join(' | ') : 'нет'))
  require('fs').writeFileSync(OUT + 'log.txt', log.join('\n') + '\n')
  console.log(log.join('\n'))
  await b.close()
})()
