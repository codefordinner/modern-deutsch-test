# Deutsch Trainer

Тренажёр немецкого языка для русскоязычных: числительные, слова, артикли, глаголы, время.
Интервальное повторение по Лейтнеру (SRS), админка словаря, синхронизация прогресса между устройствами, PWA.

- Архитектура: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Правила для разработчиков и ИИ-агентов: [AGENTS.md](./AGENTS.md)

## Быстрый старт (dev)

Нужен Node 22 (`.nvmrc`).

```bash
npm install                                   # в корне
(cd frontend && npm install)
(cd backend && npm install && npx prisma generate)
npm run dev                                   # http://localhost:3000 (API + Vite)
```

При первом запуске создаётся SQLite-база `dev.db` и заполняется стартовыми словами.
Админка: вкладка «Админка», пароль из `ADMIN_PASSWORD` (по умолчанию `admin` — только для разработки).
Переменные окружения — см. `.env.example`.

## Сборка и деплой

`npm run build` в `frontend/` и `backend/`; образы собирает GitHub Actions (`.github/workflows/deploy.yml`) в GHCR.
