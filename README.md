# Trove Relationship Manager

A functioning **Phase 1 development application**, built from Microsoft's Rayfin 1.36.2 React/TypeScript scaffold. It uses a persistent local API and **synthetic data only**. No MS Fabric datalake is connected.

## Run locally

Prerequisite: **Node.js 24 LTS** and npm. From the repository root:

```sh
npm ci
npm run dev
```

The frontend runs on port **5173** and the local API on **3001**. The sign-in screen explicitly identifies demo authentication. Choose an employee to explore team access:

| Demo employee                | Access                                          |
| ---------------------------- | ----------------------------------------------- |
| Elizabeth Morgan             | Administrator; all three families               |
| James Carter                 | Manager; Smith and Bennett families             |
| Diana Brooks / Oliver Chen   | Director / Senior; Smith and Bennett families   |
| Sophia Reed                  | Associate; read-only Smith and Bennett families |
| William Hayes / Ava Thompson | Partner / Manager; Carter family                |
| Noah Bennett                 | No assigned Client Groups                       |

Changes persist in ignored `.data/trove.sqlite`. Seed initialization is transactional and idempotent. Restarting does not erase saved records. Tests use isolated databases. Never enter real client data into demo mode.

## Implemented

- Client Group creation/editing, status/archive, required primary assignments and assignment history.
- Reusable people, legal entities and advisor organizations, with UUID identities and optional billing designation independent of accounting IDs.
- Three seeded families, five households, several generations, trusts/LLCs, shared entities and advisors, professional affiliations and historical ownership.
- Effective-dated household memberships, group associations, advisor scopes and relationship edges.
- Interactive family and entity diagrams: selection, zoom/pan, branch collapse, relationship filtering and historical as-of dates.
- Ownership changes preserve prior intervals; relationships and household memberships can end without deletion.
- Group-private notes, server-side team authorization, read-only Associates, scoped search and audit, admin reference definitions and team membership grants.
- Bounded/paginated directories, saved filters scoped to the current user, profile drawers, and responsive layouts.
- Entra OIDC code-flow implementation with PKCE, nonce/state, JWS signature validation and pre-provisioned employee mapping. Its protocol behavior is tested against a simulated identity provider; **a real tenant sign-in has not been tested**.

## Verify

```sh
npm test           # API, authorization, temporal invariants, persistence and OIDC protocol tests
npm run test:e2e   # Chromium browser workflows against an isolated backend
npm run build     # frontend, server and Rayfin schema typechecks; Vite production bundle
npm run lint
npm run smoke      # functional readiness of the running local demo
```

Playwright uses `/usr/bin/chromium` when available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your installed Chromium executable. The browser runner uses ports 5174/3002 and an in-memory database; it does not modify the development database.

`npm run preview` previews the static build only; the local API must also be running and routed under `/api` and `/auth`. Use `npm run dev` for the complete local workflow.

## Scope and integration status

The full user-supplied requirements are retained in [docs/master-build-prompt.md](docs/master-build-prompt.md). Phase 2 financials/source mapping, Phase 3 contracts and Phase 4 workflow/activities are intentionally deferred. Financial or workflow seed values have not been introduced before their modules.

The current executable backend is **Node/SQLite**, not a Fabric Function or Warehouse. The Rayfin model definitions compile and deny direct GraphQL access by default. The scaffold's supported Fabric authentication adapter is retained separately, but the working UI calls the local API. A supported Fabric repository/Functions adapter, tenant provisioning and deployed authorization validation remain required before Fabric deployment. `build:fabric` deliberately fails with that explanation; it cannot accidentally publish a nonfunctional or insecure demo bundle.

For non-demo authentication, run `server/index.ts` with `TROVE_DEMO` unset and supply these securely:

- `TROVE_ORIGIN`: exact HTTPS application origin.
- `TROVE_ENTRA_TENANT_ID`, `TROVE_ENTRA_CLIENT_ID`, `TROVE_ENTRA_CLIENT_SECRET`.
- `TROVE_ENTRA_REDIRECT_URI`: the registered HTTPS `/auth/callback` URI.
- `TROVE_DB_PATH`: separately provisioned local adapter database; do not reuse demo identities as real employees.

The API binds to loopback and expects an HTTPS reverse proxy routing `/api` and `/auth`. Employees must be provisioned with `subject = tenantId:objectId`; authentication never creates employees or grants app roles from token claims. No actual tenant/app credentials or source identifiers have been supplied. See [docs/security.md](docs/security.md) and [docs/fabric-integration.md](docs/fabric-integration.md).

## Repository guide

- `src/pages`: Home, directories, Client Group profile and administration.
- `src/components`: forms, profile drawer, interactive diagrams and UI primitives.
- `server`: normalized SQLite schema, transactional domain service, access controls, auth and synthetic seed.
- `shared/types.ts`: typed UI/API contracts.
- `rayfin/data`: supported decorator-based entities and explicit junctions, with direct access denied.
- `docs`: architecture, ERD, security, deferred integrations, scope and open decisions.

Effective dates use inclusive starts and exclusive ends. Current access rights govern historical views. The default business date uses America/New_York. Indirect ownership is displayed as a chain and is never automatically calculated.
