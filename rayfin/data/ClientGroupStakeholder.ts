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
import { ReferenceType } from "./ReferenceType.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ClientGroupStakeholder {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) advisor_id!: string;
  @one(() => Party, { optional: false }) advisor!: Party;
  @uuid({ optional: false }) stakeholderType_id!: string;
  @one(() => ReferenceType, { optional: false })
  stakeholderType!: ReferenceType;
  @text({ max: 1000, optional: true }) scopeDescription?: string;
  @text({ max: 2000, optional: true }) privateGroupNotes?: string;
  @boolean({ optional: false }) primaryAdvisor!: boolean;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
