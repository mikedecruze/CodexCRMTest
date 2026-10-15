# Phase 2 — historical financials

Extend the existing local adapter using additive schema changes. Preserve all Phase 1 records and seeded/user changes. Only synthetic, read-only mock Fabric datasets are enabled; no production schemas, identifiers or calculation definitions are invented.

## Metric conventions

- All amounts are USD. Monetary inputs use at most two decimal places; aggregations use integer cents. No FX assumptions.
- Snapshot ARR/net worth resolve the latest eligible business-effective observation, not sums across dates. ARR sums service-line slices once; an imported family total is only a fallback when no service-line slices exist.
- Revenue/cost are completed monthly measurements with [periodStart, periodEnd) dates. Margin = matching-period revenue minus source-supplied labor cost; margin percentage divides those components, returning unavailable when revenue is zero. Do not average percentages.
- Realization is a synthetic source-defined percentage and is not aggregated or reverse-engineered. Production formula mapping remains pending.
- Staffing uses the configured number of completed calendar months (default 12), ending at the latest completed month as of the selected day. Monthly average = total monthly hours / lookback months; annualized equivalent = average * 12. Missing months produce unavailable averages plus coverage, not invented zeroes. Month-end dates include that completed month. No labor rates are generated.
- Tenure = elapsed calendar days / 365.2425, floored at zero, displayed in years.

## Temporal resolution

Observation source identities, dimensions, measurement periods, effective date and revision are unique and immutable. A correction inserts a higher revision. Each read applies recordedAt <= selected knowledge timestamp, then selects the latest effective observation and eligible revision. Overrides are append-only events with exact dimensions and measurement periods; latest applicable business start and recorded order wins. Withdrawal appends a new event returning that slice to source. Original observations and prior override states remain inspectable. API writes always set the actual server recording time.

## Authorization and operations

Existing group authorization applies before all financial operations. Margin and labor-cost payloads, histories, override writes, audit records and report totals are restricted by current Partner/Director/current-RM or explicit effective-dated profitability grants. Admin status alone does not grant profitability. All-group profitability totals are omitted unless every selected group is authorized and data periods are compatible. Service status is separately effective-dated and never inferred from ARR.

Imports resolve explicit source mappings; never match by name. ImportBatch/ImportException track unmapped, duplicate, stale/conflicting revisions and invalid rows. Re-running the same mock batch skips already imported observations. Mapping approval, source import and category configuration are administrative. Only read methods exist on the connector interface.

## Delivery and verification

Financial Overview profile tab, source/override history and forms, monthly/quarterly trends, staffing tables, service history, portfolio reporting and source mapping/import administration. Tests cover bitemporal resolution, period-scoped overrides, corrections, zero/missing values, hours, idempotency, leakage through audit/reports, role changes and Phase 1 regressions. Real Fabric connectivity and deployment remain deferred.
