# Trove Relationship Manager

## Master Build Prompt — Version 1.0

### Role and Objective

Act as a principal software architect, Microsoft Fabric Apps specialist, database architect, and senior React/TypeScript developer.

Build **Trove Relationship Manager**, a secure internal client relationship management system for Trove FS, LLC, a multi-family office.

The application should be inspired by Wealthbox's family office CRM capabilities but tailored to Trove's operating model.

**Primary objectives:**

1. Centralize complex family, household, individual, trust, legal entity, and advisor records.
2. Maintain historical client financial and operational statistics.
3. Manage contracts, scopes of work, and client assignments.
4. Coordinate recurring firmwide client-service initiatives.
5. Provide a unified client view with relationships, economics, activities, and upcoming work.

Sales opportunity tracking is not an MVP priority.

The system is intended for approximately:

- 150 Client Groups
- 2,000 legal entities
- 150 internal employees
- An expandable population of individuals and external professional contacts

Build for maintainability, data integrity, security, and usability rather than unnecessary complexity.

---

# 1. Technology and Development Environment

Use:

- Microsoft Fabric Apps (Rayfin framework)
- TypeScript
- React
- Microsoft Entra ID authentication
- Supported Fabric Apps data models and GraphQL
- Microsoft Fabric Warehouse and semantic-model connectors
- Fabric Apps Functions for supported secure server-side operations
- SharePoint document links
- Power BI for advanced reporting

Develop locally in VS Code and deploy to Microsoft Fabric.

Use the latest compatible Rayfin SDK and official Microsoft documentation. Inspect the scaffolded project before modifying it.

Initial scaffolding:

`npm create @microsoft/rayfin@latest`

Local development:

`npx rayfin dev`

Production deployment:

`npx rayfin up`

Do not invent unsupported APIs or assume standard SQL database behavior is automatically supported by Rayfin.

Use the officially documented database decorators and explicit junction entities.

IMPORTANT: Fabric Apps is in preview. Verify API compatibility before implementing advanced capabilities. If a desired feature is unsupported, explain the limitation and implement a maintainable, supported alternative.

# 2. Fundamental Business Concepts

## Client Group

A Client Group is the highest-level client relationship, usually a family.

Example: "Smith Family."

The Client Group is the primary level for:

- Reporting
- Client assignments
- Financial metrics
- Service-line tracking
- Global initiatives
- Activities and tasks
- Access control

Each Client Group has exactly:

- One designated primary Partner
- One designated primary Relationship Manager
- One designated primary Service Team

Assignments should retain change history.

## Client / Customer

A Client or Customer is an individual or legal entity that may receive services and may be billed.

Examples:

- John Smith
- Smith Family Trust
- Smith Holdings LLC

Customers may have Sage Intacct customer IDs, but these identifiers are optional.

A Client Group may include many Customers. Not every individual or entity is necessarily a billable Customer.

## Individuals

Represent natural persons, including family members, professional contacts, and other stakeholders.

A family-member individual belongs to no more than one Client Group.

Professional contacts can be associated with many Client Groups through separate advisor/stakeholder relationships.

## Legal Entities

Legal entities can be associated with multiple Client Groups.

Types include trusts, LLCs, partnerships, corporations, S-Corps, private foundations, donor-advised funds, and estates.

Additional entity types must be configurable.

## Households

Households are explicit records within Client Groups.

Users must be able to create and view individual family branches.

Household membership should be effective-dated.

## External Advisors

External advisors are reusable master records.

Professional individuals and their organizations should be separate records.

A professional may work at a firm and advise multiple Client Groups.

Group-specific relationships, notes, and activities must remain separately secured.

---

# 3. Database Architecture

Develop a normalized relational data model using UUID primary keys.

All important entities should include creation and modification timestamps and appropriate audit information.

Do not use mutable display names or external accounting-system IDs as primary keys.

Use the following logical model as the starting design. Adapt the physical implementation to supported Fabric Apps constraints and document any deviations.

## A. Core records

### ClientGroup

Fields:

- id
- group_name
- display_name
- status
- inception_date
- primary_partner_user_id
- primary_relationship_manager_user_id
- primary_service_team_id
- primary_sharepoint_url
- created_at
- updated_at

### Household

- id
- client_group_id
- household_name
- description
- effective_start_date
- effective_end_date

### HouseholdMembership

- id
- household_id
- person_id
- relationship_to_household
- is_primary
- effective_start_date
- effective_end_date

### Party

Create a common identity table supporting:

- PERSON
- LEGAL_ENTITY
- ADVISOR_ORGANIZATION

Fields:

- id
- party_type
- display_name
- record_status
- created_at
- updated_at

This common identity allows relationships between different kinds of records without duplicating their underlying information.

### PersonProfile

- id
- party_id
- primary_client_group_id (nullable for external professionals)
- first_name
- middle_name
- last_name
- preferred_name
- former_names
- birth_date
- deceased_date
- gender (optional)
- citizenship
- tax_domicile
- contact_information
- occupation
- employer
- communication_preferences
- important_dates
- personal_notes

Where appropriate, use separate effective-dated records for changing attributes, including tax domicile and residence.

Keep sensitive notes under group-specific permissions.

### LegalEntityProfile

- id
- party_id
- legal_name
- entity_type_id
- tax_classification
- formation_date
- formation_jurisdiction
- entity_status
- termination_date
- description

### AdvisorOrganizationProfile

- id
- party_id
- organization_name
- organization_type
- website
- primary_contact_information
- address

### ClientGroupParty

An explicit junction entity associating legal entities and applicable people with Client Groups.

Fields:

- id
- client_group_id
- party_id
- association_type
- effective_start_date
- effective_end_date
- is_billable_customer
- group_specific_status

Enforce the rule that family-member individuals cannot have concurrent memberships in multiple Client Groups.

Allow legal entities to have multiple Client Group associations.

### PartyRelationship

A reusable relationship/ownership engine.

Fields:

- id
- source_party_id
- target_party_id
- relationship_type_id
- effective_start_date
- effective_end_date
- ownership_percentage
- voting_percentage
- economic_percentage
- ownership_class
- notes
- source_document_reference

Example relationships:

- Spouse
- Parent / child
- Sibling
- Grantor
- Trustee
- Beneficiary
- LLC member
- Shareholder
- Manager
- Officer
- Executor
- Power of attorney

Do not assume all relationships have ownership percentages.

Support indirect ownership chains, but do not automatically calculate indirect ownership unless the ownership-class and calculation rules are explicitly defined.

Prevent logically inconsistent or duplicate active relationship records.

### ClientGroupStakeholder

Associates a reusable external advisor or organization with a Client Group.

Fields:

- id
- client_group_id
- advisor_party_id
- stakeholder_type_id
- scope_description
- primary_advisor_flag
- effective_start_date
- effective_end_date
- private_group_notes

### ProfessionalAffiliation

Links professional individuals to organizations, with positions and effective dates.

### ReferenceType

A configurable lookup system for:

- Legal entity types
- Relationship types
- Advisor categories
- Contact roles
- Activity categories
- Other administrative classifications

Only administrators may modify these lookup definitions.

---

# 4. Interactive Relationship Visualization

Build two interconnected views.

### Family Tree

Display:

- Family generations
- Parents and children
- Marriages
- Former spouses
- Households
- Relevant important dates

Allow users to select a person and navigate to their profile.

### Entity / Ownership Diagram

Display:

- Individuals
- Trusts
- LLCs
- Partnerships
- Other legal entities
- Ownership percentages
- Trustee and fiduciary relationships
- Beneficiaries
- External stakeholders where relevant

Support:

- Zoom and pan
- Expand/collapse branches
- Filtering by relationship type
- Click-through navigation
- As-of-date selection
- Historical visualization

The as-of-date selector must use effective-dated relationship records.

Only relationships visible to the signed-in user may appear in the graph.

Never expose the existence, names, or private details of unauthorized Client Groups through shared entities.

---

# 5. Historical Client Financial Metrics

Financial metrics are maintained primarily at Client Group level.

## Metric dimensions

Required:

- Client Group
- Metric
- Service Line, where applicable
- Employee Level, where applicable
- Effective date
- Measurement period, where applicable
- Source
- Recorded timestamp

Initial Service Lines:

- Tax
- Family Office
- BOS
- Other

Allow administrators to add or modify service-line categories.

Employee Levels:

- Partner
- Director
- Manager
- Senior
- Associate

## Metrics

### Client Group metrics

- Net Worth
- Client Tenure
- Total ARR
- Total Gross Margin
- Total Gross Margin Percentage

### Service-line metrics

- ARR
- Revenue
- Direct Labor Cost
- Gross Margin Dollars
- Gross Margin Percentage
- Realization Percentage
- Annualized Monthly Average Service Hours

### Service-line and employee-level metrics

Annualized monthly average hours by:

- Client Group
- Service Line
- Employee Level
- As-of date

Preserve historical values.

## MetricDefinition

- id
- metric_code
- display_name
- unit
- required_dimensions
- aggregation_method
- access_classification
- calculation_method
- is_derived

## MetricObservation

- id
- client_group_id
- metric_definition_id
- service_line_id (nullable)
- employee_level_id (nullable)
- metric_effective_date
- period_start_date (nullable)
- period_end_date (nullable)
- numeric_value
- source_system
- external_source_reference
- imported_at
- recorded_at
- source_revision

Imported observations are immutable. Corrections should create a new source revision or superseding observation.

## MetricOverride

- id
- client_group_id
- metric_definition_id
- service_line_id (nullable)
- employee_level_id (nullable)
- override_effective_date
- override_end_date (nullable)
- override_value
- reason
- created_by_user_id
- created_at
- superseded_at (nullable)
- approval_status (if configured)

Never edit or delete the underlying imported observation when an override is entered.

## Metric resolution rules

When displaying a metric for a selected date:

1. Identify the applicable Client Group and dimensions.
2. Select the latest eligible observation effective on or before the as-of date.
3. Apply the latest valid, authorized manual override for the corresponding metric and period if one exists.
4. Display the effective value.
5. Preserve the original imported value, override value, source, and user attribution.
6. Allow authorized users to inspect the history.

Support both:

- Business effective dates
- System recorded timestamps

This allows users to answer both "What was the value at December 31?" and "What did we believe the December 31 value was when we reported it in January?"

Do not sum point-in-time snapshots across months.

Total ARR across service lines can be summed for a single as-of date, avoiding duplicate imported family-total and service-line amounts.

Historical profitability and realization percentages must be calculated from appropriate components or existing approved source definitions, not by adding or naively averaging percentages.

## Financial calculations

Gross Margin Dollars = Engagement Revenue - Direct Labor Costs.

Direct labor costs are based on standard employee cost rates supplied by the approved financial data source.

Gross Margin Percentage = Gross Margin Dollars / Engagement Revenue, where revenue is nonzero.

Do not invent labor cost rates.

Client tenure should derive from the Client Group inception date, with any approved reporting convention documented.

For service hours, use an annualized monthly-average measure calculated using a defined lookback period ending at the as-of date.

Proposed default for validation: trailing 12 completed months' hours divided by 12. Display the monthly average and its annualized equivalent distinctly. The reporting convention must be configurable if the approved Fabric measure uses a different period or annualization method.

Do not invent a realization formula if Fabric already defines it. Discover and document the existing approved calculation.

## Historical reporting

Support:

- Any as-of date
- Monthly views
- Quarterly views
- Trend charts
- Period-over-period comparisons
- Source versus override inspection

Every metric should have a clear source and last-updated indicator.

---

# 6. Fabric Integration and Supplemental Data

Fabric Warehouse and semantic models are primary financial sources.

The underlying Sage Intacct source contains only some of the individuals and legal entities represented in the family office.

The CRM must therefore support its own complete record inventory.

## ExternalSourceMapping

- id
- internal_record_id
- internal_record_type
- source_system
- source_object_type
- external_source_id
- mapping_status
- last_verified_at

Use explicit mappings rather than assuming identical customer IDs across systems.

## Data import process

1. Inspect actual Fabric data schemas.
2. Identify customer, revenue, cost, and service-line datasets.
3. Produce a mapping document.
4. Match imported customers to existing CRM records.
5. Flag ambiguous or unmatched records for review.
6. Create approved mappings.
7. Keep supplemental CRM records independent of Sage availability.

Never silently merge people or entities based only on similar names.

Support CRM records without external source mappings.

Create ImportBatch and ImportException records for monitoring ingestion, failed mappings, duplicates, and data quality issues.

The CRM must not overwrite source financial warehouse data.

Use read-only connectors for source financial datasets unless an independently reviewed business requirement authorizes otherwise.

---

# 7. Service Line History

Create a separate effective-dated service status record.

## ClientServiceHistory

- id
- client_group_id
- service_line_id
- status
- effective_start_date
- effective_end_date
- responsible_service_team_id
- reason
- source

Possible statuses:

- Active
- Inactive
- Pending
- Suspended

Service status is distinct from ARR.

For example, a Client Group may have Family Office ARR but its service status may be inactive as of a later date.

ARR can inform data-quality warnings but must not automatically override an explicitly approved effective-dated service status.

Use active service status for global initiative eligibility.

---

# 8. Contracts and Engagements

A Client Group may have multiple contracts.

Contracts can cover:

- Entire Client Group
- Entire Client Group except selected people/entities
- Selected people/entities
- Individual service lines
- Special projects

## Contract

- id
- client_group_id
- contract_name
- contract_type
- description
- effective_date
- expiration_date
- renewal_date
- notice_period_days
- status
- responsible_partner_user_id
- scope_description
- sharepoint_document_url

## ContractCoverage

- id
- contract_id
- coverage_mode
- party_id (nullable)
- inclusion_exclusion_type
- effective_start_date
- effective_end_date

Coverage modes:

- ALL_GROUP_MEMBERS
- SELECTED_PARTIES

An entire-group contract should dynamically include newly associated people/entities unless explicitly excluded.

Coverage must be evaluated as of a specified date.

## ContractServiceLine

- id
- contract_id
- service_line_id
- scope_description

## ContractAmendment

Record amendments and their effective dates, document links, authors, and descriptions.

Do not calculate total ARR by summing contract records. ARR comes from approved financial measures.

Generate configurable alerts for:

- Upcoming renewals
- Expiring contracts
- Notice deadlines
- Fee escalation dates
- Missing or incomplete contract information

---

# 9. Global Initiative and Task Management

Build a lightweight but reliable firmwide client outreach engine.

Initial initiatives:

- Annual client satisfaction outreach
- Estate plan review outreach
- Quarterly meetings
- Insurance reviews
- Periodic relationship reviews

Allow administrators to create additional initiatives.

## InitiativeDefinition

- id
- initiative_name
- description
- active_flag
- recurrence_type
- recurrence_interval
- start_date
- default_due_offset_days
- default_owner_rule
- default_status
- eligibility_rule
- eligible_service_line_ids

Eligibility should use structured, validated rules, not arbitrary client-supplied executable code.

Support service-line-based targeting.

Example:

"Generate a quarterly meeting task for every Client Group actively consuming Family Office services."

## InitiativeClientOverride

- id
- initiative_id
- client_group_id
- participation_status
- override_recurrence
- override_due_date_rule
- override_owner_user_id
- effective_start_date
- effective_end_date
- reason

Overrides should allow:

- Exclusion
- Different recurrence
- Different task owner
- Different due-date rule

## InitiativeRun

- id
- initiative_id
- scheduled_occurrence_date
- started_at
- completed_at
- run_status
- eligible_count
- created_count
- skipped_count
- error_count

## ClientTask

- id
- client_group_id
- initiative_id (nullable)
- initiative_run_id (nullable)
- initiative_occurrence_key (nullable)
- title
- description
- assigned_owner_user_id
- responsible_team_id
- due_date
- status
- completed_at
- completed_by_user_id
- created_at

Task statuses should include:

- Not Started
- In Progress
- Awaiting Response
- Completed
- Cancelled

Include a separate TaskStatusHistory entity to preserve status changes.

## Automated recurrence

Use a supported Microsoft scheduling mechanism, such as Fabric Data Pipelines or Power Automate, to execute recurrence independently of active users.

The scheduler should invoke a secured, idempotent task-generation process using a verified supported authentication mechanism.

Each execution must:

1. Determine initiatives due for the scheduling period.
2. Determine eligible Client Groups from their active service status as of the occurrence date.
3. Apply Client Group overrides.
4. Resolve the assigned owner, defaulting to the group's Relationship Manager.
5. Generate the task.
6. Store the occurrence identifier.
7. Prevent duplicates if the job is rerun.
8. Record execution results and exceptions.

Require uniqueness for each initiative, Client Group, and occurrence.

A second execution of the same schedule must not generate duplicate tasks.

Changing a default recurrence should affect future occurrences without silently changing completed historical tasks.

## Dashboard reporting

Display:

- Eligible Client Groups
- Tasks generated
- Completed
- In progress
- Awaiting response
- Overdue
- Not yet started
- Completion percentage

Allow filtering by:

- Initiative
- Service Line
- Partner
- Relationship Manager
- Service Team
- Date range

---

# 10. Activity Timeline

Allow manually recorded:

- Calls
- Meetings
- Notes
- Emails
- Decisions
- Client life events
- Other configurable activity types

## Activity

- id
- activity_type_id
- title
- description
- activity_date
- created_by_user_id
- created_at

## ActivityLink

Allow one activity to be associated with:

- A Client Group
- Multiple people
- Multiple legal entities
- External advisors
- Contracts
- Tasks

Support both group-wide and group-specific visibility.

Provide a chronological Client Group activity feed with filtering and search.

Do not automatically ingest all emails.

Design the architecture to permit future Outlook manual-log integration, but do not include it in the initial MVP.

---

# 11. SharePoint Integration

Each Client Group should support a primary SharePoint root folder URL.

Additional SharePoint links may be associated with:

- Individuals
- Legal entities
- Contracts
- Activities
- Other relevant records

## SharePointLink

- id
- client_group_id
- linked_record_type
- linked_record_id
- display_name
- sharepoint_url
- document_category
- created_at

Do not duplicate SharePoint documents in CRM storage.

Respect SharePoint's existing permissions.

A CRM user should not automatically receive access to a restricted SharePoint document simply because its link exists in the application.

---

# 12. Employee Roles and Security

All users must sign in with Microsoft Entra ID.

Implement team-level Client Group authorization.

An employee may view a Client Group only if they are assigned to that group's authorized Service Team, are otherwise expressly authorized, or have an approved administrative exception.

## Employee

- id
- entra_user_id
- display_name
- email
- employee_level
- application_role
- active_status

## ServiceTeam

- id
- team_name
- description
- active_status

## ServiceTeamMembership

- id
- service_team_id
- employee_id
- effective_start_date
- effective_end_date

Each Client Group has one primary Service Team.

Support employees who belong to more than one team.

### Client data editing

Partners, Directors, Managers, and Seniors may edit authorized client records.

Associates should be read-only by default unless granted a specific operational permission.

### Profitability restrictions

Detailed client margin, labor cost, and profitability information should be visible only to:

- Partners
- Directors
- Designated Relationship Managers

Relationship Manager privileges should be based on that user's current assignment or approved scope, not solely their employee level.

Access to profitability must also require authorization for the specific Client Group.

### Shared entities and advisors

Split shared records into:

1. Shared core master information
2. Client Group-specific confidential information

A person assigned to the Smith Family must not gain access to another family's:

- Private notes
- Contracts
- Financial information
- Tasks
- Activities
- Confidential relationship data

This restriction must hold even when both families are associated with the same entity or advisor.

Enforce security in the backend, connector configuration, and database authorization policies.

Do not rely only on filtering tables in React.

Security must also apply to:

- Search results
- Global record lookups
- Graph relationships
- Exports
- Dashboard totals
- API requests
- Server-side Functions

Test for cross-family data leakage.

Implement an AuditLog recording material changes to client records, financial overrides, assignments, contracts, and permissions.

Avoid storing SSNs, full banking credentials, or other unnecessary sensitive identifiers.

---

# 13. User Interface Requirements

Create a clean, intuitive, desktop-first enterprise application.

Use restrained styling, consistent tables, clear navigation, informative empty states, and minimal unnecessary clicks.

## Main navigation

- Home
- Client Groups
- Individuals
- Entities & Trusts
- Advisors
- Contracts
- Activities
- Initiatives & Tasks
- Reporting
- Administration

## Home dashboard

Prioritize:

1. My tasks
2. Overdue tasks
3. Upcoming meetings and relationship activities
4. My assigned Client Groups
5. Contract alerts
6. Client-service notifications

## Client Group profile

Use a tabbed design.

Tabs:

- Overview
- Family & Households
- Entities & Ownership
- Advisors & Stakeholders
- Financial Overview
- Contracts
- Activity Timeline
- Tasks & Initiatives
- Documents

The Overview should display:

- Client Group information
- Primary Partner
- Relationship Manager
- Service Team
- Active service lines
- Key contacts
- ARR summary, subject to permission
- Important alerts
- Upcoming tasks
- Recent activity

## Financial tab

Provide an as-of-date selector and historical charts.

Display ARR, margin, realization, and staffing hours by service line.

Use an interactive table for historical values.

Expose source/override details to appropriately authorized users.

## Search and filtering

Provide global search across authorized records.

Support filtering Client Groups by:

- Partner
- Relationship Manager
- Service Team
- Active Service Lines
- Client status
- Relevant financial metrics, where authorized

Permit saved views.

Use pagination or bounded queries for large datasets.

---

# 14. Reporting

Create initial dashboards for:

- Total Client Groups
- Total ARR
- ARR by Service Line
- Gross Margin by Service Line
- Client profitability
- Client tenure
- Client net worth distributions
- Upcoming contract renewals
- Workflow completion
- Workload by employee/team

Maintain compatibility with Power BI for advanced analysis.

Avoid duplicating existing Fabric business logic unnecessarily.

Ensure the application's profitability permissions are preserved when reports are exposed or embedded.

---

# 15. Data Quality and Administration

Provide administrative tools to:

- Manage configurable categories
- Manage service lines
- Manage teams and employee assignments
- Review unmatched Fabric/Sage records
- Merge duplicate records using an audited workflow
- Review data import errors
- Inspect historical changes
- Review recurring initiative execution results

Prevent accidental deletion of records with dependent relationships.

Prefer archive/inactivate behavior rather than hard deletion of business-critical records.

Provide clear validation messages for conflicting effective dates, missing required information, and invalid ownership percentages.

---

# 16. Development Deliverables

Before building substantial UI functionality, create these files:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/financial-metrics.md`
- `docs/fabric-integration.md`
- `docs/security.md`
- `docs/workflows.md`
- `docs/ui-specification.md`
- `docs/implementation-plan.md`
- `docs/open-decisions.md`

Include a logical ERD in the data-model document.

Document actual Fabric source identifiers only after inspecting the connected environment. Do not fabricate production table or field names.

Create synthetic seed data including:

- Three family groups
- Multiple households
- Several generations
- People and trusts
- Entities associated with multiple families
- Shared external advisors
- Historical ownership changes
- Historical ARR and margin
- Manual overrides
- Multiple contracts
- Recurring initiative tasks

## Phase 1 — Core Relationships

Implement:

- Authentication
- Client Groups
- People
- Households
- Legal entities
- Advisors
- Relationship engine
- Basic security
- Search
- Client Group profile

Deliver a functioning application, not just a database design.

## Phase 2 — Historical Financials

Implement:

- Fabric connector framework
- Source ID mapping
- Metric observations
- Overrides
- Service-line history
- Historical reporting
- Profitability permissions

Use mock Fabric data until the real warehouse fields and measures are mapped.

## Phase 3 — Contracts

Implement:

- Contract management
- Group-wide coverage
- Entity-specific coverage
- Exclusions
- Amendments
- Renewal alerts
- SharePoint links

## Phase 4 — Service Coordination

Implement:

- Initiative definitions
- Eligibility
- Client-level overrides
- Tasks
- Recurrence processor
- Firmwide progress dashboards
- Activity timeline

## Phase 5 — Enhancements

Consider:

- Outlook manual logging
- Teams integration
- Expanded Power BI reporting
- Additional client data fields
- Optional AI-assisted insights
- Additional workflow functionality

---

# 17. Acceptance Tests

The implementation is not complete until the following scenarios work.

### Relationship test

Create a family with three households, several trusts, and LLCs. Display its family tree and entity ownership diagram.

### Shared-entity test

Associate one LLC with two Client Groups. Verify that its shared core information appears in each group while unrelated confidential information remains inaccessible.

### Historical ownership test

Change a trust ownership percentage effective January 1. Verify that the graph displays the old percentage for a prior as-of date and the new percentage afterward.

### Financial-history test

Import historical ARR and then enter a manual override for one Client Group and Service Line. Verify that both values are preserved, the effective value resolves correctly, and the user/reason are recorded.

### Hours test

Display annualized monthly-average service hours by employee level using the correct historical as-of date and configured calculation convention.

### Contract-coverage test

Create a contract covering an entire Client Group except one entity. Add a new entity later. Verify that the new entity is included automatically and the excluded entity remains excluded.

### Workflow eligibility test

Create a quarterly initiative targeting actively serviced Family Office clients. Verify that only eligible groups receive tasks.

### Recurrence test

Run the scheduling process twice for the same period. Verify that duplicate tasks are not created.

### Override test

Exclude a Client Group from an initiative and verify that no new tasks are generated during the exclusion period.

### Security test

Test a Partner, Relationship Manager, Director, Manager, Senior, Associate, and unauthorized employee. Confirm that each can see or modify only the permitted records and financial details.

### Source-mapping test

Add a child, trust, or other person/entity without a Sage Intacct ID. Verify that the record works normally and can be mapped to a source record in the future.

---

# 18. Execution Instructions for the Coding Agent

Start by:

1. Inspecting the installed Fabric Apps SDK, CLI, and project configuration.
2. Verifying current official documentation and supported capabilities.
3. Producing the architecture, data model, and implementation documents.
4. Identifying genuine technical blockers and unresolved business logic.
5. Creating the project scaffold and synthetic data.
6. Building Phase 1 as a functional vertical slice.
7. Running available tests and confirming the relevant functionality works.

Do not attempt to implement all modules in one large untested change.

Do not fabricate integrations or claim a capability is working unless verified.

Maintain the documentation as code and design choices evolve.

Prioritize a working, secure client management system with reusable records and extensible relationships.

**The immediate development objective is Phase 1: a polished, functioning Client Group management application with individuals, households, legal entities, advisors, effective-dated relationships, and team-restricted access.**
Show less
