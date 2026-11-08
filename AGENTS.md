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
- Установка: `npm install` в корне, `frontend/`, `backend/` (у каждого свой `package.json`); в `backend/` дополнительно `npx prisma generate`.
- Dev: `npm run dev` в корне (Express + Vite middleware, порт 3000). `.env` приложение само не читает — см. `.env.example`.
- Проверка типов фронтенда: `npm run lint` в корне (`tsc -b frontend`) или `npm run build` в `frontend/` (`tsc -b && vite build`).
  Внимание: `tsc -p frontend/tsconfig.json` ничего не проверяет — это «solution»-конфиг с `files: []`, нужен именно `-b`.
- Проверка бэкенда: `npm run build` в `backend/` (`prisma generate && tsc`).
- Сборка: `npm run build` в корне (фронт + `dist/server.cjs`). CI собирает только `backend/` и `frontend/` (+ Docker-образы).
- ESLint и Vitest подключены в `frontend/package.json`; перед завершением запускайте `npm run lint`, `npm run build` и `npm run test` в `frontend/`.
- Новую чистую логику (`utils/*`, `services/*`, конфигурационные registry) покрывайте тестами (vitest).

## Жёсткие правила

### Данные и API
1. Все запросы к серверу идут **только** через `frontend/src/api/client.ts` (`request`). Не вызывайте `fetch('/api…')` из компонентов и утилит.
2. Серверные данные читаются через хуки `useWords` / `useCategories` / `useVerbs` (`hooks/useDictionary.ts`) поверх `api/queryCache.ts`. После изменения данных — `invalidateQueries(WORDS_KEY | CATEGORIES_KEY)`.
3. Каждый админский эндпоинт защищён `requireAdmin`; изменяющие запросы проходят `requireSameOrigin` (CSRF, подключён глобально в `backend/src/api.ts`). Клиентские мутации — только через `client.ts` с `auth: true` для админских.
4. Новый админский роутер подключайте в `backend/src/api.ts` **до** `words.routes` (иначе `/:id` перехватит путь).
5. Пользователю показываем `getErrorMessage(...)` / `reportError(...)`, не сырые ошибки.
6. Публичные «ключевые» эндпоинты (`/auth/login`, `/sync/srs`) защищены `express-rate-limit`; новый публичный эндпоинт, который можно перебирать, тоже ограничивайте.

### Немецкие данные
7. **Никогда не угадывайте немецкие формы** (Präsens, Partizip II…). Нет данных → карточки нет (см. `verbConjugation.ts`).
8. `Word.hilfsverb` — строго `'haben'` | `'sein'` (не `hat`/`ist`). Нормализация: `backend/src/services/hilfsverb.ts` (на старте, в middleware `normalizeWordBody` и при импорте).
9. Числительные: допустимые написания даёт `germanNumberVariants()` (`einhundert` и `hundert`). Не сравнивайте с `numberToGerman()` напрямую.
10. Сравнение ответов — только через `utils/answerMatch.ts` (регистр, пробелы, Unicode, `ae/oe/ue/ss` по настройке). Подсветка различий — `utils/answerDiff.ts`.

### SRS (Лейтнер)
11. Ключи карточек строятся только функциями: `srsKeys` (`utils/srs.ts`) и `articleSrsKey` (`utils/articles.ts`). **Формат ключей нельзя менять** — это сбросит прогресс всех пользователей (и в синхронизации).
12. Список карточек для тренажёра и для SRS-окна должен быть один и тот же (см. `wordCards.ts`, `verbCards.ts`).
13. «К повторению» определяется `utils/srsDue.ts` (`isDue`); режим «только к повторению» — глобальная настройка в `utils/studyPrefs.ts`, применяется внутри `useSRSProgress.pickCard`. Не дублируйте эту логику в тренажёрах; пустой пул → `SRSIdleCard`.
14. Веса ящиков — серверная настройка (`Setting`, ключ `srsBoxWeights`). Значения по умолчанию (`DEFAULT_SRS_WEIGHTS` в `backend/src/services/srsSettings.ts` и `DEFAULT_SRS_BOX_WEIGHTS` в `frontend/src/utils/srsWeights.ts`) и правила валидации должны совпадать.
15. Синхронизация между устройствами: логика слияния живёт в двух копиях — `backend/src/services/srsSync.ts` и `frontend/src/utils/srsSyncData.ts`. Меняйте обе одновременно. Новый тренажёр с SRS нужно добавить в `SYNC_TRAINERS` (бэкенд), `SRS_TRAINERS` (фронт), тип `SrsTrainer` и `emptySyncData`. Сам ключ синхронизации на сервере не хранится — только его хэш.

### localStorage
16. Ключи, принадлежащие ученику, перечислены в `utils/progressBackup.ts` (`BACKUP_KEYS`). **Добавили новый ключ — добавьте его туда** и в таблицу ключей в `ARCHITECTURE.md`, иначе экспорт/импорт прогресса его потеряет.
17. Любое обращение к `localStorage` — в `try/catch` (в Safari private mode и при отключённом хранилище оно бросает исключение).

### UI и стили
18. Цвета — только через CSS-переменные из `index.css` (тёмная тема на `:root`, светлая на `html.light`). Inline-style допустим лишь для значений, вычисляемых из данных (ширина полосы и т. п.).
19. Новые стили — в `styles/*.css`; `mobile.css` импортируется **последним** в `main.tsx`.
20. Все модальные окна — через `components/Modal.tsx`. Поля ввода ≥ 16px на мобильных (иначе iOS зумит).
21. Доступность: `aria-label` у иконок-кнопок, `htmlFor` у `label`.
22. Выбор режима — через `ModeSwitch` (на телефонах превращается в выпадающий список), кнопки панелей — через `ToolbarButton`.

### Новый тренажёр / вкладка (чек-лист)
`config/tabs.ts` (`APP_TABS`) → компонент вкладки → при необходимости настройки, scoring и SRS. Hash-роутинг, Navbar, аналитика, заголовки и mobile-навигация используют registry автоматически. При добавлении SRS-тренажёра дополнительно обновите backend `SYNC_TRAINERS`, frontend `SRS_TRAINERS`, `SrsTrainer`, `emptySyncData` и тесты.

### PWA / Service Worker
23. `frontend/public/sw.js` кэширует только публичные `GET /api/words` и `GET /api/categories`. Админские, аналитические, `/api/settings/*` и `/api/sync/*` кэшировать **нельзя**. При изменении правил кэширования поднимите `VERSION`.
24. `sw.js` и `manifest.webmanifest` отдаются без долгого кэша (см. `nginx.conf`). Новый воркер сам не активируется: пользователю показывается `UpdateBanner`.

### База данных
25. Схема — `backend/prisma/schema.prisma`; применяется `prisma db push`. Сейчас `entrypoint.sh`, `npm start` и `server.ts` используют `--accept-data-loss`: не вносите деструктивных изменений схемы без бэкапа БД. Разовые правки данных делайте идемпотентными сервисами, как `backfillPartOfSpeech.ts` (вызываются при старте).
26. Дубликаты слов определяются `duplicateKey()` (`services/wordImport.ts`) — используйте её везде.

### Безопасность
27. Токен админа живёт только в HttpOnly-cookie и не передаётся клиентскому JavaScript через тело ответа или `localStorage`.
28. Секреты — только из окружения (`ADMIN_PASSWORD`, `JWT_SECRET`), не в клиент и не в репозиторий. В production обязательно задавайте оба.
29. Не логируйте персональные данные (IP и User-Agent из аналитики — только в БД).

## Перед завершением задачи
- `npm run lint` (в корне) и сборка фронта/бэка проходят.
- Новые строки интерфейса на русском, новые localStorage-ключи добавлены в `BACKUP_KEYS`.
- Обновлены `ARCHITECTURE.md` (структура, API, модель данных, ключи хранилища, переменные окружения) и `.env.example`, если они менялись.
