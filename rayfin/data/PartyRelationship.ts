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
export class PartyRelationship {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) source_id!: string;
  @one(() => Party, { optional: false }) source!: Party;
  @uuid({ optional: false }) target_id!: string;
  @one(() => Party, { optional: false }) target!: Party;
  @uuid({ optional: false }) relationshipType_id!: string;
  @one(() => ReferenceType, { optional: false })
  relationshipType!: ReferenceType;
  @decimal({ optional: true }) ownershipPercentage?: number;
  @decimal({ optional: true }) votingPercentage?: number;
  @decimal({ optional: true }) economicPercentage?: number;
  @text({ max: 1000, optional: true }) ownershipClass?: string;
  @text({ max: 2000, optional: true }) notes?: string;
  @text({ max: 1000, optional: true }) sourceDocumentReference?: string;
  @date() effectiveStartDate!: Date;
  @date({ optional: true }) effectiveEndDate?: Date;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
