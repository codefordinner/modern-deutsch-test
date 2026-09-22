#!/bin/sh
set -e

echo "[entrypoint] Applying database schema (prisma db push)..."
npx prisma db push --accept-data-loss --skip-generate

echo "[entrypoint] Starting server..."
exec node dist/index.js
