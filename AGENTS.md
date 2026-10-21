# AGENTS.md — правила для ИИ-агентов и разработчиков

Перед изменениями прочитайте [ARCHITECTURE.md](./ARCHITECTURE.md). Здесь — правила, которые нельзя нарушать.

## Проект в двух словах
Deutsch Trainer: тренажёр немецкого для русскоязычных (числа, слова, артикли, глаголы, время) + админка словаря.
Монорепо: `frontend/` (React 18 + TS + Vite), `backend/` (Express + Prisma + SQLite), корневой `server.ts` (dev/prod-сервер «всё в одном»).

## Язык
- Весь интерфейс, сообщения об ошибках для пользователя и тексты в админке — **на русском**.
- Код, имена, комментарии — на английском (в `wordImport.ts` исторически есть русские комментарии; не переписывайте их без нужды).
- Документация (`*.md`) — на русском.

## Команды
- Установка: `npm install` в корне, `frontend/`, `backend/` (у каждого свой `package.json`).
- Dev: `npm run dev` в корне (Express + Vite middleware, порт 3000).
- Проверка типов: `npm run lint` в корне (`tsc -p frontend/tsconfig.json --noEmit`) и `npm run build` в `backend/`.
- Сборка: `npm run build` в корне; `npm run build` в `frontend/` и `backend/` (так делает CI).
- Автотестов пока нет. Новую чистую логику (`utils/*`, `services/*`) покрывайте тестами (vitest), если добавляете раннер.

## Жёсткие правила

### Данные и API
1. Все запросы к серверу идут **только** через `frontend/src/api/client.ts` (`request`). Не вызывайте `fetch('/api…')` из компонентов.
2. Серверные данные читаются через хуки `useWords` / `useCategories` / `useVerbs` (`hooks/useDictionary.ts`) поверх `api/queryCache.ts`. После изменения данных — `invalidateQueries(WORDS_KEY | CATEGORIES_KEY)`.
3. Каждый админский эндпоинт защищён `requireAdmin`; изменяющие запросы проходят `requireSameOrigin` (CSRF). Не добавляйте мутации в обход `api.ts`.
4. Новый админский роутер подключайте в `backend/src/api.ts` **до** `words.routes` (иначе `/:id` перехватит путь).
5. Пользователю показываем `getErrorMessage(...)` / `reportError(...)`, не сырые ошибки.

### Немецкие данные
6. **Никогда не угадывайте немецкие формы** (Präsens, Partizip II…). Нет данных → карточки нет (см. `verbConjugation.ts`).
7. `Word.hilfsverb` — строго `'haben'` | `'sein'` (не `hat`/`ist`). Нормализация: `backend/src/services/hilfsverb.ts` (на старте, в middleware `normalizeWordBody` и при импорте).
8. Числительные: допустимые написания даёт `germanNumberVariants()` (`einhundert` и `hundert`). Не сравнивайте с `numberToGerman()` напрямую.
9. Сравнение ответов — только через `utils/answerMatch.ts` (регистр, пробелы, Unicode, `ae/oe/ue/ss` по настройке). Подсветка различий — `utils/answerDiff.ts`.

### SRS (Лейтнер)
10. Ключи карточек строятся только функциями: `srsKeys` (`utils/srs.ts`) и `articleSrsKey` (`utils/articles.ts`). **Формат ключей нельзя менять** — это сбросит прогресс всех пользователей.
11. Список карточек для тренажёра и для SRS-окна должен быть один и тот же (см. `verbCards.ts`).
12. «К повторению» определяется `utils/srsDue.ts` (`isDue`); режим «только к повторению» — глобальная настройка в `utils/studyPrefs.ts`, применяется внутри `useSRSProgress.pickCard`. Не дублируйте эту логику в тренажёрах; пустой пул → `SRSIdleCard`.

### localStorage
13. Ключи, принадлежащие ученику, перечислены в `utils/progressBackup.ts` (`BACKUP_KEYS`). **Добавили новый ключ — добавьте его туда**, иначе экспорт/импорт прогресса его потеряет.
14. Любое обращение к `localStorage` — в `try/catch`.

### UI и стили
15. Цвета — только через CSS-переменные из `index.css` (тёмная тема на `:root`, светлая на `html.light`). Inline-style допустим лишь для значений, вычисляемых из данных (ширина полосы и т. п.).
16. Новые стили — в `styles/*.css`; `mobile.css` импортируется **последним** в `main.tsx`.
17. Все модальные окна — через `components/Modal.tsx`. Поля ввода ≥ 16px на мобильных (иначе iOS зумит).
18. Доступность: `aria-label` у иконок-кнопок, `htmlFor` у `label`.

### Новый тренажёр / вкладка (чек-лист)
`types.ts` (`TrainerTab`) → `hooks/useHashRoute.ts` (`TABS`) → `components/Navbar.tsx` (`tabs`) → `App.tsx` (`titles`, `pageTitles`, рендер) → `hooks/useScores.ts` (`ScoredTab`, `SCORED_TABS`) → `components/admin/AnalyticsTab.tsx` (`tabLabels`) → `ARCHITECTURE.md`.

### PWA / Service Worker
19. `frontend/public/sw.js` кэширует только публичные `GET /api/words` и `GET /api/categories`. Админские и аналитические запросы кэшировать **нельзя**. При изменении правил кэширования поднимите `VERSION`.
20. `sw.js` и `manifest.webmanifest` отдаются без долгого кэша (см. `nginx.conf`).

### База данных
21. Схема — `backend/prisma/schema.prisma`; применяется `prisma db push`. Не используйте `--accept-data-loss` для новых деструктивных изменений без бэкапа. Разовые правки данных делайте идемпотентными сервисами, как `backfillPartOfSpeech.ts` (вызываются при старте).
22. Дубликаты слов определяются `duplicateKey()` (`services/wordImport.ts`) — используйте её везде.

### Безопасность
23. Не возвращайте токены в теле ответов и не кладите секреты в клиент. Пароль/секреты — только `ADMIN_PASSWORD`, `JWT_SECRET` из окружения.
24. Не логируйте персональные данные (IP из аналитики — только в БД).

## Перед завершением задачи
- `npm run lint` и сборка фронта/бэка проходят.
- Новые строки интерфейса на русском, новые localStorage-ключи добавлены в `BACKUP_KEYS`.
- Обновлён `ARCHITECTURE.md`, если менялась структура, API, модель данных или ключи хранилища.
