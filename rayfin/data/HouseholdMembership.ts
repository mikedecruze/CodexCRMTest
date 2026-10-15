import {
  authenticated,
  boolean,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { Household } from "./Household.js";
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
export class HouseholdMembership {
  @uuid() id!: string;
  @uuid({ optional: false }) household_id!: string;
  @one(() => Household, { optional: false }) household!: Household;
  @uuid({ optional: false }) person_id!: string;
  @one(() => Party, { optional: false }) person!: Party;
  @text({ max: 1000, optional: false }) relationshipToHousehold!: string;
  @boolean({ optional: false }) isPrimary!: boolean;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
