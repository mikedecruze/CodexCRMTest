import {
  authenticated,
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
export class PersonProfile {
  @uuid() id!: string;
  @uuid({ optional: false }) party_id!: string;
  @one(() => Party, { optional: false }) party!: Party;
  @uuid({ optional: true }) primaryGroup_id?: string;
  @one(() => ClientGroup, { optional: true }) primaryGroup?: ClientGroup;
  @text({ max: 1000, optional: false }) firstName!: string;
  @text({ max: 1000, optional: false }) lastName!: string;
  @text({ max: 1000, optional: true }) preferredName?: string;
  @date({ optional: true }) birthDate?: Date;
  @date({ optional: true }) deceasedDate?: Date;
  @text({ max: 1000, optional: true }) email?: string;
  @text({ max: 1000, optional: true }) phone?: string;
  @text({ max: 1000, optional: true }) occupation?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
