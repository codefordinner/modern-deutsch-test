# ARCHITECTURE.md

## Структура репозитория
```
/
├─ server.ts                 dev/prod-сервер «всё в одном»: БД (db push + seed) + API + (Vite middleware | статика frontend/dist), порт 3000
├─ package.json              корневые скрипты (dev/build/start/lint)
├─ .nvmrc, .env.example      Node 22; описание переменных окружения
├─ README.md, AGENTS.md      быстрый старт; правила разработки
├─ .github/workflows/        CI: сборка backend+frontend, push Docker-образов в GHCR
├─ backend/
│  ├─ prisma/schema.prisma   Category, Word, AnalyticsEvent, Setting, AudioCache, SyncProfile (SQLite)
│  ├─ prisma/seed.ts         стартовые категории/слова (только в пустую БД)
│  ├─ entrypoint.sh          prisma db push → node dist/index.js
│  └─ src/
│     ├─ index.ts            отдельный запуск бэкенда (порт 3001, за nginx)
│     ├─ api.ts              сборка роутера /api (порядок монтирования важен)
│     ├─ db.ts               PrismaClient
│     ├─ middleware/         auth (JWT, cookie), csrf (Origin/Referer), normalizeWordBody
│     ├─ routes/             auth, words, words-admin, categories, analytics, settings, sync
│     └─ services/           partOfSpeech, wordImport, hilfsverb, backfillPartOfSpeech, srsSettings, srsSync
└─ frontend/
   ├─ nginx.conf, Dockerfile статика + прокси /api → app-backend:3001
   ├─ public/                favicon, manifest.webmanifest, sw.js, icons/
   └─ src/
      ├─ main.tsx, App.tsx   вход, вкладки, тема, счёт
      ├─ types.ts            общие типы
      ├─ api/                client.ts (весь HTTP), queryCache.ts (кэш запросов)
      ├─ hooks/              useDictionary, useSRSProgress, useSrsWeightsSync, useSrsSync, useScores, useHashRoute,
      │                      useUISettings, usePersistentState, useServiceWorkerUpdates, use{Words,Verbs}QuizEngine
      ├─ utils/              чистая логика (см. «Утилиты»)
      ├─ components/         Navbar, *Trainer, admin/, words/, verbs/, numbers/, time/, articles/, srs/,
      │                      Modal, ModeSwitch, ToolbarButton, FeedbackBox, StatsPanel, GeneralSettingsModal,
      │                      ToastHost, UpdateBanner, ArticleText, UmlautBar, Scorebar, …
      └─ styles/             components.css, import-export.css, features.css, srs-settings.css, layout.css, mobile.css (последним)
```

## Модель данных
- **Category** `{id, name, icon, color, isBuiltin}` — 1:N **Word** (каскадное удаление).
- **Word** `{de, ru, hint, partOfSpeech, plural, feminine, femininePlural, praeteritum, partizip2, hilfsverb ('haben'|'sein'), praesens{Ich,Du,ErSieEs,Wir,Ihr,Sie}, categoryId}`.
  `partOfSpeech` ∈ noun|verb|adjective|adverb|other (валидируется в API; пусто → выводится `inferPartOfSpeech`).
- **AnalyticsEvent** `{eventType: visit|tab_switch|quiz_answer, trainerType, isCorrect, ipAddress, userAgent, timestamp}`; публичная запись ограничена rate limit и принимает только известные типы событий.
- **Setting** `{key, value (JSON), updatedAt}` — общие настройки, редактируемые в админке. Ключи: `srsBoxWeights` и `audioSettings` (модель Piper, скорость, вариативность и пауза). Старый `audioVoice` читается для совместимости.
- **SyncProfile** `{keyHash, data (JSON), createdAt, updatedAt}` — снимок SRS-прогресса для синхронизации устройств. `keyHash` = sha256 ключа; сам ключ не хранится.
- **AudioCache** `{cacheKey, kind ('word'|'sentence'), text, audio (WAV), mimeType}` — постоянный серверный кэш Piper. Отсутствующая запись генерируется при первом прослушивании. Ключ учитывает выбранный голос и параметры синтеза. `AudioRegenerationJob` хранит фоновую регенерацию слов, прогресс и время; задача возобновляется после перезапуска backend.
- Прогресс ученика по умолчанию **живёт только в `localStorage`** браузера (SRS, счёт, настройки). Если ученик задал «Ключ синхронизации», снимок SRS (слова, глаголы, артикли) дополнительно хранится на сервере в `SyncProfile`.

## Переменные окружения
См. `.env.example`. Приложение `.env` само не читает — передавайте переменные окружением (docker, `node --env-file`).

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `ADMIN_PASSWORD` | пароль админки | `admin` (с предупреждением в логе) |
| `JWT_SECRET` | секрет подписи JWT | ключ из `ADMIN_PASSWORD` (слабее) |
| `DATABASE_URL` | SQLite | `file:./dev.db` |
| `ALLOWED_ORIGINS` | доп. Origin для CSRF, через запятую | пусто |
| `TRUST_PROXY` | число прокси перед приложением | `backend/`: 1; `server.ts`: 0 |
| `STATS_TIMEZONE` | часовой пояс «дня» в статистике | часовой пояс сервера |
| `PORT` | порт отдельного backend | 3001 (`server.ts` — всегда 3000) |
| `PIPER_URL` | URL Piper в Podman-сети | `http://piper-tts:5000` |
 | `PIPER_VOICE` | голос Piper по умолчанию | `de_DE-thorsten-medium` |
| `PIPER_TIMEOUT_MS` | таймаут генерации WAV | `30000` |

Пустое значение (`TRUST_PROXY=`) не равно «не задано» — оно превращается в 0. Необязательные переменные не оставляйте пустыми.

## Backend
- Express 4, JSON-лимит 5 МБ (массовый импорт); nginx — `client_max_body_size 6m`.
- **Аутентификация админа**: пароль → JWT (HS256, 24 ч) только в HttpOnly-cookie. `requireAdmin` защищает мутации и админские чтения. Логин ограничен 8 неудачными попытками в минуту на IP.
- **CSRF**: `requireSameOrigin` для не-GET: `Origin`/`Referer` должен совпасть с `Host`/`X-Forwarded-Host` или `ALLOWED_ORIGINS`; запрос без обоих заголовков (curl) пропускается.
- Порядок в `api.ts`: csrf → auth (`/auth`, алиас `/admin`) → `normalizeWordBody` (ist/hat → sein/haben) → `words-admin` → `words` → categories → analytics → settings → sync.
- **words-admin**: `POST /words/bulk/{category,part-of-speech,delete}`, `GET /words/duplicates`, `POST /words/duplicates/merge`, `POST /words/import/preview`.
- **words**: публичный `GET /words` (поиск в JS, Unicode-aware; страницы до 1000), админские POST/PUT/DELETE, `POST /words/import`, `GET /words/export`.
- **settings**: `GET/PUT/DELETE /settings/audio-settings` читают и изменяют модель Piper, `length_scale`, `noise_scale`, `noise_w_scale` и `sentence_silence`; старые endpoints `audio-voice` остаются для совместимости. `POST /audio/admin/preview` генерирует тестовый WAV без записи в кэш.
- **audio**: `GET /audio?text=…&kind=word|sentence` отдаёт WAV, создавая запись через Piper при отсутствии в кэше; endpoint ограничен 60 запросами в минуту на IP. Админские `GET /audio/admin/stats`, `DELETE /audio/admin/cache` и `POST /audio/admin/regenerate-words` позволяют управлять кэшем. WAV не кэшируется браузером: постоянный кэш находится на сервере.
- **sync**: `POST /sync/srs` (публичный, 60 запросов/мин на IP) — клиент шлёт `{key, srs, resetAt}`, сервер сливает со своим снимком (для каждой карточки побеждает запись с более поздним `lastReviewed`; `resetAt` отбрасывает записи не новее сброса), сохраняет и возвращает результат. Ключ — 6…200 символов; логика — `services/srsSync.ts`.
- **Импорт** (`wordImport.ts`): JSON (в т. ч. в ```json```), либо текст «слово;перевод;plural;подсказка». Строки с ошибками пропускаются и отчитываются; `dryRun`; дубликаты по `duplicateKey`.
- **Старт** (`backfillPartOfSpeech`): нормализует `hilfsverb`, затем заполняет `partOfSpeech`. Идемпотентно.
- **Аналитика**: «день» — календарный день в часовом поясе `STATS_TIMEZONE` (по умолчанию серверный); «сегодня», график 7 дней и подписи используют одну функцию `dayKey`.

## Frontend
### Поток данных
`api/client.ts` → `api/queryCache.ts` (общий кэш, stale-while-revalidate, `invalidateQueries`) → `hooks/useDictionary.ts` → тренажёры и админка. Один запрос словаря обслуживает все вкладки.

### Вкладки (hash-роутинг `#/numbers|words|articles|verbs|time|admin`)
| Вкладка | Компонент | Логика |
|---|---|---|
| Числа | `NumbersTrainer` | `numbers-generator.ts` (`germanNumberVariants`), `answerMatch` |
| Слова | `WordsTrainer` | `useWordsQuizEngine`, `wordCards.ts`, подсказка `wordHint.ts`; SRS-карточка = слово×направление×форма |
| Артикли | `ArticlesTrainer` | `utils/articles.ts`; карточка = существительное с артиклем; клавиши 1/2/3 |
| Глаголы | `VerbsTrainer` | `useVerbsQuizEngine`, `verbCards.ts` (единый список карточек) |
| Время | `TimeTrainer` | `time-generator.ts`; только флэш-карточки («показать ответ»), ответы не проверяются и не считаются (в статистике счёт 0) |
| Админка | `AdminPanel` (lazy) | слова (массовые действия), категории, импорт/экспорт + проверка, дубликаты, ящики SRS, аналитика |

### Утилиты (`frontend/src/utils`)
| Файл | Назначение |
|---|---|
| `answerMatch.ts`, `answerDiff.ts` | сравнение ответов; посимвольная подсветка ошибок (LCS) |
| `numbers-generator.ts`, `time-generator.ts` | немецкие числительные и время |
| `srs.ts`, `srsDue.ts`, `srsWeights.ts` | Лейтнер: ключи, выбор карточки, «к повторению», веса ящиков |
| `srsSync.ts`, `srsSyncData.ts` | синхронизация SRS (ввод-вывод / чистое слияние) |
| `studyPrefs.ts`, `uiSettings.ts`, `progressBackup.ts` | настройки обучения и интерфейса; экспорт/импорт прогресса |
| `verbCards.ts`, `verbConjugation.ts`, `verbQuiz.ts`, `wordCards.ts`, `wordHint.ts`, `articles.ts`, `partOfSpeech.ts` | колоды карточек и правила тренажёров |
| `random.ts`, `audio.ts`, `toast.ts`, `scrollGuard.ts` | служебное; аудио кэшируется на сервере, URL-файлы браузера живут только во время воспроизведения |
| `analytics.ts` | **устарел и не используется** (дубликат `trackEvent` из `api/client.ts`) — удалить |

### SRS (Лейтнер)
- 5 ящиков; веса выбора ящика по умолчанию `[60,15,10,5,10]` (`DEFAULT_SRS_BOX_WEIGHTS` в `utils/srsWeights.ts`; он же `SRS_BOX_WEIGHTS` в `srs.ts`), пустые ящики пропускаются, остальные пересчитываются.
- **Веса настраивает админ** (вкладка «Ящики SRS»), значения хранятся на сервере (`Setting`) и общие для всех. Клиент загружает их при старте (`hooks/useSrsWeightsSync.ts`, вызывается в `App`) в хранилище `utils/srsWeights.ts`; `pickCardBySRS` и `boxProbabilityPercent` читают текущие веса в момент вызова. Нет ответа сервера → действуют значения по умолчанию.
- Верный ответ: +1 ящик, не чаще раза в день (`promotedOn`); ошибка → ящик 1. `nextReview` = сейчас + `[0,1,3,7,14,30]` дней[ящик]. При выборе карточки `nextReview` учитывается только в режиме «только к повторению».
- **Режим «только к повторению»** (`studyPrefs.dueOnly`): `isDue` — новая карточка, ящик 1 (после ошибки) или `nextReview` наступил. Фильтр в `useSRSProgress.pickCard`; если пусто — `SRSIdleCard`.
- **Цель на день** (`studyPrefs.dailyGoal`): счётчик ответов за локальные сутки, инкремент в `useScores.recordAnswer`; чип в Navbar и полоса в «Статистике».
- **Синхронизация между устройствами** (`hooks/useSrsSync.ts`, `utils/srsSync.ts`): задаётся в «Настройки» → «Ключ синхронизации» (хранится в `app_ui_settings.syncKey`). Пустой ключ — ничего не отправляется. Обмен: при старте, смене ключа, возврате на вкладку и появлении сети; после ответов — с задержкой 2,5 с (`scheduleSync`). Сброс прогресса передаётся отметкой `app_srs_reset_at`. Чужой прогресс приходит через событие `srs-synced`.

### Проверка ответов
`answerMatch.ts`: регистр, пробелы, Unicode-форма, `ae/oe/ue/ss` (настройка), `е/ё`. Числа: `parseTypedInteger`, `germanNumberVariants` (+`hundert`/`tausend`). Подсветка ошибок — LCS в `answerDiff.ts`.

### Хранилище браузера (localStorage)
| Ключ | Что | В бэкапе |
|---|---|---|
| `words_srs_state`, `verbs_srs_state`, `articles_srs_state` | карточки SRS | да |
| `words_use_srs`, `verbs_use_srs`, `articles_use_srs` | SRS вкл/выкл | да |
| `app_srs_reset_at` | когда тренажёры сбрасывались (для синхронизации) | да |
| `app_scores` | счёт по тренажёрам | да |
| `app_ui_settings` | панель умлаутов, ae/oe, фокус, клавиатура, подсказка категории, цвета артиклей, громкость озвучки, **ключ синхронизации** | да |
| `app_study_prefs` | dueOnly, dailyGoal | да |
| `theme`, `verbs_praesens_submode` | тема, подрежим глаголов | да |
| `words_settings` | настройки тренажёра слов (направление, категории, формы) | да |
| `numbers_direction`, `numbers_range` | режим и диапазон чисел | да |
| `time_display_mode`, `time_step_mode` | вид часов и шаг минут | да |
| `verbs_mode` | режим тренажёра глаголов | да |
| `articles_category` | выбранная категория артиклей | да |
| `app_daily_progress` | ответов за сегодня | нет |
| `onboarding_seen` | приветственный экран уже показан | да |
| `admin_token` | удалён: токен админа живёт только в HttpOnly-cookie | нет |
| `admin_last_word_category_id` | последняя категория в форме слова | нет |

Веса ящиков SRS в `localStorage` не хранятся — это серверная настройка. Внимание: ключ синхронизации входит в бэкап (внутри `app_ui_settings`) — файл прогресса нужно хранить как пароль.

Перенос между устройствами: «Настройки» → «Скачать/Загрузить» (`utils/progressBackup.ts`, JSON `{app, version, exportedAt, data}`; загрузка **заменяет** прогресс и перезагружает страницу) либо ключ синхронизации.

### PWA и офлайн
`manifest.webmanifest` + `sw.js` (регистрируется только в production, `VERSION` = `v2`). Стратегии: HTML — network-first; `/assets/*` — cache-first; `GET /api/words` и `/api/categories` — network-first с таймаутом 4 с и запасом из кэша (при изменении данных страницы получают `DICTIONARY_UPDATED` и перезагружают словарь); остальное не перехватывается (в том числе `/api/settings/*` и `/api/sync/*`: офлайн действуют веса по умолчанию, синхронизация ждёт сети).
Новый воркер сам не активируется: `useServiceWorkerUpdates` + `UpdateBanner` предлагают «Обновить», после согласия страница перезагружается.

## Сборка и деплой
- Docker: `backend/Dockerfile` (порт 3001), `frontend/Dockerfile` (nginx), образы собирает GitHub Actions (`deploy.yml`). На pull request выполняются `npm ci`, typecheck, ESLint, тесты frontend и сборка backend/frontend; при push в `main` после успешных проверок образы собираются и публикуются в GHCR с тегами `latest` и SHA коммита. Сборочные образы используют `node:22-alpine`; это согласовано с `.nvmrc` и требованием `engines` в корневом `package.json`.
- nginx: `/api/` → `app-backend:3001` (имя резолвится на каждый запрос), `client_max_body_size 6m`, `sw.js`/manifest без кэша, `/assets/` — год и `immutable`, остальное — SPA-fallback.
- Корневой `server.ts` — для dev и «одного процесса»: поднимает БД (`prisma db push` + seed в пустую), API, Vite или статику. Prisma-клиент берётся из `backend/node_modules`: в `backend/` выполните `npm install && npx prisma generate` (после любого изменения схемы — снова `prisma generate`; `npm run build` в `backend/` делает это сам).
- Новые таблицы (`Setting`, `SyncProfile`) создаются автоматически через `prisma db push` при старте.

## Известные ограничения / идеи
- Нет аккаунтов: прогресс переносится файлом или ключом синхронизации (кто знает ключ — владеет профилем; ограничение 60 запросов/мин на IP).
- Нет автотестов; ESLint сконфигурирован (`frontend/eslint.config.js`), но пакеты не добавлены в `frontend/package.json`, поэтому `npm run lint` во `frontend/` не работает.
- Токен админа не возвращается в теле `/auth/login`, не хранится в `localStorage` и передаётся только в HttpOnly-cookie.
- `prisma db push --accept-data-loss` выполняется при каждом старте (`entrypoint.sh`, `npm start`, `server.ts`) — делайте бэкап БД перед изменением схемы.
- Метка вкладки «Артикли» в `AnalyticsTab.tabLabels` не добавлена (показывается ключ `articles`).
- Вкладка «Время» не ведёт счёт; компонент `time/TimeQuizCard.tsx` (режим с вводом ответа) нигде не используется.
- Неиспользуемые файлы-остатки: `components/Footer.tsx`, `utils/analytics.ts`, `src/App.css`, `src/assets/*.svg`, `public/icons.svg` (шаблон Vite).
- Аналитика хранит IP и User-Agent в открытом виде (GDPR).
