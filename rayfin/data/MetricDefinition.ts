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
export class MetricDefinition {
  @uuid() id!: string;
  @text({ max: 2000, optional: false }) code!: string;
  @text({ max: 2000, optional: false }) displayName!: string;
  @text({ max: 2000, optional: false }) unit!: string;
  @text({ max: 2000, optional: false }) requiredDimensions!: string;
  @text({ max: 2000, optional: false }) aggregationMethod!: string;
  @text({ max: 2000, optional: false }) accessClassification!: string;
  @text({ max: 2000, optional: false }) calculationMethod!: string;
  @boolean({ optional: false }) isDerived!: boolean;
  @boolean({ optional: false }) periodic!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
