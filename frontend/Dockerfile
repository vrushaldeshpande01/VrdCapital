FROM node:20-alpine AS base
WORKDIR /app

# Dependencies — copy only package.json to avoid Windows lockfile platform issues
FROM base AS deps
COPY package.json ./
RUN npm install

# Build — needs devDependencies (tsc, vite) so NODE_ENV must not be production
FROM deps AS builder
COPY . .
RUN npm run build

# Production — serve with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
