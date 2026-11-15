FROM node:22-alpine AS builder
WORKDIR /app
ARG BUILD_VERSION=local
ENV BUILD_VERSION=$BUILD_VERSION
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci
COPY frontend ./frontend
COPY packages/shared ./packages/shared
RUN npm --prefix frontend run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
# Rendered into /etc/nginx/conf.d/default.conf by the image entrypoint (envsubst).
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
