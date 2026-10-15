import { randomUUID } from "node:crypto";
import { transaction, type Db } from "../db.ts";
import { insert, seedId } from "../seed.ts";
import { financialId, shiftMonths } from "./catalog.ts";
import { mockObservations } from "./connector.ts";
export function seedFinancial(db: Db) {
  if (db.prepare("SELECT name FROM seed_version WHERE name='phase2-v1'").get())
    return;
  transaction(db, () => {
    const actor = seedId("elizabeth");
    if (!db.prepare("SELECT id FROM employee WHERE id=?").get(actor)) return;
    const stamp = "2026-10-06T12:00:00.000Z";
    const batch = randomUUID();
    insert(db, "import_batch", {
      id: batch,
      sourceSystem: "MOCK_FABRIC",
      status: "Completed with exceptions",
      startedAt: stamp,
      completedAt: stamp,
      createdBy: actor,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 2,
    });
    for (const key of ["smith", "bennett", "carter"]) {
      const groupId = seedId(key);
      const group = db
        .prepare("SELECT teamId FROM client_group WHERE id=?")
        .get(groupId) as { teamId: string } | undefined;
      if (!group) continue;
      insert(db, "external_mapping", {
        id: randomUUID(),
        groupId,
        recordType: "CLIENT_GROUP",
        internalRecordId: groupId,
        sourceSystem: "MOCK_FABRIC",
        sourceObjectType: "ClientGroup",
        externalSourceId: `MOCK-CG-${key.toUpperCase()}`,
        status: "Approved",
        lastVerifiedAt: stamp,
        createdAt: stamp,
        createdBy: actor,
      });
      for (const code of ["TAX", "FAMILY_OFFICE", "BOS", "OTHER"]) {
        insert(db, "client_service_history", {
          id: randomUUID(),
          groupId,
          serviceLineId: financialId(`service-${code}`),
          status: code === "OTHER" ? "Inactive" : "Active",
          startDate: "2024-01-01",
          endDate: null,
          teamId: group.teamId,
          reason: "Synthetic service agreement",
          source: "MOCK_FABRIC",
          recordedAt: "2024-01-01T12:00:00.000Z",
          createdBy: actor,
          supersedesId: null,
        });
        if (key === "carter" && code === "FAMILY_OFFICE")
          insert(db, "client_service_history", {
            id: randomUUID(),
            groupId,
            serviceLineId: financialId(`service-${code}`),
            status: "Inactive",
            startDate: "2025-07-01",
            endDate: null,
            teamId: group.teamId,
            reason:
              "Synthetic service suspension; ARR remains an independent source measure.",
            source: "CRM",
            recordedAt: "2025-07-01T12:00:00.000Z",
            createdBy: actor,
            supersedesId: null,
          });
      }
    }
    let count = 0;
    for (const row of mockObservations()) {
      const mapping = db
        .prepare(
          "SELECT groupId FROM external_mapping WHERE sourceSystem='MOCK_FABRIC' AND externalSourceId=?",
        )
        .get(row.externalSourceId) as { groupId: string } | undefined;
      if (!mapping) continue;
      const { metricCode, serviceLineCode, ...values } = row;
      const recordedAt =
        row.sourceRevision === 2
          ? "2026-02-05T12:00:00.000Z"
          : `${shiftMonths(row.effectiveDate, 1).slice(0, 7)}-05T12:00:00.000Z`;
      insert(db, "metric_observation", {
        id: randomUUID(),
        groupId: mapping.groupId,
        metricId: financialId(`metric-${metricCode}`),
        serviceLineId: serviceLineCode
          ? financialId(`service-${serviceLineCode}`)
          : null,
        ...values,
        sourceSystem: "MOCK_FABRIC",
        batchId: batch,
        recordedAt,
        importedAt: recordedAt,
      });
      count++;
    }
    for (const externalSourceId of [
      "MOCK-CG-UNMATCHED",
      "MOCK-CG-SMITH-REVIEW",
    ])
      insert(db, "import_exception", {
        id: randomUUID(),
        batchId: batch,
        groupId: null,
        externalSourceId,
        externalReference: `mock/${externalSourceId}`,
        code: "UNMAPPED_CUSTOMER",
        message:
          "Explicit mapping approval is required; names are never used to merge records.",
        createdAt: stamp,
      });
    db.prepare("UPDATE import_batch SET importedCount=? WHERE id=?").run(
      count,
      batch,
    );
    if (
      db.prepare("SELECT id FROM client_group WHERE id=?").get(seedId("smith"))
    )
      insert(db, "metric_override", {
        id: randomUUID(),
        groupId: seedId("smith"),
        metricId: financialId("metric-ARR"),
        serviceLineId: financialId("service-FAMILY_OFFICE"),
        employeeLevel: null,
        effectiveDate: "2025-12-31",
        endDate: "2026-02-01",
        periodStart: null,
        periodEnd: null,
        numericValue: 315000,
        action: "VALUE",
        reason: "Synthetic approved fee revision pending source refresh.",
        createdBy: seedId("james"),
        recordedAt: "2026-01-10T12:00:00.000Z",
        supersedesId: null,
      });
    insert(db, "seed_version", { name: "phase2-v1", createdAt: stamp });
  });
}
