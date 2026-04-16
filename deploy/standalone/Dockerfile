# Single multi-stage image: Node builds the Vite app, then Python + nginx serve API + static files.
# Build from repo root: docker build -f deploy/standalone/Dockerfile -t projecth-app:local .

FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
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
