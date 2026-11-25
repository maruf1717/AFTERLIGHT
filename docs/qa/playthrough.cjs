const { chromium } = require('playwright');
const out = process.argv[2];
const log = (...a) => console.log('QA', ...a);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(e.message); log('ERR', e.message) });
  p.on('console', m => { if (m.type() === 'error') { errors.push('console ' + m.text().slice(0, 200)); log('ERR console', m.text().slice(0, 200)) } });
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const nav = (t) => p.locator('nav[aria-label="Разделы"] button', { hasText: t }).first().click();
  const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(350) };
  const bal = async () => (await p.locator('body').innerText()).match(/Искры\s*\n?\s*([\d\s ,.тысмлн]+)/)?.[1]?.trim();
  const body = () => p.locator('body').innerText();
  const step = async () => ((await body()).match(/Шаг (\d) из 4/) || [])[1];
  await p.goto('http://localhost:4173/?q=low');
  await p.waitForTimeout(8000);

  // 1. Welcome -> name -> tutorial
  log('1 welcome visible:', await p.locator('#welcome-title').isVisible());
  await shot('01-welcome');
  await p.locator('[role=dialog] button.btn-primary').first().click();
  await p.waitForTimeout(600);
  log('1 name prompt:', await p.locator('#first-name').isVisible());
  await p.locator('#first-name').fill('Маруф');
  await p.getByRole('button', { name: 'Готово' }).click();
  await p.waitForTimeout(1200);
  log('1 tutorial step shown:', await step());
  await shot('02-start');
  // step 1: wires through the tutorial card
  await p.getByRole('button', { name: 'Начать' }).first().click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Начать' }).first().click();
  await p.waitForTimeout(900);
  const game = p.locator('[role=dialog] svg.rounded-2xl')
  for (let attempt = 0; attempt < 3; attempt++) {
    const lefts = game.locator('rect[x="10"]'), rights = game.locator('rect[x="266"]')
    const n = await lefts.count()
    const fills = [], strokes = []
    for (let i = 0; i < n; i++) { fills.push(await lefts.nth(i).getAttribute('fill')); strokes.push(await rights.nth(i).getAttribute('stroke')) }
    for (let i = 0; i < n; i++) {
      await lefts.nth(i).dispatchEvent('click')
      await rights.nth(strokes.indexOf(fills[i])).dispatchEvent('click')
    }
    await p.waitForTimeout(800)
    if (!(await p.locator('text=Время вышло').isVisible())) break
    await p.getByRole('button', { name: 'Попробовать ещё раз' }).click()
    await p.waitForTimeout(500)
  }
  await p.waitForTimeout(500);
  await shot('03-wires');
  await p.waitForTimeout(1800);
  await esc(); await esc();
  log('1 wires done, step now:', await step(), 'balance', await bal());
  // step 2: donate to the clinic
  await nav('Проекты'); await p.waitForTimeout(600);
  await p.locator('div.rounded-3xl', { hasText: 'Поликлиника' }).getByRole('button', { name: '+100' }).click();
  await p.waitForTimeout(1500);
  log('5 projects panel still open after donation:', await p.locator('text=Большие здания город строит').isVisible());
  await shot('04-donate');
  await esc();
  log('1 step after donation:', await step(), 'balance', await bal());
  // step 3: open a business with forecast
  await nav('Бизнес'); await p.waitForTimeout(700);
  await p.locator('button', { hasText: 'Закусочная' }).first().click();
  await p.locator('#biz-name').fill('Закусочная «Маруф»');
  await p.locator('text=4. Место').scrollIntoViewIfNeeded();
  const forecast = await p.locator('text=/гостей и/').first().innerText();
  log('4 forecast on plot:', forecast.replace(/\s+/g, ' '));
  await shot('05-business-form');
  await p.getByRole('button', { name: /Открыть за/ }).click();
  await p.waitForTimeout(4000);
  await shot('06-business-map');
  log('1 step after opening:', await step(), 'balance', await bal());
  // 2. daily tasks
  await nav('Задания'); await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Начать' }).first().click();
  await p.waitForTimeout(500);
  await p.locator('p.font-display + div button').first().click(); await p.waitForTimeout(800);
  await p.locator('p.font-display + div button').nth(1).click({ force: true }).catch(() => {}); await p.waitForTimeout(600);
  await esc(); await esc();
  const b1 = await bal();
  await nav('Задания'); await p.waitForTimeout(600);
  log('2 survey done, balance', b1, 'tasks text:', ((await body()).match(/(\d) из 5/) || [])[0]);
  // delivery via «Показать дом» and a tap in the middle of the screen
  await p.getByRole('button', { name: 'Показать дом' }).click();
  await p.waitForTimeout(4500);
  await shot('07-delivery');
  const box = await p.locator('canvas').boundingBox();
  for (const [dx, dy] of [[0, 0], [0, 40], [0, -40], [30, 20], [-30, 20]]) {
    await p.mouse.click(box.x + box.width / 2 + dx, box.y + box.height * 0.42 + dy); await p.waitForTimeout(1500)
    if ((await body()).includes('Посылка доставлена') || !(await body()).includes('Посылка сюда')) break
  }
  log('2 delivery by tapping the house on the map:', !(await body()).includes('Посылка сюда'));
  await shot('08-delivered');
  await esc(); await esc();
  // pager does not count for the patrol
  await nav('Ещё'); await p.getByRole('button', { name: /Все здания района/ }).click(); await p.waitForTimeout(700);
  await p.locator('ul button, li button').first().click(); await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await p.getByRole('button', { name: 'Следующее здание' }).click(); await p.waitForTimeout(400) }
  await esc(); await esc();
  await nav('Задания'); await p.waitForTimeout(600);
  log('2 patrol after list + 6× arrows (must stay 0):', ((await body()).match(/Открыто сегодня: (\d) из 5/) || [])[1]);
  await esc();
  // 4/1 step 4: collect after takings accrue
  log('waiting 150 s for the first takings…');
  await p.waitForTimeout(150000);
  await nav('Бизнес'); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Собрать' }).first().click(); await p.waitForTimeout(1500);
  await shot('09-collect');
  await esc();
  log('1 step after collecting (expect gone):', await step() ?? 'tutorial finished', 'balance', await bal());
  // 4: upgrade
  await nav('Бизнес'); await p.waitForTimeout(700);
  const up = p.locator('div.rounded-2xl', { hasText: 'Озеленение' }).locator('button.btn-primary');
  log('4 upgrade affordable:', !(await up.isDisabled()));
  if (!(await up.isDisabled())) { await up.click(); await p.waitForTimeout(2500); log('4 upgrade bought, balance', await bal()) }
  await esc();
  // 7. admin: invalid values, grant, day length 1 minute
  await nav('Ещё'); await p.getByRole('button', { name: /Админ-панель/ }).click(); await p.waitForTimeout(1200);
  await p.locator('#cfg-dayMinutes').fill('0');
  log('7 invalid day length blocks saving:', await p.getByRole('button', { name: 'Сохранить баланс' }).isDisabled(), 'error:', await p.locator('text=От 1 до').first().isVisible());
  await p.locator('#cfg-dayMinutes').scrollIntoViewIfNeeded(); await shot('10-admin-invalid');
  await p.locator('#cfg-dayMinutes').fill('1');
  await p.getByRole('button', { name: 'Сохранить баланс' }).click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: '+10 000 себе' }).click(); await p.waitForTimeout(800);
  await esc();
  // 3. buy a plot, build a house, wait until finished
  await nav('Стройка'); await p.waitForTimeout(800);
  const plots = p.locator('div.rounded-2xl', { hasText: /Центр, / }).locator('button.btn-primary');
  await plots.first().click(); await p.waitForTimeout(1500);
  await p.locator('div.rounded-2xl', { hasText: 'Частный дом' }).locator('button.btn-primary').first().click();
  await p.waitForTimeout(3500);
  await shot('11-building-site');
  log('3 site started; waiting 130 s (2 city days of 1 minute)…');
  await p.waitForTimeout(130000);
  await nav('Стройка'); await p.waitForTimeout(800);
  log('3 house finished (rent shown):', await p.locator('text=/Аренда \\+/').first().isVisible());
  await p.getByRole('button', { name: 'На карте →' }).first().click(); await p.waitForTimeout(4000);
  await shot('12-house-built');
  // 5: finish the clinic, happiness rises at once
  await nav('Город'.length ? 'Ещё' : 'Ещё'); await p.getByRole('button', { name: /Город: жители/ }).click(); await p.waitForTimeout(600);
  const h0 = ((await body()).match(/Счастье\s*\n?\s*(\d+)%/) || [])[1];
  await esc();
  await nav('Проекты'); await p.waitForTimeout(600);
  const clinic = p.locator('div.rounded-3xl', { hasText: 'Поликлиника' });
  await clinic.locator('input').fill('4900'); await clinic.getByRole('button', { name: 'Вложить' }).click(); await p.waitForTimeout(500);
  await clinic.getByRole('button', { name: 'Да, вложить' }).click(); await p.waitForTimeout(4000);
  const h1 = ((await body()).match(/Счастье\s*\n?\s*(\d+)%/) || [])[1];
  log('5 clinic finished, happiness before/after:', h0, h1);
  await shot('13-clinic-done');
  // 6. reload: everything stays
  const before = await bal();
  await p.reload(); await p.waitForTimeout(9000);
  log('6 after reload balance', before, '->', await bal());
  await nav('Бизнес'); await p.waitForTimeout(600);
  log('6 business still there:', (await body()).includes('Маруф'));
  await esc();
  // 7. restart returns Искры
  await nav('Ещё'); await p.getByRole('button', { name: /Админ-панель/ }).click(); await p.waitForTimeout(800);
  const bRestart = await bal();
  await p.getByRole('button', { name: /Перезапустить город/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Да, начать заново' }).click(); await p.waitForTimeout(3500);
  log('7 restart: balance before', bRestart, 'after', await bal());
  await esc();
  // 8. night and economy shadows
  await nav('Ещё'); await p.getByRole('button', { name: /Ночь/ }).click(); await esc(); await p.waitForTimeout(2500);
  await shot('14-night');
  await nav('Ещё'); await p.getByRole('button', { name: /День/ }).click(); await esc(); await p.waitForTimeout(2500);
  await shot('15-eco-shadows');
  // 9. other screens
  for (const [name, w, h, mob] of [['16-360x640', 360, 640, true], ['17-844x390', 844, 390, true], ['18-1440x900', 1440, 900, false]]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob })
    await c2.addInitScript(() => { try { localStorage.setItem('afterlight:welcomed', '1'); sessionStorage.setItem('afterlight:name-later', '1') } catch {} })
    const q = await c2.newPage()
    q.on('pageerror', e => { errors.push(e.message); log('ERR', name, e.message) })
    q.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); log('ERR console', name, m.text().slice(0, 200)) } })
    await q.goto('http://localhost:4173/?q=low'); await q.waitForTimeout(8000)
    await q.locator('nav[aria-label="Разделы"] button', { hasText: 'Стройка' }).first().click(); await q.waitForTimeout(900)
    await q.screenshot({ path: `${out}/${name}.png` })
    const over = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    log('9', name, 'horizontal overflow:', over)
    await c2.close()
  }
  log('10 console errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
