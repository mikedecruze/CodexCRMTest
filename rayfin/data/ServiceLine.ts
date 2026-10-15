import {
  authenticated,
  boolean,
  date,
  entity,
  text,
  uuid,
} from "@microsoft/rayfin-core";

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ServiceLine {
  @uuid() id!: string;
  @text({ max: 2000, optional: false }) code!: string;
  @text({ max: 2000, optional: false }) displayName!: string;
  @boolean({ optional: false }) active!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
