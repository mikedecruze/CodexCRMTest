import type { DatabaseSync } from "node:sqlite";
import { metricDefinitions, financialId } from "./catalog.ts";
export function migrateFinancial(db: DatabaseSync) {
  db.exec(`
CREATE TABLE IF NOT EXISTS service_line(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS metric_definition(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,unit TEXT NOT NULL,dimensions TEXT NOT NULL,aggregation TEXT NOT NULL,classification TEXT NOT NULL CHECK(classification IN ('GENERAL','PROFITABILITY')),calculation TEXT NOT NULL,derived INTEGER NOT NULL,periodic INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS financial_settings(id TEXT PRIMARY KEY CHECK(id='default'),lookbackMonths INTEGER NOT NULL CHECK(lookbackMonths BETWEEN 1 AND 60),updatedAt TEXT NOT NULL,updatedBy TEXT REFERENCES employee(id));
CREATE TABLE IF NOT EXISTS profitability_grant(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),employeeId TEXT NOT NULL REFERENCES employee(id),startDate TEXT NOT NULL,endDate TEXT,reason TEXT NOT NULL,createdAt TEXT NOT NULL,CHECK(endDate IS NULL OR endDate>startDate));
CREATE TABLE IF NOT EXISTS financial_settings_history(id TEXT PRIMARY KEY,lookbackMonths INTEGER NOT NULL CHECK(lookbackMonths BETWEEN 1 AND 60),recordedAt TEXT NOT NULL,createdBy TEXT NOT NULL REFERENCES employee(id));
CREATE TABLE IF NOT EXISTS external_mapping(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),recordType TEXT NOT NULL CHECK(recordType IN ('CLIENT_GROUP','PARTY')),internalRecordId TEXT NOT NULL,sourceSystem TEXT NOT NULL,sourceObjectType TEXT NOT NULL,externalSourceId TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Approved','Rejected')),lastVerifiedAt TEXT NOT NULL,createdAt TEXT NOT NULL,createdBy TEXT NOT NULL REFERENCES employee(id),UNIQUE(sourceSystem,sourceObjectType,externalSourceId));
CREATE TABLE IF NOT EXISTS import_batch(id TEXT PRIMARY KEY,sourceSystem TEXT NOT NULL,status TEXT NOT NULL,startedAt TEXT NOT NULL,completedAt TEXT,createdBy TEXT NOT NULL REFERENCES employee(id),importedCount INTEGER NOT NULL DEFAULT 0,skippedCount INTEGER NOT NULL DEFAULT 0,errorCount INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS import_exception(id TEXT PRIMARY KEY,batchId TEXT NOT NULL REFERENCES import_batch(id),groupId TEXT REFERENCES client_group(id),externalSourceId TEXT NOT NULL,externalReference TEXT NOT NULL,code TEXT NOT NULL,message TEXT NOT NULL,createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS metric_observation(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),metricId TEXT NOT NULL REFERENCES metric_definition(id),serviceLineId TEXT REFERENCES service_line(id),employeeLevel TEXT, effectiveDate TEXT NOT NULL,periodStart TEXT,periodEnd TEXT,numericValue REAL NOT NULL,currency TEXT NOT NULL DEFAULT 'USD',sourceSystem TEXT NOT NULL,sourceObjectType TEXT NOT NULL,externalSourceId TEXT NOT NULL,externalReference TEXT NOT NULL,sourceRevision INTEGER NOT NULL CHECK(sourceRevision>=1),batchId TEXT NOT NULL REFERENCES import_batch(id),importedAt TEXT NOT NULL,recordedAt TEXT NOT NULL,CHECK((periodStart IS NULL AND periodEnd IS NULL) OR periodEnd>periodStart));
CREATE UNIQUE INDEX IF NOT EXISTS observation_source_identity ON metric_observation(sourceSystem,sourceObjectType,externalSourceId,metricId,IFNULL(serviceLineId,''),IFNULL(employeeLevel,''),effectiveDate,IFNULL(periodStart,''),IFNULL(periodEnd,''),sourceRevision);
CREATE INDEX IF NOT EXISTS observation_resolution ON metric_observation(groupId,metricId,serviceLineId,employeeLevel,effectiveDate,recordedAt);
CREATE TRIGGER IF NOT EXISTS observation_no_update BEFORE UPDATE ON metric_observation BEGIN SELECT RAISE(ABORT,'Imported observations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS observation_no_delete BEFORE DELETE ON metric_observation BEGIN SELECT RAISE(ABORT,'Imported observations are immutable'); END;
CREATE TABLE IF NOT EXISTS metric_override(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),metricId TEXT NOT NULL REFERENCES metric_definition(id),serviceLineId TEXT REFERENCES service_line(id),employeeLevel TEXT,effectiveDate TEXT NOT NULL,endDate TEXT,periodStart TEXT,periodEnd TEXT,numericValue REAL,action TEXT NOT NULL CHECK(action IN ('VALUE','WITHDRAW')),reason TEXT NOT NULL,createdBy TEXT NOT NULL REFERENCES employee(id),recordedAt TEXT NOT NULL,supersedesId TEXT REFERENCES metric_override(id),CHECK(endDate IS NULL OR endDate>effectiveDate),CHECK((action='VALUE' AND numericValue IS NOT NULL) OR action='WITHDRAW'));
CREATE INDEX IF NOT EXISTS override_resolution ON metric_override(groupId,metricId,serviceLineId,employeeLevel,effectiveDate,recordedAt);
CREATE TRIGGER IF NOT EXISTS override_no_update BEFORE UPDATE ON metric_override BEGIN SELECT RAISE(ABORT,'Override events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS override_no_delete BEFORE DELETE ON metric_override BEGIN SELECT RAISE(ABORT,'Override events are immutable'); END;
CREATE TABLE IF NOT EXISTS client_service_history(id TEXT PRIMARY KEY,groupId TEXT NOT NULL REFERENCES client_group(id),serviceLineId TEXT NOT NULL REFERENCES service_line(id),status TEXT NOT NULL CHECK(status IN ('Active','Inactive','Pending','Suspended')),startDate TEXT NOT NULL,endDate TEXT,teamId TEXT NOT NULL REFERENCES team(id),reason TEXT NOT NULL,source TEXT NOT NULL,recordedAt TEXT NOT NULL,createdBy TEXT NOT NULL REFERENCES employee(id),supersedesId TEXT REFERENCES client_service_history(id),CHECK(endDate IS NULL OR endDate>startDate));
CREATE TRIGGER IF NOT EXISTS service_history_no_update BEFORE UPDATE ON client_service_history BEGIN SELECT RAISE(ABORT,'Service history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS service_history_no_delete BEFORE DELETE ON client_service_history BEGIN SELECT RAISE(ABORT,'Service history is append-only'); END;
CREATE TABLE IF NOT EXISTS seed_version(name TEXT PRIMARY KEY,createdAt TEXT NOT NULL);
`);
  const cols = db.prepare("PRAGMA table_info(audit_log)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "accessClassification"))
    db.exec(
      "ALTER TABLE audit_log ADD COLUMN accessClassification TEXT NOT NULL DEFAULT 'GENERAL'",
    );
  const grantCols = db
    .prepare("PRAGMA table_info(profitability_grant)")
    .all() as { name: string }[];
  if (!grantCols.some((c) => c.name === "revokedAt"))
    db.exec("ALTER TABLE profitability_grant ADD COLUMN revokedAt TEXT");
  const stamp = new Date().toISOString();
  for (const m of metricDefinitions)
    db.prepare(
      "INSERT OR IGNORE INTO metric_definition(id,code,name,unit,dimensions,aggregation,classification,calculation,derived,periodic) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      m.id,
      m.code,
      m.name,
      m.unit,
      m.dimensions,
      m.aggregation,
      m.classification,
      m.calculation,
      m.derived,
      m.periodic,
    );
  for (const [code, name] of [
    ["TAX", "Tax"],
    ["FAMILY_OFFICE", "Family Office"],
    ["BOS", "BOS"],
    ["OTHER", "Other"],
  ])
    db.prepare(
      "INSERT OR IGNORE INTO service_line(id,code,name,active,createdAt,updatedAt) VALUES(?,?,?,1,?,?)",
    ).run(financialId(`service-${code}`), code, name, stamp, stamp);
  db.prepare(
    "INSERT OR IGNORE INTO financial_settings(id,lookbackMonths,updatedAt,updatedBy) VALUES('default',12,?,NULL)",
  ).run(stamp);
}
