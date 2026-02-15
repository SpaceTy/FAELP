FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      postgresql-client \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY app /app
COPY scripts /app/scripts

RUN chmod +x /app/distbackend \
    && chmod +x /app/scripts/entrypoint.sh \
    && chmod +x /app/scripts/setup_database.sh

EXPOSE 8081 8083

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
