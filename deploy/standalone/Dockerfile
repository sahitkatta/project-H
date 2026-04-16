# Single multi-stage image: Node builds the Vite app, then Python + nginx serve API + static files.
# Build from repo root: docker build -f deploy/standalone/Dockerfile -t projecth-app:local .

# Debian (glibc), not Alpine: Vite/Rollup ship optional native binaries; musl on Alpine often
# breaks in CI with MODULE_NOT_FOUND in rollup/dist/native.js. Render uses linux/amd64 + glibc.
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app
# Render (and many CI systems) set NODE_ENV=production during `docker build`. That makes
# `npm ci` skip devDependencies — but we need them to run `tsc` and `vite build`.
ENV NODE_ENV=development
COPY frontend/package*.json ./
RUN npm ci --include=dev
COPY frontend/ ./
# 1) COPY can overlay a host node_modules (wrong OS/libc) if context includes it.
# 2) npm optional-deps bug (npm/cli#4828) can leave Rollup loading *-musl on glibc images.
RUN rm -rf node_modules && npm ci --include=dev \
    && ROLLUP_VER=$(node -p "require('rollup/package.json').version") \
    && if [ "$(uname -m)" = "aarch64" ]; then npm install "@rollup/rollup-linux-arm64-gnu@${ROLLUP_VER}" --no-save; \
    else npm install "@rollup/rollup-linux-x64-gnu@${ROLLUP_VER}" --no-save; fi
ENV NODE_ENV=production
RUN npm run build

FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

COPY deploy/standalone/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/standalone/supervisord.conf /etc/supervisord.conf
COPY deploy/standalone/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80
ENV PORT=8000

ENTRYPOINT ["/entrypoint.sh"]
