# Requires a pre-built frontend image (see build.sh). Override with:
#   docker build --build-arg FRONTEND_IMAGE=...
ARG FRONTEND_IMAGE=projecth-frontend:local
FROM ${FRONTEND_IMAGE} AS frontend

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

COPY --from=frontend /dist /usr/share/nginx/html

EXPOSE 80
ENV PORT=8000

ENTRYPOINT ["/entrypoint.sh"]
