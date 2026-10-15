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

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ProfitabilityGrant {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) employee_id!: string;
  @one(() => Employee, { optional: false }) employee!: Employee;
  @date({ optional: false }) effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @text({ max: 2000, optional: false }) reason!: string;
  @date({ optional: true }) revokedAt?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
