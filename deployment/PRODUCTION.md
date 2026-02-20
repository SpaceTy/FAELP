# Production Deployment (Single Host)

This repository currently expects org and dist backends to communicate via Unix sockets, so both services should run on the same host with a shared socket volume.

## 1) Build deployment bundles

From repo root:

```bash
make deploy-org deploy-dist
```

This refreshes:

- `deployment/orgbackend/container`
- `deployment/distbackend/container`

## 2) Configure runtime env files

Edit:

- `deployment/orgbackend/container/.env`
- `deployment/distbackend/container/.env`

Minimum production requirements:

- Org: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, strong `JWT_SECRET`, DB credentials
- Dist: strong `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, DB credentials

## 3) Start full stack

From `deployment/`:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

## 4) Verify health

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8081/health
```

## 5) Reverse proxy

Expose only your reverse proxy publicly, and proxy to:

- org user/API: `127.0.0.1:8080`
- org admin: `127.0.0.1:8082`
- dist user/API: `127.0.0.1:8081`
- dist admin: `127.0.0.1:8083`

## Notes

- `entrypoint.sh` in each backend auto-runs DB bootstrap and will auto-generate `JWT_SECRET` only when it is missing or placeholder (`replace-me`).
- Backend binaries still run migrations at startup; keep migration files and binary versions aligned in each release.
