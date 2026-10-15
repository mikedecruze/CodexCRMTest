# Phase 1 validation

Validated in the cloud workspace with Node 24.19.0 and npm 11.9.0. The full master prompt is preserved; only the Phase 1 relationship workflow is implemented.

| Check | Result |
| --- | --- |
| API/domain/auth/persistence tests | 41 passed (32 API/domain, 8 simulated OIDC, 1 disk persistence) |
| Chromium browser workflows | 9 passed on isolated synthetic backend |
| TypeScript checks | Passed for frontend, server and Rayfin data definitions; strict mode |
| Vite production build | Passed |
| ESLint | Passed |
| Runtime dependency audit | Zero findings with `npm audit --omit=dev` |
| Live API/database readiness | Functional health response, authenticated API requests and `npm run smoke` verified |
| Clean installation and restart | `npm ci --cache /tmp/trove-npm-cache` passed; documented `npm run dev` restarted both services |
| Formatting | Prettier check passed |

Browser checks cover scoped directories/search, shared master profiles, family generations and households, graph zoom/filter/collapse, graph-to-profile navigation, old/new as-of ownership, person creation and membership, reload persistence, Associate and unassigned-user experiences, administrator group/household/entity/reference creation, narrow-screen layout, entering ownership changes, private advisor context and shared-entity association.

API checks cover direct unauthorized requests, role escalation attempts, session expiry/revocation, demo-mode isolation, current versus historical permissions, graph/search/audit leakage through shared records, valid and conflicting date intervals, ownership limits, duplicate/circular relationships, partial-write rollback, customer records without source IDs, assignment history, archive behavior and append-only audit. OIDC protocol checks use generated RSA keys and a simulated provider; **they do not verify a live Microsoft tenant**.

Initial scaffold SWC native binding failed on this machine. The frontend now uses the compatible @vitejs/plugin-react 5.x with Vite 7; package-lock.json records the working dependency graph. Browser checks exposed ambiguous form names and a fast tab/date navigation race; explicit control labels and preserved query updates resolve those cases.

The Microsoft CLI's development dependency graph contains the upstream moderate sprintf-js denial-of-service advisory through tedious. No patched sprintf-js release was available from the registry. The unused local-dev runtime dependency was removed so runtime dependencies have no reported findings. TLS, package integrity and signature verification remain enabled.

Not run: live Entra/Fabric authentication, Fabric schema apply, remote Functions/GraphQL authorization, datalake connectivity, or any Phase 2–5 financial/contract/workflow acceptance scenarios. Those capabilities are not represented as working. The Fabric build target is explicitly blocked until the adapter described in fabric-integration.md exists.
