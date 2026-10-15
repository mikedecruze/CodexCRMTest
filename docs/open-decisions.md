# Open decisions and external prerequisites

- No Fabric workspace/item or Entra registration is configured. No remote deployment or real Microsoft sign-in can be claimed.
- The local persistent API is the tested development adapter. A Fabric Functions/data repository implementation and backend authorization proof remain required before Fabric deployment.
- Production identity requires tenant ID, app ID, app secret, exact redirect URI and pre-provisioned Employee-to-Entra subject mappings; values belong in secure environment configuration, never chat or source control.
- Approve operational permissions for Associates and any explicit group grants before production use. Current default is read-only.
- Ends are exclusive across all effective-dated records. Ownership changes split intervals. Confirm this convention with data owners before import.
- Indirect ownership calculations and aggregate ownership-class totals are not inferred. Define class rules before enabling those calculations.
- Financial/workflow seed data requested for the full system is deferred with its modules; Phase 1 seeds only relationship-relevant records.
