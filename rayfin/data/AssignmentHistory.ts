import { authenticated, date, entity, one, uuid } from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { Employee } from "./Employee.js";
import { ServiceTeam } from "./ServiceTeam.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class AssignmentHistory {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) partner_id!: string;
  @one(() => Employee, { optional: false }) partner!: Employee;
  @uuid({ optional: false }) manager_id!: string;
  @one(() => Employee, { optional: false }) manager!: Employee;
  @uuid({ optional: false }) team_id!: string;
  @one(() => ServiceTeam, { optional: false }) team!: ServiceTeam;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
