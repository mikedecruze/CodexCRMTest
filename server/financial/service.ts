import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Employee } from "../../shared/types.ts";
import type {
  FinancialCatalog,
  FinancialHistory,
  FinancialLine,
  FinancialOverview,
  FinancialPoint,
  FinancialReport,
  FinancialSummary,
  MetricCode,
  MetricDefinition,
  MetricOverride,
  Observation,
  ResolvedMetric,
  ServiceLine,
  ServiceStatus,
  SourceObservation,
} from "../../shared/financial.ts";
import { transaction } from "../db.ts";
import { insert } from "../seed.ts";
import { dateSchema, HttpError, Service, today } from "../service.ts";
import {
  completedWindow,
  dayBefore,
  employeeLevels,
  monthStart,
  roundMoney,
  shiftMonths,
  sumMoney,
} from "./catalog.ts";
export const timestampSchema = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v).toISOString());
const nullableId = z.uuid().nullable().default(null),
  level = z
    .enum(["Partner", "Director", "Manager", "Senior", "Associate"])
    .nullable()
    .default(null);
export const sliceSchema = z.object({
  metricCode: z.enum([
    "ARR",
    "NET_WORTH",
    "REVENUE",
    "LABOR_COST",
    "REALIZATION",
    "HOURS",
  ]),
  serviceLineId: nullableId,
  employeeLevel: level,
});
export const overrideSchema = sliceSchema
  .extend({
    effectiveDate: dateSchema,
    endDate: dateSchema.nullable().default(null),
    periodStart: dateSchema.nullable().default(null),
    periodEnd: dateSchema.nullable().default(null),
    numericValue: z.number().finite().min(-1e12).max(1e12),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
export const serviceStatusSchema = z
  .object({
    serviceLineId: z.uuid(),
    status: z.enum(["Active", "Inactive", "Pending", "Suspended"]),
    startDate: dateSchema,
    endDate: dateSchema.nullable().default(null),
    teamId: z.uuid(),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
interface Context {
  observations: Observation[];
  overrides: MetricOverride[];
  statuses: ServiceStatus[];
}
export class FinancialService {
  private metricCache: MetricDefinition[] | null = null;
  constructor(public core: Service) {}
  get db() {
    return this.core.db;
  }
  definitions() {
    return (this.metricCache ??= this.core.rows<MetricDefinition>(
      "SELECT * FROM metric_definition ORDER BY rowid",
    ));
  }
  definition(code: string) {
    const d = this.definitions().find((d) => d.code === code);
    if (!d) throw new HttpError(400, "Unknown metric.");
    return d;
  }
  serviceLines() {
    return this.core.rows<ServiceLine>(
      "SELECT * FROM service_line ORDER BY createdAt,code",
    );
  }
  settings(recordedAsOf?: string) {
    if (recordedAsOf)
      return (
        this.core.one<{ lookbackMonths: number }>(
          "SELECT lookbackMonths FROM financial_settings_history WHERE recordedAt<=? ORDER BY recordedAt DESC,rowid DESC LIMIT 1",
          recordedAsOf,
        )?.lookbackMonths ?? 12
      );
    return this.core.one<{ lookbackMonths: number }>(
      "SELECT lookbackMonths FROM financial_settings WHERE id='default'",
    )!.lookbackMonths;
  }
  catalog(): FinancialCatalog {
    return {
      serviceLines: this.serviceLines(),
      metrics: this.definitions(),
      employeeLevels,
      lookbackMonths: this.settings(),
      mode: "MOCK_FABRIC",
    };
  }
  requireMetric(
    user: Employee,
    groupId: string,
    definition: MetricDefinition,
    write = false,
  ) {
    this.core.requireGroup(user, groupId, write);
    if (
      definition.classification === "PROFITABILITY" &&
      !this.core.canViewProfitability(user, groupId)
    )
      throw new HttpError(
        403,
        "Profitability is restricted to authorized Partners, Directors and designated Relationship Managers.",
      );
  }
  validateSlice(
    def: MetricDefinition,
    serviceLineId: string | null,
    employeeLevel: string | null,
  ) {
    if (
      serviceLineId &&
      !this.serviceLines().some((s) => s.id === serviceLineId)
    )
      throw new HttpError(400, "Unknown service line.");
    if (def.dimensions === "GROUP" && (serviceLineId || employeeLevel))
      throw new HttpError(400, "This metric is defined at Client Group level.");
    if (["SERVICE", "SERVICE_LEVEL"].includes(def.dimensions) && !serviceLineId)
      throw new HttpError(400, "A service line is required.");
    if (def.dimensions === "SERVICE_LEVEL" && !employeeLevel)
      throw new HttpError(400, "An employee level is required.");
    if (def.dimensions !== "SERVICE_LEVEL" && employeeLevel)
      throw new HttpError(400, "This metric does not use employee levels.");
  }
  validateValue(def: MetricDefinition, value: number) {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12)
      throw new HttpError(
        400,
        "Metric value must be finite and within the supported range.",
      );
    if (
      def.unit === "USD" &&
      Math.abs(value * 100 - Math.round(value * 100)) > 0.0001
    )
      throw new HttpError(
        400,
        "USD amounts support at most two decimal places.",
      );
    if (["ARR", "HOURS", "REALIZATION"].includes(def.code) && value < 0)
      throw new HttpError(400, "This metric cannot be negative.");
  }
  validatePeriod(
    def: MetricDefinition,
    start: string | null,
    end: string | null,
    effectiveDate: string,
  ) {
    if (!def.periodic) {
      if (start || end)
        throw new HttpError(
          400,
          "Snapshot metrics do not have a measurement period.",
        );
      return;
    }
    if (!start || !end)
      throw new HttpError(400, "A monthly measurement period is required.");
    dateSchema.parse(start);
    dateSchema.parse(end);
    if (
      start !== monthStart(start) ||
      end !== shiftMonths(start, 1) ||
      effectiveDate !== dayBefore(end)
    )
      throw new HttpError(
        400,
        "Monthly source measurements must use a complete calendar month and its last day as the effective date.",
      );
  }
  context(groupId: string, recordedAsOf: string): Context {
    return {
      observations: this.core.rows<Observation>(
        "SELECT * FROM metric_observation WHERE groupId=? AND recordedAt<=? ORDER BY effectiveDate DESC,sourceRevision DESC,recordedAt DESC,rowid DESC",
        groupId,
        recordedAsOf,
      ),
      overrides: this.core.rows<MetricOverride>(
        "SELECT o.*,e.displayName actor FROM metric_override o JOIN employee e ON e.id=o.createdBy WHERE o.groupId=? AND o.recordedAt<=? ORDER BY o.effectiveDate DESC,o.recordedAt DESC,o.rowid DESC",
        groupId,
        recordedAsOf,
      ),
      statuses: this.core.rows<ServiceStatus>(
        "SELECT h.*,t.name team,e.displayName actor FROM client_service_history h JOIN team t ON t.id=h.teamId JOIN employee e ON e.id=h.createdBy WHERE h.groupId=? AND h.recordedAt<=? ORDER BY h.startDate DESC,h.recordedAt DESC,h.rowid DESC",
        groupId,
        recordedAsOf,
      ),
    };
  }
  resolve(
    ctx: Context,
    metricId: string,
    serviceLineId: string | null,
    employeeLevel: string | null,
    asOf: string,
    periodStart?: string,
  ): ResolvedMetric | null {
    const source = ctx.observations.find(
      (o) =>
        o.metricId === metricId &&
        o.serviceLineId === serviceLineId &&
        o.employeeLevel === employeeLevel &&
        o.effectiveDate <= asOf &&
        (periodStart === undefined || o.periodStart === periodStart),
    );
    if (!source) return null;
    const override = ctx.overrides.find(
      (o) =>
        o.metricId === metricId &&
        o.serviceLineId === serviceLineId &&
        o.employeeLevel === employeeLevel &&
        o.effectiveDate <= asOf &&
        (!o.endDate || o.endDate > asOf) &&
        o.periodStart === source.periodStart &&
        o.periodEnd === source.periodEnd,
    );
    const applied = override?.action === "VALUE" ? override : undefined;
    const def = this.definitions().find((d) => d.id === metricId)!;
    return {
      metric: def.code,
      value: applied?.numericValue ?? source.numericValue,
      sourceValue: source.numericValue,
      overrideValue: applied?.numericValue ?? null,
      observationId: source.id,
      overrideId: applied?.id ?? null,
      sourceSystem: source.sourceSystem,
      sourceRevision: source.sourceRevision,
      externalReference: source.externalReference,
      effectiveDate: source.effectiveDate,
      periodStart: source.periodStart,
      periodEnd: source.periodEnd,
      recordedAt: source.recordedAt,
      ...(applied
        ? {
            overrideReason: applied.reason,
            overrideActor: applied.actor,
            overrideRecordedAt: applied.recordedAt,
          }
        : {}),
    };
  }
  status(ctx: Context, lineId: string, asOf: string) {
    const s = ctx.statuses.find(
      (s) => s.serviceLineId === lineId && s.startDate <= asOf,
    );
    return s && (!s.endDate || s.endDate > asOf) ? s : null;
  }
  overview(
    user: Employee,
    groupId: string,
    asOf = today(),
    recordedAsOf = new Date().toISOString(),
    onlyServiceLineId?: string,
    context?: Context,
  ): FinancialOverview {
    this.core.requireGroup(user, groupId);
    if (
      onlyServiceLineId &&
      !this.serviceLines().some((s) => s.id === onlyServiceLineId)
    )
      throw new HttpError(400, "Unknown service line.");
    const ctx = context || this.context(groupId, recordedAsOf),
      canProfit = this.core.canViewProfitability(user, groupId),
      window = completedWindow(asOf, this.settings(recordedAsOf)),
      definitions = new Map(this.definitions().map((d) => [d.code, d.id])),
      warnings: string[] = [];
    const resolve = (
      code: MetricCode,
      line: string | null = null,
      level: string | null = null,
      date = asOf,
      period?: string,
    ) => this.resolve(ctx, definitions.get(code)!, line, level, date, period);
    const lines: FinancialLine[] = this.serviceLines()
      .filter((s) => !onlyServiceLineId || s.id === onlyServiceLineId)
      .map((serviceLine) => {
        const line = serviceLine.id,
          arr = resolve("ARR", line),
          revenue = resolve("REVENUE", line),
          laborCost = canProfit ? resolve("LABOR_COST", line) : undefined,
          status = this.status(ctx, line, asOf),
          samePeriod =
            revenue &&
            laborCost &&
            revenue.periodStart === laborCost.periodStart &&
            revenue.periodEnd === laborCost.periodEnd;
        if (arr && arr.value > 0 && status?.status !== "Active")
          warnings.push(
            `${serviceLine.name} has ARR while service status is ${status?.status.toLowerCase() || "not recorded"}. Status is not inferred from ARR.`,
          );
        const hours = employeeLevels.map((employeeLevel) => {
          const periods = Array.from({ length: window.months }, (_, i) =>
              shiftMonths(window.start, i),
            ),
            values = periods.map((p) =>
              resolve(
                "HOURS",
                line,
                employeeLevel,
                dayBefore(shiftMonths(p, 1)),
                p,
              ),
            );
          const covered = values.filter((v): v is ResolvedMetric => v !== null),
            complete = covered.length === window.months,
            total = complete ? covered.reduce((n, v) => n + v.value, 0) : null;
          return {
            employeeLevel,
            monthlyAverage:
              total === null
                ? null
                : Math.round((total / window.months) * 1e6) / 1e6,
            annualized:
              total === null
                ? null
                : Math.round((total / window.months) * 12 * 1e6) / 1e6,
            totalHours: total,
            coveredMonths: covered.length,
            expectedMonths: window.months,
            overrideCount: covered.filter((v) => v.overrideId).length,
          };
        });
        return {
          serviceLine,
          status,
          arr,
          revenue,
          realization: resolve("REALIZATION", line),
          hours,
          ...(canProfit
            ? {
                laborCost: laborCost ?? null,
                grossMargin: samePeriod
                  ? roundMoney(revenue.value - laborCost.value)
                  : null,
                grossMarginPercentage:
                  samePeriod && revenue.value !== 0
                    ? ((revenue.value - laborCost.value) / revenue.value) * 100
                    : null,
              }
            : {}),
        };
      });
    const arrLines = lines.filter((l) => l.arr),
      familyArr = onlyServiceLineId ? null : resolve("ARR"),
      totalARR = arrLines.length
        ? sumMoney(arrLines.map((l) => l.arr!.value))
        : (familyArr?.value ?? null);
    const revenueLines = lines.filter((l) => l.revenue),
      periodStart = revenueLines[0]?.revenue?.periodStart ?? null,
      periodEnd = revenueLines[0]?.revenue?.periodEnd ?? null,
      matchingRevenue =
        revenueLines.length > 0 &&
        revenueLines.every(
          (l) =>
            l.revenue!.periodStart === periodStart &&
            l.revenue!.periodEnd === periodEnd,
        ),
      revenue = matchingRevenue
        ? sumMoney(revenueLines.map((l) => l.revenue!.value))
        : null,
      matchingCosts =
        matchingRevenue &&
        revenueLines.every(
          (l) =>
            l.laborCost &&
            l.laborCost.periodStart === periodStart &&
            l.laborCost.periodEnd === periodEnd,
        ),
      cost = matchingCosts
        ? sumMoney(revenueLines.map((l) => l.laborCost!.value))
        : null;
    if (revenueLines.length && !matchingRevenue)
      warnings.push(
        "Revenue measurement periods differ across service lines; the aggregate is unavailable.",
      );
    if (canProfit && revenue !== null && cost === null)
      warnings.push(
        "Matching labor-cost periods are incomplete; aggregate margin is unavailable.",
      );
    const group = this.core.group(user, groupId);
    const summary: FinancialSummary = {
      totalARR,
      arrSource: arrLines.length
        ? "Service-line snapshots (family total excluded)"
        : familyArr
          ? "Imported family total"
          : "Unavailable",
      netWorth: resolve("NET_WORTH"),
      tenureYears: Math.max(
        0,
        (new Date(asOf + "T12:00:00Z").valueOf() -
          new Date(group.inceptionDate + "T12:00:00Z").valueOf()) /
          86400000 /
          365.2425,
      ),
      revenue,
      periodStart: matchingRevenue ? periodStart : null,
      periodEnd: matchingRevenue ? periodEnd : null,
      ...(canProfit
        ? {
            laborCost: cost,
            grossMargin:
              cost !== null && revenue !== null
                ? roundMoney(revenue - cost)
                : null,
            grossMarginPercentage:
              cost !== null && revenue !== null && revenue !== 0
                ? ((revenue - cost) / revenue) * 100
                : null,
          }
        : {}),
    };
    return {
      groupId,
      asOf,
      recordedAsOf,
      canViewProfitability: canProfit,
      canEdit: this.core.canEdit(user, groupId),
      summary,
      lines,
      hoursWindow: window,
      warnings,
      dataMode: "MOCK_FABRIC",
    };
  }
  history(
    user: Employee,
    groupId: string,
    input: unknown,
    asOf: string,
    recordedAsOf: string,
  ): FinancialHistory {
    const slice = sliceSchema.strict().parse(input),
      def = this.definition(slice.metricCode);
    this.requireMetric(user, groupId, def);
    this.validateSlice(def, slice.serviceLineId, slice.employeeLevel);
    const ctx = this.context(groupId, recordedAsOf),
      observations = ctx.observations.filter(
        (o) =>
          o.metricId === def.id &&
          o.serviceLineId === slice.serviceLineId &&
          o.employeeLevel === slice.employeeLevel,
      ),
      overrides = ctx.overrides.filter(
        (o) =>
          o.metricId === def.id &&
          o.serviceLineId === slice.serviceLineId &&
          o.employeeLevel === slice.employeeLevel,
      );
    return {
      definition: def,
      observations: observations.slice(0, 240),
      overrides: overrides.slice(0, 100),
      totalObservations: observations.length,
      totalOverrides: overrides.length,
      resolved: this.resolve(
        ctx,
        def.id,
        slice.serviceLineId,
        slice.employeeLevel,
        asOf,
      ),
    };
  }
  createOverride(user: Employee, groupId: string, input: unknown) {
    const v = overrideSchema.parse(input),
      def = this.definition(v.metricCode);
    this.requireMetric(user, groupId, def, true);
    this.validateSlice(def, v.serviceLineId, v.employeeLevel);
    this.core.range(v.effectiveDate, v.endDate);
    this.validateValue(def, v.numericValue);
    if (def.periodic) {
      if (!v.periodStart || !v.periodEnd)
        throw new HttpError(400, "Choose the exact source measurement period.");
      dateSchema.parse(v.periodStart);
      dateSchema.parse(v.periodEnd);
    }
    return transaction(this.db, () => {
      const ctx = this.context(groupId, new Date().toISOString()),
        source = this.resolve(
          ctx,
          def.id,
          v.serviceLineId,
          v.employeeLevel,
          v.effectiveDate,
        );
      if (
        !source ||
        source.periodStart !== v.periodStart ||
        source.periodEnd !== v.periodEnd
      )
        throw new HttpError(
          400,
          "The override must match an existing eligible source observation and its exact measurement period.",
        );
      const id = randomUUID(),
        recordedAt = new Date().toISOString();
      const previous = ctx.overrides.find(
        (o) =>
          o.metricId === def.id &&
          o.serviceLineId === v.serviceLineId &&
          o.employeeLevel === v.employeeLevel &&
          o.effectiveDate === v.effectiveDate &&
          o.periodStart === v.periodStart &&
          o.periodEnd === v.periodEnd,
      );
      insert(this.db, "metric_override", {
        id,
        groupId,
        metricId: def.id,
        serviceLineId: v.serviceLineId,
        employeeLevel: v.employeeLevel,
        effectiveDate: v.effectiveDate,
        endDate: v.endDate,
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        numericValue: v.numericValue,
        action: "VALUE",
        reason: v.reason,
        createdBy: user.id,
        recordedAt,
        supersedesId: previous?.id ?? null,
      });
      this.core.log(
        user,
        groupId,
        "Financial override recorded",
        id,
        null,
        { ...v, recordedAt },
        def.classification,
      );
      return { id };
    });
  }
  withdrawOverride(
    user: Employee,
    groupId: string,
    overrideId: string,
    reason: string,
  ) {
    return transaction(this.db, () => {
      this.core.requireGroup(user, groupId, true);
      const target = this.core.one<MetricOverride>(
        "SELECT * FROM metric_override WHERE id=? AND groupId=?",
        overrideId,
        groupId,
      );
      if (!target) throw new HttpError(404, "Override not found");
      const def = this.definitions().find((d) => d.id === target.metricId)!;
      this.requireMetric(user, groupId, def, true);
      if (target.action !== "VALUE")
        throw new HttpError(409, "This event is already a withdrawal.");
      const latest = this.core.one<{ id: string }>(
        "SELECT id FROM metric_override WHERE groupId=? AND metricId=? AND serviceLineId IS ? AND employeeLevel IS ? AND effectiveDate=? AND periodStart IS ? AND periodEnd IS ? ORDER BY recordedAt DESC,rowid DESC LIMIT 1",
        groupId,
        target.metricId,
        target.serviceLineId,
        target.employeeLevel,
        target.effectiveDate,
        target.periodStart,
        target.periodEnd,
      );
      if (latest?.id !== target.id)
        throw new HttpError(
          409,
          "Only the latest event in this override series can be withdrawn.",
        );
      const id = randomUUID();
      insert(this.db, "metric_override", {
        id,
        groupId,
        metricId: target.metricId,
        serviceLineId: target.serviceLineId,
        employeeLevel: target.employeeLevel,
        effectiveDate: target.effectiveDate,
        endDate: target.endDate,
        periodStart: target.periodStart,
        periodEnd: target.periodEnd,
        numericValue: null,
        action: "WITHDRAW",
        reason: z.string().trim().min(5).max(2000).parse(reason),
        createdBy: user.id,
        recordedAt: new Date().toISOString(),
        supersedesId: target.id,
      });
      this.core.log(
        user,
        groupId,
        "Financial override withdrawn",
        id,
        { overrideId: target.id },
        { reason },
        def.classification,
      );
      return { id };
    });
  }
  serviceHistory(user: Employee, groupId: string, recordedAsOf: string) {
    this.core.requireGroup(user, groupId);
    return this.context(groupId, recordedAsOf).statuses.slice(0, 200);
  }
  changeServiceStatus(user: Employee, groupId: string, input: unknown) {
    this.core.requireGroup(user, groupId, true);
    const v = serviceStatusSchema.parse(input);
    this.core.range(v.startDate, v.endDate);
    if (!this.serviceLines().some((s) => s.id === v.serviceLineId && s.active))
      throw new HttpError(400, "Choose an active service line.");
    if (!this.core.teams().some((t) => t.id === v.teamId && t.active))
      throw new HttpError(400, "Choose an active responsible team.");
    return transaction(this.db, () => {
      const prior = this.core.one<ServiceStatus>(
        "SELECT * FROM client_service_history WHERE groupId=? AND serviceLineId=? ORDER BY startDate DESC,recordedAt DESC,rowid DESC LIMIT 1",
        groupId,
        v.serviceLineId,
      );
      if (prior && v.startDate <= prior.startDate)
        throw new HttpError(
          409,
          "A service change must follow the latest effective start date.",
        );
      const id = randomUUID();
      insert(this.db, "client_service_history", {
        id,
        groupId,
        ...v,
        source: "CRM",
        recordedAt: new Date().toISOString(),
        createdBy: user.id,
        supersedesId: prior?.id ?? null,
      });
      this.core.log(
        user,
        groupId,
        "Service status changed",
        id,
        prior ?? null,
        v,
      );
      return { id };
    });
  }
  trend(
    user: Employee,
    groupId: string,
    end: string,
    recordedAsOf: string,
    granularity: "monthly" | "quarterly",
    serviceLineId?: string,
  ): FinancialPoint[] {
    this.core.requireGroup(user, groupId);
    const ctx = this.context(groupId, recordedAsOf),
      count = granularity === "quarterly" ? 8 : 12,
      endMonth = monthStart(end),
      quarterStart = `${end.slice(0, 4)}-${String(Math.floor((Number(end.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`,
      canProfit = this.core.canViewProfitability(user, groupId);
    const points: FinancialPoint[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const start =
        granularity === "quarterly"
          ? shiftMonths(quarterStart, -i * 3)
          : shiftMonths(endMonth, -i);
      let date = dayBefore(
        shiftMonths(start, granularity === "quarterly" ? 3 : 1),
      );
      if (i === 0) date = end;
      const current = this.overview(
        user,
        groupId,
        date,
        recordedAsOf,
        serviceLineId,
        ctx,
      ).summary;
      let revenue = current.revenue,
        cost = current.laborCost ?? null,
        margin = current.grossMargin ?? null,
        periodStart = current.periodStart,
        periodEnd = current.periodEnd;
      if (granularity === "quarterly") {
        const monthDates = [0, 1, 2]
            .map((m) => shiftMonths(start, m))
            .filter((m) => dayBefore(shiftMonths(m, 1)) <= date),
          parts = monthDates.map(
            (m) =>
              this.overview(
                user,
                groupId,
                dayBefore(shiftMonths(m, 1)),
                recordedAsOf,
                serviceLineId,
                ctx,
              ).summary,
          ),
          complete =
            parts.length > 0 &&
            parts.every(
              (p, j) =>
                p.periodStart === monthDates[j] &&
                p.periodEnd === shiftMonths(monthDates[j], 1) &&
                p.revenue !== null,
            );
        revenue = complete ? sumMoney(parts.map((p) => p.revenue!)) : null;
        cost =
          complete &&
          canProfit &&
          parts.every((p) => p.laborCost !== null && p.laborCost !== undefined)
            ? sumMoney(parts.map((p) => p.laborCost!))
            : null;
        margin =
          revenue !== null && cost !== null ? roundMoney(revenue - cost) : null;
        periodStart = complete ? start : null;
        periodEnd = complete ? shiftMonths(monthDates.at(-1)!, 1) : null;
      }
      points.push({
        date,
        arr: current.totalARR,
        netWorth: current.netWorth?.value ?? null,
        revenue,
        periodStart,
        periodEnd,
        ...(canProfit
          ? {
              laborCost: cost,
              grossMargin: margin,
              grossMarginPercentage:
                margin !== null && revenue !== null && revenue !== 0
                  ? (margin / revenue) * 100
                  : null,
            }
          : {}),
      });
    }
    return points;
  }

  report(
    user: Employee,
    asOf: string,
    recordedAsOf: string,
    filters: {
      groupId?: string;
      serviceLineId?: string;
      teamId?: string;
      partnerId?: string;
      managerId?: string;
      status?: string;
    },
  ): FinancialReport {
    if (filters.groupId) this.core.requireGroup(user, filters.groupId);
    if (
      filters.serviceLineId &&
      !this.serviceLines().some((s) => s.id === filters.serviceLineId)
    )
      throw new HttpError(400, "Unknown service line.");
    let groups = this.core
      .groups(user)
      .filter(
        (g) =>
          (!filters.groupId || g.id === filters.groupId) &&
          (!filters.teamId || g.teamId === filters.teamId) &&
          (!filters.partnerId || g.partnerId === filters.partnerId) &&
          (!filters.managerId || g.managerId === filters.managerId) &&
          (!filters.status || g.status === filters.status),
      );
    if (filters.serviceLineId)
      groups = groups.filter((g) => {
        const status = this.status(
          this.context(g.id, recordedAsOf),
          filters.serviceLineId!,
          asOf,
        );
        return status?.status === "Active";
      });
    if (groups.length > 250)
      throw new HttpError(
        400,
        "Narrow the report filters to at most 250 Client Groups.",
      );
    const rows = groups.map((group) => ({
        group,
        financial: this.overview(
          user,
          group.id,
          asOf,
          recordedAsOf,
          filters.serviceLineId,
        ),
      })),
      canViewAllProfitability =
        rows.length > 0 && rows.every((r) => r.financial.canViewProfitability);
    const complete = (values: (number | null | undefined)[]) =>
      values.length && values.every((v) => v !== null && v !== undefined)
        ? sumMoney(values as number[])
        : null;
    const periodStart = rows[0]?.financial.summary.periodStart ?? null,
      periodEnd = rows[0]?.financial.summary.periodEnd ?? null,
      compatible =
        rows.length > 0 &&
        rows.every(
          (r) =>
            r.financial.summary.periodStart === periodStart &&
            r.financial.summary.periodEnd === periodEnd,
        ) &&
        periodStart !== null,
      revenue = compatible
        ? complete(rows.map((r) => r.financial.summary.revenue))
        : null,
      margin =
        canViewAllProfitability && compatible
          ? complete(rows.map((r) => r.financial.summary.grossMargin))
          : null;
    const serviceTotals = this.serviceLines()
      .filter((s) => !filters.serviceLineId || s.id === filters.serviceLineId)
      .map((service) => {
        const lines = rows.map((r) =>
            r.financial.lines.find((l) => l.serviceLine.id === service.id),
          ),
          arrValues = lines.map((l) => l?.arr?.value),
          start = lines[0]?.revenue?.periodStart ?? null,
          end = lines[0]?.revenue?.periodEnd ?? null,
          periodsMatch =
            lines.length > 0 &&
            start !== null &&
            lines.every(
              (l) =>
                l?.revenue?.periodStart === start &&
                l?.revenue?.periodEnd === end,
            ),
          lineRevenue = periodsMatch
            ? complete(lines.map((l) => l?.revenue?.value))
            : null,
          lineCosts =
            canViewAllProfitability &&
            periodsMatch &&
            lines.every(
              (l) =>
                l?.laborCost?.periodStart === start &&
                l?.laborCost?.periodEnd === end,
            )
              ? complete(lines.map((l) => l?.laborCost?.value))
              : null,
          lineMargin =
            lineRevenue !== null && lineCosts !== null
              ? roundMoney(lineRevenue - lineCosts)
              : null;
        return {
          serviceLineId: service.id,
          name: service.name,
          arr: complete(arrValues),
          coverage: arrValues.filter((v) => v !== null && v !== undefined)
            .length,
          groupCount: rows.length,
          revenue: lineRevenue,
          periodStart: periodsMatch ? start : null,
          periodEnd: periodsMatch ? end : null,
          ...(canViewAllProfitability
            ? {
                grossMargin: lineMargin,
                grossMarginPercentage:
                  lineRevenue !== null &&
                  lineRevenue !== 0 &&
                  lineMargin !== null
                    ? (lineMargin / lineRevenue) * 100
                    : null,
              }
            : {}),
        };
      });
    const knownWorth = rows
        .map((r) => r.financial.summary.netWorth?.value)
        .filter((v): v is number => v !== null && v !== undefined),
      netWorthDistribution = [
        {
          label: "Below $10m",
          count: knownWorth.filter((v) => v < 10000000).length,
        },
        {
          label: "$10m–$25m",
          count: knownWorth.filter((v) => v >= 10000000 && v < 25000000).length,
        },
        {
          label: "$25m–$50m",
          count: knownWorth.filter((v) => v >= 25000000 && v < 50000000).length,
        },
        {
          label: "$50m and above",
          count: knownWorth.filter((v) => v >= 50000000).length,
        },
      ];
    return {
      serviceTotals,
      netWorthDistribution,
      missingNetWorthCount: rows.length - knownWorth.length,
      asOf,
      recordedAsOf,
      rows,
      totals: {
        arr: complete(rows.map((r) => r.financial.summary.totalARR)),
        netWorth: complete(
          rows.map((r) => r.financial.summary.netWorth?.value),
        ),
        revenue,
        ...(canViewAllProfitability
          ? {
              grossMargin: margin,
              grossMarginPercentage:
                margin !== null && revenue !== null && revenue !== 0
                  ? (margin / revenue) * 100
                  : null,
            }
          : {}),
      },
      canViewAllProfitability,
      periodStart: compatible ? periodStart : null,
      periodEnd: compatible ? periodEnd : null,
      warnings: [
        ...(!canViewAllProfitability && rows.length
          ? [
              "Portfolio profitability totals are restricted because not every selected Client Group is in your approved scope.",
            ]
          : []),
        ...(!compatible && rows.length
          ? [
              "Matching revenue periods are unavailable across the selected groups.",
            ]
          : []),
      ],
    };
  }
  validateSource(row: SourceObservation) {
    const def = this.definition(row.metricCode);
    if (def.derived)
      throw new HttpError(
        400,
        "Derived metrics are calculated from approved components.",
      );
    const service = row.serviceLineCode
      ? this.serviceLines().find((s) => s.code === row.serviceLineCode)
      : null;
    if (row.serviceLineCode && !service)
      throw new HttpError(400, "Unknown source service-line code.");
    if (row.employeeLevel && !employeeLevels.includes(row.employeeLevel))
      throw new HttpError(400, "Unknown source employee level.");
    dateSchema.parse(row.effectiveDate);
    this.validateSlice(def, service?.id ?? null, row.employeeLevel);
    this.validateValue(def, row.numericValue);
    this.validatePeriod(def, row.periodStart, row.periodEnd, row.effectiveDate);
    if (row.currency !== "USD")
      throw new HttpError(400, "Only mapped USD amounts are supported.");
    if (!Number.isInteger(row.sourceRevision) || row.sourceRevision < 1)
      throw new HttpError(400, "Source revision must be a positive integer.");
    return { def, serviceLineId: service?.id ?? null };
  }
}
