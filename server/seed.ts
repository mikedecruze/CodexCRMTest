import { createHash, randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import { transaction } from "./db.ts";
import { seedFinancial } from "./financial/seed.ts";
export const seedId = (key: string) => {
  const s = createHash("sha256").update(`trove-fixture:${key}`).digest("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
};
export function insert(db: Db, table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  db.prepare(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
  ).run(...(Object.values(row) as (string | number | null)[]));
}
export function seed(db: Db) {
  if (
    (db.prepare("SELECT count(*) AS n FROM employee").get() as { n: number }).n
  ) {
    seedFinancial(db);
    return;
  }
  transaction(db, () => {
    const stamp = "2026-01-15T12:00:00.000Z";
    const dates = { createdAt: stamp, updatedAt: stamp };
    const employees = [
      ["elizabeth", "Elizabeth Morgan", "Partner", "admin"],
      ["james", "James Carter", "Manager", "employee"],
      ["diana", "Diana Brooks", "Director", "employee"],
      ["oliver", "Oliver Chen", "Senior", "employee"],
      ["sophia", "Sophia Reed", "Associate", "employee"],
      ["william", "William Hayes", "Partner", "employee"],
      ["ava", "Ava Thompson", "Manager", "employee"],
      ["noah", "Noah Bennett", "Associate", "employee"],
    ];
    for (const [key, displayName, level, role] of employees)
      insert(db, "employee", {
        id: seedId(key),
        subject: `demo:${key}`,
        displayName,
        email: `${key}@trove.example`,
        level,
        role,
        active: 1,
        ...dates,
      });
    for (const [key, name, description] of [
      ["team-cedar", "Cedar team", "Multigenerational family advisory"],
      ["team-oak", "Oak team", "Integrated family office services"],
    ])
      insert(db, "team", {
        id: seedId(key),
        name,
        description,
        active: 1,
        ...dates,
      });
    for (const key of ["elizabeth", "james", "diana", "oliver", "sophia"])
      insert(db, "team_membership", {
        id: randomUUID(),
        teamId: seedId("team-cedar"),
        employeeId: seedId(key),
        startDate: "2010-01-01",
        endDate: null,
      });
    for (const key of ["william", "ava"])
      insert(db, "team_membership", {
        id: randomUUID(),
        teamId: seedId("team-oak"),
        employeeId: seedId(key),
        startDate: "2010-01-01",
        endDate: null,
      });
    const refs = [
      ["entity", "trust", "Trust", 0, 0],
      ["entity", "llc", "Limited liability company", 0, 0],
      ["entity", "partnership", "Partnership", 0, 0],
      ["entity", "corporation", "Corporation", 0, 0],
      ["entity", "s-corp", "S corporation", 0, 0],
      ["entity", "foundation", "Private foundation", 0, 0],
      ["entity", "daf", "Donor-advised fund", 0, 0],
      ["entity", "estate", "Estate", 0, 0],
      ["relationship", "parent", "Parent / child", 0, 0],
      ["relationship", "spouse", "Spouse", 1, 0],
      ["relationship", "former-spouse", "Former spouse", 1, 0],
      ["relationship", "sibling", "Sibling", 1, 0],
      ["relationship", "owner", "Ownership interest", 0, 1],
      ["relationship", "trustee", "Trustee", 0, 0],
      ["relationship", "beneficiary", "Beneficiary", 0, 0],
      ["relationship", "grantor", "Grantor", 0, 0],
      ["relationship", "manager", "Manager", 0, 0],
      ["relationship", "officer", "Officer", 0, 0],
      ["relationship", "executor", "Executor", 0, 0],
      ["relationship", "poa", "Power of attorney", 0, 0],
      ["advisor", "tax", "Tax advisor", 0, 0],
      ["advisor", "legal", "Estate counsel", 0, 0],
      ["advisor", "investment", "Investment advisor", 0, 0],
      ["advisor", "insurance", "Insurance advisor", 0, 0],
      ["contact", "family", "Family member", 0, 0],
    ];
    for (const [category, code, label, symmetric, ownership] of refs)
      insert(db, "reference_type", {
        id: seedId(`${category}-${code}`),
        category,
        code,
        label,
        symmetric,
        ownership,
        active: 1,
        ...dates,
      });
    for (const [key, name, displayName, date, team, partner, manager] of [
      [
        "smith",
        "Smith Family",
        "The Smith family",
        "2014-03-15",
        "team-cedar",
        "elizabeth",
        "james",
      ],
      [
        "bennett",
        "Bennett Family",
        "The Bennett family",
        "2018-06-01",
        "team-cedar",
        "elizabeth",
        "james",
      ],
      [
        "carter",
        "Carter Family",
        "The Carter family",
        "2020-09-01",
        "team-oak",
        "william",
        "ava",
      ],
    ]) {
      insert(db, "client_group", {
        id: seedId(key),
        name,
        displayName,
        status: "Active",
        inceptionDate: date,
        partnerId: seedId(partner),
        managerId: seedId(manager),
        teamId: seedId(team),
        sharepointUrl: null,
        ...dates,
      });
      insert(db, "assignment_history", {
        id: randomUUID(),
        groupId: seedId(key),
        partnerId: seedId(partner),
        managerId: seedId(manager),
        teamId: seedId(team),
        startDate: date,
        endDate: null,
        ...dates,
      });
    }
    const party = (key: string, kind: string, displayName: string) =>
      insert(db, "party", {
        id: seedId(key),
        kind,
        displayName,
        status: "Active",
        ...dates,
      });
    const associate = (key: string, group: string, notes = "") =>
      insert(db, "group_party", {
        id: randomUUID(),
        groupId: seedId(group),
        partyId: seedId(key),
        associationType: "Member",
        startDate: "2010-01-01",
        endDate: null,
        billable: 0,
        notes,
        status: "Active",
        ...dates,
      });
    const persons = [
      ["robert", "Robert", "Smith", "1948-04-12", "smith", "Retired founder"],
      ["eleanor", "Eleanor", "Smith", "1950-09-22", "smith", "Philanthropist"],
      [
        "alexander",
        "Alexander",
        "Smith",
        "1976-05-18",
        "smith",
        "Managing director",
      ],
      ["charlotte", "Charlotte", "Smith", "1979-11-03", "smith", "Architect"],
      ["emma", "Emma", "Smith", "2002-07-09", "smith", "Graduate student"],
      ["henry", "Henry", "Smith", "2006-02-14", "smith", "Student"],
      ["olivia", "Olivia", "Reynolds", "1981-08-26", "smith", "Entrepreneur"],
      ["liam", "Liam", "Reynolds", "1980-12-02", "smith", "Physician"],
      ["amelia", "Amelia", "Reynolds", "2010-06-11", "smith", "Student"],
      ["thomas", "Thomas", "Bennett", "1963-01-25", "bennett", "Founder"],
      ["isabelle", "Isabelle", "Bennett", "1965-03-12", "bennett", "Director"],
      ["lucas", "Lucas", "Bennett", "1993-10-15", "bennett", "Investor"],
      ["daniel", "Daniel", "Carter", "1968-08-04", "carter", "Chief executive"],
      ["grace", "Grace", "Carter", "1971-02-20", "carter", "Art advisor"],
      ["mia", "Mia", "Carter", "1998-05-10", "carter", "Designer"],
      ["sarah", "Sarah", "Mitchell", "1982-06-18", "", "Estate attorney"],
      ["michael", "Michael", "Lee", "1975-10-10", "", "Investment advisor"],
    ];
    for (const [
      key,
      firstName,
      lastName,
      birthDate,
      group,
      occupation,
    ] of persons) {
      party(key, "PERSON", `${firstName} ${lastName}`);
      insert(db, "person_profile", {
        id: randomUUID(),
        partyId: seedId(key),
        primaryGroupId: group ? seedId(group) : null,
        firstName,
        lastName,
        preferredName: "",
        birthDate,
        deceasedDate: null,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phone: "+1 (212) 555-0140",
        occupation,
      });
      if (group) associate(key, group);
    }
    for (const [key, name, type, jurisdiction] of [
      ["smith-trust", "Smith Family Trust", "trust", "Delaware"],
      ["legacy-trust", "Smith Legacy Trust", "trust", "South Dakota"],
      ["education-trust", "Smith Education Trust", "trust", "Delaware"],
      ["smith-holdings", "Smith Holdings LLC", "llc", "Delaware"],
      ["shared", "Evergreen Ventures LLC", "llc", "New York"],
      ["foundation", "Smith Family Foundation", "foundation", "New York"],
      ["bennett-trust", "Bennett Revocable Trust", "trust", "Connecticut"],
      ["bennett-partners", "Bennett Partners LP", "partnership", "Delaware"],
      ["carter-trust", "Carter Family Trust", "trust", "New York"],
      ["carter-llc", "Carter Properties LLC", "llc", "Delaware"],
    ]) {
      party(key, "LEGAL_ENTITY", name);
      insert(db, "legal_entity_profile", {
        id: randomUUID(),
        partyId: seedId(key),
        legalName: name,
        entityTypeId: seedId(`entity-${type}`),
        jurisdiction,
        formationDate: "2012-01-01",
        taxClassification: "",
        description: "Synthetic relationship record",
      });
    }
    for (const key of [
      "smith-trust",
      "legacy-trust",
      "education-trust",
      "smith-holdings",
      "shared",
      "foundation",
    ])
      associate(
        key,
        "smith",
        key === "shared"
          ? "Smith investment scope — confidential to Cedar."
          : "",
      );
    for (const key of ["bennett-trust", "bennett-partners"])
      associate(key, "bennett");
    for (const key of ["carter-trust", "carter-llc", "shared"])
      associate(
        key,
        "carter",
        key === "shared"
          ? "CARTER_PRIVATE_NOTE_729: confidential Oak strategy."
          : "",
      );
    for (const [key, name] of [
      ["mitchell-law", "Mitchell & Associates"],
      ["northstar", "Northstar Advisory"],
    ]) {
      party(key, "ADVISOR_ORGANIZATION", name);
      insert(db, "advisor_organization_profile", {
        id: randomUUID(),
        partyId: seedId(key),
        organizationType:
          key === "northstar" ? "Investment advisory" : "Law firm",
        website: "https://example.com",
        email: "office@example.com",
        phone: "+1 (212) 555-0198",
        address: "New York, NY",
      });
    }
    for (const [person, org, position] of [
      ["sarah", "mitchell-law", "Partner"],
      ["michael", "northstar", "Managing director"],
    ])
      insert(db, "professional_affiliation", {
        id: randomUUID(),
        personId: seedId(person),
        organizationId: seedId(org),
        position,
        startDate: "2010-01-01",
        endDate: null,
        ...dates,
      });
    for (const group of ["smith", "bennett", "carter"])
      for (const [person, type] of [
        ["sarah", "legal"],
        ["mitchell-law", "legal"],
        ["michael", "investment"],
        ["northstar", "investment"],
      ])
        insert(db, "stakeholder", {
          id: randomUUID(),
          groupId: seedId(group),
          partyId: seedId(person),
          typeId: seedId(`advisor-${type}`),
          scope:
            type === "legal"
              ? "Estate planning & fiduciary counsel"
              : "Investment strategy",
          notes:
            group === "carter"
              ? "CARTER_PRIVATE_ADVISOR_917"
              : "Annual relationship review recommended.",
          primaryAdvisor: person === "sarah" ? 1 : 0,
          startDate: "2020-01-01",
          endDate: null,
          ...dates,
        });
    for (const [key, group, name, members] of [
      ["smith-founders", "smith", "Robert & Eleanor", ["robert", "eleanor"]],
      [
        "smith-alex",
        "smith",
        "Alexander & Charlotte",
        ["alexander", "charlotte", "emma", "henry"],
      ],
      ["smith-olivia", "smith", "Olivia & Liam", ["olivia", "liam", "amelia"]],
      [
        "bennett-home",
        "bennett",
        "Thomas & Isabelle",
        ["thomas", "isabelle", "lucas"],
      ],
      ["carter-home", "carter", "Daniel & Grace", ["daniel", "grace", "mia"]],
    ] as [string, string, string, string[]][]) {
      insert(db, "household", {
        id: seedId(key),
        groupId: seedId(group),
        name,
        description: "Family household",
        startDate: "2010-01-01",
        endDate: null,
        ...dates,
      });
      members.forEach((p, i) =>
        insert(db, "household_membership", {
          id: randomUUID(),
          householdId: seedId(key),
          personId: seedId(p),
          role: i === 0 ? "Primary contact" : "Family member",
          isPrimary: i === 0 ? 1 : 0,
          startDate: "2010-01-01",
          endDate: null,
          ...dates,
        }),
      );
    }
    const rel = (
      group: string,
      source: string,
      target: string,
      type: string,
      startDate = "2010-01-01",
      endDate: string | null = null,
      percentage: number | null = null,
    ) =>
      insert(db, "relationship", {
        id: randomUUID(),
        groupId: seedId(group),
        sourceId: seedId(source),
        targetId: seedId(target),
        typeId: seedId(`relationship-${type}`),
        startDate,
        endDate,
        ownershipPercentage: percentage,
        votingPercentage: null,
        economicPercentage: null,
        ownershipClass: type === "owner" ? "Common" : "",
        notes: "",
        sourceDocument: "",
        ...dates,
      });
    for (const [s, t] of [
      ["robert", "eleanor"],
      ["alexander", "charlotte"],
      ["olivia", "liam"],
    ])
      rel("smith", s, t, "spouse");
    for (const [s, t] of [
      ["robert", "alexander"],
      ["eleanor", "alexander"],
      ["robert", "olivia"],
      ["eleanor", "olivia"],
      ["alexander", "emma"],
      ["charlotte", "emma"],
      ["alexander", "henry"],
      ["charlotte", "henry"],
      ["olivia", "amelia"],
      ["liam", "amelia"],
    ])
      rel("smith", s, t, "parent");
    rel("smith", "alexander", "olivia", "sibling");
    rel("smith", "robert", "smith-trust", "grantor");
    rel("smith", "sarah", "smith-trust", "trustee");
    rel("smith", "emma", "education-trust", "beneficiary");
    rel("smith", "henry", "education-trust", "beneficiary");
    rel(
      "smith",
      "robert",
      "smith-trust",
      "owner",
      "2010-01-01",
      "2025-01-01",
      80,
    );
    rel("smith", "robert", "smith-trust", "owner", "2025-01-01", null, 60);
    rel(
      "smith",
      "eleanor",
      "smith-trust",
      "owner",
      "2010-01-01",
      "2025-01-01",
      20,
    );
    rel("smith", "eleanor", "smith-trust", "owner", "2025-01-01", null, 40);
    rel(
      "smith",
      "smith-trust",
      "smith-holdings",
      "owner",
      "2010-01-01",
      null,
      100,
    );
    rel("smith", "smith-holdings", "shared", "owner", "2010-01-01", null, 40);
    rel(
      "smith",
      "legacy-trust",
      "foundation",
      "owner",
      "2010-01-01",
      null,
      100,
    );
    rel("smith", "alexander", "smith-holdings", "manager");
    rel("bennett", "thomas", "isabelle", "spouse");
    rel("bennett", "thomas", "lucas", "parent");
    rel("bennett", "thomas", "bennett-trust", "grantor");
    rel(
      "bennett",
      "bennett-trust",
      "bennett-partners",
      "owner",
      "2010-01-01",
      null,
      100,
    );
    rel("carter", "daniel", "grace", "spouse");
    rel("carter", "daniel", "mia", "parent");
    rel("carter", "carter-trust", "shared", "owner", "2010-01-01", null, 60);
    insert(db, "audit_log", {
      id: randomUUID(),
      groupId: seedId("smith"),
      actorId: seedId("elizabeth"),
      action: "Synthetic data initialized",
      recordId: seedId("smith"),
      before: null,
      after: JSON.stringify({ synthetic: true }),
      createdAt: stamp,
    });
  });
  seedFinancial(db);
}
