import type { Employee, Group, Team } from "./types.ts";
export type MetricCode =
  | "ARR"
  | "NET_WORTH"
  | "REVENUE"
  | "LABOR_COST"
  | "REALIZATION"
  | "HOURS"
  | "GROSS_MARGIN"
  | "GROSS_MARGIN_PCT"
  | "TENURE";
export interface ServiceLine {
  id: string;
  code: string;
  name: string;
  active: number;
  createdAt: string;
  updatedAt: string;
}
export interface MetricDefinition {
  id: string;
  code: MetricCode;
  name: string;
  unit: "USD" | "PERCENT" | "HOURS" | "YEARS";
  dimensions: "GROUP" | "SERVICE" | "SERVICE_LEVEL" | "GROUP_OR_SERVICE";
  aggregation: string;
  classification: "GENERAL" | "PROFITABILITY";
  calculation: string;
  derived: number;
  periodic: number;
}
export interface Observation {
  id: string;
  groupId: string;
  metricId: string;
  serviceLineId: string | null;
  employeeLevel: string | null;
  effectiveDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  numericValue: number;
  currency: string;
  sourceSystem: string;
  sourceObjectType: string;
  externalSourceId: string;
  externalReference: string;
  sourceRevision: number;
  batchId: string;
  importedAt: string;
  recordedAt: string;
}
export interface MetricOverride {
  id: string;
  groupId: string;
  metricId: string;
  serviceLineId: string | null;
  employeeLevel: string | null;
  effectiveDate: string;
  endDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  numericValue: number | null;
  action: "VALUE" | "WITHDRAW";
  reason: string;
  createdBy: string;
  actor: string;
  recordedAt: string;
  supersedesId: string | null;
}
export interface ResolvedMetric {
  metric: MetricCode;
  value: number;
  sourceValue: number;
  overrideValue: number | null;
  observationId: string;
  overrideId: string | null;
  sourceSystem: string;
  sourceRevision: number;
  externalReference: string;
  effectiveDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  recordedAt: string;
  overrideReason?: string;
  overrideActor?: string;
  overrideRecordedAt?: string;
}
export interface ServiceStatus {
  id: string;
  groupId: string;
  serviceLineId: string;
  status: "Active" | "Inactive" | "Pending" | "Suspended";
  startDate: string;
  endDate: string | null;
  teamId: string;
  team: string;
  reason: string;
  source: string;
  recordedAt: string;
  createdBy: string;
  actor: string;
  supersedesId: string | null;
}
export interface HoursMeasure {
  employeeLevel: string;
  monthlyAverage: number | null;
  annualized: number | null;
  coveredMonths: number;
  expectedMonths: number;
  totalHours: number | null;
  overrideCount: number;
}
export interface FinancialLine {
  serviceLine: ServiceLine;
  status: ServiceStatus | null;
  arr: ResolvedMetric | null;
  revenue: ResolvedMetric | null;
  realization: ResolvedMetric | null;
  laborCost?: ResolvedMetric | null;
  grossMargin?: number | null;
  grossMarginPercentage?: number | null;
  hours: HoursMeasure[];
}
export interface FinancialSummary {
  totalARR: number | null;
  arrSource: string;
  netWorth: ResolvedMetric | null;
  tenureYears: number;
  revenue: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  laborCost?: number | null;
  grossMargin?: number | null;
  grossMarginPercentage?: number | null;
}
export interface FinancialOverview {
  groupId: string;
  asOf: string;
  recordedAsOf: string;
  canViewProfitability: boolean;
  canEdit: boolean;
  summary: FinancialSummary;
  lines: FinancialLine[];
  hoursWindow: { start: string; end: string; months: number };
  warnings: string[];
  dataMode: "MOCK_FABRIC";
}
export interface FinancialPoint {
  date: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  arr: number | null;
  netWorth: number | null;
  revenue: number | null;
  laborCost?: number | null;
  grossMargin?: number | null;
  grossMarginPercentage?: number | null;
}
export interface FinancialHistory {
  definition: MetricDefinition;
  observations: Observation[];
  overrides: MetricOverride[];
  resolved: ResolvedMetric | null;
  totalObservations: number;
  totalOverrides: number;
}
export interface ExternalMapping {
  id: string;
  groupId: string;
  recordType: "CLIENT_GROUP" | "PARTY";
  internalRecordId: string;
  sourceSystem: string;
  sourceObjectType: string;
  externalSourceId: string;
  status: "Approved" | "Rejected";
  lastVerifiedAt: string;
  createdAt: string;
  createdBy: string;
  groupName: string;
  recordName: string;
}
export interface ImportBatch {
  id: string;
  sourceSystem: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  createdBy: string;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
}
export interface ImportException {
  id: string;
  batchId: string;
  groupId: string | null;
  externalSourceId: string;
  externalReference: string;
  code: string;
  message: string;
  createdAt: string;
}
export interface SourceCustomer {
  externalSourceId: string;
  displayName: string;
  sourceObjectType: string;
}
export interface SourceObservation {
  externalSourceId: string;
  sourceObjectType: string;
  metricCode: MetricCode;
  serviceLineCode: string | null;
  employeeLevel: string | null;
  effectiveDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  numericValue: number;
  currency: "USD";
  externalReference: string;
  sourceRevision: number;
}
export interface SourceDescription {
  sourceSystem: string;
  name: string;
  mode: "mock";
  readOnly: true;
  schemas: { name: string; fields: string[] }[];
  notes: string[];
}
export interface FinancialCatalog {
  serviceLines: ServiceLine[];
  metrics: MetricDefinition[];
  employeeLevels: string[];
  lookbackMonths: number;
  mode: "MOCK_FABRIC";
}
export interface FinancialAdmin {
  source: SourceDescription;
  customers: SourceCustomer[];
  mappings: ExternalMapping[];
  batches: ImportBatch[];
  exceptions: ImportException[];
  serviceLines: ServiceLine[];
  employees: Employee[];
  teams: Team[];
  groups: Group[];
  grants: {
    id: string;
    groupId: string;
    groupName: string;
    employeeId: string;
    employee: string;
    startDate: string;
    endDate: string | null;
    revokedAt: string | null;
    reason: string;
  }[];
  lookbackMonths: number;
}
export interface ServiceFinancialTotal {
  serviceLineId: string;
  name: string;
  arr: number | null;
  coverage: number;
  groupCount: number;
  revenue: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  grossMargin?: number | null;
  grossMarginPercentage?: number | null;
}
export interface NetWorthBucket {
  label: string;
  count: number;
}
export interface FinancialReport {
  serviceTotals: ServiceFinancialTotal[];
  netWorthDistribution: NetWorthBucket[];
  missingNetWorthCount: number;
  asOf: string;
  recordedAsOf: string;
  rows: { group: Group; financial: FinancialOverview }[];
  totals: {
    arr: number | null;
    netWorth: number | null;
    revenue: number | null;
    grossMargin?: number | null;
    grossMarginPercentage?: number | null;
  };
  canViewAllProfitability: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  warnings: string[];
}
