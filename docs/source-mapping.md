# Source mapping — synthetic development contract

`server/financial/connector.ts` defines an application-owned `FinancialSourceConnector` read contract. It is not a fabricated Microsoft SDK API. `MockFabricConnector` is its only active implementation and has no write operations. Microsoft Rayfin connector configuration remains unchanged and no real source identifiers are declared.

| Synthetic dataset          | Contract                                                                                                                                         | Internal destination                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `mock_customers`           | externalSourceId, displayName, sourceObjectType                                                                                                  | Explicit approved ExternalSourceMapping                  |
| `mock_metric_observations` | customer identity, metricCode, serviceLineCode, employeeLevel, effective/period dates, numericValue, currency, externalReference, sourceRevision | Immutable MetricObservation after mapping and validation |

Both dataset names are synthetic. Mock customer identities start with `MOCK-CG-`; metric references start with `mock/`. Three family mappings are explicitly seeded using known fixture UUIDs. Two additional identities remain unmapped, including one with a display name identical to an existing family. They must be reviewed; name similarity never creates or merges records.

An approved mapping identifies a source system, source object type and external ID independently of an internal UUID and record type. Group-source mappings target exactly one Client Group, with duplicate source-group mappings blocked. Supplemental people/entities operate normally without a source mapping. Party mappings are retained by the API but do not implicitly aggregate financial observations into a family. Retargeting existing mappings is rejected to preserve the attribution of immutable imported history.

Each import stores a batch result and exceptions. Already stored identical source revisions are skipped; changed values under the same revision raise a conflict. Corrections require a new revision. Unknown/unmapped customers, invalid dimensions/periods, incompatible currencies and insufficient financial scope are quarantined as exceptions. Source rows are never written back to the mock connector or a warehouse.

To activate a real source later: inspect the actual Fabric schemas and approved measures, produce the real mapping document, implement and verify a read-only adapter using the installed Rayfin connector's supported operations, explicitly approve customer matches, and validate backend authorization and all calculations against that source. The current UI always labels its dataset as mock.
