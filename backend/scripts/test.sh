#!/bin/sh
set -eu

database_file="$(mktemp "${TMPDIR:-/tmp}/sprachfunke-backend-test-XXXXXX.db")"
trap 'rm -f "$database_file" "$database_file-wal" "$database_file-shm"' EXIT HUP INT TERM

export DATABASE_URL="file:$database_file"
export TELEGRAM_AUTH_PEPPER="test-pepper-with-sufficient-length-0123456789"
export TELEGRAM_BOT_API_SECRET="test-internal-secret-with-sufficient-length"
export TELEGRAM_BOT_TOKEN="test-telegram-bot-token"
export TELEGRAM_BOT_USERNAME="test_sprachfunke_bot"

npx prisma db push --schema prisma/schema.prisma --skip-generate
npx tsx --test src/services/*.test.ts src/routes/*.test.ts
