import { beforeEach, afterEach, describe, it, expect } from "vitest";
import request from "supertest";
import { openDb, type Db } from "../server/db.ts";
import { seed, seedId } from "../server/seed.ts";
import { createApp } from "../server/app.ts";
import { Service } from "../server/service.ts";
const origin = "http://localhost:5173";
let db: Db, app: ReturnType<typeof createApp>;
beforeEach(() => {
  db = openDb(":memory:");
  seed(db);
  app = createApp(db, { demo: true, origin });
});
afterEach(() => db.close());
async function login(name = "james") {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/demo")
    .set("Origin", origin)
    .send({ employeeId: seedId(name) })
    .expect(200);
  return agent;
}
const entityPayload = () => ({
  action: "entity",
  displayName: "New Trust",
  entityTypeId: seedId("entity-trust"),
  startDate: "2024-01-01",
});
const relationshipPayload = (extra = {}) => ({
  action: "relationship",
  sourceId: seedId("alexander"),
  targetId: seedId("legacy-trust"),
  typeId: seedId("relationship-owner"),
  startDate: "2024-01-01",
  ownershipPercentage: 25,
  ownershipClass: "Common",
  ...extra,
});
describe("Authentication and server authorization", () => {
  it("requires a valid session for every client data route", async () => {
    for (const path of [
      "/api/bootstrap",
      "/api/groups",
      "/api/parties",
      "/api/audit",
      "/api/admin",
      `/api/groups/${seedId("smith")}`,
      `/api/parties/${seedId("shared")}`,
    ])
      await request(app).get(path).expect(401);
  });
  it("rejects forged identity and role fields", async () => {
    await request(app)
      .post("/api/auth/demo")
      .set("Origin", origin)
      .send({ employeeId: seedId("james"), role: "admin" })
      .expect(400);
    await request(app)
      .get("/api/groups")
      .set("X-User-Id", seedId("elizabeth"))
      .expect(401);
  });
  it("sets HttpOnly strict cookies, stores only hashed tokens, and revokes logout", async () => {
    const agent = request.agent(app),
      r = await agent
        .post("/api/auth/demo")
        .set("Origin", origin)
        .send({ employeeId: seedId("james") })
        .expect(200);
    expect(r.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(r.headers["set-cookie"][0]).toContain("SameSite=Strict");
    const token = r.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const stored = db.prepare("SELECT tokenHash FROM session").get()!;
    expect(stored.tokenHash).not.toBe(token);
    await agent
      .post("/api/auth/logout")
      .set("Origin", origin)
      .send({})
      .expect(200);
    await agent.get("/api/bootstrap").expect(401);
  });
  it("enforces session expiry and active employee status", async () => {
    const a = await login();
    db.prepare("UPDATE session SET expiresAt=0").run();
    await a.get("/api/bootstrap").expect(401);
    const b = await login();
    db.prepare("UPDATE employee SET active=0 WHERE id=?").run(seedId("james"));
    await b.get("/api/bootstrap").expect(401);
  });
  it("rejects mutation requests without the exact allowed Origin", async () => {
    const a = await login();
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .send(entityPayload())
      .expect(403);
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", "https://evil.example")
      .send(entityPayload())
      .expect(403);
  });
  it("disables fixture auth outside explicit demo mode and refuses production demo", async () => {
    const normal = createApp(db, {
      demo: false,
      origin: "https://trove.example",
    });
    expect(
      (await request(normal).get("/api/auth/config")).body.personas,
    ).toEqual([]);
    await request(normal)
      .post("/api/auth/demo")
      .set("Origin", "https://trove.example")
      .send({ employeeId: seedId("elizabeth") })
      .expect(404);
    await request(normal).get("/auth/entra").expect(503);
    expect(() =>
      createApp(db, { demo: true, origin, production: true }),
    ).toThrow("production");
  });
  it("gives Partner, Director, Manager and Senior write access only to authorized groups", async () => {
    for (const who of ["william", "diana", "james", "oliver"]) {
      const a = await login(who),
        group = who === "william" ? "carter" : "smith";
      await a
        .post(`/api/groups/${seedId(group)}/commands`)
        .set("Origin", origin)
        .send({ ...entityPayload(), displayName: who + " Trust" })
        .expect(201);
      const blocked = who === "william" ? "smith" : "carter";
      await a
        .post(`/api/groups/${seedId(blocked)}/commands`)
        .set("Origin", origin)
        .send(entityPayload())
        .expect(404);
    }
  });
  it("makes an Associate read-only even when calling the write API directly", async () => {
    const a = await login("sophia");
    await a.get(`/api/groups/${seedId("smith")}`).expect(200);
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", origin)
      .send(entityPayload())
      .expect(403);
    await a.post("/api/groups").set("Origin", origin).send({}).expect(403);
    await a
      .patch(`/api/parties/${seedId("robert")}`)
      .set("Origin", origin)
      .send({ displayName: "Changed", status: "Active" })
      .expect(403);
  });
  it("returns no client records, totals, search or audit to an unassigned employee", async () => {
    const a = await login("noah"),
      r = await a.get("/api/bootstrap").expect(200);
    expect(r.body.stats).toEqual({
      groups: 0,
      people: 0,
      entities: 0,
      advisors: 0,
    });
    expect((await a.get("/api/search?q=Smith")).body).toEqual({
      groups: [],
      parties: [],
    });
    expect((await a.get("/api/audit")).body).toEqual([]);
    await a.get(`/api/groups/${seedId("smith")}`).expect(404);
  });
  it("does not leak other families through a shared entity, advisor, graph, search or audit", async () => {
    const a = await login();
    const p = await a.get(`/api/parties/${seedId("shared")}`).expect(200);
    expect(p.body.groups.map((g: { name: string }) => g.name)).toEqual([
      "Smith Family",
    ]);
    expect(JSON.stringify(p.body)).not.toContain("Carter Family");
    expect(p.body.canEdit).toBe(false);
    for (const path of [
      `/api/groups/${seedId("smith")}`,
      "/api/search?q=Evergreen",
      "/api/parties?kind=advisor",
      "/api/audit",
    ]) {
      const r = await a.get(path).expect(200);
      expect(JSON.stringify(r.body)).not.toMatch(
        /CARTER_PRIVATE|Carter Family/,
      );
    }
    await a.get(`/api/groups/${seedId("carter")}`).expect(404);
    await a.get(`/api/parties/${seedId("carter-trust")}`).expect(404);
    await a.get(`/api/audit?groupId=${seedId("carter")}`).expect(404);
    await a
      .patch(`/api/parties/${seedId("shared")}`)
      .set("Origin", origin)
      .send({ displayName: "Evergreen", status: "Active" })
      .expect(403);
  });
  it("keeps shared core information identical while isolating group notes", async () => {
    const a = await login("elizabeth"),
      smith = (await a.get(`/api/groups/${seedId("smith")}`)).body,
      carter = (await a.get(`/api/groups/${seedId("carter")}`)).body;
    const s = smith.entities.find(
        (p: { id: string }) => p.id === seedId("shared"),
      ),
      c = carter.entities.find(
        (p: { id: string }) => p.id === seedId("shared"),
      );
    expect(s.displayName).toBe(c.displayName);
    expect(s.notes).not.toBe(c.notes);
    expect(s.notes).not.toContain("CARTER_PRIVATE");
  });
  it("uses current access rights when showing old relationship dates", async () => {
    const a = await login();
    db.prepare(
      "UPDATE team_membership SET endDate='2025-01-01' WHERE employeeId=?",
    ).run(seedId("james"));
    await a.get(`/api/groups/${seedId("smith")}?asOf=2024-01-01`).expect(404);
  });
});
describe("Effective-dated relationships and persistence", () => {
  it("seeds three households, generations, trusts and effective ownership changes", async () => {
    const a = await login();
    const old = (
        await a
          .get(`/api/groups/${seedId("smith")}?asOf=2024-12-31`)
          .expect(200)
      ).body,
      next = (
        await a
          .get(`/api/groups/${seedId("smith")}?asOf=2025-01-01`)
          .expect(200)
      ).body;
    expect(old.households).toHaveLength(3);
    expect(old.people).toHaveLength(9);
    expect(old.entities.length).toBeGreaterThanOrEqual(5);
    const owned = (d: typeof old) =>
      d.relationships.find(
        (r: { sourceId: string; targetId: string; code: string }) =>
          r.sourceId === seedId("robert") &&
          r.targetId === seedId("smith-trust") &&
          r.code === "owner",
      );
    expect(owned(old).ownershipPercentage).toBe(80);
    expect(owned(next).ownershipPercentage).toBe(60);
  });
  it("splits ownership history atomically and audits both intervals", async () => {
    const a = await login(),
      d = (await a.get(`/api/groups/${seedId("smith")}?asOf=2025-01-01`)).body,
      r = d.relationships.find(
        (r: { sourceId: string; code: string }) =>
          r.sourceId === seedId("robert") && r.code === "owner",
      );
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", origin)
      .send({
        action: "ownership",
        relationshipId: r.id,
        effectiveDate: "2026-01-01",
        ownershipPercentage: 55,
        reason: "Approved synthetic transfer",
      })
      .expect(201);
    const s = new Service(db),
      u = s.employee(seedId("james"))!;
    expect(
      s
        .detail(u, seedId("smith"), "2025-12-31")
        .relationships.find((x) => x.id === r.id)?.ownershipPercentage,
    ).toBe(60);
    expect(
      s
        .detail(u, seedId("smith"), "2026-01-01")
        .relationships.find(
          (x) => x.sourceId === r.sourceId && x.code === "owner",
        )?.ownershipPercentage,
    ).toBe(55);
    expect(
      s
        .audit(u, seedId("smith"))
        .some((x) => x.action === "Ownership interval closed"),
    ).toBe(true);
  });
  it("rejects bad percentages, invalid dates, self relationships and unauthorized endpoints", async () => {
    const a = await login();
    for (const bad of [
      { ownershipPercentage: 101 },
      { ownershipPercentage: -1 },
      { startDate: "2026-02-30" },
      { endDate: "2023-01-01" },
      { sourceId: seedId("legacy-trust"), targetId: seedId("legacy-trust") },
      { targetId: seedId("carter-trust") },
    ])
      await a
        .post(`/api/groups/${seedId("smith")}/commands`)
        .set("Origin", origin)
        .send(relationshipPayload(bad))
        .expect(400);
  });
  it("rejects overlapping duplicates but allows adjoining historical intervals", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    await a
      .post(path)
      .set("Origin", origin)
      .send(relationshipPayload({ endDate: "2025-01-01" }))
      .expect(201);
    await a
      .post(path)
      .set("Origin", origin)
      .send(relationshipPayload({ startDate: "2024-06-01" }))
      .expect(409);
    await a
      .post(path)
      .set("Origin", origin)
      .send(relationshipPayload({ startDate: "2025-01-01" }))
      .expect(201);
  });
  it("rejects symmetric duplicates, parent cycles and ownership cycles", async () => {
    db.prepare("UPDATE person_profile SET birthDate=NULL WHERE partyId=?").run(
      seedId("emma"),
    );
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    await a
      .post(path)
      .set("Origin", origin)
      .send(
        relationshipPayload({
          sourceId: seedId("eleanor"),
          targetId: seedId("robert"),
          typeId: seedId("relationship-spouse"),
          ownershipPercentage: null,
          ownershipClass: "",
        }),
      )
      .expect(409);
    await a
      .post(path)
      .set("Origin", origin)
      .send(
        relationshipPayload({
          sourceId: seedId("emma"),
          targetId: seedId("robert"),
          typeId: seedId("relationship-parent"),
          ownershipPercentage: null,
          ownershipClass: "",
        }),
      )
      .expect(409);
    await a
      .post(path)
      .set("Origin", origin)
      .send(
        relationshipPayload({
          sourceId: seedId("shared"),
          targetId: seedId("smith-trust"),
        }),
      )
      .expect(409);
  });
  it("requires person endpoints for family edges and entity targets for ownership", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    await a
      .post(path)
      .set("Origin", origin)
      .send(
        relationshipPayload({
          typeId: seedId("relationship-parent"),
          ownershipPercentage: null,
        }),
      )
      .expect(400);
    await a
      .post(path)
      .set("Origin", origin)
      .send(relationshipPayload({ targetId: seedId("henry") }))
      .expect(400);
  });
  it("creates independent CRM people without source IDs and adds household membership", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    const result = await a
      .post(path)
      .set("Origin", origin)
      .send({
        action: "person",
        firstName: "New",
        lastName: "Smith",
        displayName: "New Smith",
        householdId: seedId("smith-alex"),
        startDate: "2026-01-01",
      })
      .expect(201);
    const p = await a.get(`/api/parties/${result.body.id}`).expect(200);
    expect(p.body.primaryGroupId).toBe(seedId("smith"));
    expect(
      (await a.get(`/api/groups/${seedId("smith")}`)).body.households.some(
        (h: { members: { personId: string }[] }) =>
          h.members.some((m) => m.personId === result.body.id),
      ),
    ).toBe(true);
  });
  it("rolls back invalid multi-record writes without orphan masters or audits", async () => {
    const a = await login(),
      before = db.prepare("SELECT count(*) n FROM party").get()!.n;
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", origin)
      .send({
        action: "person",
        firstName: "Bad",
        lastName: "Smith",
        displayName: "Bad Smith",
        householdId: seedId("carter-home"),
        startDate: "2026-01-01",
      })
      .expect(404);
    expect(db.prepare("SELECT count(*) n FROM party").get()!.n).toBe(before);
  });
  it("rejects cross-family household membership and overlapping primary contacts", async () => {
    const a = await login("elizabeth"),
      path = `/api/groups/${seedId("smith")}/commands`;
    for (const personId of [seedId("daniel"), seedId("emma")])
      await a
        .post(path)
        .set("Origin", origin)
        .send({
          action: "membership",
          householdId: seedId("smith-alex"),
          personId,
          role: "Primary contact",
          isPrimary: true,
          startDate: "2026-01-01",
        })
        .expect(personId === seedId("daniel") ? 400 : 409);
  });
  it("allows a legal entity in a second group without allowing duplicate active associations", async () => {
    const a = await login("elizabeth"),
      path = `/api/groups/${seedId("bennett")}/commands`,
      data = {
        action: "associate",
        partyId: seedId("shared"),
        startDate: "2026-01-01",
        notes: "Bennett private scope",
      };
    await a.post(path).set("Origin", origin).send(data).expect(201);
    await a.post(path).set("Origin", origin).send(data).expect(409);
    expect(
      (await a.get(`/api/groups/${seedId("bennett")}`)).body.entities.some(
        (e: { id: string }) => e.id === seedId("shared"),
      ),
    ).toBe(true);
    await a
      .post(path)
      .set("Origin", origin)
      .send({ ...data, partyId: seedId("robert") })
      .expect(400);
  });
  it("creates a fully assigned group and preserves assignment history", async () => {
    const a = await login("elizabeth"),
      group = await a
        .post("/api/groups")
        .set("Origin", origin)
        .send({
          name: "Test Family",
          displayName: "The Test family",
          inceptionDate: "2024-01-01",
          partnerId: seedId("elizabeth"),
          managerId: seedId("james"),
          teamId: seedId("team-cedar"),
        })
        .expect(201);
    await a
      .post(`/api/groups/${group.body.id}/commands`)
      .set("Origin", origin)
      .send({
        action: "assignments",
        partnerId: seedId("elizabeth"),
        managerId: seedId("diana"),
        teamId: seedId("team-cedar"),
        effectiveDate: "2025-01-01",
      })
      .expect(201);
    const d = (await a.get(`/api/groups/${group.body.id}`)).body;
    expect(d.group.manager).toBe("Diana Brooks");
    expect(d.assignments).toHaveLength(2);
    expect(
      d.assignments.find(
        (x: { manager: string }) => x.manager === "James Carter",
      ).endDate,
    ).toBe("2025-01-01");
  });
  it("archives instead of deleting and protects append-only audit history", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    await a
      .post(path)
      .set("Origin", origin)
      .send({ action: "archive" })
      .expect(201);
    expect(
      (await a.get(`/api/groups/${seedId("smith")}`)).body.group.status,
    ).toBe("Archived");
    expect(() => db.exec("DELETE FROM audit_log")).toThrow("append-only");
  });
  it("restricts reference management and team grants to administrators", async () => {
    const a = await login(),
      admin = await login("elizabeth");
    await a.get("/api/admin").expect(403);
    await a
      .post("/api/admin/references")
      .set("Origin", origin)
      .send({ category: "entity", code: "custom", label: "Custom type" })
      .expect(403);
    await admin
      .post("/api/admin/references")
      .set("Origin", origin)
      .send({ category: "entity", code: "custom", label: "Custom type" })
      .expect(201);
    await admin
      .post("/api/admin/memberships")
      .set("Origin", origin)
      .send({
        employeeId: seedId("noah"),
        teamId: seedId("team-cedar"),
        startDate: "2026-01-01",
      })
      .expect(201);
    const b = await login("noah");
    expect((await b.get("/api/bootstrap")).body.stats.groups).toBe(2);
  });
  it("bounds directories and never offers unbounded export routes", async () => {
    const a = await login();
    const p = await a.get("/api/parties?kind=PERSON").expect(200);
    expect(p.body.items.length).toBeLessThanOrEqual(20);
    expect(p.body.pageSize).toBe(20);
    await a.get("/api/export").expect(404);
    await a.get("/api/parties?page=-1").expect(400);
  });
});
describe("History maintenance regressions", () => {
  it("ends a marriage without erasing historical graph edges", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`,
      detail = (await a.get(`/api/groups/${seedId("smith")}`)).body;
    const edge = detail.relationships.find(
      (r: { sourceId: string; code: string }) =>
        r.sourceId === seedId("robert") && r.code === "spouse",
    );
    await a
      .post(path)
      .set("Origin", origin)
      .send({
        action: "endRecord",
        recordType: "relationship",
        recordId: edge.id,
        effectiveEndDate: "2025-01-01",
        reason: "Historical synthetic transition",
      })
      .expect(201);
    expect(
      (
        await a.get(`/api/groups/${seedId("smith")}?asOf=2024-12-31`)
      ).body.relationships.some((r: { id: string }) => r.id === edge.id),
    ).toBe(true);
    expect(
      (
        await a.get(`/api/groups/${seedId("smith")}?asOf=2025-01-01`)
      ).body.relationships.some((r: { id: string }) => r.id === edge.id),
    ).toBe(false);
  });
  it("ends household membership without deleting the person or their prior membership", async () => {
    const a = await login(),
      detail = (await a.get(`/api/groups/${seedId("smith")}`)).body;
    const membership = detail.households
      .find((h: { id: string }) => h.id === seedId("smith-alex"))
      .members.find((m: { personId: string }) => m.personId === seedId("emma"));
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", origin)
      .send({
        action: "endRecord",
        recordType: "membership",
        recordId: membership.id,
        effectiveEndDate: "2025-01-01",
        reason: "Moved to another branch",
      })
      .expect(201);
    const old = (await a.get(`/api/groups/${seedId("smith")}?asOf=2024-12-31`))
        .body,
      next = (await a.get(`/api/groups/${seedId("smith")}?asOf=2025-01-01`))
        .body;
    expect(
      old.households.some((h: { members: { id: string }[] }) =>
        h.members.some((m) => m.id === membership.id),
      ),
    ).toBe(true);
    expect(
      next.households.some((h: { members: { id: string }[] }) =>
        h.members.some((m) => m.id === membership.id),
      ),
    ).toBe(false);
    await a.get(`/api/parties/${seedId("emma")}`).expect(200);
  });
  it("changes advisor context for one group without changing another group", async () => {
    const a = await login("elizabeth"),
      smith = (await a.get(`/api/groups/${seedId("smith")}`)).body;
    const p = smith.advisors.find(
      (p: { id: string }) => p.id === seedId("sarah"),
    );
    await a
      .post(`/api/groups/${seedId("smith")}/commands`)
      .set("Origin", origin)
      .send({
        action: "advisorNotes",
        stakeholderId: p.stakeholderId,
        scope: "Updated estate scope",
        notes: "SMITH_ONLY_UPDATE",
      })
      .expect(201);
    const next = (await a.get(`/api/groups/${seedId("smith")}`)).body,
      other = (await a.get(`/api/groups/${seedId("carter")}`)).body;
    expect(
      next.advisors.find((p: { id: string }) => p.id === seedId("sarah")).notes,
    ).toBe("SMITH_ONLY_UPDATE");
    expect(JSON.stringify(other)).not.toContain("SMITH_ONLY_UPDATE");
  });
  it("cannot reuse a demo session in Entra mode", async () => {
    const r = await request(app)
        .post("/api/auth/demo")
        .set("Origin", origin)
        .send({ employeeId: seedId("elizabeth") })
        .expect(200),
      normal = createApp(db, { demo: false, origin: "https://trove.example" });
    await request(normal)
      .get("/api/bootstrap")
      .set("Cookie", r.headers["set-cookie"])
      .expect(401);
  });
  it("edits group core fields without bypassing assignment history", async () => {
    const a = await login(),
      path = `/api/groups/${seedId("smith")}/commands`;
    await a
      .post(path)
      .set("Origin", origin)
      .send({
        action: "groupProfile",
        name: "Smith Family Office",
        displayName: "The Smith family",
        status: "Active",
        sharepointUrl: "https://trove.example/sites/smith",
      })
      .expect(400);
    await a
      .post(path)
      .set("Origin", origin)
      .send({
        action: "groupProfile",
        name: "Smith Family Office",
        displayName: "The Smith family",
        status: "Active",
        sharepointUrl: "https://example.sharepoint.com/sites/smith",
      })
      .expect(201);
    const d = (await a.get(`/api/groups/${seedId("smith")}`)).body;
    expect(d.group.name).toBe("Smith Family Office");
    expect(d.assignments).toHaveLength(1);
  });
  it("captures the pre-edit core fields in audits", async () => {
    const a = await login();
    await a
      .patch(`/api/parties/${seedId("robert")}`)
      .set("Origin", origin)
      .send({ displayName: "Robert J. Smith", status: "Active" })
      .expect(200);
    const audit = (
      await a.get(`/api/audit?groupId=${seedId("smith")}`)
    ).body.find(
      (e: { action: string }) => e.action === "Shared master updated",
    );
    expect(JSON.parse(audit.before).displayName).toBe("Robert Smith");
    expect(JSON.parse(audit.after).displayName).toBe("Robert J. Smith");
  });
});
