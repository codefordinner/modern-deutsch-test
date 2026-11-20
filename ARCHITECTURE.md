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
│  ├─ prisma/schema.prisma   Category, Word, Picture, AnalyticsEvent, Setting, AiErrorLog, AiBulkJob, AudioCache, AudioRegenerationJob, SyncProfile, LearnerProgress, TelegramUser, TelegramChallenge, UserSession (SQLite)
│  ├─ prisma/seed.ts         стартовые категории/слова (только в пустую БД)
│  ├─ entrypoint.sh          prisma db push → node dist/index.js
│  └─ src/
│     ├─ index.ts            отдельный запуск бэкенда (порт 3001, за nginx)
│     ├─ api.ts              сборка роутера /api (порядок монтирования важен)
│     ├─ db.ts               PrismaClient
│     ├─ middleware/         auth (JWT, cookie), csrf (Origin/Referer), normalizeWordBody
│     ├─ routes/             auth, telegram-auth, words, words-admin, categories, pictures, audio, analytics, settings, sync
│     └─ services/           audio, audioSettings, aiSettings, aiBulkJobs, aiUsage, wordImport, wordImportService, wordCategories, partOfSpeech, hilfsverb, backfill*, srs*, visitor, userAgent
├─ packages/shared/            @sprachfunke/shared: общая чистая логика SRS-синхронизации и веса по умолчанию
├─ packages/telegram-bot/       общий long-polling бот; auth handler сейчас, без доступа к SQLite
├─ deploy/                       примеры Quadlet и runbook (не применяются автоматически)
└─ frontend/
   ├─ nginx.conf, Dockerfile статика + прокси /api → app-backend:3001
   ├─ public/                favicon, manifest.webmanifest, sw.js, icons/
   └─ src/
        ├─ main.tsx, App.tsx   вход, ErrorBoundary, глобальная оболочка, тема, счёт
       │  ├─ config/tabs.ts   единый registry вкладок и их возможностей
       │  └─ components/routing/TrainerContent.tsx  выбор содержимого вкладки
      ├─ types.ts            общие типы
       ├─ api/                request.ts + доменные модули (auth, dictionary, adminWords, analytics, audio, settings, srs), client.ts (совместимый фасад), queryCache.ts
      ├─ hooks/              useDictionary, useSRSProgress, useSrsWeightsSync, useSrsSync, useScores, useHashRoute,
      │                      useUISettings, usePersistentState, useServiceWorkerUpdates, use{Words,Verbs}QuizEngine
      ├─ utils/              чистая логика (см. «Утилиты»)
      ├─ components/         Navbar, *Trainer (включая PictureDescriptionTrainer), admin/, words/, verbs/, numbers/, time/, articles/, srs/,
      │                      Modal, ModeSwitch, ToolbarButton, FeedbackBox, StatsPanel, GeneralSettingsModal,
      │                      ToastHost, UpdateBanner, ArticleText, UmlautBar, Scorebar, …
      └─ styles/             components.css, import-export.css, features.css, srs-settings.css, layout.css, mobile.css (последним)
```

## Модель данных
- **Category** `{id, name, normalizedName, icon, color, isBuiltin}` — основная связь 1:N с **Word** (`categoryId`) и дополнительная связь M:N через `extraCategories` (каскадное удаление основной категории).
- **Word** `{de, normalizedDe, ru, hint, partOfSpeech, plural, feminine, praeteritum, partizip2, hilfsverb ('haben'|'sein'), requiredCase, praesensIch, praesensDu, praesensErSieEs, praesensWir, praesensIhr, praesensSie, categoryId}`. `requiredCase` используется в режиме управления глаголов и принимает `nominativ|akkusativ|dativ|genitiv`. Формы Präsens хранятся отдельными полями, а не вложенным объектом.
  `partOfSpeech` ∈ noun|verb|adjective|adverb|other (валидируется в API; пусто → выводится `inferPartOfSpeech`).
- **AnalyticsEvent** `{eventType: visit|tab_switch|quiz_answer, trainerType, isCorrect, visitorId, ipAddress, userAgent, browser, os, device, timestamp}`; публичная запись ограничена rate limit и принимает только известные типы событий.
- **Setting** `{key, value (JSON), updatedAt}` — общие настройки, редактируемые в админке. Ключи: `srsBoxWeights`, `srsPromotionThreshold`, `audioSettings` и `aiSettings` (провайдер Gemini, API-ключ, общий лимит запросов в минуту и registry профилей `{profileId: {model, prompt}}`). AI-ключ никогда не возвращается клиенту.
- **AiErrorLog** `{operation, profileId, model, errorCode, providerStatus, message, prompt, response, durationMs, createdAt}` — журнал вызовов AI-операций для админки; промпт и ответ Gemini сохраняются для диагностики, API-ключи и inline-данные изображений перед сохранением удаляются.
- **AiBulkJob** `{id, status, total, completed, count, result, error, createdAt, finishedAt}` — устойчивый статус массовой проверки слов, распределения категорий и определения управления глаголов. Входные записи не сохраняются; незавершённые при рестарте становятся ошибкой `AI_JOB_INTERRUPTED` и остаются видимы в логах ИИ.
- **SyncProfile** `{keyHash, data (JSON), revision, createdAt, updatedAt}` — legacy-снимок SRS-прогресса по ключу синхронизации. `keyHash` = sha256 ключа; сам ключ не хранится. Оставлен для совместимости и одноразового переноса.
- **LearnerProgress** `{userId, data (JSON), revision, legacyKeyHash?, createdAt, updatedAt}` — SRS-прогресс, счёт и синхронизируемые настройки, принадлежащие Telegram-пользователю. `legacyKeyHash` уникально связывает старый ключ с одним аккаунтом на время переноса; сам ключ не хранится. `revision` используется для optimistic locking.
- **Picture** `{id, title, description, dataUrl, isActive, createdAt, updatedAt}` — изображения режима «Описание картинки».
- **AudioCache** `{cacheKey, kind ('word'|'sentence'), text, audio (WAV), mimeType}` — постоянный серверный кэш Piper. Отсутствующая запись генерируется при первом прослушивании. Ключ учитывает выбранный голос и параметры синтеза. `AudioRegenerationJob` хранит фоновую регенерацию слов, прогресс и время; задача возобновляется после перезапуска backend.
- Прогресс ученика кэшируется в `localStorage`; настройки режимов тренажёров при Telegram-входе загружаются в память из `LearnerProgress` и не записываются в браузер. Первый запрос переносит старые локальные настройки и, если задан старый ключ, объединяет `SyncProfile`; после успешной загрузки устаревшие ключи настроек удаляются. Без входа сохраняется локальный режим.

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
| `HERMES_WORD_IMPORT_TOKEN` | Bearer-токен локального endpoint `/api/internal/word-import` | не задан (endpoint выключен) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token для проверки Mini App initData и работы общего Sprachfunke-бота | не задан |
| `TELEGRAM_BOT_USERNAME` | публичный username общего Sprachfunke-бота без `@` | не задан |
| `TELEGRAM_AUTH_REQUIRED` | обязательный вход перед тренажёрами; включается после настройки secrets | `false` |
| `TELEGRAM_BOT_API_SECRET` | отдельная runtime-аутентификация bot → backend; не bot token | не задан |
| `TELEGRAM_AUTH_PEPPER` | HMAC pepper для digest кодов и browser binding | не задан |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | максимальный возраст Mini App initData | `300` |
| `TELEGRAM_SESSION_TTL_SECONDS` | срок сессии ученика в секундах | `2592000` |
| `TELEGRAM_COOKIE_SECURE` | принудительный `Secure` для ученических cookie за HTTPS tunnel (`true` в production) | авто по запросу |
| `PORT` | порт отдельного backend | 3001 (`server.ts` — всегда 3000) |
| `PIPER_URL` | URL Piper в Podman-сети | `http://piper-tts:5000` |
 | `PIPER_VOICE` | голос Piper по умолчанию | `de_DE-thorsten-medium` |
| `PIPER_TIMEOUT_MS` | таймаут генерации WAV | `30000` |

Пустое значение (`TRUST_PROXY=`) не равно «не задано» — оно превращается в 0. Необязательные переменные не оставляйте пустыми.

## Backend
- Express 4, JSON-лимит 5 МБ (массовый импорт); nginx — `client_max_body_size 6m`.
- **Аутентификация админа**: пароль → JWT (HS256, 24 ч) только в HttpOnly-cookie. `requireAdmin` защищает мутации и админские чтения. Логин ограничен 8 неудачными попытками в минуту на IP.
- **Ученические аккаунты Telegram**: отдельные таблицы `TelegramUser`, `TelegramChallenge`, `UserSession`. Пользовательская HttpOnly-cookie содержит случайный токен, в SQLite хранится только его digest; logout отзывает сессию. По HTTPS cookies имеют `SameSite=None; Secure; Partitioned` для Telegram WebView; по HTTP в dev сохраняется `SameSite=Lax`. Админская авторизация и cookie остаются независимыми.
- `GET /learner-auth/config` сообщает frontend, включён ли обязательный вход. На production после подготовки secrets установить `TELEGRAM_AUTH_REQUIRED=true`; выключенный флаг сохраняет совместимость со старой версией до согласованной выкладки.
- **Mini App-вход**: `POST /learner-auth/telegram/mini-app` проверяет Telegram HMAC и свежесть `auth_date` на backend; токен не возвращается в JSON.
- **Вход по коду**: `/learner-auth/telegram/challenge` выдаёт шестизначный код на 5 минут, в БД хранится HMAC digest. Challenge привязан к короткоживущей HttpOnly browser-cookie. Status и complete работают только с этой cookie; complete одноразово потребляет подтверждение, устанавливает session-cookie и возвращает `{authenticated, user: {id}}`.
- **Telegram-бот Sprachfunke**: `packages/telegram-bot/` — расширяемое long-polling ядро с отдельными handlers; сейчас реализован только handler авторизации. Публикуется отдельным GHCR-образом, принимает коды только в личном чате, вызывает `POST /internal/telegram/confirm` с отдельным `TELEGRAM_BOT_API_SECRET`; к SQLite бот доступа не имеет.
- **Доступ**: Telegram-вход обязателен для тренажёров; вкладка админки продолжает использовать отдельный admin login. Прогресс ученика в `LearnerProgress` привязан к Telegram-аккаунту.
- `POST /learner-auth/progress/srs` требует ученическую HttpOnly-сессию и сливает снимок прогресса с `LearnerProgress`: SRS, счёт и ответы за день остаются в локальном кэше; категории, дневная цель, dueOnly и режимы тренажёров берутся из памяти/сервера. Первый снимок мигрирует старые настройки из `localStorage`; начальная загрузка выполняется до монтирования тренажёров. Настройки устройства (тема, громкость и прочие UI-параметры) остаются локальными. Необязательный `legacyKey` одноразово импортирует профиль `SyncProfile`. Один старый ключ можно привязать только к одному Telegram-аккаунту. Одновременные записи защищены revision/CAS; endpoint ограничен 60 запросами в минуту на IP.
- **CSRF**: `requireSameOrigin` для не-GET: `Origin`/`Referer` должен совпасть с `Host`/`X-Forwarded-Host` или `ALLOWED_ORIGINS`; запрос без обоих заголовков (curl) пропускается.
- Порядок в `api.ts`: csrf → auth (`/auth`, алиас `/admin`) → `normalizeWordBody` (ist/hat → sein/haben) → `words-admin` → `words` → categories → analytics → settings → sync.
- **words-admin**: `POST /words/bulk/{category,part-of-speech,delete}`, `POST /words/ai/check` (фоновая проверка выбранных слов; безопасные исправления сохраняются сервером даже после закрытия вкладки; конфликты немецких форм отображаются как замечания к словам и не отменяют остальные исправления), `GET /words/duplicates`, `POST /words/duplicates/merge`, `POST /words/import/preview`.
- **words**: публичный `GET /words` (поиск в JS, Unicode-aware; страницы до 1000), админские POST/PUT/DELETE, `POST /words/import`, `GET /words/export`.
- **settings**: `GET/PUT/DELETE /settings/audio-settings` управляют озвучкой; `/settings/ai` управляет конфигурацией Gemini и профилями промптов, `/settings/ai/models` получает актуальный каталог моделей Gemini, `/settings/ai/check` проверяет ключ через этот каталог, а `/settings/ai/logs` читает и очищает журнал AI. Чтение журнала возвращает единый снимок последних записей и общие счётчики `{completed, errors}` по всей таблице; вкладки «Выполненные» и «Ошибки» фильтруют этот снимок только на клиенте, поэтому переключение вкладки не создаёт конкурирующих запросов. AI-операции централизованы в `services/aiSettings.ts`; каждый профиль может использовать свою модель. Для всех prompt-based вызовов в журнал сохраняются отправленный промпт и ответ Gemini (с удалением ключей и inline-изображений). Администратор может повторить завершившуюся ошибкой задачу через `POST /settings/ai/queue/:id/retry`: исходные данные хранятся только в памяти процесса и повторно ставятся в общую очередь.
- Профили ИИ: `pictureDescription` генерирует эталонные данные картинки; `pictureAnswerFormat` обрабатывает только голосовой ответ ученика, сохраняя слова и меняя лишь пробелы, запятые и точки; `pictureAnswerCheck` проверяет ответ ученика и использует отдельную модель, промпт и параметр жёсткости проверки; `wordFill` превращает сырой список слов в структурированный JSON словаря (`POST /settings/ai/word-fill`, отдельная модель и промпт, до 1000 слов/50k символов); `categoryRedistribution` перераспределяет выбранные слова по существующим категориям; `requiredCase` определяет `requiredCase` выбранных глаголов. Последние два запускаются из массовых действий вкладки «Слова» через защищённые `/words/ai/redistribute-categories` и `/words/ai/required-case`.
- Все вызовы Gemini проходят через in-memory очередь `services/aiQueue.ts` с ограничением параллельности `AI_QUEUE_CONCURRENCY` (по умолчанию 2). До получения слота rate limit задача остаётся `queued`; статус `running` означает, что начинается вызов Gemini. Состояние очереди доступно администратору через SSE `GET /settings/ai/queue`. Очередь очищается при перезапуске backend; журнал хранится в БД. HTTP-ошибки и таймауты пишутся с промптом, статусом и телом ответа Gemini; ошибки каталога моделей также видны в журнале. Логирование выполняется до завершения вызова.
- Массовые AI jobs запускаются фоново: UI получает `202` и больше не блокирует таблицу до завершения. Статусы хранятся в `AiBulkJob`; список доступен через `GET /words/ai/jobs`, отдельная задача — через `GET /words/ai/jobs/:jobId`. После рестарта активные записи явно помечаются прерванными. Хранятся последние 100 завершённых/прерванных задач.
- Для `categoryRedistribution` и `requiredCase` размер одного AI-промпта задаётся отдельно для каждого профиля ползунком в админке (10–1000 слов, шаг 10; по умолчанию 100). Большая выборка разбивается на несколько задач общей очереди, результаты объединяются перед записью.
- **audio**: `GET /audio?text=…&kind=word|sentence` отдаёт WAV, создавая запись через Piper при отсутствии в кэше; endpoint ограничен 60 запросами в минуту на IP. Админские `GET /audio/admin/stats`, `DELETE /audio/admin/cache` и `POST /audio/admin/regenerate-words` позволяют управлять кэшем. WAV не кэшируется браузером: постоянный кэш находится на сервере.
- **sync legacy**: `POST /sync/srs` (публичный, 60 запросов/мин на IP) — клиент шлёт `{key, srs, resetAt}`, сервер сливает со снимком по ключу. Оставлен для старых клиентов и режима без авторизации; профиль также используется для одноразовой миграции в `LearnerProgress`.
- **pictures**: `GET /pictures` отдаёт активные изображения; `GET /pictures/admin` и `POST/PUT/DELETE /pictures` доступны администратору; `POST /pictures/:id/ai-description` генерирует редактируемые название и описание через центральный AI-модуль; `POST /pictures/:id/format-answer` форматирует завершённую голосовую диктовку перед ручной правкой, а `POST /pictures/:id/check-answer` выполняет финальную проверку.
- В тренажёре описания картинки переход «Следующая картинка» меняет текущую картинку и режим ввода через React-состояние без перезагрузки страницы; черновик ответа хранится в `localStorage`.
- Массовая загрузка картинок выполняется последовательными защищёнными запросами, а опция автозаполнения вызывает AI-операцию для каждой картинки после сохранения изображения.
- **Импорт** (`wordImport.ts`): JSON (в т. ч. в ```json```), либо текст «слово;перевод;plural;подсказка». Строки с ошибками пропускаются и отчитываются; `dryRun`; дубликаты по `duplicateKey`.
- **Старт** (`backfillPartOfSpeech`): нормализует `hilfsverb`, затем заполняет `partOfSpeech`. Идемпотентно.
- **Аналитика**: «день» — календарный день в часовом поясе `STATS_TIMEZONE` (по умолчанию серверный); «сегодня», график 7 дней и подписи используют одну функцию `dayKey`.

## Frontend
### Поток данных
`api/client.ts` → `api/queryCache.ts` (общий кэш, stale-while-revalidate, `invalidateQueries`) → `hooks/useDictionary.ts` → тренажёры и админка. Один запрос словаря обслуживает все вкладки.

### Вкладки (hash-роутинг `#/numbers|words|articles|verbs|time|admin`)

Метаданные вкладок находятся в едином registry `frontend/src/config/tabs.ts`: id, подпись, заголовок, иконка, участие в счёте и поддержка SRS. Hash-роутинг, Navbar, подписи аналитики и список scored-вкладок используют этот registry. Содержимое вкладок выбирает `components/routing/TrainerContent.tsx`. При добавлении вкладки сначала добавьте её в registry, затем компонент и специализированные настройки/SRS по необходимости; не создавайте отдельные ручные списки вкладок.

Состояние админки также сохраняется в hash URL: `#/admin?tab=ai-settings` открывает нужный раздел после перезагрузки, а `#/admin?category=<id>` сохраняет выбранную категорию слов. В разделе «Логи ИИ» есть три подкатегории: текущие/ожидающие задачи, выполненные запросы и ошибки.
| Вкладка | Компонент | Логика |
|---|---|---|
| Числа | `NumbersTrainer` | `numbers-generator.ts` (`germanNumberVariants`), `answerMatch` |
| Слова | `WordsTrainer` | `useWordsQuizEngine`, `wordCards.ts`, подсказка `wordHint.ts`; SRS-карточка = слово×направление×форма |
| Артикли | `ArticlesTrainer` | `utils/articles.ts`; карточка = существительное с артиклем; клавиши 1/2/3 |
| Глаголы | `VerbsTrainer` | `useVerbsQuizEngine`, `verbCards.ts` (единый список карточек) |
| Время | `TimeTrainer` | `time-generator.ts`; только флэш-карточки («показать ответ»), ответы не проверяются и не считаются (в статистике счёт 0) |
| Админка | `AdminPanel` (lazy) | слова (массовые действия), категории, импорт/экспорт + проверка, дубликаты, ящики SRS, озвучка, картинки, настройки ИИ, отдельные логи ИИ, аналитика |

В админке настройки ИИ и технические журналы ИИ разделены на отдельные пункты навигации. Профили промптов в «Настройках ИИ» отображаются компактным списком: подробности профиля открываются по нажатию на его название. Очередь задач и журнал ошибок загружаются только в разделе «Логи ИИ».

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

### SRS (Лейтнер)
- 5 ящиков; веса выбора ящика по умолчанию `[60,15,10,5,10]` (`DEFAULT_SRS_BOX_WEIGHTS` в `utils/srsWeights.ts`; он же `SRS_BOX_WEIGHTS` в `srs.ts`), пустые ящики пропускаются, остальные пересчитываются.
- **Веса и порог настраивает админ** (вкладка «Ящики SRS»), значения хранятся на сервере (`Setting`) и общие для всех. Клиент загружает их при старте (`hooks/useSrsWeightsSync.ts`, вызывается в `App`) в `utils/srsWeights.ts`; веса используются `pickCardBySRS`, порог — при записи ответа только если ученик включил соответствующую галочку в общих настройках. Порог по умолчанию — 1, диапазон — 1–10. Нет ответа сервера → действуют значения по умолчанию.
- При включённом пороге ящик повышается после заданного числа ответов подряд, но не чаще раза в день (`promotedOn`); ошибка обнуляет серию и возвращает карточку в ящик 1. Без клиентской галочки сохраняется прежнее повышение после первого верного ответа. `nextReview` = сейчас + `[0,1,3,7,14,30]` дней[ящик]. При выборе карточки `nextReview` учитывается только в режиме «только к повторению».
- **Режим «только к повторению»** (`studyPrefs.dueOnly`): `isDue` — новая карточка, ящик 1 (после ошибки) или `nextReview` наступил. Фильтр в `useSRSProgress.pickCard`; если пусто — `SRSIdleCard`.
- **Цель на день** (`studyPrefs.dailyGoal`): счётчик ответов за локальные сутки, инкремент в `useScores.recordAnswer`; чип в Navbar и полоса в «Статистике».
- **Синхронизация между устройствами** (`hooks/useSrsSync.ts`, `utils/srsSync.ts`): при Telegram-входе снимок SRS, счёт, ответы за день, цель, категории и аккаунтные настройки тренажёров синхронизируются по сессии. Тренажёры не монтируются до начальной загрузки настроек; аккаунтные настройки далее живут только в памяти клиента, отправляются на сервер после изменения и не кэшируются в `localStorage`. SRS/счёт и другие данные прогресса пока сохраняют локальный кэш. На устройстве кэш прогресса помечается `app_learner_profile_id`, чтобы не слить данные предыдущего аккаунта в новый; ключевое legacy-хранилище используется только при первом переносе.

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
| `app_study_prefs` | dueOnly, dailyGoal; локальный режим без аккаунта и разовая миграция | да |
| `theme`, `verbs_praesens_submode` | тема, подрежим глаголов | да |
| `words_settings` | настройки тренажёра слов (направление, категории, формы) | да |
| `numbers_direction`, `numbers_range` | режим и диапазон чисел | да |
| `time_display_mode`, `time_step_mode` | вид часов и шаг минут | да |
| `verbs_mode` | режим тренажёра глаголов | да |
| `articles_category` | выбранная категория артиклей | да |
| `app_daily_progress` | ответов за сегодня | нет |
| `app_sync_settings_updated_at` | время изменения настроек, передаваемых синхронизацией | да |
| `app_learner_profile_id` | Telegram-профиль, которому принадлежит локальный кэш синхронизируемого прогресса | нет |
| `onboarding_seen` | приветственный экран уже показан | да |
| `admin_token` | удалён: токен админа живёт только в HttpOnly-cookie | нет |
| `admin_last_word_category_id` | последняя категория в форме слова | нет |

Тема (`theme`) и UI-параметры, включая громкость озвучки, являются устройственными и не синхронизируются аккаунтом. Направление/формы слов, режимы чисел/глаголов/времени, диапазон чисел, выбранные категории, флаги SRS, dueOnly и дневная цель — аккаунтные. Старые ключи настроек тренажёров и `app_study_prefs` читаются для миграции; после успешной загрузки Telegram-профиля удаляются. В аккаунтном режиме эти настройки находятся в памяти клиента до отправки на сервер, а не в `localStorage`; без аккаунта остаётся локальный режим. SRS-карточки, счёт и ответы за день по-прежнему имеют отдельный локальный кэш.

`picture_draft` — временный черновик ответа в тренажёре картинок; он не считается прогрессом и намеренно не включается в экспорт.

Веса ящиков SRS в `localStorage` не хранятся — это серверная настройка. Ключ синхронизации входит в старые бэкапы (внутри `app_ui_settings`) — такие файлы нужно хранить как пароль. После переноса в Telegram-профиль ключ из текущих настроек устройства удаляется.

Перенос между устройствами: для авторизованного ученика — Telegram-аккаунт; также доступны «Скачать/Загрузить» (`utils/progressBackup.ts`, JSON `{app, version, exportedAt, data}`; загрузка **заменяет** прогресс на устройстве) и legacy-ключ для режима без авторизации.

### PWA и офлайн
`manifest.webmanifest` + `sw.js` (регистрируется только в production). Версия кэшей Service Worker подставляется автоматически скриптом `frontend/scripts/build.mjs`: в CI используется GitHub SHA, локально — текущий Git commit, а без Git — timestamp. Поэтому ручное изменение `VERSION` не требуется. Стратегии: HTML — network-first; `/assets/*` — cache-first; `GET /api/words` и `/api/categories` — network-first с таймаутом 4 с и запасом из кэша (при изменении данных страницы получают `DICTIONARY_UPDATED` и перезагружают словарь); остальное не перехватывается (в том числе `/api/settings/*` и `/api/sync/*`: офлайн действуют веса по умолчанию, синхронизация ждёт сети). HTML-shell (`/` и `/index.html`) отдаётся с `Cache-Control: no-cache, no-store`, потому что он содержит имя текущего hashed JS-файла.
Новый воркер сам не активируется: `useServiceWorkerUpdates` + `UpdateBanner` предлагают «Обновить», после согласия страница перезагружается.

## Сборка и деплой
- Docker: `backend/Dockerfile` (порт 3001), `frontend/Dockerfile` (nginx), `packages/telegram-bot/Dockerfile` (long polling, без опубликованных портов). Образы собирает GitHub Actions (`deploy.yml`): PR выполняет backend build/tests, frontend typecheck/lint/tests/build и bot build/tests; push в `main` публикует все образы в GHCR с тегами `latest` и SHA коммита. Сервер получает готовые образы; секреты не являются build args.
- nginx: `/api/` → `app-backend:3001` (имя резолвится на каждый запрос), `client_max_body_size 6m`, таймауты прокси `proxy_connect_timeout 10s` / `proxy_send_timeout 120s` / `proxy_read_timeout 120s` (проверка описания картинки через Gemini может идти до ~60 с — без этого Cloudflare возвращал 502), `sw.js`/manifest без кэша, `/assets/` — год и `immutable`, остальное — SPA-fallback.
- Корневой `server.ts` — для dev и «одного процесса»: поднимает БД (`prisma db push` + seed в пустую), API, Vite или статику. Prisma-клиент берётся из `backend/node_modules`: в `backend/` выполните `npm install && npx prisma generate` (после любого изменения схемы — снова `prisma generate`; `npm run build` в `backend/` делает это сам).
- Новые таблицы (`Setting`, `SyncProfile`, `Picture`) создаются автоматически через `prisma db push` при старте.

## Известные ограничения / идеи
- Legacy-ключи синхронизации и `/sync/srs` остаются для переходного периода, совместимости и режима без авторизации. Удалять их можно отдельным этапом после завершения миграции клиентов; решение об отказе от локального кэша также отдельное.
- Основная чистая логика покрывается Vitest; frontend typecheck, ESLint и тесты запускаются отдельными командами из `frontend/`.
- Токен админа не возвращается в теле `/auth/login`, не хранится в `localStorage` и передаётся только в HttpOnly-cookie.
- `prisma db push --accept-data-loss` выполняется при каждом старте (`entrypoint.sh`, `npm start`, `server.ts`) — делайте бэкап БД перед изменением схемы.
- Метаданные вкладок централизованы в `frontend/src/config/tabs.ts`; отдельные списки в Navbar, routing и аналитике не создаются.
- Вкладка «Время» не ведёт счёт.
- Аналитика хранит IP и User-Agent в открытом виде (GDPR).
