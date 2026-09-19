FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "dist/index.js"]
