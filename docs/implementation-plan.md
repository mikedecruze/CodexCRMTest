# Implementation plan

## Completed: Phase 1 relationships

Official Rayfin scaffold and version-matched docs inspected; normalized relationship model, synthetic seed, authentication/session adapter, transactional domain operations and current team access implemented. Directories, profiles, search, household and ownership graphs, creation/editing, effective history and audit are validated.

## Completed locally: Phase 2 historical financials

See phase-2-plan.md. Additive financial schema and catalog, immutable observations/corrections, attributed override/withdrawal events, business/recorded time, matching-period margin calculations, complete-month staffing, source-defined realization, independent service history, explicit source mappings, read-only mock ingestion and import exceptions are implemented. Financial profile/history, portfolio reports, source administration, configurable service categories/conventions and explicit profitability scope are wired to backend checks.

Validation covers server/domain/auth/persistence, browser workflows, strict typechecks, production bundle, lint, formatting and live functional readiness. See validation.md for results and limits. No real Fabric schema or tenant deployment is claimed.

## Deferred

Real Fabric adapter activation requires actual source schema/measure discovery, approved identities, supported deployed Functions/data operations and authorization proof. Phase 3 contracts, Phase 4 service coordination/recurrence and Phase 5 enhancements remain outside the implemented scope.
