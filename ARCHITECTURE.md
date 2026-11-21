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
│  ├─ prisma/schema.prisma   Category, Word, Picture, AnalyticsEvent, Setting, AiErrorLog, AiBulkJob, AudioCache, AudioRegenerationJob, LearnerProgress, TelegramUser, TelegramChallenge, UserSession (SQLite)
│  ├─ prisma/seed.ts         стартовые категории/слова (только в пустую БД)
│  ├─ entrypoint.sh          prisma db push → node dist/index.js
│  └─ src/
│     ├─ index.ts            отдельный запуск бэкенда (порт 3001, за nginx)
│     ├─ api.ts              сборка роутера /api (порядок монтирования важен)
│     ├─ db.ts               PrismaClient
│     ├─ middleware/         auth (Telegram session cookie), csrf (Origin/Referer), normalizeWordBody
│     ├─ routes/             telegram-auth, users-admin, words, words-admin, categories, pictures, audio, analytics, settings, internal
│     └─ services/           audio, audioSettings, aiSettings + ai/{gemini,picture,words}, aiBulkJobs, aiUsage, wordImport, wordImportService, wordCategories, partOfSpeech, hilfsverb, backfill*, srs*, visitor, userAgent
├─ packages/shared/            @sprachfunke/shared (TypeScript, CJS/ESM): SRS-синхронизация/веса, типы Word, enum’ы и общие списки
├─ packages/telegram-bot/       общий long-polling бот; обработчик подтверждения входа, без доступа к SQLite
├─ deploy/                       примеры Quadlet и runbook (не применяются автоматически)
└─ frontend/
   ├─ nginx.conf, Dockerfile статика + прокси /api → app-backend:3001
   ├─ public/                favicon, manifest.webmanifest, sw.js, icons/
   └─ src/
        ├─ main.tsx, App.tsx   вход, ErrorBoundary, глобальная оболочка, тема, счёт
       │  ├─ config/tabs.ts   единый registry вкладок и их возможностей
       │  └─ components/routing/TrainerContent.tsx  выбор содержимого вкладки
      ├─ types.ts            общие типы
       ├─ api/                request.ts + доменные модули (telegramAuth, adminUsers, dictionary, adminWords, analytics, audio, settings, srs), client.ts (совместимый фасад), queryCache.ts
      ├─ hooks/              useDictionary, useSRSProgress, useSrsWeightsSync, useSrsSync, useScores, useHashRoute,
      │                      useUISettings, usePersistentState, useServiceWorkerUpdates, use{Words,Verbs}QuizEngine
      ├─ utils/              чистая логика (см. «Утилиты»)
      ├─ components/         Navbar, *Trainer (включая PictureDescriptionTrainer), admin/, words/, verbs/, numbers/, time/, articles/, srs/,
      │                      Modal, ModeSwitch, ToolbarButton, FeedbackBox, StatsPanel, GeneralSettingsModal,
      │                      ToastHost, ArticleText, UmlautBar, Scorebar, …
      └─ styles/             components.css, import-export.css, features.css, srs-settings.css, layout.css, mobile.css (последним)
```

## Модель данных
- **Category** `{id, name, normalizedName, icon, color, isBuiltin}` — основная связь 1:N с **Word** (`categoryId`) и дополнительная связь M:N через `extraCategories` (каскадное удаление основной категории).
- **Word** `{de, normalizedDe, ru, hint, partOfSpeech, plural, feminine, praeteritum, partizip2, hilfsverb ('haben'|'sein'), requiredCase, praesensIch, praesensDu, praesensErSieEs, praesensWir, praesensIhr, praesensSie, categoryId}`. `requiredCase` используется в режиме управления глаголов и принимает `nominativ|akkusativ|dativ|genitiv`. Формы Präsens хранятся отдельными полями, а не вложенным объектом.
  `partOfSpeech` ∈ noun|verb|adjective|adverb|other (валидируется в API; пусто → выводится `inferPartOfSpeech`).
- **AnalyticsEvent** `{eventType: visit|tab_switch|quiz_answer, trainerType, isCorrect, learnerId, visitorId (legacy), ipAddress, userAgent, browser, os, device, timestamp}`; новые события требуют Telegram-сессию и используют внутренний ID ученика (не Telegram ID), публичная запись ограничена rate limit и принимает только известные типы событий. Админская аналитика исключает legacy-события без `learnerId`.
- **Setting** `{key, value (JSON), updatedAt}` — общие настройки, редактируемые в админке. Ключи: `srsBoxWeights`, `srsPromotionThreshold`, `audioSettings` и `aiSettings` (провайдер Gemini, API-ключ, общий лимит запросов в минуту и registry профилей `{profileId: {model, prompt}}`). AI-ключ никогда не возвращается клиенту.
- **AiErrorLog** `{operation, profileId, model, errorCode, providerStatus, message, prompt, response, durationMs, createdAt}` — журнал вызовов AI-операций для админки; промпт и ответ Gemini сохраняются для диагностики, API-ключи и inline-данные изображений перед сохранением удаляются.
- **AiBulkJob** `{id, status, total, completed, count, result, error, createdAt, finishedAt}` — устойчивый статус массовой проверки слов, распределения категорий и определения управления глаголов. Входные записи не сохраняются; незавершённые при рестарте становятся ошибкой `AI_JOB_INTERRUPTED` и остаются видимы в логах ИИ.
- **TelegramUser** `{id, telegramId, isAdmin, isBanned, createdAt, updatedAt}` — Telegram-аккаунт ученика; `isAdmin` управляет показом вкладки админки, `isBanned` блокирует вход и действующие сессии.
- **LearnerProgress** `{userId, data (JSON), revision, createdAt, updatedAt}` — SRS-прогресс, счёт, настройки и отметка прохождения обучения Telegram-пользователя. `revision` используется для optimistic locking.
- **Picture** `{id, title, description, dataUrl, isActive, createdAt, updatedAt}` — изображения режима «Описание картинки».
- **AudioCache** `{cacheKey, kind ('word'|'sentence'), text, audio (WAV), mimeType}` — постоянный серверный кэш Piper. Отсутствующая запись генерируется при первом прослушивании. Ключ учитывает выбранный голос и параметры синтеза. `AudioRegenerationJob` хранит фоновую регенерацию слов, прогресс и время; задача возобновляется после перезапуска backend.
- Прогресс ученика кэшируется в `localStorage`; настройки режимов тренажёров при Telegram-входе загружаются в память из `LearnerProgress` и не записываются в браузер. Локальные настройки устройства не импортируются в аккаунт.

## Переменные окружения
См. `.env.example`. Приложение `.env` само не читает — передавайте переменные окружением (docker, `node --env-file`).

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `DATABASE_URL` | SQLite | `file:./dev.db` |
| `ALLOWED_ORIGINS` | доп. Origin для CSRF, через запятую | пусто |
| `TRUST_PROXY` | число прокси перед приложением | `backend/`: 1; `server.ts`: 0 |
| `STATS_TIMEZONE` | часовой пояс «дня» в статистике | часовой пояс сервера |
| `HERMES_WORD_IMPORT_TOKEN` | Bearer-токен локального endpoint `/api/internal/word-import` | не задан (endpoint выключен) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token для проверки Mini App initData и работы общего Sprachfunke-бота | не задан |
| `TELEGRAM_BOT_USERNAME` | публичный username общего Sprachfunke-бота без `@` | не задан |
| `TELEGRAM_BOT_API_SECRET` | отдельная runtime-аутентификация bot → backend; не bot token | не задан |
| `TELEGRAM_AUTH_PEPPER` | HMAC pepper для digest кодов и browser binding | не задан |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | максимальный возраст Mini App initData | `300` |
| `TELEGRAM_SESSION_TTL_SECONDS` | срок сессии ученика в секундах | `2592000` |
| `TELEGRAM_COOKIE_SECURE` | настройка `Secure` для ученических cookie за HTTPS tunnel | автоматически в production и для HTTPS; `false` — только для локального HTTP |
| `PORT` | порт отдельного backend | 3001 (`server.ts` — всегда 3000) |
| `PIPER_URL` | URL Piper в Podman-сети | `http://piper-tts:5000` |
 | `PIPER_VOICE` | голос Piper по умолчанию | `de_DE-thorsten-medium` |
| `PIPER_TIMEOUT_MS` | таймаут генерации WAV | `30000` |
| `AUDIO_REGEN_CONCURRENCY` | параллельность массовой регенерации аудио (1–8) | `2` |
| `AI_QUEUE_CONCURRENCY` | число одновременных запросов Gemini | `2` |
| `AI_DAILY_CHECK_CAP` | общий дневной лимит платных AI-проверок | `500` |

Пустое значение (`TRUST_PROXY=`) не равно «не задано» — оно превращается в 0. Необязательные переменные не оставляйте пустыми.

## Backend
- Express 4, JSON-лимит 6 МБ (массовый импорт и API); nginx — `client_max_body_size 6m`.
- **Аутентификация админа**: отдельного пароля нет. `requireAdmin` проверяет действующую Telegram-сессию и актуальный `TelegramUser.isAdmin` в БД для каждого защищённого запроса.
- **Ученические аккаунты Telegram**: отдельные таблицы `TelegramUser`, `TelegramChallenge`, `UserSession`. HttpOnly-cookie содержит случайный токен сессии, в SQLite хранится только его digest; logout отзывает сессию. По HTTPS cookie имеет `SameSite=None; Secure; Partitioned` для Telegram WebView; по HTTP в dev сохраняется `SameSite=Lax`. Админские права определяются ролью того же Telegram-пользователя.
- У `TelegramUser.isAdmin` по умолчанию `false`; `/learner-auth/me` и успешные входы возвращают этот флаг, frontend показывает вкладку «Админка» только таким Telegram-пользователям. Выдать/снять флаг можно внутри backend-контейнера: `npm run admin:set -- <telegramId> grant|revoke`. Админские API используют ту же HttpOnly Telegram-cookie и проверяют флаг через `requireAdmin`.
- `GET /learner-auth/config` сообщает frontend, что вход через Telegram обязателен. Клиент работает fail-closed и не открывает тренажёры, если endpoint отсутствует.
- **Mini App-вход**: `POST /learner-auth/telegram/mini-app` проверяет Telegram HMAC и свежесть `auth_date` на backend; токен не возвращается в JSON.
- **Вход по коду**: `/learner-auth/telegram/challenge` выдаёт шестизначный код на 5 минут и ограничен 5 запросами в минуту на IP; в БД хранится HMAC digest. Challenge привязан к короткоживущей HttpOnly browser-cookie. Status и complete работают только с этой cookie; complete одноразово потребляет подтверждение, устанавливает session-cookie и возвращает `{authenticated, user: {id}}`.
- **Telegram-бот Sprachfunke**: `packages/telegram-bot/` — расширяемое long-polling ядро с отдельными handlers; сейчас реализован только handler авторизации. Публикуется отдельным GHCR-образом, принимает коды только в личном чате, вызывает `POST /internal/telegram/confirm` с отдельным `TELEGRAM_BOT_API_SECRET`; к SQLite бот доступа не имеет.
- **Доступ**: Telegram-вход обязателен для тренажёров и админки; права администратора определяются флагом пользователя в БД. Прогресс ученика в `LearnerProgress` привязан к Telegram-аккаунту.
- **Пользователи админки**: `/users` и `/users/:id/{progress,admin,ban}` доступны только через `requireAdmin`; раздел показывает Telegram ID (профиль Telegram по ID получить нельзя), позволяет смотреть SRS/счёт/настройки прогресса, сбрасывать прогресс, блокировать/разблокировать, выдавать/снимать админку и удалять аккаунт. Самого себя и последнего администратора нельзя лишить доступа или удалить; блокировка отзывает сессии. Удаление аккаунта каскадно удаляет прогресс, сессии и challenge.
- `POST /learner-auth/progress/srs` требует ученическую HttpOnly-сессию и сливает снимок прогресса с `LearnerProgress`: SRS, счёт и ответы за день остаются в локальном кэше; категории, дневная цель, dueOnly, режимы тренажёров и `onboardingSeen` синхронизируются с сервером. Начальная загрузка выполняется до монтирования тренажёров. Настройки устройства (тема, громкость и прочие UI-параметры) остаются локальными. Одновременные записи защищены revision/CAS; endpoint ограничен 60 запросами в минуту на IP.
- **CSRF**: `requireSameOrigin` для не-GET: `Origin`/`Referer` должен совпасть с `Host`/`X-Forwarded-Host` или `ALLOWED_ORIGINS`; запрос без обоих заголовков (curl) пропускается.
- Порядок в `api.ts`: CSRF → `/learner-auth` → `/users` → `normalizeWordBody` → `words-admin` → `words` → categories → analytics → settings → audio → pictures → internal.
- **words-admin**: `POST /words/bulk/{category,part-of-speech,delete}`, `POST /words/ai/check` (фоновая проверка выбранных слов; безопасные исправления сохраняются сервером даже после закрытия вкладки; конфликты немецких форм отображаются как замечания к словам и не отменяют остальные исправления), `GET /words/duplicates`, `POST /words/duplicates/merge`, `POST /words/import/preview`.
- **words**: публичный `GET /words` (поиск в JS, Unicode-aware; страницы до 1000) с ETag и условным ответом `304 Not Modified`; админские POST/PUT/DELETE, `POST /words/import`, `GET /words/export`.
- **settings**: `GET/PUT/DELETE /settings/audio-settings` управляют озвучкой; `/settings/ai` управляет конфигурацией Gemini и профилями промптов, `/settings/ai/models` получает актуальный каталог моделей Gemini, `/settings/ai/check` проверяет ключ через этот каталог, а `/settings/ai/logs` читает и очищает журнал AI. Чтение журнала возвращает единый снимок последних записей и общие счётчики `{completed, errors}` по всей таблице; вкладки «Выполненные» и «Ошибки» фильтруют этот снимок только на клиенте, поэтому переключение вкладки не создаёт конкурирующих запросов. Настройки и каталог моделей находятся в `services/aiSettings.ts`, операции разнесены по `services/ai/picture.ts` и `services/ai/words.ts`, а все вызовы `generateContent` проходят через `services/ai/gemini.ts` (`callGemini`). Каждый профиль может использовать свою модель. Для всех prompt-based вызовов в журнал сохраняются отправленный промпт и ответ Gemini (с удалением ключей и inline-изображений). Администратор может повторить завершившуюся ошибкой задачу через `POST /settings/ai/queue/:id/retry`: исходные данные хранятся только в памяти процесса и повторно ставятся в общую очередь.
- Профили ИИ: `pictureDescription` генерирует эталонные данные картинки; `pictureAnswerFormat` обрабатывает только голосовой ответ ученика, сохраняя слова и меняя лишь пробелы, запятые и точки; `pictureAnswerCheck` проверяет ответ ученика и использует отдельную модель, промпт и параметр жёсткости проверки; `wordFill` превращает сырой список слов в структурированный JSON словаря (`POST /settings/ai/word-fill`, отдельная модель и промпт, до 1000 слов/50k символов); `categoryRedistribution` перераспределяет выбранные слова по существующим категориям; `requiredCase` определяет `requiredCase` выбранных глаголов. Последние два запускаются из массовых действий вкладки «Слова» через защищённые `/words/ai/redistribute-categories` и `/words/ai/required-case`.
- Все вызовы Gemini проходят через in-memory очередь `services/aiQueue.ts` с ограничением параллельности `AI_QUEUE_CONCURRENCY` (по умолчанию 2). До получения слота rate limit задача остаётся `queued`; статус `running` означает, что начинается вызов Gemini. Состояние очереди доступно администратору через SSE `GET /settings/ai/queue`. Очередь очищается при перезапуске backend; журнал хранится в БД. HTTP-ошибки и таймауты пишутся с промптом, статусом и телом ответа Gemini; ошибки каталога моделей также видны в журнале. Логирование выполняется до завершения вызова.
- Массовые AI jobs запускаются фоново: UI получает `202` и больше не блокирует таблицу до завершения. Статусы хранятся в `AiBulkJob`; список доступен через `GET /words/ai/jobs`, отдельная задача — через `GET /words/ai/jobs/:jobId`. После рестарта активные записи явно помечаются прерванными. Хранятся последние 100 завершённых/прерванных задач.
- Для `categoryRedistribution` и `requiredCase` размер одного AI-промпта задаётся отдельно для каждого профиля ползунком в админке (10–1000 слов, шаг 10; по умолчанию 100). Большая выборка разбивается на несколько задач общей очереди, результаты объединяются перед записью.
- **audio**: `GET /audio?text=…&kind=word|sentence` отдаёт WAV, создавая запись через Piper при отсутствии в кэше; endpoint ограничен 60 запросами в минуту на IP. Админские `GET /audio/admin/stats`, `DELETE /audio/admin/cache` и `POST /audio/admin/regenerate-words` позволяют управлять кэшем. WAV не кэшируется браузером: постоянный кэш находится на сервере.
- Legacy endpoint `POST /sync/srs` удалён. Синхронизация между устройствами работает только через Telegram-аккаунт и `/learner-auth/progress/srs`.
- **pictures**: `GET /pictures` отдаёт активные изображения; `GET /pictures/admin` и `POST/PUT/DELETE /pictures` доступны администратору; `POST /pictures/:id/ai-description` генерирует редактируемые название и описание через центральный AI-модуль; `POST /pictures/:id/format-answer` форматирует завершённую голосовую диктовку перед ручной правкой, а `POST /pictures/:id/check-answer` выполняет финальную проверку.
- В тренажёре описания картинки переход «Следующая картинка» меняет текущую картинку и режим ввода через React-состояние без перезагрузки страницы; черновик ответа хранится в `localStorage`.
- Массовая загрузка картинок выполняется последовательными защищёнными запросами, а опция автозаполнения вызывает AI-операцию для каждой картинки после сохранения изображения.
- **Импорт** (`wordImport.ts`): JSON (в т. ч. в ```json```), либо текст «слово;перевод;plural;подсказка». Строки с ошибками пропускаются и отчитываются; `dryRun`; дубликаты по `duplicateKey`.
- **Старт** (`backfillPartOfSpeech`): нормализует `hilfsverb`, затем заполняет `partOfSpeech`. Идемпотентно.
- **Аналитика**: события тренажёров записываются только после Telegram-входа и привязываются к внутреннему ID ученика. Админская статистика включает только такие события, а количество зарегистрированных и новых учеников берётся из `TelegramUser`; активность и возвраты считаются по уникальным аккаунтам, а не IP/cookie. Старые анонимные события не участвуют в показателях. «День» — календарный день в часовом поясе `STATS_TIMEZONE` (по умолчанию серверный); все временные срезы используют одну функцию `dayKey`.

## Frontend
### Поток данных
Доменные модули `api/*.ts` используют общий транспорт `api/request.ts`; словарь идёт через `api/queryCache.ts` (общий кэш, stale-while-revalidate, `invalidateQueries`) → `hooks/useDictionary.ts` → тренажёры и админка. `api/client.ts` оставлен как совместимый фасад. Настройки проходят через единый внешний store в `usePersistentState`: иммутабельные account-настройки обновляются в памяти и синхронизируются, а настройки устройства сохраняются через store в `localStorage`.

### Навигация и экраны (hash-роутинг)

Основные разделы: `#/trainers` (каталог тренажёров и стартовый экран), `#/progress` (дневная цель и результаты) и `#/profile` (настройки приложения, тема, выход и ссылка на админку для администраторов). Внутренние маршруты тренажёров сохранены: `#/numbers|words|articles|verbs|time|pictures`; `#/admin` по-прежнему открывает админку. Старые прямые ссылки продолжают работать.

Метаданные экранов находятся в едином registry `frontend/src/config/tabs.ts`: id, подпись, заголовок, иконка, поверхность (основная навигация / тренажёр / админка), участие в счёте и поддержка SRS. Navbar показывает только три основных раздела; каталог тренажёров формирует карточки из registry, а подписи аналитики и список scored-вкладок также используют его. Содержимое выбирает `components/routing/TrainerContent.tsx`. При добавлении тренажёра сначала добавьте его в registry и каталог, затем компонент и специализированные настройки/SRS по необходимости; не создавайте отдельные ручные списки вкладок.

Состояние админки также сохраняется в hash URL: `#/admin?tab=ai-settings` открывает нужный раздел после перезагрузки, а `#/admin?category=<id>` сохраняет выбранную категорию слов. В разделе «Логи ИИ» есть три подкатегории: текущие/ожидающие задачи, выполненные запросы и ошибки.
| Экран/тренажёр | Компонент | Логика |
|---|---|---|
| Тренажёры | `TrainerCatalog` (`routing/HubPages.tsx`) | Каталог режимов по группам; выбранные тренажёры открываются по прежним hash-маршрутам |
| Прогресс | `ProgressPage` (`routing/HubPages.tsx`) | Дневная цель (изменяется прямо на странице) и сводка счёта по scored-тренажёрам |
| Профиль | `ProfilePage` (`routing/HubPages.tsx`) | Ссылка на общие настройки, переключение темы, выход и (для администратора) ссылка на админку |
| Числа | `NumbersTrainer` | `numbers-generator.ts` (`germanNumberVariants`), `answerMatch` |
| Слова | `WordsTrainer` | `useWordsQuizEngine`, `wordCards.ts`, подсказка `wordHint.ts`; SRS-карточка = слово×направление×форма |
| Артикли | `ArticlesTrainer` | `utils/articles.ts`; карточка = существительное с артиклем; клавиши 1/2/3 |
| Глаголы | `VerbsTrainer` | `useVerbsQuizEngine`, `verbCards.ts` (единый список карточек) |
| Время | `TimeTrainer` | `time-generator.ts`; только флэш-карточки («показать ответ»), ответы не проверяются и не считаются (в статистике счёт 0) |
| Админка | `AdminPanel` (lazy) | слова (массовые действия), категории, импорт/экспорт + проверка, дубликаты, ящики SRS, озвучка, картинки, настройки ИИ, отдельные логи ИИ, аналитика |

В админке настройки ИИ и технические журналы ИИ разделены на отдельные пункты навигации. Профили промптов в «Настройках ИИ» отображаются компактным списком: подробности профиля открываются по нажатию на его название. Очередь задач и журнал ошибок загружаются только в разделе «Логи ИИ». Раздел «Пользователи» управляет Telegram-аккаунтами и показывает снимок сохранённого прогресса.

### Утилиты (`frontend/src/utils`)
| Файл | Назначение |
|---|---|
| `answerMatch.ts`, `answerDiff.ts` | сравнение ответов; посимвольная подсветка ошибок (LCS) |
| `numbers-generator.ts`, `time-generator.ts` | немецкие числительные и время |
| `srs.ts`, `srsDue.ts`, `srsWeights.ts` | Лейтнер: ключи, выбор карточки, «к повторению», веса ящиков |
| `srsSync.ts`, `srsSyncData.ts` | синхронизация SRS (ввод-вывод / чистое слияние) |
| `studyPrefs.ts`, `uiSettings.ts` | настройки обучения и интерфейса |
| `verbCards.ts`, `verbConjugation.ts`, `verbQuiz.ts`, `wordCards.ts`, `wordHint.ts`, `articles.ts`, `partOfSpeech.ts` | колоды карточек и правила тренажёров |
| `random.ts`, `audio.ts`, `toast.ts`, `scrollGuard.ts` | служебное; аудио кэшируется на сервере, URL-файлы браузера живут только во время воспроизведения |

### SRS (Лейтнер)
- 5 ящиков; веса выбора ящика по умолчанию `[60,15,10,5,10]` (`DEFAULT_SRS_BOX_WEIGHTS` в `utils/srsWeights.ts`; он же `SRS_BOX_WEIGHTS` в `srs.ts`), пустые ящики пропускаются, остальные пересчитываются.
- **Веса и порог настраивает админ** (вкладка «Ящики SRS»), значения хранятся на сервере (`Setting`) и общие для всех. Клиент загружает их при старте (`hooks/useSrsWeightsSync.ts`, вызывается в `App`) в `utils/srsWeights.ts`; веса используются `pickCardBySRS`, порог — при записи ответа только если ученик включил соответствующую галочку в общих настройках. Порог по умолчанию — 1, диапазон — 1–10. Нет ответа сервера → действуют значения по умолчанию.
- При включённом пороге ящик повышается после заданного числа ответов подряд, но не чаще раза в день (`promotedOn`); ошибка обнуляет серию и возвращает карточку в ящик 1. Без клиентской галочки сохраняется прежнее повышение после первого верного ответа. `nextReview` = сейчас + `[0,1,3,7,14,30]` дней[ящик]. При выборе карточки `nextReview` учитывается только в режиме «только к повторению».
- **Режим «только к повторению»** (`studyPrefs.dueOnly`): `isDue` — новая карточка, ящик 1 (после ошибки) или `nextReview` наступил. Фильтр в `useSRSProgress.pickCard`; если пусто — `SRSIdleCard`.
- **Цель на день** (`studyPrefs.dailyGoal`): счётчик ответов за локальные сутки, инкремент в `useScores.recordAnswer`; чип в Navbar и полоса в «Статистике».
- **Синхронизация между устройствами** (`hooks/useSrsSync.ts`, `utils/srsSync.ts`): при Telegram-входе снимок SRS, счёт, ответы за день, цель, категории и аккаунтные настройки тренажёров синхронизируются по сессии. Тренажёры не монтируются до начальной загрузки настроек; аккаунтные настройки далее живут только в памяти клиента, отправляются на сервер после изменения и не кэшируются в `localStorage`. Локальные настройки устройства не используются для заполнения аккаунтного профиля. SRS/счёт и другие данные прогресса сохраняют локальный кэш. На устройстве кэш прогресса помечается `app_learner_profile_id`, чтобы не слить данные предыдущего аккаунта в новый. Повторные pull-запросы при возвращении во вкладку или восстановлении сети ограничены интервалом 30 секунд.

### Проверка ответов
`answerMatch.ts`: регистр, пробелы, Unicode-форма, `ae/oe/ue/ss` (настройка), `е/ё`. Числа: `parseTypedInteger`, `germanNumberVariants` (+`hundert`/`tausend`). Подсветка ошибок — LCS в `answerDiff.ts`.

### Хранилище браузера (localStorage)
| Ключ | Что |
|---|---|
| `words_srs_state`, `verbs_srs_state`, `articles_srs_state` | локальный кэш карточек SRS |
| `app_srs_reset_at` | когда тренажёры сбрасывались (для синхронизации) |
| `app_scores` | локальный кэш счёта по тренажёрам |
| `app_ui_settings` | панель умлаутов, ae/oe, фокус, клавиатура, подсказка категории, цвета артиклей, громкость озвучки |
| `theme` | тема |
| `app_daily_progress` | ответов за сегодня |
| `app_learner_profile_id` | Telegram-профиль, которому принадлежит локальный кэш синхронизируемого прогресса |
| `admin_last_word_category_id` | последняя категория в форме слова |

Тема (`theme`) и UI-параметры, включая громкость озвучки, являются устройственными и не синхронизируются аккаунтом. Направление/формы слов, режимы чисел/глаголов/времени, диапазон чисел, выбранные категории, флаги SRS и дневная цель принадлежат аккаунту; `onboardingSeen` хранится только в `LearnerProgress`. Настройки тренажёров не читаются и не записываются в `localStorage`; старые локальные значения не импортируются в аккаунт и удаляются при загрузке серверных настроек. Вход обязателен. SRS-карточки, счёт и ответы за день по-прежнему имеют отдельный локальный кэш.

`picture_draft` — временный черновик ответа в тренажёре картинок; он не считается прогрессом и очищается при выходе из аккаунта. `admin_last_word_category_id` также очищается при выходе, чтобы не раскрывать последнюю категорию следующему пользователю устройства.

Веса ящиков SRS в `localStorage` не хранятся — это серверная настройка. Настройки тренажёров хранятся только в аккаунте на сервере; локальные копии старых настроек игнорируются и удаляются.

Перенос прогресса между устройствами выполняется через Telegram-аккаунт; ручной экспорт и импорт прогресса удалены.

### PWA и офлайн
`manifest.webmanifest` + `sw.js` (регистрируется только в production). Версия кэшей Service Worker подставляется автоматически скриптом `frontend/scripts/build.mjs`: в CI используется GitHub SHA, локально — текущий Git commit, а без Git — timestamp. Поэтому ручное изменение `VERSION` не требуется. Стратегии: HTML — network-first; `/assets/*` — cache-first; `GET /api/words` и `/api/categories` — network-first с таймаутом 4 с и запасом из кэша (при изменении данных страницы получают `DICTIONARY_UPDATED` и перезагружают словарь); остальное не перехватывается (в том числе `/api/settings/*` и `/api/sync/*`: офлайн действуют веса по умолчанию, синхронизация ждёт сети). HTML-shell (`/` и `/index.html`) отдаётся с `Cache-Control: no-cache, no-store`, потому что он содержит имя текущего hashed JS-файла.
Новый воркер автоматически активируется через `useServiceWorkerUpdates`; после смены контроллера страница перезагружается, а после загрузки показывается исчезающее toast-уведомление об обновлении.

## Сборка и деплой
- Docker: `backend/Dockerfile` (Node `22.12.0-alpine3.20`, порт 3001, процесс запускается от непривилегированного `node`), `frontend/Dockerfile` (nginx), `packages/telegram-bot/Dockerfile` (long polling, без опубликованных портов). Backend-образ сначала собирает `@sprachfunke/shared` из TypeScript в CJS и ESM, затем backend; production-образ получает обе сборки пакета, а CommonJS backend использует CJS export condition. Образы собирает GitHub Actions (`deploy.yml`): PR выполняет backend build/tests, frontend typecheck/lint/tests/build и bot build/tests; push в `main` публикует все образы в GHCR с тегами `latest` и SHA коммита. Сервер получает готовые образы; секреты не являются build args.
- nginx: `/api/` → `app-backend:3001` (имя резолвится на каждый запрос), `client_max_body_size 6m`, таймауты прокси `proxy_connect_timeout 10s` / `proxy_send_timeout 120s` / `proxy_read_timeout 120s` (проверка описания картинки через Gemini может идти до ~60 с — без этого Cloudflare возвращал 502), `sw.js`/manifest без кэша, `/assets/` — год и `immutable`, остальное — SPA-fallback.
- Корневой `server.ts` — для dev и «одного процесса»: поднимает БД (`prisma db push` + seed в пустую), API, Vite или статику. Prisma-клиент берётся из `backend/node_modules`: в `backend/` выполните `npm install && npx prisma generate` (после любого изменения схемы — снова `prisma generate`; `npm run build` в `backend/` делает это сам).
- Новые таблицы (`Setting`, `Picture`) создаются автоматически через `prisma db push` при старте.

## Известные ограничения / идеи
- Legacy UI-ключ, `/sync/srs`, одноразовый импорт `legacyKey`, таблица `SyncProfile` и колонка `LearnerProgress.legacyKeyHash` удалены. При применении схемы `prisma db push` удаляет эти legacy-данные из БД.
- Основная чистая логика покрывается Vitest; frontend typecheck, ESLint и тесты запускаются из `frontend/`, backend ESLint/Prettier — из `backend/` (`npm run lint`, `npm run format`).
- `prisma db push --accept-data-loss` выполняется при каждом старте (`entrypoint.sh`, `npm start`, `server.ts`) — делайте бэкап БД перед изменением схемы.
- Метаданные вкладок централизованы в `frontend/src/config/tabs.ts`; отдельные списки в Navbar, routing и аналитике не создаются.
- Вкладка «Время» не ведёт счёт.
- Аналитика хранит IP и User-Agent в открытом виде (GDPR).
