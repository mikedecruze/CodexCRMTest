import {
  authenticated,
  date,
  decimal,
  entity,
  int,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { ImportBatch } from "./ImportBatch.js";
import { MetricDefinition } from "./MetricDefinition.js";
import { ServiceLine } from "./ServiceLine.js";

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class MetricObservation {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) metric_id!: string;
  @one(() => MetricDefinition, { optional: false }) metric!: MetricDefinition;
  @uuid({ optional: true }) serviceLine_id?: string;
  @one(() => ServiceLine, { optional: true }) serviceLine?: ServiceLine;
  @text({ max: 2000, optional: true }) employeeLevel?: string;
  @date({ optional: false }) effectiveDate!: Date;
  @date({ optional: true }) periodStart?: Date;
  @date({ optional: true }) periodEnd?: Date;
  @decimal({ optional: false }) numericValue!: number;
  @text({ max: 2000, optional: false }) currency!: string;
  @text({ max: 2000, optional: false }) sourceSystem!: string;
  @text({ max: 2000, optional: false }) sourceObjectType!: string;
  @text({ max: 2000, optional: false }) externalSourceId!: string;
  @text({ max: 2000, optional: false }) externalReference!: string;
  @int({ optional: false }) sourceRevision!: number;
  @uuid({ optional: false }) batch_id!: string;
  @one(() => ImportBatch, { optional: false }) batch!: ImportBatch;
  @date({ optional: false }) importedAt!: Date;
  @date({ optional: false }) recordedAt!: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
