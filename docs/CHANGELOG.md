# Журнал изменений

## Этап 0. Инструменты проверки

- Подключены тесты Vitest: `npm run test`. Первые 6 тестов на симуляцию города (`src/game/__tests__/sim.test.ts`): 120 жителей на старте, кризис здоровья, поликлиника его закрывает, счёт дней, недособранный проект, детерминированность.
- Подключён ESLint (flat config, typescript-eslint, react-hooks): `npm run lint`. Исправлены 2 найденные ошибки в `city/planner.ts`.
- m8: убрана ошибка React про ключи в `KindArt` (`ui/art.tsx`, окна склада).

Как проверить: `npm run lint`, `npm run test`, `npm run build` — без ошибок.
