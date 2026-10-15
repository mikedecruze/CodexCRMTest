# Historical financial metrics — Phase 2

Phase 2 is implemented against synthetic read-only financial data in the existing persistent local adapter. Real Fabric tables, approved measures and connectors remain unmapped. See [phase-2-plan.md](phase-2-plan.md) for the conventions and [fabric-integration.md](fabric-integration.md) for the deployment boundary.

The model includes MetricDefinition, immutable MetricObservation, append-only MetricOverride events, explicit ExternalSourceMapping, ImportBatch, ImportException, ClientServiceHistory, ServiceLine, versioned staffing conventions and explicit ProfitabilityGrant records. All business records use UUID identities. Display names and Sage IDs are never keys.

ARR and net worth resolve the latest business-effective source observation eligible at the selected recorded-knowledge timestamp. Higher eligible source revisions correct a snapshot without altering its original record. Service-line ARR slices take precedence over a family total; family totals are fallback values, never added on top of those slices. Missing data is unavailable, not zero. Amounts are USD with two decimal input precision; sums use integer cents.

Overrides carry exact metric dimensions, measurement period, effective interval, reason, author and actual server recording timestamp. The latest applicable business start and recorded event wins. A withdrawal appends an event returning that interval to source; it never deletes an earlier override. Derived margin, margin percentage and tenure cannot be directly overridden. Override the approved components instead. History includes only events known at the selected timestamp, with bounded observation/event lists and explicit counts.

Monthly revenue and source-supplied labor cost must share measurement periods before margin is calculated. Gross margin dollars = revenue − labor cost. Gross margin percent = 100 × margin / revenue, unavailable when revenue is zero. Group and portfolio margin percentages are weighted from compatible component totals. Quarterly revenue and margin sum completed monthly component periods; ARR and net worth remain quarter-end snapshots. A partial current quarter includes completed months only and shows its actual measurement bounds.

Realization is an explicitly labeled synthetic source-defined measure. It is neither summed nor averaged across groups or services. The real approved Fabric definition must be inspected and documented before a production adapter is enabled. No employee labor cost rates or realization formula are invented.

Staffing defaults to 12 completed calendar months. A month-end as-of date includes that completed month; mid-month ends the window at the prior month's boundary. Monthly average = monthly source hours / configured lookback months. Annualized equivalent = monthly average × 12. The table distinguishes both values, source-month coverage and overridden months by employee level/service. Missing months produce unavailable averages. Administrative convention changes retain recorded-time history, so an earlier knowledge view uses the prior convention (default 12 before any recorded change).

Tenure is elapsed calendar days since inception / 365.2425, floored at zero and displayed as years. This is the development reporting convention, pending approval alongside Fabric mappings.

Client service status is a separate append-only transition history. For a business date and knowledge cutoff, the latest eligible business-start transition controls; an expired transition yields no recorded status rather than silently restoring an older state. Later transitions take precedence over retained prior states. ARR never changes service status. The UI flags ARR on inactive/suspended/unrecorded service lines.

Profitability requires current group access plus Partner, Director, current designated Relationship Manager, or an explicit unrevoked effective-dated grant. Administrator status alone does not qualify. Read permissions apply to payloads, history, overrides, audits and reporting. Aggregate portfolio profitability is withheld unless every selected group is in scope and component periods are compatible. See security.md.
