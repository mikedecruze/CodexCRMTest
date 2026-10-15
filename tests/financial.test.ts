import { beforeEach, afterEach, it, expect } from "vitest";
import request from "supertest";
import { openDb, type Db } from "../server/db.ts";
import { seed, seedId } from "../server/seed.ts";
import { Service } from "../server/service.ts";
import { createApp } from "../server/app.ts";
import { FinancialService } from "../server/financial/service.ts";
import { FinancialImports } from "../server/financial/imports.ts";
import {
  MockFabricConnector,
  mockObservations,
} from "../server/financial/connector.ts";
import { completedWindow, financialId } from "../server/financial/catalog.ts";
const origin = "http://localhost:5173",
  group = seedId("smith"),
  line = financialId("service-FAMILY_OFFICE");
let db: Db,
  core: Service,
  finance: FinancialService,
  imports: FinancialImports,
  app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDb(":memory:");
  seed(db);
  core = new Service(db);
  finance = new FinancialService(core);
  imports = new FinancialImports(finance, new MockFabricConnector());
  app = createApp(db, { demo: true, origin });
});
afterEach(() => db.close());
const user = (key = "james") => core.employee(seedId(key))!;
const overview = (date = "2025-12-31", known = "2026-03-01T12:00:00.000Z") =>
  finance.overview(user(), group, date, known);
async function login(key = "james") {
  const a = request.agent(app);
  await a
    .post("/api/auth/demo")
    .set("Origin", origin)
    .send({ employeeId: seedId(key) })
    .expect(200);
  return a;
}
const override = (extra = {}) => ({
  metricCode: "ARR",
  serviceLineId: line,
  employeeLevel: null,
  effectiveDate: "2025-12-31",
  endDate: "2026-02-01",
  periodStart: null,
  periodEnd: null,
  numericValue: 320000,
  reason: "Approved synthetic financial revision",
  ...extra,
});
it("resolves business time and knowledge time independently, preserving source revisions and overrides", () => {
  const first = overview("2025-12-31", "2026-01-07T12:00:00.000Z").lines.find(
      (l) => l.serviceLine.id === line,
    )!.arr!,
    overridden = overview("2025-12-31", "2026-01-20T12:00:00.000Z").lines.find(
      (l) => l.serviceLine.id === line,
    )!.arr!,
    corrected = overview().lines.find((l) => l.serviceLine.id === line)!.arr!;
  expect(first.value).toBe(286000);
  expect(first.sourceRevision).toBe(1);
  expect(first.overrideValue).toBeNull();
  expect(overridden.value).toBe(315000);
  expect(overridden.sourceValue).toBe(286000);
  expect(corrected.sourceValue).toBe(290000);
  expect(corrected.value).toBe(315000);
  expect(corrected.overrideActor).toBe("James Carter");
  expect(
    overview("2026-02-01").lines.find((l) => l.serviceLine.id === line)!.arr!
      .overrideValue,
  ).toBeNull();
});
it("sums service-line ARR once without summing snapshots or the imported group total", () => {
  const d = overview("2025-12-31", "2026-01-07T12:00:00.000Z");
  expect(d.summary.totalARR).toBe(416500);
  expect(d.summary.totalARR).toBe(
    d.lines.reduce((n, l) => n + (l.arr?.value ?? 0), 0),
  );
  expect(d.summary.arrSource).toContain("family total excluded");
});
it("calculates margin dollars and percentages from compatible revenue and cost components", () => {
  const d = overview();
  expect(d.summary.grossMargin).toBeCloseTo(
    d.summary.revenue! - d.summary.laborCost!,
    2,
  );
  expect(d.summary.grossMarginPercentage).toBeCloseTo(
    (d.summary.grossMargin! / d.summary.revenue!) * 100,
    8,
  );
  for (const l of d.lines.filter((l) => l.revenue?.value))
    expect(l.grossMarginPercentage).toBeCloseTo(
      ((l.revenue!.value - l.laborCost!.value) / l.revenue!.value) * 100,
    );
  expect(
    d.lines.find((l) => l.serviceLine.code === "OTHER")!.grossMarginPercentage,
  ).toBeNull();
});
it("keeps realization as the source measure instead of calculating an aggregate percentage", () => {
  const d = overview();
  expect(
    d.lines.find((l) => l.serviceLine.id === line)!.realization!.sourceSystem,
  ).toBe("MOCK_FABRIC");
  expect(d.summary).not.toHaveProperty("realization");
  expect(finance.definition("REALIZATION").calculation).toContain(
    "Production Fabric definition is unmapped",
  );
});
it("computes monthly-average and annualized hours by service and employee level over completed months", () => {
  const d = overview(),
    h = d.lines
      .find((l) => l.serviceLine.id === line)!
      .hours.find((h) => h.employeeLevel === "Manager")!;
  expect(d.hoursWindow).toEqual({
    start: "2025-01-01",
    end: "2026-01-01",
    months: 12,
  });
  expect(h.coveredMonths).toBe(12);
  expect(h.monthlyAverage).toBe(21);
  expect(h.annualized).toBe(252);
  expect(completedWindow("2025-12-15", 12)).toEqual({
    start: "2024-12-01",
    end: "2025-12-01",
    months: 12,
  });
});
it("returns coverage rather than invented zero hours for incomplete or unknown datasets", () => {
  const d = overview("2024-03-31", "2024-05-01T00:00:00.000Z"),
    h = d.lines.find((l) => l.serviceLine.id === line)!.hours[0];
  expect(h.coveredMonths).toBe(3);
  expect(h.monthlyAverage).toBeNull();
  expect(h.annualized).toBeNull();
  expect(
    finance.overview(user(), seedId("bennett"), "2020-01-01").summary.totalARR,
  ).toBeNull();
});
it("retains immutable imported observations and append-only override history", () => {
  expect(() => db.exec("UPDATE metric_observation SET numericValue=0")).toThrow(
    "immutable",
  );
  expect(() => db.exec("DELETE FROM metric_observation")).toThrow("immutable");
  expect(() => db.exec("UPDATE metric_override SET numericValue=0")).toThrow(
    "immutable",
  );
});
it("creates and withdraws overrides while retaining source and prior knowledge states", () => {
  const before = new Date().toISOString(),
    result = finance.createOverride(user(), group, override()),
    d = finance.overview(user(), group, "2025-12-31");
  expect(d.lines.find((l) => l.serviceLine.id === line)!.arr!.value).toBe(
    320000,
  );
  expect(
    finance
      .overview(user(), group, "2025-12-31", "2026-03-01T00:00:00.000Z")
      .lines.find((l) => l.serviceLine.id === line)!.arr!.value,
  ).toBe(315000);
  finance.withdrawOverride(
    user(),
    group,
    result.id,
    "Return to approved source",
  );
  const latest = finance
    .overview(user(), group, "2025-12-31")
    .lines.find((l) => l.serviceLine.id === line)!.arr!;
  expect(latest.value).toBe(290000);
  expect(latest.overrideId).toBeNull();
  expect(
    db
      .prepare("SELECT count(*) n FROM metric_override WHERE recordedAt>=?")
      .get(before)!.n,
  ).toBeGreaterThanOrEqual(2);
});
it("requires exact measurement periods and prevents a December override spilling into January", () => {
  finance.createOverride(
    user(),
    group,
    override({
      metricCode: "REVENUE",
      periodStart: "2025-12-01",
      periodEnd: "2026-01-01",
      numericValue: 30000,
      endDate: null,
    }),
  );
  expect(
    finance
      .overview(user(), group, "2025-12-31")
      .lines.find((l) => l.serviceLine.id === line)!.revenue!.value,
  ).toBe(30000);
  expect(
    finance
      .overview(user(), group, "2026-01-31")
      .lines.find((l) => l.serviceLine.id === line)!.revenue!.value,
  ).not.toBe(30000);
  expect(() =>
    finance.createOverride(
      user(),
      group,
      override({
        metricCode: "REVENUE",
        periodStart: "2025-11-01",
        periodEnd: "2025-12-01",
      }),
    ),
  ).toThrow("exact measurement period");
});
it("rejects invalid dimensions, amounts, empty reasons and unsupported derived overrides", () => {
  for (const bad of [
    { serviceLineId: null, metricCode: "HOURS" },
    { employeeLevel: "Senior" },
    { numericValue: 1.001 },
    { numericValue: -1 },
    { endDate: "2025-01-01" },
    { reason: "" },
    { metricCode: "GROSS_MARGIN" },
  ])
    expect(() =>
      finance.createOverride(user(), group, override(bad)),
    ).toThrow();
});
it("exposes costs only to group-authorized Partners, Directors, current RMs or expressly granted users", () => {
  for (const key of ["elizabeth", "diana", "james"])
    expect(finance.overview(user(key), group).canViewProfitability).toBe(true);
  for (const key of ["oliver", "sophia"]) {
    const d = finance.overview(user(key), group);
    expect(d.canViewProfitability).toBe(false);
    expect(d.summary).not.toHaveProperty("laborCost");
    expect(d.summary).not.toHaveProperty("grossMargin");
    expect(d.lines[0]).not.toHaveProperty("laborCost");
    expect(d.lines[0]).not.toHaveProperty("grossMarginPercentage");
  }
  expect(() => finance.overview(user("william"), group)).toThrow(
    "Record not found",
  );
});
it("does not grant profitability merely from administrator status or Manager level", () => {
  db.prepare("UPDATE employee SET role='admin' WHERE id=?").run(
    seedId("oliver"),
  );
  expect(finance.overview(user("oliver"), group).canViewProfitability).toBe(
    false,
  );
  db.prepare("UPDATE client_group SET managerId=? WHERE id=?").run(
    seedId("diana"),
    group,
  );
  expect(finance.overview(user("james"), group).canViewProfitability).toBe(
    false,
  );
});
it("revokes profitability immediately, even for a newly granted same-day scope", () => {
  const grant = imports.grant(user("elizabeth"), {
    groupId: group,
    employeeId: seedId("oliver"),
    startDate: "2020-01-01",
    reason: "Approved financial analysis",
  });
  expect(finance.overview(user("oliver"), group).canViewProfitability).toBe(
    true,
  );
  imports.revokeGrant(user("elizabeth"), grant.id, "Assignment scope removed");
  expect(finance.overview(user("oliver"), group).canViewProfitability).toBe(
    false,
  );
});
it("rejects grants that attempt to bypass Client Group access", () => {
  expect(() =>
    imports.grant(user("elizabeth"), {
      groupId: group,
      employeeId: seedId("noah"),
      startDate: "2020-01-01",
      reason: "Invalid access bypass",
    }),
  ).toThrow("does not grant Client Group access");
});
it("redacts sensitive audit events and history endpoints as well as the overview", async () => {
  finance.createOverride(
    user(),
    group,
    override({
      metricCode: "LABOR_COST",
      periodStart: "2025-12-01",
      periodEnd: "2026-01-01",
      numericValue: 12345,
      reason: "CONFIDENTIAL_COST_CANARY",
    }),
  );
  const a = await login("oliver");
  await a
    .get(
      `/api/groups/${group}/financials/history?metricCode=LABOR_COST&serviceLineId=${line}`,
    )
    .expect(403);
  await a
    .post(`/api/groups/${group}/financials/overrides`)
    .set("Origin", origin)
    .send(
      override({
        metricCode: "LABOR_COST",
        periodStart: "2025-12-01",
        periodEnd: "2026-01-01",
      }),
    )
    .expect(403);
  const audit = await a.get(`/api/audit?groupId=${group}`).expect(200);
  expect(JSON.stringify(audit.body)).not.toContain("CONFIDENTIAL_COST_CANARY");
});
it("prevents cross-family financial access through shared entities and report filters", async () => {
  const a = await login();
  for (const path of [
    `/api/groups/${seedId("carter")}/financials`,
    `/api/groups/${seedId("carter")}/financials/trend`,
    `/api/groups/${seedId("carter")}/financials/history?metricCode=ARR&serviceLineId=${line}`,
    `/api/financial/reports?groupId=${seedId("carter")}`,
  ])
    await a.get(path).expect(404);
  const report = await a
    .get("/api/financial/reports?asOf=2025-12-31")
    .expect(200);
  expect(report.body.rows).toHaveLength(2);
  expect(JSON.stringify(report.body)).not.toContain("Carter Family");
});
it("withholds portfolio profitability totals when even one selected group is outside approved scope", () => {
  db.prepare("UPDATE client_group SET managerId=? WHERE id=?").run(
    seedId("diana"),
    seedId("bennett"),
  );
  const report = finance.report(
    user(),
    "2025-12-31",
    new Date().toISOString(),
    {},
  );
  expect(report.rows).toHaveLength(2);
  expect(report.canViewAllProfitability).toBe(false);
  expect(report.totals).not.toHaveProperty("grossMargin");
  expect(
    report.rows.find((r) => r.group.id === group)!.financial.summary,
  ).toHaveProperty("grossMargin");
});
it("maintains service status independently of source ARR and historical recording time", () => {
  const before = finance.overview(user("ava"), seedId("carter"), "2025-06-30"),
    after = finance.overview(user("ava"), seedId("carter"), "2025-07-31");
  expect(
    before.lines.find((l) => l.serviceLine.id === line)!.status!.status,
  ).toBe("Active");
  expect(
    after.lines.find((l) => l.serviceLine.id === line)!.status!.status,
  ).toBe("Inactive");
  expect(
    after.lines.find((l) => l.serviceLine.id === line)!.arr!.value,
  ).toBeGreaterThan(0);
  expect(after.warnings.some((w) => w.includes("Family Office has ARR"))).toBe(
    true,
  );
});
it("appends service transitions without deleting old states or guessing after an interval expires", () => {
  finance.changeServiceStatus(user(), group, {
    serviceLineId: line,
    status: "Suspended",
    startDate: "2025-08-01",
    endDate: "2025-10-01",
    teamId: seedId("team-cedar"),
    reason: "Approved synthetic service pause",
  });
  expect(
    finance
      .overview(user(), group, "2025-07-31")
      .lines.find((l) => l.serviceLine.id === line)!.status!.status,
  ).toBe("Active");
  expect(
    finance
      .overview(user(), group, "2025-08-31")
      .lines.find((l) => l.serviceLine.id === line)!.status!.status,
  ).toBe("Suspended");
  expect(
    finance
      .overview(user(), group, "2025-10-01")
      .lines.find((l) => l.serviceLine.id === line)!.status,
  ).toBeNull();
  expect(() => db.exec("DELETE FROM client_service_history")).toThrow(
    "append-only",
  );
});
it("uses explicit mappings and skips repeated imports without duplicating financial observations", async () => {
  const count = db.prepare("SELECT count(*) n FROM metric_observation").get()!
    .n;
  const first = await imports.run(user("elizabeth")),
    next = await imports.run(user("elizabeth"));
  expect(first.importedCount).toBe(0);
  expect(first.skippedCount).toBeGreaterThan(3000);
  expect(first.errorCount).toBe(2);
  expect(next.importedCount).toBe(0);
  expect(db.prepare("SELECT count(*) n FROM metric_observation").get()!.n).toBe(
    count,
  );
  const exceptions = (await imports.admin(user("elizabeth"))).exceptions;
  expect(
    exceptions.some(
      (e) =>
        e.externalSourceId === "MOCK-CG-SMITH-REVIEW" &&
        e.code === "UNMAPPED_CUSTOMER",
    ),
  ).toBe(true);
});
it("records changed source revisions instead of mutating observations and detects conflicting same-revision content", () => {
  const row = mockObservations().find(
    (r) => r.metricCode === "ARR" && r.serviceLineCode === "TAX",
  )!;
  const conflict = imports.ingest(user("elizabeth"), "MOCK_FABRIC", [
    { ...row, numericValue: row.numericValue + 1 },
  ]);
  expect(conflict.errorCount).toBe(1);
  expect(conflict.importedCount).toBe(0);
  const revised = imports.ingest(user("elizabeth"), "MOCK_FABRIC", [
    { ...row, sourceRevision: 2, numericValue: row.numericValue + 100 },
  ]);
  expect(revised.importedCount).toBe(1);
});
it("does not match similarly named customers or allow duplicate source mappings", async () => {
  await expect(
    imports.map(user("elizabeth"), {
      groupId: group,
      recordType: "CLIENT_GROUP",
      internalRecordId: group,
      externalSourceId: "MOCK-CG-SMITH-REVIEW",
    }),
  ).rejects.toThrow("already has an approved");
  expect((await imports.admin(user("elizabeth"))).mappings).toHaveLength(3);
});
it("supports source mappings approved to a new group without inventing accounting IDs for all people", async () => {
  const result = core.createGroup(user("elizabeth"), {
    name: "New family",
    displayName: "New family",
    inceptionDate: "2024-01-01",
    partnerId: seedId("elizabeth"),
    managerId: seedId("james"),
    teamId: seedId("team-cedar"),
  });
  await imports.map(user("elizabeth"), {
    groupId: result.id,
    recordType: "CLIENT_GROUP",
    internalRecordId: result.id,
    externalSourceId: "MOCK-CG-UNMATCHED",
  });
  const run = await imports.run(user("elizabeth"));
  expect(run.importedCount).toBe(1);
  expect(
    finance.overview(user(), result.id, "2025-12-31").summary.totalARR,
  ).toBe(48000);
  expect(core.party(user(), seedId("emma")).displayName).toBe("Emma Smith");
});
it("denies source operations and configuration changes to nonadministrators and disables sources in non-demo mode", async () => {
  const a = await login();
  await a.get("/api/admin/financial").expect(403);
  await a
    .post("/api/admin/financial/imports")
    .set("Origin", origin)
    .send({})
    .expect(403);
  expect(() => new FinancialImports(finance, null).requireSource()).toThrow(
    "No financial source",
  );
});
it("keeps configurable hours conventions reproducible at the selected knowledge timestamp", () => {
  imports.settings(user("elizabeth"), { lookbackMonths: 6 });
  expect(finance.overview(user(), group, "2025-12-31").hoursWindow.months).toBe(
    6,
  );
  expect(overview().hoursWindow.months).toBe(12);
  expect(() =>
    imports.settings(user("elizabeth"), { lookbackMonths: 0 }),
  ).toThrow();
});
it("offers quarterly snapshot endpoints and never sums the quarterly ARR snapshots", () => {
  const trend = finance.trend(
    user(),
    group,
    "2025-12-31",
    new Date().toISOString(),
    "quarterly",
  );
  expect(trend).toHaveLength(8);
  expect(trend.slice(-4).map((p) => p.date)).toEqual([
    "2025-03-31",
    "2025-06-30",
    "2025-09-30",
    "2025-12-31",
  ]);
  expect(trend.at(-1)!.arr).toBe(
    finance.overview(user(), group, "2025-12-31").summary.totalARR,
  );
});
it("adds the second phase seed once while preserving existing Phase 1 records and financial overrides", () => {
  const before = db.prepare("SELECT count(*) n FROM metric_observation").get()!
    .n;
  const id = finance.createOverride(user(), group, override()).id;
  seed(db);
  expect(db.prepare("SELECT count(*) n FROM metric_observation").get()!.n).toBe(
    before,
  );
  expect(
    db.prepare("SELECT id FROM metric_override WHERE id=?").get(id),
  ).toBeTruthy();
});

it("quarterly revenue and margin sum monthly components while ARR remains one end-date snapshot", () => {
  const known = "2026-03-01T12:00:00.000Z",
    point = finance
      .trend(user(), group, "2025-12-31", known, "quarterly")
      .at(-1)!,
    months = ["2025-10-31", "2025-11-30", "2025-12-31"].map(
      (d) => finance.overview(user(), group, d, known).summary,
    );
  expect(point.revenue).toBeCloseTo(
    months.reduce((n, m) => n + m.revenue!, 0),
    2,
  );
  expect(point.grossMargin).toBeCloseTo(
    months.reduce((n, m) => n + m.grossMargin!, 0),
    2,
  );
  expect(point.periodStart).toBe("2025-10-01");
  expect(point.periodEnd).toBe("2026-01-01");
  expect(point.arr).toBe(months[2].totalARR);
});
it("returns component-weighted service-line profitability and authorized net-worth distributions", () => {
  const report = finance.report(
      user(),
      "2025-12-31",
      new Date().toISOString(),
      {},
    ),
    service = report.serviceTotals.find((l) => l.serviceLineId === line)!;
  expect(service.grossMargin).toBeCloseTo(
    report.rows.reduce(
      (n, r) =>
        n +
        r.financial.lines.find((l) => l.serviceLine.id === line)!.grossMargin!,
      0,
    ),
    2,
  );
  expect(service.grossMarginPercentage).toBeCloseTo(
    (service.grossMargin! / service.revenue!) * 100,
  );
  expect(report.netWorthDistribution.reduce((n, b) => n + b.count, 0)).toBe(2);
  const restricted = finance.report(
    user("oliver"),
    "2025-12-31",
    new Date().toISOString(),
    {},
  );
  expect(restricted.serviceTotals[0]).not.toHaveProperty("grossMargin");
});
it("quarantines unexpected source fields and invalid numeric values instead of forwarding them to SQL", () => {
  const row = mockObservations()[0];
  const invalid = { ...row, unexpectedColumn: "not a schema field" };
  const result = imports.ingest(user("elizabeth"), "MOCK_FABRIC", [
    invalid,
    { ...row, numericValue: Infinity },
  ]);
  expect(result.errorCount).toBe(2);
  expect(result.importedCount).toBe(0);
  expect(db.prepare("SELECT count(*) n FROM client_group").get()!.n).toBe(3);
});
