FROM node:22-alpine AS builder
WORKDIR /app
ARG BUILD_VERSION=local
ENV BUILD_VERSION=$BUILD_VERSION
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Rendered into /etc/nginx/conf.d/default.conf by the image entrypoint (envsubst).
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
