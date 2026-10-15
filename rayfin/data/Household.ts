import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class Household {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @text({ max: 1000, optional: false }) householdName!: string;
  @text({ max: 2000, optional: true }) description?: string;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
