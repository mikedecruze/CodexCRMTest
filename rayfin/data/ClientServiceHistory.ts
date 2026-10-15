import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { Employee } from "./Employee.js";
import { ServiceLine } from "./ServiceLine.js";
import { ServiceTeam } from "./ServiceTeam.js";

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ClientServiceHistory {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) serviceLine_id!: string;
  @one(() => ServiceLine, { optional: false }) serviceLine!: ServiceLine;
  @text({ max: 2000, optional: false }) status!: string;
  @date({ optional: false }) effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @uuid({ optional: false }) team_id!: string;
  @one(() => ServiceTeam, { optional: false }) team!: ServiceTeam;
  @text({ max: 2000, optional: false }) reason!: string;
  @text({ max: 2000, optional: false }) source!: string;
  @date({ optional: false }) recordedAt!: Date;
  @uuid({ optional: false }) createdBy_id!: string;
  @one(() => Employee, { optional: false }) createdBy!: Employee;
  @uuid({ optional: true }) supersedesId?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
