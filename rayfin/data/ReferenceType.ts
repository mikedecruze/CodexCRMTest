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
export class ReferenceType {
  @uuid() id!: string;
  @text({ max: 1000, optional: false }) category!: string;
  @text({ max: 1000, optional: false }) code!: string;
  @text({ max: 1000, optional: false }) displayName!: string;
  @boolean({ optional: false }) symmetric!: boolean;
  @boolean({ optional: false }) ownership!: boolean;
  @boolean({ optional: false }) active!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
