# Production Deployment (Single Host)

This repository currently expects org and dist backends to communicate via Unix sockets, so both services should run on the same host with a shared socket volume.

## 1) Create local deployment secret files (gitignored)

Create these files on your machine:

- `deployment/orgbackend/.env.dev`
- `deployment/distbackend/.env.dev`

When present, `make deploy-org` / `make deploy-dist` copies them into the packaged container folders as `.env`.

## 2) Build deployment bundles

From repo root:

```bash
make deploy-org deploy-dist
```

This refreshes:

- `deployment/orgbackend/container`
- `deployment/distbackend/container`

If `.env.dev` files do not exist, packaging falls back to template defaults.

## 3) Configure runtime env files

Ensure these files exist and are correct:

- `deployment/orgbackend/container/.env`
- `deployment/distbackend/container/.env`

Minimum production requirements:

- Org: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, strong `JWT_SECRET`, DB credentials
- Dist: strong `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, DB credentials
- Optional upload paths:
  - Org: `ORG_UPLOAD_PATH` (defaults to `/app/uploads`)
  - Dist: `DIST_UPLOAD_PATH` (defaults to `/app/uploads`)

## 4) Start full stack

From `deployment/`:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

## 5) Verify health

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8081/health
```

## 6) Reverse proxy

Expose only your reverse proxy publicly, and proxy to:

- org user/API: `127.0.0.1:8080`
- org admin: `127.0.0.1:8082`
- dist user/API: `127.0.0.1:8081`
- dist admin: `127.0.0.1:8083`

## Optional: Build a transfer tarball

From repo root:

```bash
make package-release
```

This creates `deployment/releases/faelp_deployment_<timestamp>.tar.gz` containing:

- `deployment/orgbackend/container`
- `deployment/distbackend/container`
- `deployment/docker-compose.production.yml`
- `deployment/PRODUCTION.md`

## Notes

- `entrypoint.sh` in each backend auto-runs DB bootstrap and will auto-generate `JWT_SECRET` only when it is missing or placeholder (`replace-me`).
- Backend binaries still run migrations at startup; keep migration files and binary versions aligned in each release.
- Production compose now mounts persistent upload volumes (`org-uploads`, `dist-uploads`) so uploaded/synced images survive container recreation.
