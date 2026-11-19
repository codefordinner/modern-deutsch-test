# Примеры production-конфигурации Telegram-входа

Эти файлы — **шаблоны**, они не являются установленными Quadlet units и не меняют сервер сами по себе. При read-only проверке 19 ноября 2026 на сервере обнаружены Podman 5.8.4, rootless Quadlet в `~/.config/containers/systemd`, существующий `backend.container` (unit `backend.service`), `app-net`, GHCR owner `codefordinner` и включённый пользовательский `podman-auto-update.timer`. Сверить это повторно перед применением: состояние сервера могло измениться.

**Важно:** frontend/backend Quadlet уже используют `AutoUpdate=registry`, а пользовательский auto-update timer включён. Push в `main` публикует `latest` и может автоматически обновить production без SSH deploy workflow. Не отправлять auth-изменения в `main` до подготовки runtime secrets, резервной копии SQLite и согласованного окна обновления всех образов.

## Бот

`telegram-bot.container.example` описывает отдельный общий бот Sprachfunke без опубликованных портов, тома SQLite и сборки на сервере. Сейчас включён только handler авторизации; новые функции следует добавлять отдельными обработчиками. Бот подключается к уже существующей сети `app-net` и обращается к backend по `http://app-backend:3001`. Зависимость `backend.service` соответствует текущему Quadlet `backend.container`.

Шаблон использует Quadlet `Secret=...type=env`, поддерживаемый проверенной версией Podman 5.8.4. Создать Podman secrets из защищённых файлов, содержащих только значения, без вывода самих значений в консоль или журнал. Bot token и bot-to-backend secret — разные secrets.

## Backend

`backend.container.d/telegram-auth.conf.example` — шаблон drop-in для текущего backend unit. После создания secrets его можно установить как `~/.config/containers/systemd/backend.container.d/telegram-auth.conf`; перезапуск backend production-контейнера требует согласованного окна. Runtime secrets:

- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_BOT_API_SECRET`;
- `TELEGRAM_AUTH_PEPPER`.

Обычные несекретные env: `TELEGRAM_BOT_USERNAME`, `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=300`, `TELEGRAM_SESSION_TTL_SECONDS=2592000`, `TELEGRAM_COOKIE_SECURE=true`. Нельзя печатать секреты через `systemctl show`, shell tracing, workflow или логи. Если значения передаются env-файлом, файл должен быть недоступен другим пользователям.

`TELEGRAM_AUTH_REQUIRED=true` включает обязательный gate на тренажёры. Пока флаг выключен (default), старый backend и frontend работают без входа; это нужно для безопасного порядка обновления, но не является целевой production-конфигурацией.

Не добавлять второй backend unit и не менять `telegram-userbot-dm`. Бот не получает `DATABASE_URL`, SQLite volume или наружный порт.

## Обновление и схема

GitHub Actions публикует три образа с `latest` и SHA. Использовать существующий автообновляющий механизм; не добавлять SSH-деплой без отдельного решения. Для ручного обновления применять согласованный SHA для всех трёх образов.

Для согласованного rollout сначала подготовить secrets и backend drop-in, затем backup и migration plan. Обновить backend единственным экземпляром, проверить auth API, после этого обновить frontend и запустить bot unit. Обновление трёх контейнеров не атомарно; при необходимости заранее согласовать временную приостановку пользовательского auto-update timer.

Схема меняется только новыми таблицами, но текущий backend entrypoint запускает `prisma db push --accept-data-loss`. Перед production-применением обязательны backup SQLite, остановка единственного backend, просмотр schema diff и подтверждение. Не запускать два backend и не собирать образы на сервере.

## Откат

Остановить bot unit, вернуть предыдущие SHA frontend/backend/bot и запустить один backend. Не удалять auth-таблицы при откате кода. Восстанавливать SQLite из backup только при остановленных writers и после оценки записей, возникших после создания backup.
