import {
  authenticated,
  date,
  decimal,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { Employee } from "./Employee.js";
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
export class MetricOverride {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) metric_id!: string;
  @one(() => MetricDefinition, { optional: false }) metric!: MetricDefinition;
  @uuid({ optional: true }) serviceLine_id?: string;
  @one(() => ServiceLine, { optional: true }) serviceLine?: ServiceLine;
  @text({ max: 2000, optional: true }) employeeLevel?: string;
  @date({ optional: false }) effectiveDate!: Date;
  @date({ optional: true }) endDate?: Date;
  @date({ optional: true }) periodStart?: Date;
  @date({ optional: true }) periodEnd?: Date;
  @decimal({ optional: true }) numericValue?: number;
  @text({ max: 2000, optional: false }) action!: string;
  @text({ max: 2000, optional: false }) reason!: string;
  @uuid({ optional: false }) createdBy_id!: string;
  @one(() => Employee, { optional: false }) createdBy!: Employee;
  @date({ optional: false }) recordedAt!: Date;
  @uuid({ optional: true }) supersedesId?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
