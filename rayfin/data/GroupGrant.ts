import {
  authenticated,
  boolean,
  date,
  entity,
  one,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { Employee } from "./Employee.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class GroupGrant {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) employee_id!: string;
  @one(() => Employee, { optional: false }) employee!: Employee;
  @boolean({ optional: false }) canEdit!: boolean;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
