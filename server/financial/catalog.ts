import { createHash } from "node:crypto";
import type { MetricDefinition } from "../../shared/financial.ts";
export const financialId = (key: string) => {
  const s = createHash("sha256").update(`trove-financial:${key}`).digest("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
};
export const employeeLevels = [
  "Partner",
  "Director",
  "Manager",
  "Senior",
  "Associate",
];
const definitions: Omit<MetricDefinition, "id">[] = [
  {
    code: "ARR",
    name: "Annual recurring revenue",
    unit: "USD",
    dimensions: "GROUP_OR_SERVICE",
    aggregation: "SNAPSHOT",
    classification: "GENERAL",
    calculation:
      "Latest source snapshot; service-line slices take precedence over family total.",
    derived: 0,
    periodic: 0,
  },
  {
    code: "NET_WORTH",
    name: "Net worth",
    unit: "USD",
    dimensions: "GROUP",
    aggregation: "SNAPSHOT",
    classification: "GENERAL",
    calculation: "Latest source snapshot; never sum across dates.",
    derived: 0,
    periodic: 0,
  },
  {
    code: "REVENUE",
    name: "Engagement revenue",
    unit: "USD",
    dimensions: "SERVICE",
    aggregation: "PERIOD",
    classification: "GENERAL",
    calculation: "Source monthly period amount.",
    derived: 0,
    periodic: 1,
  },
  {
    code: "LABOR_COST",
    name: "Direct labor cost",
    unit: "USD",
    dimensions: "SERVICE",
    aggregation: "PERIOD",
    classification: "PROFITABILITY",
    calculation: "Source-supplied labor cost; no rates calculated in CRM.",
    derived: 0,
    periodic: 1,
  },
  {
    code: "REALIZATION",
    name: "Realization",
    unit: "PERCENT",
    dimensions: "SERVICE",
    aggregation: "SOURCE_MEASURE",
    classification: "GENERAL",
    calculation:
      "Synthetic source-defined percentage. Production Fabric definition is unmapped; no cross-service aggregation.",
    derived: 0,
    periodic: 1,
  },
  {
    code: "HOURS",
    name: "Monthly service hours",
    unit: "HOURS",
    dimensions: "SERVICE_LEVEL",
    aggregation: "PERIOD",
    classification: "GENERAL",
    calculation:
      "Source monthly hours. Rolling averages use complete months and the configured lookback.",
    derived: 0,
    periodic: 1,
  },
  {
    code: "GROSS_MARGIN",
    name: "Gross margin",
    unit: "USD",
    dimensions: "GROUP_OR_SERVICE",
    aggregation: "COMPONENTS",
    classification: "PROFITABILITY",
    calculation: "Matching-period revenue minus source labor cost.",
    derived: 1,
    periodic: 1,
  },
  {
    code: "GROSS_MARGIN_PCT",
    name: "Gross margin percentage",
    unit: "PERCENT",
    dimensions: "GROUP_OR_SERVICE",
    aggregation: "COMPONENTS",
    classification: "PROFITABILITY",
    calculation:
      "100 * margin / matching-period revenue; unavailable at zero revenue.",
    derived: 1,
    periodic: 1,
  },
  {
    code: "TENURE",
    name: "Client tenure",
    unit: "YEARS",
    dimensions: "GROUP",
    aggregation: "DERIVED",
    classification: "GENERAL",
    calculation:
      "Elapsed calendar days from inception / 365.2425, floored at zero.",
    derived: 1,
    periodic: 0,
  },
];
export const metricDefinitions = definitions.map((d) => ({
  ...d,
  id: financialId(`metric-${d.code}`),
}));
export const roundMoney = (v: number) =>
  Math.round((v + Number.EPSILON) * 100) / 100;
export const sumMoney = (values: number[]) =>
  values.reduce((n, v) => n + Math.round(v * 100), 0) / 100;
export function monthStart(date: string) {
  return date.slice(0, 7) + "-01";
}
export function shiftMonths(date: string, months: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function dayBefore(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export function completedWindow(asOf: string, months: number) {
  const current = monthStart(asOf),
    next = shiftMonths(current, 1),
    end = asOf === dayBefore(next) ? next : current;
  return { start: shiftMonths(end, -months), end, months };
}
