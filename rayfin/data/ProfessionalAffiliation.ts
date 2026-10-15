import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { Party } from "./Party.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ProfessionalAffiliation {
  @uuid() id!: string;
  @uuid({ optional: false }) person_id!: string;
  @one(() => Party, { optional: false }) person!: Party;
  @uuid({ optional: false }) organization_id!: string;
  @one(() => Party, { optional: false }) organization!: Party;
  @text({ max: 1000, optional: false }) position!: string;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
