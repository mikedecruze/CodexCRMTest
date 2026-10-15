# Phase 1–2 validation

Validated in the cloud workspace with Node 24.19.0 and npm 11.9.0. The full master prompt is preserved. Phase 1 relationships and Phase 2 historical financials run against persistent synthetic local data; real Fabric connectivity remains deferred.

| Check                             | Result                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| API/domain/auth/persistence tests | 71 passed: 32 relationship/API, 30 financial, 8 simulated OIDC, 1 disk persistence                                          |
| Chromium browser workflows        | 17 passed against an isolated in-memory synthetic backend (9 Phase 1 regressions, 8 Phase 2 financial workflows)            |
| TypeScript checks                 | Passed for strict frontend/server and Rayfin data definitions                                                               |
| Vite production bundle            | Passed                                                                                                                      |
| ESLint and Prettier check         | Passed                                                                                                                      |
| Live running application          | `npm run smoke` passed for authentication, directory/profile, graph scoping and financial history                           |
| Additive upgrade                  | Existing Phase 1 database gained Phase 2 history once, preserving user records; repeated seed and override retention tested |

Financial tests exercise independent business/recorded time; immutable source corrections; source-versus-override attribution and withdrawal; exact period scope; component-based margins and zero-revenue handling; no ARR double counting; complete-month staffing averages/annualized equivalents and missing-month coverage; recorded-time conventions; independent service history; explicit mappings, duplicate-name review, idempotent imports, source revision conflicts and invalid-row quarantine; current profitability grants/revocation; group access, restricted histories/audits and aggregate report redaction; calendar-quarter period totals; and authorized net-worth distributions.

Browser financial workflows exercise the Known at selector, source revision/override inspector, raw staffing history, actual eight-point quarterly response, permitted and restricted profitability, override creation/withdrawal, mock import administration, convention changes, service-status transitions and active-service cohort filtering. Phase 1 browser coverage remains in place for directories/search, shared masters, family and ownership graphs, creation/editing, admin lookup definitions and narrow-screen navigation.

The initial scaffold's SWC native binding failed on this machine. The frontend uses compatible @vitejs/plugin-react 5.x with Vite 7. Phase 1 checks exposed ambiguous control names and a tab/date navigation race; explicit labels and preserved query updates resolve them. Phase 2 renders a loading state when the requested knowledge/filter/granularity differs from the loaded series, so a monthly dataset cannot be relabeled as quarterly while a request is pending.

At the Phase 1 dependency validation, `npm audit --omit=dev` reported zero runtime findings. Phase 2 adds no dependencies. The Microsoft CLI development graph contains the documented upstream moderate sprintf-js precision-specifier denial-of-service advisory through tedious, with no patched package available from the registry at validation. TLS, integrity and signature verification remain enabled.

Not run: live Microsoft tenant sign-in, Fabric schema apply, deployed Functions/GraphQL authorization, real warehouse/datalake ingestion, or Phase 3–5 contracts/workflow acceptance scenarios. Those capabilities are not represented as working. The Fabric build target remains guarded until the secured adapter in fabric-integration.md exists.
