# Microsoft Fabric integration boundary

Verified against npm-published Microsoft 1.36.2 packages and their bundled docs on 2026-10-14. The scaffold is official `npm create @microsoft/rayfin@1.36.2 -- . --template todoapp`. Microsoft Learn was blocked by the environment proxy (403); official version-locked package docs were readable. @microsoft/rayfin is not the SDK package; create-rayfin, rayfin-cli, rayfin-core and rayfin-client are the actual packages.

Read node_modules/@microsoft/rayfin-guide/assets/docs/known-limitations.md, data/permissions.md, auth/fabric.md and rayfin-core/assets/docs/decorators.md. Only built-in anonymous/authenticated roles are documented; do not invent multi-table team-membership policy APIs. No native many-to-many: use explicit junction entities. String fields have explicit max lengths. TC39 decorators only.

`rayfin/data` contains deny-by-default entity definitions for the Phase 1 model. They compile locally; no remote schema was applied. Fabric auth adapter is preserved from the scaffold as a separately checked SDK integration surface. The running local React application talks to the local API, not Fabric GraphQL.

Before Fabric deployment: obtain a workspace/item and supported hosting capability; port repository/transaction operations to supported Fabric Functions + CRM data storage; authorize every Function with current employee/team grants; expose no direct unrestricted GraphQL access; wire the typed Rayfin client to those Functions; validate shared-record isolation against real DAB policy and connector behavior. Run `npx rayfin up` and `npx rayfin up status` only after that work and tenant access are available. The build:fabric target intentionally fails until the adapter is implemented to prevent accidental deployment of a demo API-dependent bundle.

Future datalake sources remain read-only and unmapped. No warehouse, semantic-model, table, field, workspace, item or connector identifiers are fabricated. Phase 2 will inspect the real schemas and record explicit approved mappings.
