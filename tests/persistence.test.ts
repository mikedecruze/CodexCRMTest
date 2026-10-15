import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../server/db.ts";
import { seed, seedId } from "../server/seed.ts";
import { Service } from "../server/service.ts";
it("retains saved records and audit history after reopening the database, with idempotent seed", () => {
  const dir = mkdtempSync(join(tmpdir(), "trove-persistence-"));
  try {
    let db = openDb(join(dir, "db.sqlite"));
    seed(db);
    let service = new Service(db);
    const u = service.employee(seedId("james"))!,
      result = service.mutate(u, seedId("smith"), {
        action: "entity",
        displayName: "Persisted test trust",
        entityTypeId: seedId("entity-trust"),
        startDate: "2024-01-01",
      });
    db.close();
    db = openDb(join(dir, "db.sqlite"));
    seed(db);
    service = new Service(db);
    expect(service.party(u, result.id).displayName).toBe(
      "Persisted test trust",
    );
    expect(
      service.audit(u, seedId("smith")).some((e) => e.recordId === result.id),
    ).toBe(true);
    expect(service.groups(u)).toHaveLength(2);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
