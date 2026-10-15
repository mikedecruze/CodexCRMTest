# Open decisions and external prerequisites

- No Fabric workspace/item or Entra registration is configured. No remote deployment or real Microsoft sign-in can be claimed.
- The local persistent API is the tested development adapter. A Fabric Functions/data repository implementation and backend authorization proof remain required before Fabric deployment.
- Production identity requires tenant ID, app ID, app secret, exact redirect URI and pre-provisioned Employee-to-Entra subject mappings; values belong in secure environment configuration, never chat or source control.
- Approve operational permissions for Associates and any explicit group grants before production use. Current default is read-only.
- Ends are exclusive across all effective-dated records. Ownership changes split intervals. Confirm this convention with data owners before import.
- Indirect ownership calculations and aggregate ownership-class totals are not inferred. Define class rules before enabling those calculations.
- Phase 2 now seeds synthetic financial history once; contract/workflow seed data remain deferred with their modules.

## Phase 2 progress

Financial/source-mapping and service-history modules now operate against synthetic data. Real Fabric schemas, source customer identities, warehouse/semantic-model measures (especially realization), currencies beyond USD, and the approved hours/tenure convention remain pending real-source discovery and approval. No actual tenant deployment or datalake connectivity is claimed. Phase 3 contracts and Phase 4 workflows remain deferred. The mock source and replayed history are clearly labeled.
