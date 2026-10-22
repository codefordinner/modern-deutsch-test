# ARCHITECTURE.md

## Структура репозитория
```
/
├─ server.ts                 dev/prod-сервер: API + (Vite middleware | статика frontend/dist)
├─ package.json              корневые скрипты (dev/build/start/lint)
├─ .nvmrc, .env.example      Node 22; ADMIN_PASSWORD, JWT_SECRET, ALLOWED_ORIGINS, DATABASE_URL, STATS_TIMEZONE
├─ .github/workflows/        CI: сборка backend+frontend, push Docker-образов в GHCR
├─ backend/
│  ├─ prisma/schema.prisma   Category, Word, AnalyticsEvent (SQLite)
│  ├─ prisma/seed.ts         стартовые категории/слова (только в пустую БД)
│  ├─ entrypoint.sh          prisma db push → node dist/index.js
│  └─ src/
│     ├─ index.ts            отдельный запуск бэкенда (порт 3001, за nginx)
│     ├─ api.ts              сборка роутера /api (порядок монтирования важен)
│     ├─ db.ts               PrismaClient
│     ├─ middleware/         auth (JWT, cookie), csrf (Origin/Referer), normalizeWordBody
│     ├─ routes/             auth, words, words-admin, categories, analytics
│     └─ services/           partOfSpeech, wordImport, hilfsverb, backfillPartOfSpeech
└─ frontend/
   ├─ nginx.conf, Dockerfile статика + прокси /api → app-backend:3001
   ├─ public/                favicon, manifest.webmanifest, sw.js, icons/
   └─ src/
      ├─ main.tsx, App.tsx   вход, вкладки, тема, счёт
      ├─ types.ts            общие типы
      ├─ api/                client.ts (весь HTTP), queryCache.ts (кэш запросов)
      ├─ hooks/              useDictionary, useSRSProgress, useScores, useHashRoute,
      │                      useUISettings, use{Words,Verbs}QuizEngine
      ├─ utils/              чистая логика (см. ниже)
      ├─ components/         Navbar, *Trainer, admin/, words/, verbs/, numbers/, time/,
      │                      articles/, srs/, Modal, FeedbackBox, …
      └─ styles/             components.css, import-export.css, features.css, mobile.css
```

## Модель данных
- **Category** `{id, name, icon, color, isBuiltin}` — 1:N **Word** (каскадное удаление).
- **Word** `{de, ru, hint, partOfSpeech, plural, feminine, femininePlural, praeteritum, partizip2, hilfsverb ('haben'|'sein'), praesens{Ich,Du,ErSieEs,Wir,Ihr,Sie}, categoryId}`.
  `partOfSpeech` ∈ noun|verb|adjective|adverb|other (валидируется в API; пусто → выводится `inferPartOfSpeech`).
- **AnalyticsEvent** `{eventType: visit|tab_switch|quiz_answer, trainerType, isCorrect, ipAddress, userAgent, timestamp}`.
- Прогресс ученика **не хранится на сервере**: SRS, счёт и настройки лежат в `localStorage` браузера.

## Backend
- Express 4, JSON-лимит 5 МБ (массовый импорт).
- **Аутентификация админа**: пароль → JWT (HS256, 24 ч) в HttpOnly-cookie (+ заголовок `Authorization: Bearer` как запасной вариант). `requireAdmin` защищает мутации и админские чтения.
- **CSRF**: `requireSameOrigin` для не-GET: `Origin`/`Referer` должен совпасть с `Host`/`X-Forwarded-Host` или `ALLOWED_ORIGINS`.
- Порядок в `api.ts`: csrf → auth → `normalizeWordBody` (ist/hat → sein/haben) → `words-admin` → `words` → categories → analytics.
- **words-admin**: `POST /words/bulk/{category,part-of-speech,delete}`, `GET /words/duplicates`, `POST /words/duplicates/merge`, `POST /words/import/preview`.
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
| Слова | `WordsTrainer` | `useWordsQuizEngine`, SRS-карточка = слово×направление×форма |
| Артикли | `ArticlesTrainer` | `utils/articles.ts`; карточка = существительное с артиклем; клавиши 1/2/3 |
| Глаголы | `VerbsTrainer` | `useVerbsQuizEngine`, `verbCards.ts` (единый список карточек) |
| Время | `TimeTrainer` | `time-generator.ts`, флэш-карточки без счёта (режима ввода нет; проверка ответа не реализована) |
| Админка | `AdminPanel` (lazy) | слова (массовые действия), категории, импорт/экспорт + проверка, дубликаты, аналитика |

### SRS (Лейтнер)
- 5 ящиков; веса выбора ящика `[60,15,10,5,10]` (`SRS_BOX_WEIGHTS`), пустые ящики пропускаются.
- Верный ответ: +1 ящик, не чаще раза в день; ошибка → ящик 1. `nextReview` = сейчас + `[0,1,3,7,14,30]` дней[ящик].
- **Режим «только к повторению»** (`studyPrefs.dueOnly`): `isDue` — новая карточка, ящик 1 (после ошибки) или `nextReview` наступил. Фильтр в `useSRSProgress.pickCard`; если пусто — `SRSIdleCard`.
- **Цель на день** (`studyPrefs.dailyGoal`): счётчик ответов за локальные сутки, инкремент в `useScores.recordAnswer`; чип в Navbar и полоса в «Статистике».

### Проверка ответов
`answerMatch.ts`: регистр, пробелы, Unicode-форма, `ae/oe/ue/ss` (настройка), `е/ё`. Числа: `parseTypedInteger`, `germanNumberVariants` (+`hundert`/`tausend`). Подсветка ошибок — LCS в `answerDiff.ts`.

### Хранилище браузера (localStorage)
| Ключ | Что | В бэкапе |
|---|---|---|
| `words_srs_state`, `verbs_srs_state`, `articles_srs_state` | карточки SRS | да |
| `words_use_srs`, `verbs_use_srs`, `articles_use_srs` | SRS вкл/выкл | да |
| `app_scores` | счёт по тренажёрам | да |
| `app_ui_settings` | панель умлаутов, ae/oe, клавиатура | да |
| `app_study_prefs` | dueOnly, dailyGoal | да |
| `theme`, `verbs_praesens_submode` | тема, подрежим | да |
| `app_daily_progress` | ответов за сегодня | нет |
| `admin_token` | токен админа (запасной канал) | нет |
| `admin_last_word_category_id` | последняя категория в форме | нет |

Перенос между устройствами: «Настройки» → «Скачать/Загрузить» (`utils/progressBackup.ts`, JSON `{app, version, exportedAt, data}`; загрузка **заменяет** прогресс и перезагружает страницу).

### PWA и офлайн
`manifest.webmanifest` + `sw.js` (регистрируется только в production). Стратегии: HTML — network-first; `/assets/*` — cache-first; `GET /api/words` и `/api/categories` — network-first с запасом из кэша; остальное не перехватывается. Иконки — `public/icons/`. Офлайн работают все тренажёры на последнем загруженном словаре; прогресс и так локальный.

## Сборка и деплой
- Docker: `backend/Dockerfile`, `frontend/Dockerfile` (nginx), образы собирает GitHub Actions (`deploy.yml`) в GHCR.
- nginx: `/api/` → бэкенд, `sw.js`/manifest без кэша, `/assets/` — год и `immutable`, остальное — SPA-fallback.
- Корневой `server.ts` — для dev и «одного процесса»: поднимает БД (`prisma db push` + seed в пустую), API, Vite или статику.

## Известные ограничения / идеи
- Нет серверных аккаунтов: прогресс переносится только файлом.
- Нет автотестов и ESLint в `package.json` (конфиг есть).
- `utils/analytics.ts` удалён — используйте `trackEvent` из `api/client.ts`.
- Метка вкладки «Артикли» в `AnalyticsTab.tabLabels` пока не добавлена (показывается ключ `articles`).
- Токен админа дублируется в `localStorage` (`admin_token`) — это ослабляет HttpOnly-cookie; кандидат на удаление.
- Аналитика хранит IP и User-Agent в открытом виде (GDPR).
