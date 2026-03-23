FROM debian:trixie-slim

WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      postgresql-client \
      ca-certificates \
      libheif1 \
    && rm -rf /var/lib/apt/lists/*

COPY app /app
COPY scripts /app/scripts

RUN chmod +x /app/orgbackend \
    && chmod +x /app/scripts/entrypoint.sh \
    && chmod +x /app/scripts/setup_database.sh

EXPOSE 8080 8082

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
