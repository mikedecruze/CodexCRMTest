import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Employee } from "../../shared/types.ts";
import type {
  ExternalMapping,
  FinancialAdmin,
  ImportBatch,
  ImportException,
  SourceObservation,
} from "../../shared/financial.ts";
import { transaction } from "../db.ts";
import { insert } from "../seed.ts";
import { dateSchema, HttpError, overlaps } from "../service.ts";
import { FinancialService } from "./service.ts";
import type { FinancialSourceConnector } from "./connector.ts";
const sourceRowSchema = z
  .object({
    externalSourceId: z.string().min(1).max(200),
    sourceObjectType: z.string().min(1).max(100),
    metricCode: z.enum([
      "ARR",
      "NET_WORTH",
      "REVENUE",
      "LABOR_COST",
      "REALIZATION",
      "HOURS",
    ]),
    serviceLineCode: z.string().min(1).max(40).nullable(),
    employeeLevel: z
      .enum(["Partner", "Director", "Manager", "Senior", "Associate"])
      .nullable(),
    effectiveDate: dateSchema,
    periodStart: dateSchema.nullable(),
    periodEnd: dateSchema.nullable(),
    numericValue: z.number().finite().min(-1e12).max(1e12),
    currency: z.literal("USD"),
    externalReference: z.string().min(1).max(2000),
    sourceRevision: z.number().int().min(1),
  })
  .strict();
export class FinancialImports {
  constructor(
    public finance: FinancialService,
    public connector: FinancialSourceConnector | null,
  ) {}
  get core() {
    return this.finance.core;
  }
  requireSource() {
    if (!this.connector)
      throw new HttpError(
        503,
        "No financial source is connected. Configure and verify a read-only Fabric adapter before importing.",
      );
    return this.connector;
  }
  mappings(user: Employee) {
    return this.core
      .rows<ExternalMapping>(
        `SELECT m.*,g.name groupName,CASE WHEN m.recordType='CLIENT_GROUP' THEN g.name ELSE p.displayName END recordName FROM external_mapping m JOIN client_group g ON g.id=m.groupId LEFT JOIN party p ON p.id=m.internalRecordId ORDER BY m.createdAt DESC`,
      )
      .filter((m) => this.core.canRead(user, m.groupId));
  }
  async admin(user: Employee): Promise<FinancialAdmin> {
    this.core.requireAdmin(user);
    const connector = this.requireSource();
    return {
      source: connector.describe(),
      customers: await connector.readCustomers(),
      mappings: this.mappings(user),
      batches: this.core.rows<ImportBatch>(
        "SELECT * FROM import_batch ORDER BY startedAt DESC,rowid DESC LIMIT 30",
      ),
      exceptions: this.core
        .rows<ImportException>(
          "SELECT * FROM import_exception ORDER BY createdAt DESC,rowid DESC LIMIT 100",
        )
        .filter((e) => !e.groupId || this.core.canRead(user, e.groupId)),
      serviceLines: this.finance.serviceLines(),
      employees: this.core.employees(),
      teams: this.core.teams(),
      groups: this.core.groups(user),
      grants: this.core
        .rows<FinancialAdmin["grants"][number]>(
          "SELECT x.*,g.name groupName,e.displayName employee FROM profitability_grant x JOIN client_group g ON g.id=x.groupId JOIN employee e ON e.id=x.employeeId ORDER BY x.createdAt DESC",
        )
        .filter((g) => this.core.canRead(user, g.groupId)),
      lookbackMonths: this.finance.settings(),
    };
  }
  async map(user: Employee, input: unknown) {
    this.core.requireAdmin(user);
    const v = z
        .object({
          groupId: z.uuid(),
          recordType: z.enum(["CLIENT_GROUP", "PARTY"]),
          internalRecordId: z.uuid(),
          externalSourceId: z.string().min(1).max(200),
        })
        .strict()
        .parse(input),
      connector = this.requireSource(),
      source = connector.describe();
    this.core.requireGroup(user, v.groupId);
    const sourceCustomer = (await connector.readCustomers()).find(
      (c) => c.externalSourceId === v.externalSourceId,
    );
    if (!sourceCustomer)
      throw new HttpError(400, "Choose an inspected source record.");
    if (v.recordType === "CLIENT_GROUP" && v.internalRecordId !== v.groupId)
      throw new HttpError(
        400,
        "A Client Group mapping must target the selected Client Group.",
      );
    if (v.recordType === "PARTY") {
      const party = this.core.party(user, v.internalRecordId);
      if (!party.groups.some((g) => g.id === v.groupId))
        throw new HttpError(
          400,
          "The mapped party must be associated with this Client Group.",
        );
    }
    return transaction(this.core.db, () => {
      if (
        this.core.one(
          "SELECT id FROM external_mapping WHERE sourceSystem=? AND sourceObjectType=? AND externalSourceId=?",
          source.sourceSystem,
          sourceCustomer.sourceObjectType,
          v.externalSourceId,
        )
      )
        throw new HttpError(
          409,
          "This source identity already has a mapping. Existing imported records are never reassigned.",
        );
      if (
        v.recordType === "CLIENT_GROUP" &&
        this.core.one(
          "SELECT id FROM external_mapping WHERE sourceSystem=? AND sourceObjectType=? AND internalRecordId=? AND recordType='CLIENT_GROUP' AND status='Approved'",
          source.sourceSystem,
          sourceCustomer.sourceObjectType,
          v.internalRecordId,
        )
      )
        throw new HttpError(
          409,
          "This Client Group already has an approved source-group mapping. Review duplicates instead of combining them.",
        );
      const id = randomUUID(),
        stamp = new Date().toISOString();
      insert(this.core.db, "external_mapping", {
        id,
        ...v,
        sourceSystem: source.sourceSystem,
        sourceObjectType: sourceCustomer.sourceObjectType,
        status: "Approved",
        lastVerifiedAt: stamp,
        createdAt: stamp,
        createdBy: user.id,
      });
      this.core.log(user, v.groupId, "Source mapping approved", id, null, v);
      return { id };
    });
  }
  async run(user: Employee) {
    this.core.requireAdmin(user);
    const source = this.requireSource(),
      rows = await source.readObservations();
    return this.ingest(user, source.describe().sourceSystem, rows);
  }
  ingest(user: Employee, sourceSystem: string, rows: SourceObservation[]) {
    this.core.requireAdmin(user);
    const stamp = new Date().toISOString(),
      id = randomUUID();
    return transaction(this.core.db, () => {
      insert(this.core.db, "import_batch", {
        id,
        sourceSystem,
        status: "Running",
        startedAt: stamp,
        completedAt: null,
        createdBy: user.id,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
      });
      let importedCount = 0,
        skippedCount = 0,
        errorCount = 0;
      const mappings = this.mappings(user);
      for (const candidate of rows) {
        const parsed = sourceRowSchema.safeParse(candidate);
        const raw = candidate as unknown as Record<string, unknown>;
        const externalSourceId =
          typeof raw?.externalSourceId === "string"
            ? raw.externalSourceId.slice(0, 200)
            : "INVALID_ID";
        const externalReference =
          typeof raw?.externalReference === "string"
            ? raw.externalReference.slice(0, 2000)
            : "INVALID_REFERENCE";
        const sourceObjectType =
          typeof raw?.sourceObjectType === "string" ? raw.sourceObjectType : "";
        const mapping = mappings.find(
          (m) =>
            m.sourceSystem === sourceSystem &&
            m.sourceObjectType === sourceObjectType &&
            m.externalSourceId === externalSourceId &&
            m.status === "Approved",
        );
        const exception = (code: string, message: string) => {
          errorCount++;
          insert(this.core.db, "import_exception", {
            id: randomUUID(),
            batchId: id,
            groupId: mapping?.groupId ?? null,
            externalSourceId,
            externalReference,
            code,
            message,
            createdAt: stamp,
          });
        };
        if (!parsed.success) {
          exception(
            "INVALID_SOURCE_ROW",
            "Source fields, dimensions, dates or numeric values are invalid.",
          );
          continue;
        }
        const row = parsed.data;
        if (!mapping) {
          exception(
            "UNMAPPED_CUSTOMER",
            "Explicit source mapping approval is required. No name-based match was attempted.",
          );
          continue;
        }
        if (mapping.recordType !== "CLIENT_GROUP") {
          exception(
            "PARTY_REQUIRES_GROUP_SOURCE",
            "Party mappings are retained but do not implicitly roll financial values up to a Client Group.",
          );
          continue;
        }
        try {
          this.core.requireGroup(user, mapping.groupId);
          const { def, serviceLineId } = this.finance.validateSource(row);
          if (
            def.classification === "PROFITABILITY" &&
            !this.core.canViewProfitability(user, mapping.groupId)
          ) {
            exception(
              "INSUFFICIENT_SCOPE",
              "This source row requires an approved financial access scope.",
            );
            continue;
          }
          const existing = this.core.one<{
            numericValue: number;
            currency: string;
            externalReference: string;
          }>(
            "SELECT numericValue,currency,externalReference FROM metric_observation WHERE sourceSystem=? AND sourceObjectType=? AND externalSourceId=? AND metricId=? AND serviceLineId IS ? AND employeeLevel IS ? AND effectiveDate=? AND periodStart IS ? AND periodEnd IS ? AND sourceRevision=?",
            sourceSystem,
            row.sourceObjectType,
            row.externalSourceId,
            def.id,
            serviceLineId,
            row.employeeLevel,
            row.effectiveDate,
            row.periodStart,
            row.periodEnd,
            row.sourceRevision,
          );
          if (existing) {
            if (
              existing.numericValue !== row.numericValue ||
              existing.currency !== row.currency ||
              existing.externalReference !== row.externalReference
            )
              exception(
                "REVISION_CONFLICT",
                "The same source revision has different contents. Supply a new revision; imported observations are immutable.",
              );
            else skippedCount++;
            continue;
          }
          const {
            metricCode: _metric,
            serviceLineCode: _service,
            ...values
          } = row;
          insert(this.core.db, "metric_observation", {
            id: randomUUID(),
            groupId: mapping.groupId,
            metricId: def.id,
            serviceLineId,
            ...values,
            sourceSystem,
            batchId: id,
            recordedAt: stamp,
            importedAt: stamp,
          });
          importedCount++;
        } catch (e) {
          if (!(e instanceof HttpError || e instanceof z.ZodError)) throw e;
          exception(
            "INVALID_SOURCE_ROW",
            e instanceof HttpError
              ? e.message
              : "Source dimensions or dates are invalid.",
          );
        }
      }
      this.core.db
        .prepare(
          "UPDATE import_batch SET status=?,completedAt=?,importedCount=?,skippedCount=?,errorCount=? WHERE id=?",
        )
        .run(
          errorCount ? "Completed with exceptions" : "Completed",
          new Date().toISOString(),
          importedCount,
          skippedCount,
          errorCount,
          id,
        );
      this.core.log(user, null, "Financial import completed", id, null, {
        sourceSystem,
        importedCount,
        skippedCount,
        errorCount,
      });
      return { id, importedCount, skippedCount, errorCount };
    });
  }
  serviceLine(user: Employee, input: unknown, id?: string) {
    this.core.requireAdmin(user);
    const v = z
      .object({
        code: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
        name: z.string().trim().min(1).max(160),
        active: z.boolean().default(true),
      })
      .strict()
      .parse(input);
    return transaction(this.core.db, () => {
      const stamp = new Date().toISOString();
      if (id) {
        const old = this.core.one("SELECT id FROM service_line WHERE id=?", id);
        if (!old) throw new HttpError(404, "Service line not found");
        const existing = this.finance.serviceLines().find((s) => s.id === id)!;
        if (existing.code !== v.code)
          throw new HttpError(
            400,
            "Stable service-line codes cannot be changed after creation.",
          );
        this.core.db
          .prepare(
            "UPDATE service_line SET name=?,active=?,updatedAt=? WHERE id=?",
          )
          .run(v.name, v.active ? 1 : 0, stamp, id);
        this.core.log(user, null, "Service line updated", id, existing, v);
        return { id };
      }
      if (this.finance.serviceLines().some((s) => s.code === v.code))
        throw new HttpError(409, "This service-line code already exists.");
      const newId = randomUUID();
      insert(this.core.db, "service_line", {
        id: newId,
        ...v,
        active: v.active ? 1 : 0,
        createdAt: stamp,
        updatedAt: stamp,
      });
      this.core.log(user, null, "Service line created", newId, null, v);
      return { id: newId };
    });
  }
  settings(user: Employee, input: unknown) {
    this.core.requireAdmin(user);
    const v = z
      .object({ lookbackMonths: z.number().int().min(1).max(60) })
      .strict()
      .parse(input);
    transaction(this.core.db, () => {
      const before = this.finance.settings();
      this.core.db
        .prepare(
          "UPDATE financial_settings SET lookbackMonths=?,updatedAt=?,updatedBy=? WHERE id='default'",
        )
        .run(v.lookbackMonths, new Date().toISOString(), user.id);
      insert(this.core.db, "financial_settings_history", {
        id: randomUUID(),
        lookbackMonths: v.lookbackMonths,
        recordedAt: new Date().toISOString(),
        createdBy: user.id,
      });
      this.core.log(
        user,
        null,
        "Staffing convention updated",
        this.core.one<{ id: string }>(
          "SELECT id FROM financial_settings_history ORDER BY recordedAt DESC,rowid DESC LIMIT 1",
        )!.id,
        { lookbackMonths: before },
        v,
      );
    });
    return v;
  }
  grant(user: Employee, input: unknown) {
    this.core.requireAdmin(user);
    const v = z
      .object({
        groupId: z.uuid(),
        employeeId: z.uuid(),
        startDate: dateSchema,
        endDate: dateSchema.nullable().default(null),
        reason: z.string().trim().min(5).max(2000),
      })
      .strict()
      .parse(input);
    this.core.requireGroup(user, v.groupId);
    this.core.range(v.startDate, v.endDate);
    const employee = this.core.employee(v.employeeId);
    if (!employee) throw new HttpError(400, "Choose an active employee.");
    if (!this.core.canRead(employee, v.groupId))
      throw new HttpError(
        400,
        "Profitability scope does not grant Client Group access; assign the employee to an authorized team first.",
      );
    return transaction(this.core.db, () => {
      if (
        this.core
          .rows<{ startDate: string; endDate: string | null }>(
            "SELECT startDate,endDate FROM profitability_grant WHERE groupId=? AND employeeId=? AND revokedAt IS NULL",
            v.groupId,
            v.employeeId,
          )
          .some((g) => overlaps(v.startDate, v.endDate, g.startDate, g.endDate))
      )
        throw new HttpError(
          409,
          "This employee already has an overlapping profitability scope.",
        );
      const id = randomUUID();
      insert(this.core.db, "profitability_grant", {
        id,
        ...v,
        createdAt: new Date().toISOString(),
      });
      this.core.log(
        user,
        v.groupId,
        "Profitability scope granted",
        id,
        null,
        v,
        "PROFITABILITY",
      );
      return { id };
    });
  }
  revokeGrant(user: Employee, id: string, reason: string) {
    this.core.requireAdmin(user);
    z.string().trim().min(5).max(2000).parse(reason);
    return transaction(this.core.db, () => {
      const grant = this.core.one<{
        groupId: string;
        revokedAt: string | null;
      }>("SELECT * FROM profitability_grant WHERE id=?", id);
      if (!grant) throw new HttpError(404, "Grant not found");
      this.core.requireGroup(user, grant.groupId);
      if (grant.revokedAt)
        throw new HttpError(409, "This scope has already been revoked.");
      const revokedAt = new Date().toISOString();
      this.core.db
        .prepare("UPDATE profitability_grant SET revokedAt=? WHERE id=?")
        .run(revokedAt, id);
      this.core.log(
        user,
        grant.groupId,
        "Profitability scope revoked",
        id,
        grant,
        { revokedAt, reason },
        "PROFITABILITY",
      );
      return { id };
    });
  }
}
