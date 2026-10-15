import {
  authenticated,
  boolean,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
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
export class ClientGroupParty {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) party_id!: string;
  @one(() => Party, { optional: false }) party!: Party;
  @text({ max: 1000, optional: false }) associationType!: string;
  @boolean({ optional: false }) billableCustomer!: boolean;
  @text({ max: 2000, optional: true }) privateGroupNotes?: string;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
