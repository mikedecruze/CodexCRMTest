import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
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
export class LegalEntityProfile {
  @uuid() id!: string;
  @uuid({ optional: false }) party_id!: string;
  @one(() => Party, { optional: false }) party!: Party;
  @text({ max: 1000, optional: false }) legalName!: string;
  @uuid({ optional: false }) entityType_id!: string;
  @one(() => ReferenceType, { optional: false }) entityType!: ReferenceType;
  @text({ max: 1000, optional: true }) jurisdiction?: string;
  @date({ optional: true }) formationDate?: Date;
  @text({ max: 1000, optional: true }) taxClassification?: string;
  @text({ max: 2000, optional: true }) description?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
