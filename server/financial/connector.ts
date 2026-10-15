import type {
  SourceCustomer,
  SourceDescription,
  SourceObservation,
} from "../../shared/financial.ts";
import { dayBefore, shiftMonths } from "./catalog.ts";
/** Application-owned read contract, not a claimed Microsoft SDK connector API. */
export interface FinancialSourceConnector {
  describe(): SourceDescription;
  readCustomers(): Promise<SourceCustomer[]>;
  readObservations(): Promise<SourceObservation[]>;
}
export const mockCustomers: SourceCustomer[] = [
  {
    externalSourceId: "MOCK-CG-SMITH",
    displayName: "Smith Family",
    sourceObjectType: "ClientGroup",
  },
  {
    externalSourceId: "MOCK-CG-BENNETT",
    displayName: "Bennett Family",
    sourceObjectType: "ClientGroup",
  },
  {
    externalSourceId: "MOCK-CG-CARTER",
    displayName: "Carter Family",
    sourceObjectType: "ClientGroup",
  },
  {
    externalSourceId: "MOCK-CG-UNMATCHED",
    displayName: "New unmapped family",
    sourceObjectType: "ClientGroup",
  },
  {
    externalSourceId: "MOCK-CG-SMITH-REVIEW",
    displayName: "Smith Family",
    sourceObjectType: "ClientGroup",
  },
];
export function mockObservations(): SourceObservation[] {
  const rows: SourceObservation[] = [];
  for (let g = 0; g < 3; g++) {
    const customer = mockCustomers[g];
    for (let m = 0; m < 33; m++) {
      const start = shiftMonths("2024-01-01", m),
        end = shiftMonths(start, 1),
        date = dayBefore(end);
      const add = (
        metricCode: SourceObservation["metricCode"],
        serviceLineCode: string | null,
        numericValue: number,
        employeeLevel: string | null = null,
      ) =>
        rows.push({
          externalSourceId: customer.externalSourceId,
          sourceObjectType: "ClientGroup",
          metricCode,
          serviceLineCode,
          employeeLevel,
          effectiveDate: date,
          periodStart: ["ARR", "NET_WORTH"].includes(metricCode) ? null : start,
          periodEnd: ["ARR", "NET_WORTH"].includes(metricCode) ? null : end,
          numericValue,
          currency: "USD",
          externalReference: `mock/${customer.externalSourceId}/${metricCode}/${serviceLineCode || "group"}/${employeeLevel || "all"}/${date}`,
          sourceRevision: 1,
        });
      add("NET_WORTH", null, (g + 1) * 18000000 + m * 150000);
      let total = 0;
      for (const [i, line] of [
        "TAX",
        "FAMILY_OFFICE",
        "BOS",
        "OTHER",
      ].entries()) {
        const arr =
          i === 3
            ? 0
            : Math.round(
                ([60000, 240000, 36000][i] + m * [1000, 2000, 500][i]) *
                  (1 + g * 0.25),
              );
        total += arr;
        const revenue = arr / 12,
          cost =
            Math.round(revenue * (0.48 + g * 0.05 + i * 0.035) * 100) / 100;
        add("ARR", line, arr);
        add("REVENUE", line, Math.round(revenue * 100) / 100);
        add("LABOR_COST", line, cost);
        add("REALIZATION", line, i === 3 ? 0 : 88 + ((m + i + g) % 10));
        for (const [levelIndex, level] of [
          "Partner",
          "Director",
          "Manager",
          "Senior",
          "Associate",
        ].entries())
          add(
            "HOURS",
            line,
            i === 3 ? 0 : 8 + levelIndex * 6 + (m % 3) + g * 2,
            level,
          );
      }
      // Imported group total intentionally coexists with dimensional ARR; it must not be added twice.
      add("ARR", null, total);
    }
  }
  const corrected = rows.find(
    (r) =>
      r.externalSourceId === "MOCK-CG-SMITH" &&
      r.metricCode === "ARR" &&
      r.serviceLineCode === "FAMILY_OFFICE" &&
      r.effectiveDate === "2025-12-31",
  )!;
  rows.push({
    ...corrected,
    numericValue: corrected.numericValue + 4000,
    sourceRevision: 2,
  });
  for (const customer of mockCustomers.slice(3))
    rows.push({
      externalSourceId: customer.externalSourceId,
      sourceObjectType: customer.sourceObjectType,
      metricCode: "ARR",
      serviceLineCode: "TAX",
      employeeLevel: null,
      effectiveDate: "2025-12-31",
      periodStart: null,
      periodEnd: null,
      numericValue: 48000,
      currency: "USD",
      externalReference: `mock/${customer.externalSourceId}/ARR/TAX/2025-12-31`,
      sourceRevision: 1,
    });
  return rows;
}
export class MockFabricConnector implements FinancialSourceConnector {
  describe(): SourceDescription {
    return {
      sourceSystem: "MOCK_FABRIC",
      name: "Synthetic Fabric financial source",
      mode: "mock",
      readOnly: true,
      schemas: [
        {
          name: "mock_customers",
          fields: ["externalSourceId", "displayName", "sourceObjectType"],
        },
        {
          name: "mock_metric_observations",
          fields: [
            "externalSourceId",
            "metricCode",
            "serviceLineCode",
            "employeeLevel",
            "effectiveDate",
            "periodStart",
            "periodEnd",
            "numericValue",
            "currency",
            "externalReference",
            "sourceRevision",
          ],
        },
      ],
      notes: [
        "These schema names and source IDs are synthetic, not discovered Fabric objects.",
        "Read-only adapter; no method can write to a warehouse.",
        "Realization is a mock source-defined measure. Production formula and source mapping are pending.",
      ],
    };
  }
  async readCustomers() {
    return structuredClone(mockCustomers);
  }
  async readObservations() {
    return mockObservations();
  }
}
