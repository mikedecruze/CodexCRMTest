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
export class Employee {
  @uuid() id!: string;
  @text({ max: 1000, optional: false }) subject!: string;
  @text({ max: 1000, optional: false }) displayName!: string;
  @text({ max: 1000, optional: false }) email!: string;
  @text({ max: 1000, optional: false }) employeeLevel!: string;
  @text({ max: 1000, optional: false }) applicationRole!: string;
  @boolean({ optional: false }) activeStatus!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
