# Repository Guidelines

## Project Structure & Module Organization
FAELP is a multi-service monorepo:
- `organization_backend/`: Go API for organization workflows (`cmd/server`, `internal/*`, SQL migrations in `internal/db/migrations`).
- `distribution_backend/`: Go API for distribution workflows with parallel structure (`cmd/server`, `internal/*`, migrations).
- `frontend/user`, `frontend/orgadmin`, `frontend/distadmin`, `frontend/distribution`: Preact + TypeScript + Vite apps.
- `plans/` and `frontend/demo/`: planning and reference/demo artifacts, not production runtime code.

Keep new backend packages under each service's `internal/` tree and place frontend feature code in `src/components`, `src/pages`, `src/services`, and `src/context`.

## Build, Test, and Development Commands
Use the root `Makefile` for combined workflows:
- `make setup`: install Go/NPM dependencies and initialize both databases.
- `make dev`: run both backends and all frontends together.
- `make dev-org` / `make dev-dist`: run only one backend stack.
- `make build`: build all services and frontends.
- `make test`: run all Go tests (`go test ./...` in both backends).

Service-specific loops are available in `organization_backend/Makefile` and `distribution_backend/Makefile` (for example `make -C organization_backend run`).

## Coding Style & Naming Conventions
- Go: format with `gofmt` defaults (tabs, idiomatic package names, lowercase file names).
- TypeScript/Preact: keep components in `PascalCase` files (for example `MaterialCard.tsx`), hooks as `useX.ts`, and service modules in `src/services`.
- Use existing Tailwind utility patterns in each frontend's `src/index.css` and component files.
- Prefer small, focused packages/modules over large cross-cutting files.

## Testing Guidelines
- Primary automated tests are Go tests; add `*_test.go` files adjacent to the code under test.
- Run `make test` before opening a PR.
- For API behavior checks, update or run shell helpers like `organization_backend/test_endpoints.sh` when relevant.
- Frontend test tooling is not yet standardized; include manual verification steps in PRs for UI changes.

## Commit & Pull Request Guidelines
- Follow the existing history style: short, imperative, descriptive commit subjects (for example `fix cors proxy for dev`, `add global makefile`).
- Keep commits scoped to one concern.
- PRs should include:
  - what changed and why,
  - affected modules (for example `organization_backend/internal/api`),
  - verification steps/commands,
  - screenshots or short recordings for frontend UI changes.
