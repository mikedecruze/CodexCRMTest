# Trove Relationship Manager

A functioning **Phase 1–2 development application**, built from Microsoft's Rayfin 1.36.2 React/TypeScript scaffold. It uses a persistent local API and **synthetic data only**. No MS Fabric datalake is connected.

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

## Phase 2 financials

Open a Client Group → **Financial Overview**. The primary as-of date selects business time; **Known at** limits what had been recorded. The initial mock history spans January 2024–September 2026. A useful example is Smith Family at 2025-12-31: Family Office ARR is $286,000 at knowledge date 2026-01-07, an attributed $315,000 override at 2026-01-20, and a separately preserved $290,000 source correction at 2026-02-05.

- Immutable source observations, source revisions and append-only attributed overrides/withdrawals.
- Monthly and quarterly trends/tables, component-based margins, source-defined mock realization and separate monthly-average/annualized staffing hours.
- Effective-dated service status independent of ARR, with explicit quality warnings.
- Reporting by authorized family/team/Partner/RM/active service line, including ARR, net worth distribution and permitted profitability.
- Financial Administration for explicit source mappings, unmatched records, idempotent mock imports, exceptions, service-line categories, staffing conventions and profitability grants.

James Carter can view profitability as the assigned Relationship Manager; Diana Brooks qualifies as a Director. Oliver Chen and Sophia Reed can view general financials but cannot receive margin or labor-cost data without an explicit financial scope. Grants also require underlying group authorization. Administrator status alone does not grant profitability.

The connector framework is an application-owned read interface with a verified mock implementation. No warehouse connection, production table name, cost rate or realization formula is invented. See [docs/financial-metrics.md](docs/financial-metrics.md) and [docs/source-mapping.md](docs/source-mapping.md).

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

The full user-supplied requirements are retained in [docs/master-build-prompt.md](docs/master-build-prompt.md). Phase 2 financials/source mapping are implemented using a mock read-only adapter. Phase 3 contracts and Phase 4 workflow/activities remain deferred. Existing Phase 1 databases are upgraded additively; financial seed history is inserted once without resetting user records.

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
- `server`: normalized SQLite schema, transactional domain service, access controls, auth and synthetic seed. `server/financial` owns temporal metrics, mock ingestion and financial routes.
- `shared/types.ts` and `shared/financial.ts`: typed UI/API contracts.
- `rayfin/data`: supported decorator-based entities and explicit junctions, with direct access denied.
- `docs`: architecture, ERD, security, deferred integrations, scope and open decisions.

Effective dates use inclusive starts and exclusive ends. Current access rights govern historical views. The default business date uses America/New_York. Indirect ownership is displayed as a chain and is never automatically calculated.
