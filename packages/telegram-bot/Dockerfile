FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/telegram-bot/package.json ./packages/telegram-bot/package.json
RUN npm ci --workspace @sprachfunke/telegram-bot --include-workspace-root=false
COPY packages/telegram-bot ./packages/telegram-bot
RUN npm --workspace @sprachfunke/telegram-bot run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/telegram-bot/package.json ./packages/telegram-bot/package.json
RUN npm ci --omit=dev --workspace @sprachfunke/telegram-bot --include-workspace-root=false
COPY --from=builder /app/packages/telegram-bot/dist ./packages/telegram-bot/dist
WORKDIR /app/packages/telegram-bot
USER node
CMD ["node", "dist/index.js"]
