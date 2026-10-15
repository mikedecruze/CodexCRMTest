import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDb(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS employee(id TEXT PRIMARY KEY,subject TEXT UNIQUE,displayName TEXT NOT NULL,email TEXT NOT NULL,level TEXT NOT NULL CHECK(level IN ('Partner','Director','Manager','Senior','Associate')),role TEXT NOT NULL CHECK(role IN ('admin','employee')),active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team_membership(id TEXT PRIMARY KEY,teamId TEXT NOT NULL REFERENCES team(id),employeeId TEXT NOT NULL REFERENCES employee(id),startDate TEXT NOT NULL,endDate TEXT,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS client_group(id TEXT PRIMARY KEY,name TEXT NOT NULL,displayName TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Active','Prospective','Inactive','Archived')),inceptionDate TEXT NOT NULL,partnerId TEXT NOT NULL REFERENCES employee(id),managerId TEXT NOT NULL REFERENCES employee(id),teamId TEXT NOT NULL REFERENCES team(id),sharepointUrl TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_grant(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),employeeId TEXT NOT NULL REFERENCES employee(id),canEdit INTEGER NOT NULL DEFAULT 0,startDate TEXT NOT NULL,endDate TEXT);
CREATE TABLE IF NOT EXISTS assignment_history(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),partnerId TEXT NOT NULL REFERENCES employee(id),managerId TEXT NOT NULL REFERENCES employee(id),teamId TEXT NOT NULL REFERENCES team(id),startDate TEXT NOT NULL,endDate TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS reference_type(id TEXT PRIMARY KEY,category TEXT NOT NULL CHECK(category IN ('entity','relationship','advisor','contact')),code TEXT NOT NULL,label TEXT NOT NULL,symmetric INTEGER NOT NULL DEFAULT 0,ownership INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,UNIQUE(category,code));
CREATE TABLE IF NOT EXISTS party(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('PERSON','LEGAL_ENTITY','ADVISOR_ORGANIZATION')),displayName TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived')),createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS person_profile(id TEXT PRIMARY KEY,partyId TEXT NOT NULL UNIQUE REFERENCES party(id),primaryGroupId TEXT REFERENCES client_group(id),firstName TEXT NOT NULL,lastName TEXT NOT NULL,preferredName TEXT NOT NULL DEFAULT '',birthDate TEXT,deceasedDate TEXT,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',occupation TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS legal_entity_profile(id TEXT PRIMARY KEY,partyId TEXT NOT NULL UNIQUE REFERENCES party(id),legalName TEXT NOT NULL,entityTypeId TEXT NOT NULL REFERENCES reference_type(id),jurisdiction TEXT NOT NULL DEFAULT '',formationDate TEXT,taxClassification TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS advisor_organization_profile(id TEXT PRIMARY KEY,partyId TEXT NOT NULL UNIQUE REFERENCES party(id),organizationType TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS group_party(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),partyId TEXT NOT NULL REFERENCES party(id),associationType TEXT NOT NULL,startDate TEXT NOT NULL,endDate TEXT,billable INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Active',createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS household(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',startDate TEXT NOT NULL,endDate TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS household_membership(id TEXT PRIMARY KEY,householdId TEXT NOT NULL REFERENCES household(id),personId TEXT NOT NULL REFERENCES party(id),role TEXT NOT NULL,isPrimary INTEGER NOT NULL DEFAULT 0,startDate TEXT NOT NULL,endDate TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS stakeholder(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),partyId TEXT NOT NULL REFERENCES party(id),typeId TEXT NOT NULL REFERENCES reference_type(id),scope TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',primaryAdvisor INTEGER NOT NULL DEFAULT 0,startDate TEXT NOT NULL,endDate TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS professional_affiliation(id TEXT PRIMARY KEY,personId TEXT NOT NULL REFERENCES party(id),organizationId TEXT NOT NULL REFERENCES party(id),position TEXT NOT NULL,startDate TEXT NOT NULL,endDate TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS relationship(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),sourceId TEXT NOT NULL REFERENCES party(id),targetId TEXT NOT NULL REFERENCES party(id),typeId TEXT NOT NULL REFERENCES reference_type(id),startDate TEXT NOT NULL,endDate TEXT,ownershipPercentage REAL CHECK(ownershipPercentage BETWEEN 0 AND 100),votingPercentage REAL CHECK(votingPercentage BETWEEN 0 AND 100),economicPercentage REAL CHECK(economicPercentage BETWEEN 0 AND 100),ownershipClass TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',sourceDocument TEXT NOT NULL DEFAULT '',createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,CHECK(sourceId<>targetId),CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,groupId TEXT REFERENCES client_group(id),actorId TEXT NOT NULL REFERENCES employee(id),action TEXT NOT NULL,recordId TEXT NOT NULL,before TEXT,after TEXT,createdAt TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TABLE IF NOT EXISTS session(tokenHash TEXT PRIMARY KEY,employeeId TEXT NOT NULL REFERENCES employee(id),expiresAt INTEGER NOT NULL,mode TEXT NOT NULL DEFAULT 'demo');
CREATE TABLE IF NOT EXISTS login_attempt(state TEXT PRIMARY KEY,verifier TEXT NOT NULL,nonce TEXT NOT NULL,expiresAt INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS group_party_group ON group_party(groupId,partyId,startDate,endDate);
CREATE INDEX IF NOT EXISTS relationship_group ON relationship(groupId,startDate,endDate);
CREATE INDEX IF NOT EXISTS stakeholder_group ON stakeholder(groupId,partyId);
CREATE INDEX IF NOT EXISTS membership_employee ON team_membership(employeeId,startDate,endDate);
CREATE INDEX IF NOT EXISTS household_group ON household(groupId);
`);
  // Upgrade sessions from the first local adapter revision; old sessions stay demo-only.
  const columns = db.prepare("PRAGMA table_info(session)").all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === "mode"))
    db.exec("ALTER TABLE session ADD COLUMN mode TEXT NOT NULL DEFAULT 'demo'");
  return db;
}
export type Db = ReturnType<typeof openDb>;
export function transaction<T>(db: Db, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
