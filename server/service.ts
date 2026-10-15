import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SQLInputValue } from "node:sqlite";
import { transaction, type Db } from "./db.ts";
import { insert } from "./seed.ts";
import type {
  Employee,
  Group,
  Party,
  Household,
  Relationship,
  Reference,
  Team,
  GroupDetail,
} from "../shared/types.ts";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    try {
      return new Date(s).toISOString().slice(0, 10) === s;
    } catch {
      return false;
    }
  }, "Invalid calendar date");
const name = z.string().trim().min(1, "A name is required").max(160);
const text = z.string().trim().max(2000).default("");
const id = z.uuid();
const optionalDate = dateSchema.nullable().optional().default(null);
const percent = z.number().min(0).max(100).nullable().optional().default(null);
const range = { startDate: dateSchema, endDate: optionalDate };
const partyFields = {
  displayName: name,
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: z.string().max(80).default(""),
  birthDate: optionalDate,
  occupation: z.string().max(160).default(""),
};
export const groupSchema = z
  .object({
    name,
    displayName: name,
    status: z
      .enum(["Active", "Prospective", "Inactive", "Archived"])
      .default("Active"),
    inceptionDate: dateSchema,
    partnerId: id,
    managerId: id,
    teamId: id,
    sharepointUrl: z.string().max(1000).default(""),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("person"),
      ...partyFields,
      firstName: name,
      lastName: name,
      householdId: id.optional(),
      ...range,
      billable: z.boolean().default(false),
      notes: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("entity"),
      displayName: name,
      entityTypeId: id,
      jurisdiction: z.string().max(160).default(""),
      formationDate: optionalDate,
      taxClassification: z.string().max(160).default(""),
      description: text,
      ...range,
      billable: z.boolean().default(false),
      notes: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("associate"),
      partyId: id,
      ...range,
      billable: z.boolean().default(false),
      notes: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("household"),
      name,
      description: text,
      ...range,
    })
    .strict(),
  z
    .object({
      action: z.literal("membership"),
      householdId: id,
      personId: id,
      role: name,
      isPrimary: z.boolean().default(false),
      ...range,
    })
    .strict(),
  z
    .object({
      action: z.literal("advisor"),
      existingPartyId: id.optional(),
      displayName: name,
      kind: z.enum(["PERSON", "ADVISOR_ORGANIZATION"]),
      firstName: z.string().max(160).default(""),
      lastName: z.string().max(160).default(""),
      email: z.union([z.email(), z.literal("")]).default(""),
      phone: z.string().max(80).default(""),
      typeId: id,
      scope: text,
      notes: text,
      primaryAdvisor: z.boolean().default(false),
      organizationId: id.optional(),
      position: z.string().max(160).default(""),
      ...range,
    })
    .strict(),
  z
    .object({
      action: z.literal("relationship"),
      sourceId: id,
      targetId: id,
      typeId: id,
      ...range,
      ownershipPercentage: percent,
      votingPercentage: percent,
      economicPercentage: percent,
      ownershipClass: z.string().max(80).default(""),
      notes: text,
      sourceDocument: z.string().max(1000).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("ownership"),
      relationshipId: id,
      effectiveDate: dateSchema,
      ownershipPercentage: z.number().min(0).max(100),
      reason: name,
    })
    .strict(),
  z
    .object({
      action: z.literal("assignments"),
      partnerId: id,
      managerId: id,
      teamId: id,
      effectiveDate: dateSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("endRecord"),
      recordType: z.enum(["relationship", "membership", "stakeholder"]),
      recordId: id,
      effectiveEndDate: dateSchema,
      reason: name,
    })
    .strict(),
  z
    .object({
      action: z.literal("advisorNotes"),
      stakeholderId: id,
      notes: text,
      scope: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("groupProfile"),
      name,
      displayName: name,
      status: z.enum(["Active", "Prospective", "Inactive", "Archived"]),
      sharepointUrl: z.string().max(1000).default(""),
    })
    .strict(),
  z.object({ action: z.literal("archive") }).strict(),
  z
    .object({ action: z.literal("notes"), associationId: id, notes: text })
    .strict(),
]);
export const partyUpdateSchema = z
  .object({
    displayName: name,
    status: z.enum(["Active", "Archived"]),
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z.string().max(80).optional(),
    occupation: z.string().max(160).optional(),
    description: text.optional(),
  })
  .strict();
export function overlaps(
  a: string,
  b: string | null,
  c: string,
  d: string | null,
) {
  return a < (d || "9999-12-31") && c < (b || "9999-12-31");
}
const active = (alias: string) =>
  `${alias}.startDate<=? AND (${alias}.endDate IS NULL OR ${alias}.endDate>?)`;
export class Service {
  constructor(public db: Db) {}
  rows<T>(sql: string, ...p: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...p) as unknown as T[];
  }
  one<T>(sql: string, ...p: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...p) as unknown as T | undefined;
  }
  employee(id: string) {
    return this.one<Employee>(
      "SELECT id,displayName,email,level,role,active FROM employee WHERE id=? AND active=1",
      id,
    );
  }
  canRead(user: Employee, groupId: string) {
    return !!this.one<{ id: string }>(
      `SELECT g.id FROM client_group g WHERE g.id=? AND (?='admin' OR EXISTS(SELECT 1 FROM team_membership m WHERE m.teamId=g.teamId AND m.employeeId=? AND ${active("m")}) OR EXISTS(SELECT 1 FROM group_grant x WHERE x.groupId=g.id AND x.employeeId=? AND ${active("x")}))`,
      groupId,
      user.role,
      user.id,
      today(),
      today(),
      user.id,
      today(),
      today(),
    );
  }
  canEdit(user: Employee, groupId: string) {
    return (
      this.canRead(user, groupId) &&
      (user.role === "admin" ||
        user.level !== "Associate" ||
        !!this.one(
          `SELECT id FROM group_grant x WHERE x.groupId=? AND x.employeeId=? AND x.canEdit=1 AND ${active("x")}`,
          groupId,
          user.id,
          today(),
          today(),
        ))
    );
  }
  canViewProfitability(user: Employee, groupId: string) {
    if (!this.canRead(user, groupId)) return false;
    return (
      user.level === "Partner" ||
      user.level === "Director" ||
      !!this.one(
        "SELECT id FROM client_group WHERE id=? AND managerId=?",
        groupId,
        user.id,
      ) ||
      !!this.one(
        `SELECT id FROM profitability_grant x WHERE groupId=? AND employeeId=? AND x.revokedAt IS NULL AND ${active("x")}`,
        groupId,
        user.id,
        today(),
        today(),
      )
    );
  }
  requireGroup(user: Employee, id: string, write = false) {
    if (!this.canRead(user, id)) throw new HttpError(404, "Record not found");
    if (write && !this.canEdit(user, id))
      throw new HttpError(
        403,
        "Your role has read-only access to this client group.",
      );
  }
  requireAdmin(user: Employee) {
    if (user.role !== "admin")
      throw new HttpError(403, "Administrator access is required.");
  }
  visibleGroupIds(user: Employee) {
    return this.rows<{ id: string }>("SELECT id FROM client_group")
      .filter((g) => this.canRead(user, g.id))
      .map((g) => g.id);
  }
  group(user: Employee, id: string): Group {
    this.requireGroup(user, id);
    const g = this.one<Group>(
      `SELECT g.*,p.displayName partner,m.displayName manager,t.name team,(SELECT count(DISTINCT gp.partyId) FROM group_party gp JOIN party q ON q.id=gp.partyId WHERE gp.groupId=g.id AND q.kind='PERSON' AND q.status='Active' AND ${active("gp")}) peopleCount,(SELECT count(DISTINCT gp.partyId) FROM group_party gp JOIN party q ON q.id=gp.partyId WHERE gp.groupId=g.id AND q.kind='LEGAL_ENTITY' AND q.status='Active' AND ${active("gp")}) entityCount FROM client_group g JOIN employee p ON p.id=g.partnerId JOIN employee m ON m.id=g.managerId JOIN team t ON t.id=g.teamId WHERE g.id=?`,
      today(),
      today(),
      today(),
      today(),
      id,
    )!;
    return { ...g, canEdit: this.canEdit(user, id) };
  }
  groups(user: Employee) {
    return this.visibleGroupIds(user)
      .map((id) => this.group(user, id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  references() {
    return this.rows<Reference>(
      "SELECT * FROM reference_type ORDER BY category,label",
    );
  }
  teams() {
    return this.rows<Team>(
      "SELECT id,name,description,active FROM team ORDER BY name",
    );
  }
  employees() {
    return this.rows<Employee>(
      "SELECT id,displayName,email,level,role,active FROM employee ORDER BY displayName",
    );
  }
  partyCore(id: string): Party | undefined {
    const p = this.one<Party>("SELECT * FROM party WHERE id=?", id);
    if (!p) return;
    const profile =
      p.kind === "PERSON"
        ? this.one<Partial<Party>>(
            "SELECT firstName,lastName,preferredName,birthDate,deceasedDate,email,phone,occupation,primaryGroupId FROM person_profile WHERE partyId=?",
            id,
          )
        : p.kind === "LEGAL_ENTITY"
          ? this.one<Partial<Party>>(
              "SELECT l.legalName,l.entityTypeId,r.label entityType,l.jurisdiction,l.formationDate,l.taxClassification,l.description FROM legal_entity_profile l JOIN reference_type r ON r.id=l.entityTypeId WHERE partyId=?",
              id,
            )
          : this.one<Partial<Party>>(
              "SELECT organizationType,website,email,phone,address FROM advisor_organization_profile WHERE partyId=?",
              id,
            );
    return { ...p, ...profile };
  }
  partyVisible(user: Employee, id: string) {
    return this.partyGroups(id).some((g) => this.canRead(user, g));
  }
  partyGroups(id: string) {
    return this.rows<{ groupId: string }>(
      "SELECT groupId FROM group_party WHERE partyId=? UNION SELECT groupId FROM stakeholder WHERE partyId=?",
      id,
      id,
    ).map((g) => g.groupId);
  }
  party(user: Employee, id: string) {
    if (!this.partyVisible(user, id))
      throw new HttpError(404, "Record not found");
    const p = this.partyCore(id)!;
    const affiliations = this.rows<{
      id: string;
      organizationId: string;
      organization: string;
      position: string;
      startDate: string;
      endDate: string | null;
    }>(
      "SELECT a.id,a.organizationId,p.displayName organization,a.position,a.startDate,a.endDate FROM professional_affiliation a JOIN party p ON p.id=a.organizationId WHERE a.personId=?",
      id,
    ).filter((a) => this.partyVisible(user, a.organizationId));
    return {
      ...p,
      affiliations,
      groups: this.partyGroups(id)
        .filter((g) => this.canRead(user, g))
        .map((g) => ({ id: g, name: this.group(user, g).name })),
      canEdit: this.partyGroups(id).every((g) => this.canEdit(user, g)),
    };
  }
  parties(user: Employee) {
    const ids = this.rows<{ id: string }>("SELECT id FROM party").filter((p) =>
      this.partyVisible(user, p.id),
    );
    return ids
      .map((p) => this.partyCore(p.id)!)
      .map((p) => ({
        ...p,
        groups: this.partyGroups(p.id)
          .filter((g) => this.canRead(user, g))
          .map((g) => ({ id: g, name: this.group(user, g).name })),
        isAdvisor: this.rows<{ groupId: string }>(
          "SELECT groupId FROM stakeholder WHERE partyId=?",
          p.id,
        ).some((s) => this.canRead(user, s.groupId)),
      }));
  }
  groupParties(id: string, asOf: string) {
    return this.rows<Party>(
      `SELECT gp.id associationId,gp.partyId id,gp.groupId,gp.associationType,gp.billable,gp.notes,gp.startDate,gp.endDate FROM group_party gp WHERE gp.groupId=? AND ${active("gp")}`,
      id,
      asOf,
      asOf,
    ).map((a) => ({ ...this.partyCore(a.id)!, ...a }));
  }
  detail(user: Employee, id: string, asOf: string): GroupDetail {
    this.requireGroup(user, id);
    const parties = this.groupParties(id, asOf);
    const advisors = this.rows<Party>(
      `SELECT s.id stakeholderId,s.partyId id,s.groupId,s.scope,s.notes,s.primaryAdvisor,s.startDate,s.endDate,r.label advisorType FROM stakeholder s JOIN reference_type r ON r.id=s.typeId WHERE s.groupId=? AND ${active("s")}`,
      id,
      asOf,
      asOf,
    ).map((a) => ({ ...this.partyCore(a.id)!, ...a }));
    const visible = new Set([...parties, ...advisors].map((p) => p.id));
    const households = this.rows<Household>(
      `SELECT * FROM household h WHERE groupId=? AND ${active("h")} ORDER BY name`,
      id,
      asOf,
      asOf,
    ).map((h) => ({
      ...h,
      members: this.rows<Household["members"][number]>(
        `SELECT m.id,m.personId,p.displayName name,m.role,m.isPrimary,m.startDate,m.endDate FROM household_membership m JOIN party p ON p.id=m.personId WHERE m.householdId=? AND ${active("m")}`,
        h.id,
        asOf,
        asOf,
      ).filter((m) => visible.has(m.personId)),
    }));
    const relationships = this.rows<Relationship>(
      `SELECT e.*,r.label type,r.code,r.ownership,r.symmetric FROM relationship e JOIN reference_type r ON r.id=e.typeId WHERE e.groupId=? AND ${active("e")} ORDER BY e.startDate`,
      id,
      asOf,
      asOf,
    ).filter((e) => visible.has(e.sourceId) && visible.has(e.targetId));
    return {
      group: this.group(user, id),
      people: parties.filter((p) => p.kind === "PERSON"),
      entities: parties.filter((p) => p.kind === "LEGAL_ENTITY"),
      advisors,
      households,
      relationships,
      asOf,
      assignments: this.rows<GroupDetail["assignments"][number]>(
        "SELECT a.id,p.displayName partner,m.displayName manager,t.name team,a.startDate,a.endDate FROM assignment_history a JOIN employee p ON p.id=a.partnerId JOIN employee m ON m.id=a.managerId JOIN team t ON t.id=a.teamId WHERE a.groupId=? ORDER BY a.startDate DESC",
        id,
      ),
    };
  }
  audit(user: Employee, groupId?: string) {
    if (groupId) this.requireGroup(user, groupId);
    return this.rows<
      import("../shared/types.ts").Audit & { accessClassification: string }
    >(
      "SELECT a.id,a.groupId,a.accessClassification,e.displayName actor,a.action,a.recordId,a.before,a.after,a.createdAt FROM audit_log a JOIN employee e ON e.id=a.actorId ORDER BY a.createdAt DESC",
    )
      .filter(
        (a) =>
          (!groupId || a.groupId === groupId) &&
          (a.groupId ? this.canRead(user, a.groupId) : user.role === "admin") &&
          (a.accessClassification !== "PROFITABILITY" ||
            (!!a.groupId && this.canViewProfitability(user, a.groupId))),
      )
      .slice(0, 100);
  }
  log(
    user: Employee,
    groupId: string | null,
    action: string,
    recordId: string,
    before: unknown,
    after: unknown,
    accessClassification = "GENERAL",
  ) {
    insert(this.db, "audit_log", {
      id: randomUUID(),
      groupId,
      actorId: user.id,
      accessClassification,
      action,
      recordId,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      createdAt: new Date().toISOString(),
    });
  }
  ref(id: string, category: string) {
    const ref = this.one<Reference>(
      "SELECT * FROM reference_type WHERE id=? AND category=? AND active=1",
      id,
      category,
    );
    if (!ref) throw new HttpError(400, "Choose an active category.");
    return ref;
  }
  assignments(partnerId: string, managerId: string, teamId: string) {
    if (this.employee(partnerId)?.level !== "Partner")
      throw new HttpError(400, "Primary Partner must be an active Partner.");
    if (!this.employee(managerId))
      throw new HttpError(400, "Choose an active Relationship Manager.");
    if (!this.one("SELECT id FROM team WHERE id=? AND active=1", teamId))
      throw new HttpError(400, "Choose an active service team.");
    for (const personId of [partnerId, managerId])
      if (
        !this.one(
          `SELECT id FROM team_membership m WHERE m.teamId=? AND m.employeeId=? AND ${active("m")}`,
          teamId,
          personId,
          today(),
          today(),
        )
      )
        throw new HttpError(
          400,
          "Partner and Relationship Manager must belong to the designated team.",
        );
  }
  range(start: string, end: string | null) {
    if (end && end <= start)
      throw new HttpError(
        400,
        "End date must be after start date (end dates are exclusive).",
      );
  }
  createGroup(user: Employee, input: unknown) {
    if (user.role !== "admin" && user.level === "Associate")
      throw new HttpError(403, "Your role cannot create client groups.");
    const v = groupSchema.parse(input);
    this.assignments(v.partnerId, v.managerId, v.teamId);
    if (
      user.role !== "admin" &&
      !this.one(
        `SELECT id FROM team_membership m WHERE m.teamId=? AND m.employeeId=? AND ${active("m")}`,
        v.teamId,
        user.id,
        today(),
        today(),
      )
    )
      throw new HttpError(403, "Choose one of your authorized service teams.");
    if (
      v.sharepointUrl &&
      !/^https:\/\/[^/]+\.sharepoint\.com\//i.test(v.sharepointUrl)
    )
      throw new HttpError(400, "Use an HTTPS SharePoint folder URL.");
    return transaction(this.db, () => {
      const id = randomUUID(),
        stamp = new Date().toISOString();
      insert(this.db, "client_group", {
        id,
        ...v,
        sharepointUrl: v.sharepointUrl || null,
        createdAt: stamp,
        updatedAt: stamp,
      });
      insert(this.db, "assignment_history", {
        id: randomUUID(),
        groupId: id,
        partnerId: v.partnerId,
        managerId: v.managerId,
        teamId: v.teamId,
        startDate: v.inceptionDate,
        endDate: null,
        createdAt: stamp,
        updatedAt: stamp,
      });
      this.log(user, id, "Client group created", id, null, v);
      return { id };
    });
  }
  mutate(user: Employee, groupId: string, input: unknown) {
    this.requireGroup(user, groupId, true);
    const v = commandSchema.parse(input);
    if ("startDate" in v) this.range(v.startDate, v.endDate);
    return transaction(this.db, () => {
      const id = randomUUID(),
        stamp = new Date().toISOString(),
        dates = { createdAt: stamp, updatedAt: stamp };
      const addParty = (kind: string, displayName: string) =>
        insert(this.db, "party", {
          id,
          kind,
          displayName,
          status: "Active",
          ...dates,
        });
      const addAssociation = (
        partyId: string,
        startDate: string,
        endDate: string | null,
        billable = false,
        notes = "",
      ) => {
        const p = this.partyCore(partyId);
        if (!p) throw new HttpError(404, "Record not found");
        if (p.status === "Archived")
          throw new HttpError(400, "Archived records cannot be associated.");
        if (p.kind === "PERSON" && p.primaryGroupId !== groupId)
          throw new HttpError(
            400,
            "Family members belong to one Client Group. Add professionals as advisors.",
          );
        if (
          this.rows<{
            groupId: string;
            startDate: string;
            endDate: string | null;
          }>(
            "SELECT groupId,startDate,endDate FROM group_party WHERE partyId=?",
            partyId,
          ).some(
            (a) =>
              (a.groupId === groupId || p.kind === "PERSON") &&
              overlaps(startDate, endDate, a.startDate, a.endDate),
          )
        )
          throw new HttpError(
            409,
            "This association overlaps an existing membership.",
          );
        insert(this.db, "group_party", {
          id: randomUUID(),
          groupId,
          partyId,
          associationType: "Member",
          startDate,
          endDate,
          billable: billable ? 1 : 0,
          notes,
          status: "Active",
          ...dates,
        });
      };
      const addMember = (
        householdId: string,
        personId: string,
        role: string,
        isPrimary: boolean,
        startDate: string,
        endDate: string | null,
      ) => {
        const h = this.one<Household>(
          "SELECT * FROM household WHERE id=? AND groupId=?",
          householdId,
          groupId,
        );
        if (!h) throw new HttpError(404, "Household not found");
        const p = this.partyCore(personId);
        if (p?.kind !== "PERSON" || p.primaryGroupId !== groupId)
          throw new HttpError(400, "Choose a family member in this group.");
        if (
          startDate < h.startDate ||
          (h.endDate && (!endDate || endDate > h.endDate))
        )
          throw new HttpError(
            400,
            "Membership must fit within household effective dates.",
          );
        if (
          !this.one<{ id: string }>(
            `SELECT id FROM group_party WHERE groupId=? AND partyId=? AND startDate<=? AND (endDate IS NULL OR (?>=startDate AND endDate>=?))`,
            groupId,
            personId,
            startDate,
            endDate || "9999-12-31",
            endDate || "9999-12-31",
          )
        )
          throw new HttpError(
            400,
            "Membership must fit within group association dates.",
          );
        const members = this.rows<{
          personId: string;
          isPrimary: number;
          startDate: string;
          endDate: string | null;
        }>(
          "SELECT * FROM household_membership WHERE householdId=?",
          householdId,
        );
        if (
          members.some(
            (m) =>
              (m.personId === personId || (m.isPrimary && isPrimary)) &&
              overlaps(startDate, endDate, m.startDate, m.endDate),
          )
        )
          throw new HttpError(
            409,
            "Overlapping membership or primary contact.",
          );
        insert(this.db, "household_membership", {
          id,
          householdId,
          personId,
          role,
          isPrimary: isPrimary ? 1 : 0,
          startDate,
          endDate,
          ...dates,
        });
      };
      if (v.action === "person") {
        addParty("PERSON", v.displayName);
        insert(this.db, "person_profile", {
          id: randomUUID(),
          partyId: id,
          primaryGroupId: groupId,
          firstName: v.firstName,
          lastName: v.lastName,
          preferredName: "",
          birthDate: v.birthDate,
          deceasedDate: null,
          email: v.email,
          phone: v.phone,
          occupation: v.occupation,
        });
        addAssociation(id, v.startDate, v.endDate, v.billable, v.notes);
        if (v.householdId)
          addMember(
            v.householdId,
            id,
            "Family member",
            false,
            v.startDate,
            v.endDate,
          );
      }
      if (v.action === "entity") {
        this.ref(v.entityTypeId, "entity");
        addParty("LEGAL_ENTITY", v.displayName);
        insert(this.db, "legal_entity_profile", {
          id: randomUUID(),
          partyId: id,
          legalName: v.displayName,
          entityTypeId: v.entityTypeId,
          jurisdiction: v.jurisdiction,
          formationDate: v.formationDate,
          taxClassification: v.taxClassification,
          description: v.description,
        });
        addAssociation(id, v.startDate, v.endDate, v.billable, v.notes);
      }
      if (v.action === "associate") {
        if (!this.partyVisible(user, v.partyId))
          throw new HttpError(404, "Record not found");
        if (this.partyCore(v.partyId)?.kind !== "LEGAL_ENTITY")
          throw new HttpError(
            400,
            "Only legal entities can be associated here.",
          );
        addAssociation(v.partyId, v.startDate, v.endDate, v.billable, v.notes);
      }
      if (v.action === "household")
        insert(this.db, "household", {
          id,
          groupId,
          name: v.name,
          description: v.description,
          startDate: v.startDate,
          endDate: v.endDate,
          ...dates,
        });
      if (v.action === "membership")
        addMember(
          v.householdId,
          v.personId,
          v.role,
          v.isPrimary,
          v.startDate,
          v.endDate,
        );
      if (v.action === "advisor") {
        this.ref(v.typeId, "advisor");
        const partyId = v.existingPartyId || id;
        if (v.existingPartyId) {
          if (!this.partyVisible(user, partyId))
            throw new HttpError(404, "Record not found");
          const p = this.partyCore(partyId)!;
          if (
            p.kind === "LEGAL_ENTITY" ||
            (p.kind === "PERSON" && p.primaryGroupId)
          )
            throw new HttpError(
              400,
              "Choose a professional or advisor organization.",
            );
        } else {
          addParty(v.kind, v.displayName);
          if (v.kind === "PERSON") {
            if (!v.firstName.trim() || !v.lastName.trim())
              throw new HttpError(400, "First and last names are required.");
            insert(this.db, "person_profile", {
              id: randomUUID(),
              partyId: id,
              primaryGroupId: null,
              firstName: v.firstName,
              lastName: v.lastName,
              preferredName: "",
              birthDate: null,
              deceasedDate: null,
              email: v.email,
              phone: v.phone,
              occupation: "",
            });
          } else
            insert(this.db, "advisor_organization_profile", {
              id: randomUUID(),
              partyId: id,
              organizationType: "Professional firm",
              website: "",
              email: v.email,
              phone: v.phone,
              address: "",
            });
        }
        if (
          this.rows<{ startDate: string; endDate: string | null }>(
            "SELECT startDate,endDate FROM stakeholder WHERE groupId=? AND partyId=? AND typeId=?",
            groupId,
            partyId,
            v.typeId,
          ).some((s) =>
            overlaps(v.startDate, v.endDate, s.startDate, s.endDate),
          )
        )
          throw new HttpError(
            409,
            "An advisor association already exists for these dates.",
          );
        if (v.organizationId) {
          if (v.existingPartyId)
            throw new HttpError(
              400,
              "Affiliations for existing masters require a separate review.",
            );
          if (
            v.kind !== "PERSON" ||
            !this.partyVisible(user, v.organizationId) ||
            this.partyCore(v.organizationId)?.kind !== "ADVISOR_ORGANIZATION"
          )
            throw new HttpError(
              400,
              "Choose an authorized advisor organization.",
            );
          insert(this.db, "professional_affiliation", {
            id: randomUUID(),
            personId: partyId,
            organizationId: v.organizationId,
            position: v.position,
            startDate: v.startDate,
            endDate: v.endDate,
            ...dates,
          });
        }
        insert(this.db, "stakeholder", {
          id,
          groupId,
          partyId,
          typeId: v.typeId,
          scope: v.scope,
          notes: v.notes,
          primaryAdvisor: v.primaryAdvisor ? 1 : 0,
          startDate: v.startDate,
          endDate: v.endDate,
          ...dates,
        });
      }
      if (v.action === "relationship") {
        const ref = this.ref(v.typeId, "relationship");
        if (v.sourceId === v.targetId)
          throw new HttpError(400, "A record cannot be related to itself.");
        for (const p of [v.sourceId, v.targetId]) {
          const spans = this.rows<{
            startDate: string;
            endDate: string | null;
          }>(
            "SELECT startDate,endDate FROM group_party WHERE groupId=? AND partyId=? UNION ALL SELECT startDate,endDate FROM stakeholder WHERE groupId=? AND partyId=?",
            groupId,
            p,
            groupId,
            p,
          );
          if (
            !spans.some(
              (a) =>
                a.startDate <= v.startDate &&
                (!a.endDate || (v.endDate && a.endDate >= v.endDate)),
            )
          )
            throw new HttpError(
              400,
              "Both records must be associated with this group for the entire relationship interval.",
            );
          if (this.partyCore(p)?.status !== "Active")
            throw new HttpError(400, "Use active party records.");
        }
        const source = this.partyCore(v.sourceId)!,
          target = this.partyCore(v.targetId)!;
        if (
          ["parent", "spouse", "former-spouse", "sibling"].includes(ref.code) &&
          (source.kind !== "PERSON" || target.kind !== "PERSON")
        )
          throw new HttpError(400, "Family relationships require two people.");
        if (
          ref.code === "parent" &&
          source.birthDate &&
          target.birthDate &&
          source.birthDate >= target.birthDate
        )
          throw new HttpError(400, "A parent must be born before their child.");
        if (ref.ownership && target.kind !== "LEGAL_ENTITY")
          throw new HttpError(400, "Ownership must target a legal entity.");
        if (
          !ref.ownership &&
          [
            v.ownershipPercentage,
            v.votingPercentage,
            v.economicPercentage,
          ].some((x) => x !== null)
        )
          throw new HttpError(
            400,
            "This relationship type does not carry ownership percentages.",
          );
        const existing = this.rows<Relationship>(
          "SELECT * FROM relationship WHERE groupId=?",
          groupId,
        );
        if (
          existing.some(
            (r) =>
              r.typeId === v.typeId &&
              r.ownershipClass === v.ownershipClass &&
              ((r.sourceId === v.sourceId && r.targetId === v.targetId) ||
                (ref.symmetric &&
                  r.targetId === v.sourceId &&
                  r.sourceId === v.targetId)) &&
              overlaps(v.startDate, v.endDate, r.startDate, r.endDate),
          )
        )
          throw new HttpError(
            409,
            "A relationship already exists for the selected dates and ownership class.",
          );
        if (ref.code === "parent" || ref.ownership) {
          const edges = existing.filter((r) => r.typeId === v.typeId);
          const walk = (
            node: string,
            start: string,
            end: string | null,
            seen: Set<string>,
          ): boolean => {
            if (node === v.sourceId) return true;
            if (seen.has(node)) return false;
            const nextSeen = new Set(seen).add(node);
            return edges
              .filter(
                (r) =>
                  r.sourceId === node &&
                  overlaps(start, end, r.startDate, r.endDate),
              )
              .some((r) =>
                walk(
                  r.targetId,
                  start > r.startDate ? start : r.startDate,
                  [end, r.endDate].filter(Boolean).sort()[0] || null,
                  nextSeen,
                ),
              );
          };
          if (walk(v.targetId, v.startDate, v.endDate, new Set()))
            throw new HttpError(
              409,
              "This relationship would create a circular chain.",
            );
        }
        if (
          ref.code === "spouse" &&
          existing.some(
            (r) =>
              r.typeId === v.typeId &&
              [r.sourceId, r.targetId].some(
                (p) => p === v.sourceId || p === v.targetId,
              ) &&
              overlaps(v.startDate, v.endDate, r.startDate, r.endDate),
          )
        )
          throw new HttpError(
            409,
            "A person already has a spouse in the selected period. End the earlier marriage first.",
          );
        const { action: _action, ...fields } = v;
        insert(this.db, "relationship", { id, groupId, ...fields, ...dates });
      }
      if (v.action === "ownership") {
        const r = this.one<Relationship>(
          "SELECT * FROM relationship WHERE id=? AND groupId=?",
          v.relationshipId,
          groupId,
        );
        if (!r) throw new HttpError(404, "Relationship not found");
        if (!this.ref(r.typeId, "relationship").ownership)
          throw new HttpError(400, "Choose an ownership relationship.");
        if (
          v.effectiveDate <= r.startDate ||
          (r.endDate && v.effectiveDate >= r.endDate)
        )
          throw new HttpError(
            400,
            "Change date must fall strictly inside the existing relationship interval.",
          );
        this.db
          .prepare("UPDATE relationship SET endDate=?,updatedAt=? WHERE id=?")
          .run(v.effectiveDate, stamp, r.id);
        insert(this.db, "relationship", {
          ...r,
          id,
          startDate: v.effectiveDate,
          ownershipPercentage: v.ownershipPercentage,
          notes: v.reason,
          ...dates,
        });
        this.log(user, groupId, "Ownership interval closed", r.id, r, {
          ...r,
          endDate: v.effectiveDate,
        });
      }
      if (v.action === "assignments") {
        this.assignments(v.partnerId, v.managerId, v.teamId);
        if (v.effectiveDate > today())
          throw new HttpError(
            400,
            "Future assignment scheduling is not available in Phase 1.",
          );
        if (
          user.role !== "admin" &&
          !this.one(
            `SELECT id FROM team_membership m WHERE teamId=? AND employeeId=? AND ${active("m")}`,
            v.teamId,
            user.id,
            today(),
            today(),
          )
        )
          throw new HttpError(403, "Choose an authorized service team.");
        const last = this.one<{ id: string; startDate: string }>(
          "SELECT id,startDate FROM assignment_history WHERE groupId=? AND endDate IS NULL",
          groupId,
        );
        if (last && v.effectiveDate <= last.startDate)
          throw new HttpError(
            400,
            "Assignment changes must follow the latest effective start date.",
          );
        if (last)
          this.db
            .prepare(
              "UPDATE assignment_history SET endDate=?,updatedAt=? WHERE id=?",
            )
            .run(v.effectiveDate, stamp, last.id);
        const before = this.group(user, groupId);
        this.db
          .prepare(
            "UPDATE client_group SET partnerId=?,managerId=?,teamId=?,updatedAt=? WHERE id=?",
          )
          .run(v.partnerId, v.managerId, v.teamId, stamp, groupId);
        insert(this.db, "assignment_history", {
          id,
          groupId,
          partnerId: v.partnerId,
          managerId: v.managerId,
          teamId: v.teamId,
          startDate: v.effectiveDate,
          endDate: null,
          ...dates,
        });
        this.log(user, groupId, "Assignments changed", groupId, before, v);
        return { id };
      }
      if (v.action === "endRecord") {
        const table =
          v.recordType === "membership" ? "household_membership" : v.recordType;
        const before =
          v.recordType === "membership"
            ? this.one<{
                id: string;
                startDate: string;
                endDate: string | null;
              }>(
                `SELECT m.* FROM household_membership m JOIN household h ON h.id=m.householdId WHERE m.id=? AND h.groupId=?`,
                v.recordId,
                groupId,
              )
            : this.one<{
                id: string;
                startDate: string;
                endDate: string | null;
              }>(
                `SELECT * FROM ${table} WHERE id=? AND groupId=?`,
                v.recordId,
                groupId,
              );
        if (!before) throw new HttpError(404, "Record not found");
        if (
          v.effectiveEndDate <= before.startDate ||
          (before.endDate && v.effectiveEndDate >= before.endDate)
        )
          throw new HttpError(
            400,
            "The end date must fall strictly inside the existing interval.",
          );
        if (v.recordType === "stakeholder") {
          const row = this.one<{ partyId: string }>(
            "SELECT partyId FROM stakeholder WHERE id=?",
            v.recordId,
          )!;
          const edges = this.rows<{ endDate: string | null }>(
            "SELECT endDate FROM relationship WHERE groupId=? AND (sourceId=? OR targetId=?)",
            groupId,
            row.partyId,
            row.partyId,
          );
          if (edges.some((r) => !r.endDate || r.endDate > v.effectiveEndDate))
            throw new HttpError(
              409,
              "End dependent relationships before ending this advisor association.",
            );
        }
        this.db
          .prepare(`UPDATE ${table} SET endDate=?,updatedAt=? WHERE id=?`)
          .run(v.effectiveEndDate, stamp, v.recordId);
        this.log(user, groupId, `${v.recordType} ended`, v.recordId, before, {
          endDate: v.effectiveEndDate,
          reason: v.reason,
        });
        return { id: v.recordId };
      }
      if (v.action === "advisorNotes") {
        const before = this.one<{ notes: string; scope: string }>(
          "SELECT notes,scope FROM stakeholder WHERE id=? AND groupId=?",
          v.stakeholderId,
          groupId,
        );
        if (!before) throw new HttpError(404, "Record not found");
        this.db
          .prepare(
            "UPDATE stakeholder SET notes=?,scope=?,updatedAt=? WHERE id=?",
          )
          .run(v.notes, v.scope, stamp, v.stakeholderId);
        this.log(
          user,
          groupId,
          "Advisor group context changed",
          v.stakeholderId,
          before,
          v,
        );
        return { id: v.stakeholderId };
      }
      if (v.action === "groupProfile") {
        if (
          v.sharepointUrl &&
          !/^https:\/\/[^/]+\.sharepoint\.com\//i.test(v.sharepointUrl)
        )
          throw new HttpError(400, "Use an HTTPS SharePoint folder URL.");
        const before = this.group(user, groupId);
        this.db
          .prepare(
            "UPDATE client_group SET name=?,displayName=?,status=?,sharepointUrl=?,updatedAt=? WHERE id=?",
          )
          .run(
            v.name,
            v.displayName,
            v.status,
            v.sharepointUrl || null,
            stamp,
            groupId,
          );
        this.log(
          user,
          groupId,
          "Client group profile updated",
          groupId,
          before,
          v,
        );
        return { id: groupId };
      }
      if (v.action === "archive") {
        const before = this.group(user, groupId);
        this.db
          .prepare(
            "UPDATE client_group SET status='Archived',updatedAt=? WHERE id=?",
          )
          .run(stamp, groupId);
        this.log(user, groupId, "Client group archived", groupId, before, {
          status: "Archived",
        });
        return { id: groupId };
      }
      if (v.action === "notes") {
        const association = this.one<{ notes: string }>(
          "SELECT notes FROM group_party WHERE id=? AND groupId=?",
          v.associationId,
          groupId,
        );
        if (!association) throw new HttpError(404, "Association not found");
        this.db
          .prepare("UPDATE group_party SET notes=?,updatedAt=? WHERE id=?")
          .run(v.notes, stamp, v.associationId);
        this.log(
          user,
          groupId,
          "Group notes changed",
          v.associationId,
          association,
          { notes: v.notes },
        );
        return { id: v.associationId };
      }
      this.log(user, groupId, `${v.action} created`, id, null, v);
      return { id };
    });
  }
  updateParty(user: Employee, id: string, input: unknown) {
    const p = this.party(user, id),
      v = partyUpdateSchema.parse(input),
      before = this.partyCore(id);
    if (!p.canEdit)
      throw new HttpError(
        403,
        "This shared master requires additional authorization.",
      );
    return transaction(this.db, () => {
      this.db
        .prepare(
          "UPDATE party SET displayName=?,status=?,updatedAt=? WHERE id=?",
        )
        .run(v.displayName, v.status, new Date().toISOString(), id);
      if (p.kind === "PERSON")
        this.db
          .prepare(
            "UPDATE person_profile SET email=?,phone=?,occupation=? WHERE partyId=?",
          )
          .run(
            v.email ?? p.email ?? "",
            v.phone ?? p.phone ?? "",
            v.occupation ?? p.occupation ?? "",
            id,
          );
      if (p.kind === "LEGAL_ENTITY")
        this.db
          .prepare(
            "UPDATE legal_entity_profile SET legalName=?,description=? WHERE partyId=?",
          )
          .run(v.displayName, v.description ?? p.description ?? "", id);
      if (p.kind === "ADVISOR_ORGANIZATION")
        this.db
          .prepare(
            "UPDATE advisor_organization_profile SET email=?,phone=? WHERE partyId=?",
          )
          .run(v.email ?? p.email ?? "", v.phone ?? p.phone ?? "", id);
      for (const groupId of this.partyGroups(id))
        this.log(user, groupId, "Shared master updated", id, before, v);
      return { id };
    });
  }
}
