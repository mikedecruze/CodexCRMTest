import {
  authenticated,
  boolean,
  date,
  entity,
  text,
  uuid,
} from "@microsoft/rayfin-core";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ServiceTeam {
  @uuid() id!: string;
  @text({ max: 1000, optional: false }) teamName!: string;
  @text({ max: 2000, optional: true }) description?: string;
  @boolean({ optional: false }) activeStatus!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
