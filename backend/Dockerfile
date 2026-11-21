FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/telegram-bot/package.json ./packages/telegram-bot/package.json
RUN npm ci

COPY backend ./backend
COPY packages/shared ./packages/shared
RUN npm --prefix backend run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/telegram-bot/package.json ./packages/telegram-bot/package.json
RUN npm ci --omit=dev

WORKDIR /app/backend
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/packages/shared /app/packages/shared
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

COPY backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER node

EXPOSE 3001
CMD ["./entrypoint.sh"]
