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
export class AdvisorOrganizationProfile {
  @uuid() id!: string;
  @uuid({ optional: false }) party_id!: string;
  @one(() => Party, { optional: false }) party!: Party;
  @text({ max: 1000, optional: true }) organizationType?: string;
  @text({ max: 1000, optional: true }) website?: string;
  @text({ max: 1000, optional: true }) email?: string;
  @text({ max: 1000, optional: true }) phone?: string;
  @text({ max: 1000, optional: true }) address?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
